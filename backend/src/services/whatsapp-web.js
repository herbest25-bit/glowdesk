import { createRequire } from 'module'
import qrcode from 'qrcode'
import { db } from '../utils/db.js'
import { getIO } from './realtime.js'
import { processMessage } from '../agents/sales-agent.js'

const require = createRequire(import.meta.url)
const Baileys = require('@whiskeysockets/baileys')

const makeWASocket           = Baileys.makeWASocket || Baileys.default?.makeWASocket || Baileys.default
const DisconnectReason       = Baileys.DisconnectReason   || Baileys.default?.DisconnectReason
const initAuthCreds          = Baileys.initAuthCreds      || Baileys.default?.initAuthCreds
const BufferJSON             = Baileys.BufferJSON          || Baileys.default?.BufferJSON
const downloadMediaMessage   = Baileys.downloadMediaMessage || Baileys.default?.downloadMediaMessage
const fetchLatestBaileysVersion = Baileys.fetchLatestBaileysVersion || Baileys.default?.fetchLatestBaileysVersion
const Browsers               = Baileys.Browsers || Baileys.default?.Browsers

console.log('[Baileys] makeWASocket:', typeof makeWASocket, '| fetchLatestVersion:', typeof fetchLatestBaileysVersion)

// ─── Estado em memória ────────────────────────────────────────────────────────
const sessions    = new Map()   // channelId → session object
const connected   = new Set()   // channelId de sessões abertas
const pendingQR   = new Map()   // channelId → qrDataUrl

const logger = {
  level: 'error',
  trace:()=>{}, debug:()=>{}, info:()=>{}, warn:()=>{},
  error:(obj, msg) => console.error('[Baileys]', msg || obj?.message || obj),
  fatal:(obj, msg) => console.error('[Baileys FATAL]', msg || obj?.message || obj),
  child() { return this }
}

// ─── Auth persistida no banco ─────────────────────────────────────────────────
async function loadAuth(channelId) {
  const row = await db.query(
    'SELECT session_data FROM channel_sessions WHERE session_id = $1',
    [`wab-${channelId}`]
  )
  let creds = initAuthCreds()
  let keys  = {}
  if (row.rows[0]?.session_data) {
    try {
      const p = JSON.parse(row.rows[0].session_data, BufferJSON.reviver)
      if (p.creds) creds = p.creds
      if (p.keys)  keys  = p.keys
    } catch {}
  }
  const save = async () => {
    const data = JSON.stringify({ creds, keys }, BufferJSON.replacer)
    await db.query(
      `INSERT INTO channel_sessions (session_id, session_data, updated_at)
       VALUES ($1,$2,NOW())
       ON CONFLICT (session_id) DO UPDATE SET session_data=$2, updated_at=NOW()`,
      [`wab-${channelId}`, data]
    )
  }
  return {
    state: {
      creds,
      keys: {
        get: (type, ids) => {
          const out = {}
          for (const id of ids) { const v = keys[`${type}-${id}`]; if (v) out[id] = v }
          return out
        },
        set: (data) => {
          for (const cat in data)
            for (const id in data[cat]) {
              const v = data[cat][id]
              if (v) keys[`${cat}-${id}`] = v
              else   delete keys[`${cat}-${id}`]
            }
          save().catch(e => console.error('[WA] save keys error:', e.message))
        }
      }
    },
    save
  }
}

// ─── Inicializar todos os canais salvos ───────────────────────────────────────
export async function initChannels() {
  try {
    const { rows } = await db.query(
      `SELECT id, workspace_id, name FROM channels WHERE status IN ('connected','connecting')`
    )
    for (const ch of rows) {
      const auth = await db.query(
        `SELECT session_id FROM channel_sessions WHERE session_id = $1`,
        [`wab-${ch.id}`]
      )
      if (!auth.rows.length) {
        await db.query(`UPDATE channels SET status='disconnected', updated_at=NOW() WHERE id=$1`, [ch.id])
        console.log(`[WA] ${ch.name}: sem credenciais, aguardando QR`)
        continue
      }
      console.log(`[WA] Reconectando: ${ch.name}`)
      startSession(ch.id, ch.workspace_id).catch(e =>
        console.error(`[WA] Erro ao reconectar ${ch.name}:`, e.message)
      )
    }
  } catch (e) {
    console.error('[WA] initChannels error:', e.message)
  }
}

