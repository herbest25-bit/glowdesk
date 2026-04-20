import baileysPkg from '@whiskeysockets/baileys'
const { default: makeWASocket, DisconnectReason, initAuthCreds, BufferJSON, downloadMediaMessage } = baileysPkg
import qrcode from 'qrcode'
import { db } from '../utils/db.js'
import { getIO } from './realtime.js'

const sessions = new Map() // channelId → { sock, connected, sendMessage, sendMedia }
const connectedSessions = new Set() // só sessões realmente abertas

const logger = {
  level: 'silent',
  trace: () => {}, debug: () => {}, info: () => {},
  warn: () => {}, error: () => {}, fatal: () => {},
  child: function() { return this }
}

// ─── Auth state persistido no banco ──────────────────────────────────────────
async function makeDBAuthState(channelId) {
  const row = await db.query(
    'SELECT session_data FROM channel_sessions WHERE session_id = $1',
    [`baileys-${channelId}`]
  )

  let creds = initAuthCreds()
  let keys = {}

  if (row.rows.length > 0 && row.rows[0].session_data) {
    try {
      const parsed = JSON.parse(row.rows[0].session_data, BufferJSON.reviver)
      if (parsed.creds) creds = parsed.creds
      if (parsed.keys) keys = parsed.keys
    } catch (e) {
      console.error('[Baileys] Erro ao carregar auth state:', e.message)
    }
  }

  const saveCreds = async () => {
    const data = JSON.stringify({ creds, keys }, BufferJSON.replacer)
    await db.query(
      `INSERT INTO channel_sessions (session_id, session_data, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (session_id) DO UPDATE SET session_data = $2, updated_at = NOW()`,
      [`baileys-${channelId}`, data]
    )
  }

  return {
    state: {
      creds,
      keys: {
        get: (type, ids) => {
          const data = {}
          for (const id of ids) {
            const value = keys[`${type}-${id}`]
            if (value) data[id] = value
          }
          return data
        },
        set: (data) => {
          for (const category in data) {
            for (const id in data[category]) {
              const value = data[category][id]
              if (value) keys[`${category}-${id}`] = value
              else delete keys[`${category}-${id}`]
            }
          }
          saveCreds().catch(e => console.error('[Baileys] Erro ao salvar keys:', e.message))
        }
      }
    },
    saveCreds
  }
}

// ─── Inicializar canais ao subir o servidor ───────────────────────────────────
export async function initChannels() {
  try {
    const result = await db.query(
      `SELECT id, workspace_id, name FROM channels WHERE status = 'connected'`
    )
    for (const channel of result.rows) {
      console.log(`[Channels] Reconectando canal: ${channel.name}`)
      await startSession(channel.id, channel.workspace_id).catch(e =>
        console.error(`[Channels] Erro ao reconectar ${channel.name}:`, e.message)
      )
    }
  } catch (e) {
    console.error('[Channels] Erro ao inicializar canais:', e.message)
  }
}

