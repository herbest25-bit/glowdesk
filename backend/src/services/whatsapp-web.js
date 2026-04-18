import pkg from 'whatsapp-web.js'
const { Client, RemoteAuth } = pkg
import qrcode from 'qrcode'
import { db } from '../utils/db.js'
import { getIO } from './realtime.js'
import fs from 'fs'

const sessions = new Map() // channelId → Client

// ─── Store de sessão no banco de dados ───────────────────────────────────────
function makeStore() {
  return {
    async sessionExists({ session }) {
      const r = await db.query('SELECT 1 FROM channel_sessions WHERE session_id = $1', [session])
      return r.rows.length > 0
    },
    async save({ session }) {
      const zipPath = `./${session}.zip`
      if (!fs.existsSync(zipPath)) return
      const data = fs.readFileSync(zipPath).toString('base64')
      await db.query(
        `INSERT INTO channel_sessions (session_id, session_data, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (session_id) DO UPDATE SET session_data = $2, updated_at = NOW()`,
        [session, data]
      )
      console.log(`[Session] Sessão salva no banco: ${session}`)
    },
    async extract({ session, path }) {
      const r = await db.query('SELECT session_data FROM channel_sessions WHERE session_id = $1', [session])
      if (!r.rows.length) throw new Error('Sessão não encontrada no banco')
      const data = Buffer.from(r.rows[0].session_data, 'base64')
      fs.writeFileSync(`${path}.zip`, data)
      console.log(`[Session] Sessão restaurada do banco: ${session}`)
    },
    async delete({ session }) {
      await db.query('DELETE FROM channel_sessions WHERE session_id = $1', [session])
      console.log(`[Session] Sessão removida do banco: ${session}`)
    }
  }
}

// ─── Inicializar todos os canais conectados ao subir o servidor ───────────────
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