// ─── Iniciar/reconectar sessão ────────────────────────────────────────────────
export async function startSession(channelId, workspaceId) {
  // Fechar sessão anterior se existir
  if (sessions.has(channelId)) {
    try { sessions.get(channelId).sock?.end(undefined) } catch {}
    sessions.delete(channelId)
    connected.delete(channelId)
  }

  const { state, save } = await loadAuth(channelId)
  const token = Symbol()

  // Buscar versão atual do WhatsApp Web (evita code=405 por versão desatualizada)
  let waVersion = [2, 3000, 1015920988]
  try {
    if (fetchLatestBaileysVersion) {
      const { version } = await fetchLatestBaileysVersion()
      waVersion = version
      console.log(`[WA] versão WA obtida: ${version.join('.')}`)
    }
  } catch (e) {
    console.log('[WA] fetchLatestBaileysVersion falhou, usando versão padrão:', e.message)
  }

  console.log(`[WA] makeWASocket iniciando canal=${channelId}`)
  const sock = makeWASocket({
    version: waVersion,
    auth: state,
    logger,
    browser: Browsers?.ubuntu('Chrome') || ['Ubuntu', 'Chrome', '22.1.0'],
    printQRInTerminal: true,
    connectTimeoutMs: 120_000,
    defaultQueryTimeoutMs: 120_000,
    retryRequestDelayMs: 2_000,
    maxMsgRetryCount: 3,
  })
  console.log(`[WA] makeWASocket criado, aguardando eventos canal=${channelId}`)

  const session = {
    sock, token,
    async sendMessage(jid, text) {
      const phone = jid.split('@')[0]
      const suffix = jid.endsWith('@g.us') ? '@g.us' : '@s.whatsapp.net'
      const normalJid = `${phone}${suffix}`
      console.log(`[WA] sendMessage → ${normalJid} | text: "${String(text).substring(0, 40)}"`)
      const result = await sock.sendMessage(normalJid, { text: String(text) })
      return result?.key?.id || null
    },
    async sendMedia(jid, base64, mimetype, filename) {
      const phone  = jid.split('@')[0]
      const suffix = jid.endsWith('@g.us') ? '@g.us' : '@s.whatsapp.net'
      const j      = `${phone}${suffix}`
      const buf    = Buffer.from(base64, 'base64')
      const type = mimetype.startsWith('image/') ? 'image'
                 : mimetype.startsWith('video/') ? 'video'
                 : mimetype.startsWith('audio/') ? 'audio'
                 : 'document'
      const payload = { [type]: buf, mimetype }
      if (type === 'document') payload.fileName = filename || 'arquivo'
      const result = await sock.sendMessage(j, payload)
      return result?.key?.id || null
    }
  }

  sessions.set(channelId, session)
  sock.ev.on('creds.update', save)

  sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
    console.log(`[WA] connection.update canal=${channelId} connection=${connection} hasQR=${!!qr}`)
    if (sessions.get(channelId)?.token !== token) return // sessão obsoleta

    if (qr) {
      try {
        const img = await qrcode.toDataURL(qr)
        pendingQR.set(channelId, img)
        const io = getIO()
        if (io) io.to(`workspace:${workspaceId}`).emit('channel_qrcode', { channelId, qrcode: img })
        await db.query(`UPDATE channels SET status='connecting', updated_at=NOW() WHERE id=$1`, [channelId])
        console.log(`[WA] QR gerado para canal ${channelId}`)
      } catch (e) { console.error('[WA] QR error:', e.message) }
    }

    if (connection === 'open') {
      connected.add(channelId)
      pendingQR.delete(channelId)
      try {
        const phone = sock.user?.id?.split('@')[0]?.split(':')[0] || null
        await db.query(
          `UPDATE channels SET status='connected', phone_number=$1, connected_at=NOW(), updated_at=NOW() WHERE id=$2`,
          [phone, channelId]
        )
        await save()
        const io = getIO()
        if (io) io.to(`workspace:${workspaceId}`).emit('channel_connected', { channelId, phone })
        console.log(`[WA] Conectado: ${channelId} → +${phone}`)
      } catch (e) { console.error('[WA] open error:', e.message) }
    }

    if (connection === 'close') {
      connected.delete(channelId)
      sessions.delete(channelId)

      const code      = lastDisconnect?.error?.output?.statusCode
      const loggedOut = code === DisconnectReason.loggedOut
      console.log(`[WA] Fechou: ${channelId} code=${code} logout=${loggedOut}`)

      if (loggedOut) {
        await db.query(`UPDATE channels SET status='disconnected', updated_at=NOW() WHERE id=$1`, [channelId])
        await db.query(`DELETE FROM channel_sessions WHERE session_id=$1`, [`wab-${channelId}`])
        const io = getIO()
        if (io) io.to(`workspace:${workspaceId}`).emit('channel_disconnected', { channelId })
      } else {
        // Reconexão automática — igual ao WhatsApp Web real
        const delay = code === 408 ? 10_000 : 5_000
        setTimeout(() => {
          if (!sessions.has(channelId)) {
            console.log(`[WA] Reconectando ${channelId} automaticamente...`)
            startSession(channelId, workspaceId).catch(e =>
              console.error('[WA] auto-reconect error:', e.message)
            )
          }
        }, delay)
      }
    }
  })

  // ─── Receber mensagens ────────────────────────────────────────────────────
  sock.ev.on('messages.upsert', async ({ messages: msgs, type }) => {
    if (type !== 'notify') return
    for (const msg of msgs) {
      try {
        const jid = msg.key.remoteJid || ''
        if (!jid || jid.includes('status@broadcast')) continue

        const isGroup = jid.endsWith('@g.us') || jid.endsWith('@newsletter') || jid.includes('@broadcast')
        if (isGroup) continue  // ignorar grupos, newsletters e broadcasts

        // Mensagens enviadas pelo próprio WhatsApp (fromMe): salvar como outbound
        if (msg.key.fromMe) {
          const msgId = msg.key.id
          if (!msgId) continue
          // Verificar duplicata (mensagem já salva pelo GlowDesk ou echo anterior)
          const dup = await db.query(`SELECT id FROM messages WHERE whatsapp_message_id = $1 LIMIT 1`, [msgId])
          if (dup.rows.length) continue
          // Normalizar phone — remover qualquer sufixo @xxx
          const rawPhone = jid.split('@')[0]
          if (!rawPhone) continue
          // Buscar contato por phone exato ou por phone sem sufixo
          const contactRes = await db.query(
            `SELECT * FROM contacts WHERE workspace_id=$1 AND (phone=$2 OR phone=$3) LIMIT 1`,
            [workspaceId, jid, rawPhone]
          )
          if (!contactRes.rows.length) continue
          const contact = contactRes.rows[0]
          const convRes = await db.query(
            `SELECT * FROM conversations WHERE workspace_id=$1 AND contact_id=$2 AND status!='resolved' ORDER BY created_at DESC LIMIT 1`,
            [workspaceId, contact.id]
          )
          if (!convRes.rows.length) continue
          const conv = convRes.rows[0]
          const m = msg.message || {}
          const body = m.conversation || m.extendedTextMessage?.text || m.imageMessage?.caption || m.videoMessage?.caption || null
          const { rows: [saved] } = await db.query(
            `INSERT INTO messages (conversation_id, whatsapp_message_id, direction, sender_type, content, content_type)
             VALUES ($1,$2,'outbound','agent',$3,'text') RETURNING *`,
            [conv.id, msgId, body]
          )
          if (saved) {
            await db.query(
              `UPDATE conversations SET last_message=$1, last_message_at=NOW(), updated_at=NOW() WHERE id=$2`,
              [body || '[mídia]', conv.id]
            )
            const io = getIO()
            if (io) io.to(`workspace:${workspaceId}`).emit('new_message', {
              conversationId: conv.id, message: saved, contact
            })
            console.log(`[WA] fromMe salvo: ${rawPhone} → "${String(body).substring(0,40)}"`)
          }
          continue
        }

        const phone   = jid.split('@')[0]
        if (!phone) continue

        let contactName = msg.pushName || null
        if (isGroup) {
          try { contactName = (await sock.groupMetadata(jid)).subject } catch { contactName = phone }
        }

        console.log(`[WA] ✉️ ${phone}: "${msg.message?.conversation?.substring(0,60) || '[mídia]'}"`)

        // 1. Upsert contato
        const { rows: [contact] } = await db.query(
          `INSERT INTO contacts (workspace_id, phone, name, is_group)
           VALUES ($1,$2,$3,$4)
           ON CONFLICT (workspace_id, phone)
           DO UPDATE SET name=COALESCE($3,contacts.name), is_group=$4, updated_at=NOW()
           RETURNING *`,
          [workspaceId, phone, contactName, isGroup]
        )

        // 2. Upsert conversa
        let conversation
        const existing = await db.query(
          `SELECT * FROM conversations WHERE workspace_id=$1 AND contact_id=$2 AND status!='resolved' ORDER BY created_at DESC LIMIT 1`,
          [workspaceId, contact.id]
        )
        if (existing.rows.length) {
          conversation = existing.rows[0]
        } else {
          const { rows: [c] } = await db.query(
            `INSERT INTO conversations (workspace_id, contact_id, channel_id, status, ai_mode, whatsapp_number_id)
             VALUES ($1,$2,$3,'open',true,NULL) RETURNING *`,
            [workspaceId, contact.id, channelId]
          )
          conversation = c
        }

        // 3. Extrair conteúdo
        const m    = msg.message || {}
        const body = m.conversation || m.extendedTextMessage?.text
                  || m.imageMessage?.caption || m.videoMessage?.caption || null

        let contentType = 'text'
        let mediaUrl    = null

        if (m.imageMessage || m.videoMessage || m.audioMessage || m.pttMessage || m.documentMessage || m.stickerMessage) {
          contentType = m.imageMessage ? 'image'
                      : m.videoMessage ? 'video'
                      : (m.audioMessage || m.pttMessage) ? 'audio'
                      : m.documentMessage ? 'document'
                      : 'sticker'
          try {
            const buf  = await downloadMediaMessage(msg, 'buffer', {})
            const mime = m.imageMessage?.mimetype || m.videoMessage?.mimetype
                       || m.audioMessage?.mimetype || m.pttMessage?.mimetype
                       || m.documentMessage?.mimetype || 'application/octet-stream'
            mediaUrl = `data:${mime};base64,${buf.toString('base64')}`
          } catch (e) { console.error('[WA] media download error:', e.message) }
        }

        // 4. Salvar mensagem
        const { rows: [saved] } = await db.query(
          `INSERT INTO messages (conversation_id, whatsapp_message_id, direction, sender_type, content, content_type, media_url)
           VALUES ($1,$2,'inbound','contact',$3,$4,$5) RETURNING *`,
          [conversation.id, msg.key.id || null, body, contentType, mediaUrl]
        )

        // 5. Atualizar conversa
        await db.query(
          `UPDATE conversations SET last_message=$1, last_message_at=NOW(), unread_count=unread_count+1, updated_at=NOW() WHERE id=$2`,
          [body || '[mídia]', conversation.id]
        )

        // 6. Realtime
        const io = getIO()
        if (io) io.to(`workspace:${workspaceId}`).emit('new_message', {
          conversationId: conversation.id, message: saved, contact
        })

        // 7. Processar com IA (Glow) se ai_mode ativo e mensagem de texto
        if (conversation.ai_mode && body && contentType === 'text') {
          try {
            const wsSettings = await db.query(`SELECT settings FROM workspaces WHERE id=$1`, [workspaceId])
            const glowActive = wsSettings.rows[0]?.settings?.glow_active !== false
            if (glowActive) {
              const historyResult = await db.query(
                `SELECT direction, content FROM messages
                 WHERE conversation_id=$1 ORDER BY created_at DESC LIMIT 20`,
                [conversation.id]
              )
              const history = historyResult.rows.reverse()
              const aiResponse = await processMessage({ contact, conversation, message: body, history })
              if (aiResponse?.message) {
                // Enviar via WhatsApp
                const suffix = jid.endsWith('@g.us') ? '@g.us' : '@s.whatsapp.net'
                const sendJid = `${phone}${suffix}`
                const waId = await session.sendMessage(sendJid, aiResponse.message)
                // Salvar resposta da IA
                const { rows: [aiMsg] } = await db.query(
                  `INSERT INTO messages (conversation_id, direction, sender_type, content, content_type, whatsapp_message_id)
                   VALUES ($1,'outbound','ai',$2,'text',$3) RETURNING *`,
                  [conversation.id, aiResponse.message, waId]
                )
                await db.query(
                  `UPDATE conversations SET last_message=$1, last_message_at=NOW(), updated_at=NOW() WHERE id=$2`,
                  [aiResponse.message.substring(0, 200), conversation.id]
                )
                if (io) io.to(`workspace:${workspaceId}`).emit('new_message', {
                  conversationId: conversation.id, message: aiMsg, contact
                })
                // Transferir para humano se IA sinalizou
                if (aiResponse.signals?.transferToHuman) {
                  await db.query(
                    `UPDATE conversations SET ai_mode=false, status='pending', updated_at=NOW() WHERE id=$1`,
                    [conversation.id]
                  )
                  if (io) io.to(`workspace:${workspaceId}`).emit('transfer_to_human', { conversationId: conversation.id })
                }
              }
            }
          } catch (aiErr) {
            console.error('[WA] AI processing error:', aiErr.message)
          }
        }

        // 8. Criar deal automático se necessário
        try {
          const deal = await db.query(
            `SELECT id FROM deals WHERE contact_id=$1 AND workspace_id=$2 AND status='open' LIMIT 1`,
            [contact.id, workspaceId]
          )
          if (!deal.rows.length) {
            const pipe = await db.query(
              `SELECT p.id, ps.id as first_stage_id FROM pipelines p
               JOIN pipeline_stages ps ON ps.pipeline_id=p.id
               WHERE p.workspace_id=$1 AND p.is_default=true
               ORDER BY ps.position ASC LIMIT 1`,
              [workspaceId]
            )
            if (pipe.rows.length) {
              await db.query(
                `INSERT INTO deals (workspace_id,contact_id,pipeline_id,stage_id,title,value,status)
                 VALUES ($1,$2,$3,$4,$5,0,'open')`,
                [workspaceId, contact.id, pipe.rows[0].id, pipe.rows[0].first_stage_id,
                 `Conversa com ${contact.name || contact.phone}`]
              )
            }
          }
        } catch {}
      } catch (e) {
        console.error('[WA] message processing error:', e.message)
      }
    }
  })

  return session
}

// ─── API pública ──────────────────────────────────────────────────────────────
export async function destroySession(channelId) {
  try { sessions.get(channelId)?.sock?.end(undefined) } catch {}
  sessions.delete(channelId)
  connected.delete(channelId)
  pendingQR.delete(channelId)
}

export function getSession(channelId)  { return sessions.get(channelId) || null }
export function getSessions()          { return Array.from(connected) }
export function getPendingQR(channelId){ return pendingQR.get(channelId) || null }