// ─── Iniciar sessão Baileys ───────────────────────────────────────────────────
export async function startSession(channelId, workspaceId) {
  if (sessions.has(channelId)) {
    const existing = sessions.get(channelId)
    try { existing.sock?.end(undefined) } catch (_) {}
    sessions.delete(channelId)
  }

  const { state, saveCreds } = await makeDBAuthState(channelId)

  const sock = makeWASocket({
    auth: state,
    logger,
    browser: ['GlowDesk', 'Chrome', '1.0'],
    printQRInTerminal: false,
    connectTimeoutMs: 60_000,
    defaultQueryTimeoutMs: 60_000,
    retryRequestDelayMs: 2000,
    maxMsgRetryCount: 3
  })

  // Wrapper com mesma interface do whatsapp-web.js
  const session = {
    sock,
    async sendMessage(jid, content) {
      // Converter @c.us → @s.whatsapp.net (formato Baileys para individuais)
      const baileysJid = jid.replace('@c.us', '@s.whatsapp.net')
      await sock.sendMessage(baileysJid, { text: content })
    },
    async sendMedia(jid, base64, mimetype, filename) {
      const baileysJid = jid.replace('@c.us', '@s.whatsapp.net')
      const buffer = Buffer.from(base64, 'base64')
      const type = mimetype.startsWith('image/') ? 'image'
                 : mimetype.startsWith('video/') ? 'video'
                 : mimetype.startsWith('audio/') ? 'audio'
                 : 'document'
      const payload = { [type]: buffer, mimetype }
      if (type === 'document') payload.fileName = filename || 'arquivo'
      await sock.sendMessage(baileysJid, payload)
    }
  }

  sessions.set(channelId, session)

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
    // QR code gerado
    if (qr) {
      try {
        const qrDataUrl = await qrcode.toDataURL(qr)
        const io = getIO()
        if (io) io.to(`workspace:${workspaceId}`).emit('channel_qrcode', { channelId, qrcode: qrDataUrl })
        await db.query(`UPDATE channels SET status = 'connecting', updated_at = NOW() WHERE id = $1`, [channelId])
      } catch (e) {
        console.error('[Channels] Erro ao gerar QR:', e.message)
      }
    }

    // Conectado
    if (connection === 'open') {
      connectedSessions.add(channelId)
      try {
        const phone = sock.user?.id?.split('@')[0]?.split(':')[0] || null
        await db.query(
          `UPDATE channels SET status = 'connected', phone_number = $1, connected_at = NOW(), updated_at = NOW() WHERE id = $2`,
          [phone, channelId]
        )
        await saveCreds()
        const io = getIO()
        if (io) io.to(`workspace:${workspaceId}`).emit('channel_connected', { channelId, phone })
        console.log(`[Channels] Canal conectado: ${channelId} → ${phone}`)
      } catch (e) {
        console.error('[Channels] Erro ao salvar conexão:', e.message)
      }
    }

    // Desconectado
    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode
      const loggedOut = code === DisconnectReason.loggedOut
      console.log(`[Channels] Desconectado: ${channelId}, code: ${code}, loggedOut: ${loggedOut}`)

      connectedSessions.delete(channelId)
      sessions.delete(channelId)

      if (loggedOut) {
        await db.query(`UPDATE channels SET status = 'disconnected', updated_at = NOW() WHERE id = $1`, [channelId])
        await db.query(`DELETE FROM channel_sessions WHERE session_id = $1`, [`baileys-${channelId}`])
        const io = getIO()
        if (io) io.to(`workspace:${workspaceId}`).emit('channel_disconnected', { channelId })
      } else {
        // Reconectar automaticamente após 5s
        setTimeout(() => {
          startSession(channelId, workspaceId).catch(e =>
            console.error('[Channels] Erro ao reconectar:', e.message)
          )
        }, 5000)
      }
    }
  })

  // ─── Receber mensagens ────────────────────────────────────────────────────
  sock.ev.on('messages.upsert', async ({ messages: msgs, type }) => {
    if (type !== 'notify') return

    for (const msg of msgs) {
      try {
        if (msg.key.fromMe) continue
        const jid = msg.key.remoteJid || ''
        if (jid.includes('status') || jid === '') continue

        const isGroup = jid.endsWith('@g.us')
        const phone = jid.replace('@g.us', '').replace('@s.whatsapp.net', '').replace('@c.us', '')
        if (!phone) continue

        let contactName = msg.pushName || null
        if (isGroup) {
          try {
            const meta = await sock.groupMetadata(jid)
            contactName = meta.subject || phone
          } catch (_) { contactName = phone }
        }

        console.log(`[Channels] ✉️ ${isGroup ? 'Grupo' : 'Contato'} ${phone}: "${msg.message?.conversation?.substring(0, 80) || '[mídia]'}"`)

        // 1. Upsert contato
        const contactResult = await db.query(
          `INSERT INTO contacts (workspace_id, phone, name, is_group)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (workspace_id, phone)
           DO UPDATE SET name = COALESCE($3, contacts.name), is_group = $4, updated_at = NOW()
           RETURNING *`,
          [workspaceId, phone, contactName, isGroup]
        )
        const contact = contactResult.rows[0]

        // 2. Upsert conversa
        let convResult = await db.query(
          `SELECT * FROM conversations WHERE workspace_id = $1 AND contact_id = $2 AND status != 'resolved' ORDER BY created_at DESC LIMIT 1`,
          [workspaceId, contact.id]
        )
        let conversation
        if (!convResult.rows.length) {
          const newConv = await db.query(
            `INSERT INTO conversations (workspace_id, contact_id, channel_id, status, ai_mode, whatsapp_number_id)
             VALUES ($1, $2, $3, 'open', true, NULL) RETURNING *`,
            [workspaceId, contact.id, channelId]
          )
          conversation = newConv.rows[0]
        } else {
          conversation = convResult.rows[0]
        }

        // 3. Conteúdo da mensagem
        const body = msg.message?.conversation
          || msg.message?.extendedTextMessage?.text
          || msg.message?.imageMessage?.caption
          || msg.message?.videoMessage?.caption
          || null

        let contentType = 'text'
        let mediaUrl = null
        const m = msg.message || {}

        if (m.imageMessage || m.videoMessage || m.audioMessage || m.pttMessage || m.documentMessage || m.stickerMessage) {
          if (m.imageMessage)    contentType = 'image'
          else if (m.videoMessage)    contentType = 'video'
          else if (m.audioMessage || m.pttMessage) contentType = 'audio'
          else if (m.documentMessage) contentType = 'document'
          else if (m.stickerMessage)  contentType = 'sticker'

          try {
            const buffer = await downloadMediaMessage(msg, 'buffer', {})
            const mime = m.imageMessage?.mimetype || m.videoMessage?.mimetype || m.audioMessage?.mimetype || m.pttMessage?.mimetype || m.documentMessage?.mimetype || 'application/octet-stream'
            mediaUrl = `data:${mime};base64,${buffer.toString('base64')}`
          } catch (e) {
            console.error('[Channels] Erro ao baixar mídia:', e.message)
          }
        }

        // 4. Salvar mensagem
        const savedMsg = await db.query(
          `INSERT INTO messages (conversation_id, whatsapp_message_id, direction, sender_type, content, content_type, media_url)
           VALUES ($1, $2, 'inbound', 'contact', $3, $4, $5) RETURNING *`,
          [conversation.id, msg.key.id || null, body, contentType, mediaUrl]
        )

        // 5. Atualizar conversa
        await db.query(
          `UPDATE conversations SET last_message = $1, last_message_at = NOW(), unread_count = unread_count + 1, updated_at = NOW() WHERE id = $2`,
          [body || '[mídia]', conversation.id]
        )

        // 6. Emitir realtime
        const io = getIO()
        if (io) {
          io.to(`workspace:${workspaceId}`).emit('new_message', {
            conversationId: conversation.id,
            message: savedMsg.rows[0],
            contact
          })
        }

        // 7. Criar deal se não existir
        try {
          const existing = await db.query(
            `SELECT id FROM deals WHERE contact_id = $1 AND workspace_id = $2 AND status = 'open' LIMIT 1`,
            [contact.id, workspaceId]
          )
          if (!existing.rows.length) {
            const pipeline = await db.query(
              `SELECT p.id, ps.id as first_stage_id FROM pipelines p
               JOIN pipeline_stages ps ON ps.pipeline_id = p.id
               WHERE p.workspace_id = $1 AND p.is_default = true
               ORDER BY ps.position ASC LIMIT 1`,
              [workspaceId]
            )
            if (pipeline.rows.length > 0) {
              const { id: pipelineId, first_stage_id } = pipeline.rows[0]
              await db.query(
                `INSERT INTO deals (workspace_id, contact_id, pipeline_id, stage_id, title, value, status)
                 VALUES ($1, $2, $3, $4, $5, 0, 'open')`,
                [workspaceId, contact.id, pipelineId, first_stage_id, `Conversa com ${contact.name || contact.phone}`]
              )
            }
          }
        } catch (e) {
          console.error('[Pipeline] Erro ao criar deal:', e.message)
        }
      } catch (e) {
        console.error('[Channels] Erro ao processar mensagem:', e.message)
      }
    }
  })

  return session
}

// ─── Destruir sessão ──────────────────────────────────────────────────────────
export async function destroySession(channelId) {
  const session = sessions.get(channelId)
  if (session) {
    try { session.sock?.end(undefined) } catch (_) {}
    sessions.delete(channelId)
  }
}

// ─── Obter sessão ─────────────────────────────────────────────────────────────
export function getSession(channelId) {
  return sessions.get(channelId) || null
}

// ─── Listar sessões ativas (somente conectadas) ───────────────────────────────
export function getSessions() {
  return Array.from(connectedSessions)
}