// ─── Iniciar sessão para um canal ─────────────────────────────────────────────
export async function startSession(channelId, workspaceId) {
  if (sessions.has(channelId)) {
    const existing = sessions.get(channelId)
    try { await existing.destroy() } catch (_) {}
  }

  const client = new Client({
    authStrategy: new RemoteAuth({
      clientId: channelId,
      store: makeStore(),
      backupSyncIntervalMs: 60_000
    }),
    puppeteer: {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run'
      ]
    }
  })

  sessions.set(channelId, client)

  client.on('qr', async (qr) => {
    try {
      const qrDataUrl = await qrcode.toDataURL(qr)
      const io = getIO()
      if (io) {
        io.to(`workspace:${workspaceId}`).emit('channel_qrcode', { channelId, qrcode: qrDataUrl })
      }
      await db.query(
        `UPDATE channels SET status = 'connecting', updated_at = NOW() WHERE id = $1`,
        [channelId]
      )
    } catch (e) {
      console.error('[Channels] Erro ao gerar QR:', e.message)
    }
  })

  client.on('ready', async () => {
    try {
      const info = client.info
      const phone = info?.wid?.user || null
      await db.query(
        `UPDATE channels SET status = 'connected', phone_number = $1, connected_at = NOW(), updated_at = NOW() WHERE id = $2`,
        [phone, channelId]
      )
      const io = getIO()
      if (io) {
        io.to(`workspace:${workspaceId}`).emit('channel_connected', { channelId, phone })
      }
      console.log(`[Channels] Canal conectado: ${channelId} → ${phone}`)
    } catch (e) {
      console.error('[Channels] Erro ao salvar conexão:', e.message)
    }
  })

  client.on('disconnected', async (reason) => {
    console.log(`[Channels] Canal desconectado: ${channelId} — ${reason}`)
    sessions.delete(channelId)
    try {
      await db.query(
        `UPDATE channels SET status = 'disconnected', updated_at = NOW() WHERE id = $1`,
        [channelId]
      )
      const result = await db.query(`SELECT workspace_id FROM channels WHERE id = $1`, [channelId])
      const wsId = result.rows[0]?.workspace_id
      const io = getIO()
      if (io && wsId) {
        io.to(`workspace:${wsId}`).emit('channel_disconnected', { channelId })
      }
    } catch (e) {
      console.error('[Channels] Erro ao atualizar status:', e.message)
    }
  })

  client.on('message', async (msg) => {
    try {
      if (msg.fromMe) return
      if (msg.from === 'status@broadcast') return // ignorar status do WhatsApp

      const isGroup = msg.from.endsWith('@g.us')
      console.log(`[Channels] ✉️ ${isGroup ? 'Grupo' : 'Contato'} ${msg.from}: "${msg.body?.substring(0, 80)}"`)

      let phone, contactName
      if (isGroup) {
        phone = msg.from.replace('@g.us', '')
        try {
          const chat = await msg.getChat()
          contactName = chat.name || phone
        } catch (_) {
          contactName = phone
        }
      } else {
        phone = msg.from.replace('@c.us', '')
        contactName = msg._data?.notifyName || null
      }

      // 1. Upsert contato
      const contactResult = await db.query(
        `INSERT INTO contacts (workspace_id, phone, name)
         VALUES ($1, $2, $3)
         ON CONFLICT (workspace_id, phone)
         DO UPDATE SET name = COALESCE($3, contacts.name), updated_at = NOW()
         RETURNING *`,
        [workspaceId, phone, contactName]
      )
      const contact = contactResult.rows[0]
      console.log(`[Channels] Contato: ${contact.id} (${contact.name || phone})`)

      // 2. Upsert conversa (vinculada ao canal)
      let convResult = await db.query(
        `SELECT * FROM conversations
         WHERE workspace_id = $1 AND contact_id = $2 AND status != 'resolved'
         ORDER BY created_at DESC LIMIT 1`,
        [workspaceId, contact.id]
      )
      let conversation
      if (convResult.rows.length === 0) {
        // Tenta com channel_id, se falhar cria sem
        let newConv
        try {
          newConv = await db.query(
            `INSERT INTO conversations (workspace_id, contact_id, channel_id, status, ai_mode, whatsapp_number_id)
             VALUES ($1, $2, $3, 'open', true, NULL)
             RETURNING *`,
            [workspaceId, contact.id, channelId]
          )
        } catch (_) {
          newConv = await db.query(
            `INSERT INTO conversations (workspace_id, contact_id, status, ai_mode)
             VALUES ($1, $2, 'open', true)
             RETURNING *`,
            [workspaceId, contact.id]
          )
        }
        conversation = newConv.rows[0]
        console.log(`[Channels] Nova conversa criada: ${conversation.id}`)
      } else {
        conversation = convResult.rows[0]
        console.log(`[Channels] Conversa existente: ${conversation.id}`)
      }

      // 3. Conteúdo da mensagem
      console.log(`[Channels] tipo=${msg.type} hasMedia=${msg.hasMedia} body="${msg.body?.substring(0,30)}"`)
      let content = msg.body || null
      let contentType = msg.type === 'chat' ? 'text' : (msg.type || 'text')
      let mediaUrl = null

      const mediaTypes = ['image', 'video', 'audio', 'ptt', 'document', 'sticker']
      if (msg.hasMedia || mediaTypes.includes(msg.type)) {
        if (msg.type === 'ptt') contentType = 'audio'
        try {
          const media = await msg.downloadMedia()
          if (media) {
            mediaUrl = `data:${media.mimetype};base64,${media.data}`
            console.log(`[Channels] Mídia baixada: ${media.mimetype} (${Math.round(media.data.length * 0.75 / 1024)}KB)`)
          }
        } catch (e) {
          console.error('[Channels] Erro ao baixar mídia:', e.message)
        }
      }

      // 4. Salvar mensagem
      const savedMsg = await db.query(
        `INSERT INTO messages (conversation_id, whatsapp_message_id, direction, sender_type, content, content_type, media_url)
         VALUES ($1, $2, 'inbound', 'contact', $3, $4, $5)
         RETURNING *`,
        [conversation.id, msg.id?.id || null, content, contentType, mediaUrl]
      )

      // 5. Atualizar conversa
      await db.query(
        `UPDATE conversations
         SET last_message = $1, last_message_at = NOW(), unread_count = unread_count + 1, updated_at = NOW()
         WHERE id = $2`,
        [content || '[mídia]', conversation.id]
      )

      // 6. Emitir em tempo real para o painel
      const io = getIO()
      if (io) {
        io.to(`workspace:${workspaceId}`).emit('new_message', {
          conversationId: conversation.id,
          message: savedMsg.rows[0],
          contact
        })
      }

      // 7. Criar deal no pipeline se ainda não existir para este contato
      try {
        const existingDeal = await db.query(
          `SELECT id FROM deals WHERE contact_id = $1 AND workspace_id = $2 AND status = 'open' LIMIT 1`,
          [contact.id, workspaceId]
        )
        if (existingDeal.rows.length === 0) {
          const pipeline = await db.query(
            `SELECT p.id, ps.id as first_stage_id
             FROM pipelines p
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
            console.log(`[Pipeline] Deal criado para contato: ${contact.name || contact.phone}`)
          }
        }
      } catch (e) {
        console.error('[Pipeline] Erro ao criar deal:', e.message)
      }
    } catch (e) {
      console.error('[Channels] Erro ao processar mensagem:', e.message)
    }
  })

  await client.initialize()
  return client
}

// ─── Destruir sessão ──────────────────────────────────────────────────────────
export async function destroySession(channelId) {
  const client = sessions.get(channelId)
  if (client) {
    try { await client.destroy() } catch (_) {}
    sessions.delete(channelId)
  }
}

// ─── Obter cliente ────────────────────────────────────────────────────────────
export function getSession(channelId) {
  return sessions.get(channelId) || null
}

// ─── Listar IDs de sessões ativas ─────────────────────────────────────────────
export function getSessions() {
  return Array.from(sessions.keys())
}
