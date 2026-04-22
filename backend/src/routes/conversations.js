import { db } from '../utils/db.js'
import { sendWhatsAppMessage } from '../services/whatsapp-api.js'
import { emitToWorkspace } from '../services/realtime.js'
import { getSession, getSessions } from '../services/whatsapp-web.js'

function normalizePhone(phone) {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('55') && digits.length >= 12) return digits
  return '55' + digits
}

export async function conversationRoutes(fastify) {
  // Listar conversas (inbox)
  fastify.get('/conversations', async (req, reply) => {
    const { workspaceId } = req.user
    const { status, assignedTo, search, page = 1, limit = 30 } = req.query
    const offset = (page - 1) * limit

    let where = ['c.workspace_id = $1', "ct.phone NOT LIKE 'status%'", "COALESCE(ct.name,'') NOT ILIKE '%broadcast%'", "COALESCE(ct.is_group, false) = false"]
    const params = [workspaceId]
    let i = 2

    if (status) { where.push(`c.status = $${i++}`); params.push(status) }
    if (assignedTo) { where.push(`c.assigned_to = $${i++}`); params.push(assignedTo) }
    if (search) {
      where.push(`(ct.name ILIKE $${i} OR ct.phone ILIKE $${i})`)
      params.push(`%${search}%`); i++
    }

    const result = await db.query(
      `SELECT c.*,
              ct.name as contact_name, ct.phone as contact_phone, ct.avatar_url,
              ct.tags, ct.lead_score,
              u.name as assigned_name,
              wn.display_name as inbox_name,
              ch.name as channel_name, ch.phone_number as channel_phone
       FROM conversations c
       JOIN contacts ct ON ct.id = c.contact_id
       LEFT JOIN users u ON u.id = c.assigned_to
       LEFT JOIN whatsapp_numbers wn ON wn.id = c.whatsapp_number_id
       LEFT JOIN channels ch ON ch.id = c.channel_id
       WHERE ${where.join(' AND ')}
       ORDER BY c.last_message_at DESC NULLS LAST
       LIMIT $${i} OFFSET $${i + 1}`,
      [...params, limit, offset]
    )

    return reply.send({ conversations: result.rows })
  })

  // Detalhes de uma conversa
  fastify.get('/conversations/:id', async (req, reply) => {
    const { workspaceId } = req.user
    const { id } = req.params

    const result = await db.query(
      `SELECT c.*,
              ct.name as contact_name, ct.phone as contact_phone, ct.email,
              ct.tags, ct.lead_score, ct.purchase_count, ct.total_spent,
              ct.custom_fields as contact_fields
       FROM conversations c
       JOIN contacts ct ON ct.id = c.contact_id
       WHERE c.id = $1 AND c.workspace_id = $2`,
      [id, workspaceId]
    )

    if (!result.rows.length) return reply.status(404).send({ error: 'Conversa não encontrada' })
    return reply.send({ conversation: result.rows[0] })
  })

  // Mensagens de uma conversa
  fastify.get('/conversations/:id/messages', async (req, reply) => {
    const { id } = req.params
    const { page = 1, limit = 50 } = req.query
    const offset = (page - 1) * limit

    const result = await db.query(
      `SELECT m.*, u.name as sender_name
       FROM messages m
       LEFT JOIN users u ON u.id = m.sender_id
       WHERE m.conversation_id = $1
       ORDER BY m.created_at DESC
       LIMIT $2 OFFSET $3`,
      [id, limit, offset]
    )

    // Zerar não lidos
    await db.query('UPDATE conversations SET unread_count = 0 WHERE id = $1', [id])

    return reply.send({ messages: result.rows.reverse() })
  })

  // Enviar mensagem (agente humano)
  fastify.post('/conversations/:id/messages', async (req, reply) => {
    const { workspaceId, id: userId } = req.user
    const { id } = req.params
    const { content } = req.body

    const convResult = await db.query(
      `SELECT c.*, ct.phone, ct.is_group,
              wn.phone_number_id, wn.access_token,
              c.channel_id
       FROM conversations c
       LEFT JOIN whatsapp_numbers wn ON wn.id = c.whatsapp_number_id
       JOIN contacts ct ON ct.id = c.contact_id
       WHERE c.id = $1 AND c.workspace_id = $2`,
      [id, workspaceId]
    )

    if (!convResult.rows.length) return reply.status(404).send({ error: 'Conversa não encontrada' })
    const conv = convResult.rows[0]

    // Determinar canal: usar channel_id da conversa ou pegar qualquer sessão ativa
    let channelId = conv.channel_id
    const activeSessions = getSessions()
    console.log(`[Send] channel_id da conversa: ${channelId} | sessões ativas: ${JSON.stringify(activeSessions)}`)
    if (!channelId && activeSessions.length > 0) {
      channelId = activeSessions[0]
    }

    if (channelId) {
      // WhatsApp Web
      let client = getSession(channelId)
      // Se o canal salvo não está mais ativo, tenta qualquer sessão disponível
      if (!client && activeSessions.length > 0) {
        channelId = activeSessions[0]
        client = getSession(channelId)
      }
      console.log(`[Send] getSession(${channelId}): ${client ? 'OK' : 'NULL'}`)
      if (!client) return reply.status(400).send({ error: 'Canal WhatsApp não está conectado. Vá em Canais e reconecte.' })
      try {
        const { media_base64, media_mimetype, media_filename } = req.body
        if (media_base64 && media_mimetype) {
          const jid = conv.is_group ? `${conv.phone}@g.us` : `${conv.phone}@c.us`
          await client.sendMedia(jid, media_base64, media_mimetype, media_filename)
        } else {
          const jid = conv.is_group ? `${conv.phone}@g.us` : `${conv.phone}@c.us`
          await client.sendMessage(jid, content)
        }
      } catch (sendErr) {
        console.error('[Send] Erro ao enviar via WhatsApp Web:', sendErr.message)
        return reply.status(400).send({ error: `Falha ao enviar: ${sendErr.message}. Reconecte o canal em Canais.` })
      }
    } else if (conv.phone_number_id && conv.access_token) {
      // Meta API
      await sendWhatsAppMessage({
        phoneNumberId: conv.phone_number_id,
        accessToken: conv.access_token,
        to: conv.phone,
        message: content
      })
    } else {
      return reply.status(400).send({ error: 'Nenhum canal disponível para envio' })
    }

    // Salvar no banco
    const msgResult = await db.query(
      `INSERT INTO messages (conversation_id, direction, sender_type, sender_id, content, content_type)
       VALUES ($1, 'outbound', 'agent', $2, $3, 'text')
       RETURNING *`,
      [id, userId, content]
    )

    await db.query(
      `UPDATE conversations SET last_message = $1, last_message_at = NOW(), ai_mode = false WHERE id = $2`,
      [content.substring(0, 200), id]
    )

    emitToWorkspace(workspaceId, 'new_message', { conversationId: id, message: msgResult.rows[0] })

    return reply.send({ message: msgResult.rows[0] })
  })

  // Assumir conversa (desligar IA, atribuir para agente)
  fastify.patch('/conversations/:id/take-over', async (req, reply) => {
    const { workspaceId, id: userId } = req.user
    const { id } = req.params

    await db.query(
      `UPDATE conversations SET ai_mode = false, assigned_to = $1, status = 'open', updated_at = NOW()
       WHERE id = $2 AND workspace_id = $3`,
      [userId, id, workspaceId]
    )

    emitToWorkspace(workspaceId, 'conversation_updated', { conversationId: id })
    return reply.send({ success: true })
  })

  // Reativar IA na conversa
  fastify.patch('/conversations/:id/enable-ai', async (req, reply) => {
    const { workspaceId } = req.user
    const { id } = req.params

    await db.query(
      `UPDATE conversations SET ai_mode = true, status = 'bot', updated_at = NOW()
       WHERE id = $1 AND workspace_id = $2`,
      [id, workspaceId]
    )

    return reply.send({ success: true })
  })

  // Resolver conversa
  fastify.patch('/conversations/:id/resolve', async (req, reply) => {
    const { workspaceId } = req.user
    const { id } = req.params

    await db.query(
      `UPDATE conversations SET status = 'resolved', updated_at = NOW()
       WHERE id = $1 AND workspace_id = $2`,
      [id, workspaceId]
    )

    emitToWorkspace(workspaceId, 'conversation_resolved', { conversationId: id })
    return reply.send({ success: true })
  })

  // Apagar mensagens individuais
  fastify.delete('/conversations/:id/messages/:msgId', async (req, reply) => {
    const { id, msgId } = req.params
    await db.query(`DELETE FROM messages WHERE id = $1 AND conversation_id = $2`, [msgId, id])
    return reply.send({ success: true })
  })

  // Apagar conversa
  fastify.delete('/conversations/:id', async (req, reply) => {
    const { workspaceId } = req.user
    const { id } = req.params
    await db.query(`DELETE FROM messages WHERE conversation_id = $1`, [id])
    await db.query(`DELETE FROM conversations WHERE id = $1 AND workspace_id = $2`, [id, workspaceId])
    return reply.send({ success: true })
  })

  // Iniciar nova conversa com número externo
  fastify.post('/conversations/initiate', async (req, reply) => {
    const { workspaceId, id: userId } = req.user
    const { phone, name, message, channelId, whatsappNumberId } = req.body

    if (!phone || !message?.trim()) {
      return reply.code(400).send({ error: 'Telefone e mensagem são obrigatórios' })
    }

    const normalizedPhone = normalizePhone(phone)

    // 1. Encontrar ou criar contato
    let contact
    const existingContact = await db.query(
      `SELECT * FROM contacts WHERE workspace_id = $1 AND phone = $2`,
      [workspaceId, normalizedPhone]
    )

    if (existingContact.rows.length) {
      contact = existingContact.rows[0]
      // Atualizar nome se fornecido e contato não tem nome
      if (name && !contact.name) {
        const updated = await db.query(
          `UPDATE contacts SET name = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
          [name, contact.id]
        )
        contact = updated.rows[0]
      }
    } else {
      const created = await db.query(
        `INSERT INTO contacts (workspace_id, name, phone)
         VALUES ($1, $2, $3) RETURNING *`,
        [workspaceId, name || normalizedPhone, normalizedPhone]
      )
      contact = created.rows[0]
    }

    // 2. Encontrar ou criar conversa
    let conversation
    const convQuery = channelId
      ? `SELECT * FROM conversations WHERE workspace_id = $1 AND contact_id = $2 AND channel_id = $3 AND status != 'resolved' LIMIT 1`
      : `SELECT * FROM conversations WHERE workspace_id = $1 AND contact_id = $2 AND whatsapp_number_id = $3 AND status != 'resolved' LIMIT 1`
    const convParam = channelId || whatsappNumberId

    const existingConv = await db.query(convQuery, [workspaceId, contact.id, convParam])

    if (existingConv.rows.length) {
      conversation = existingConv.rows[0]
    } else {
      const convInsert = channelId
        ? await db.query(
            `INSERT INTO conversations (workspace_id, contact_id, channel_id, status, ai_mode, last_message, last_message_at)
             VALUES ($1, $2, $3, 'open', false, $4, NOW()) RETURNING *`,
            [workspaceId, contact.id, channelId, message.substring(0, 200)]
          )
        : await db.query(
            `INSERT INTO conversations (workspace_id, contact_id, whatsapp_number_id, status, ai_mode, last_message, last_message_at)
             VALUES ($1, $2, $3, 'open', false, $4, NOW()) RETURNING *`,
            [workspaceId, contact.id, whatsappNumberId, message.substring(0, 200)]
          )
      conversation = convInsert.rows[0]
    }

    // 3. Enviar mensagem
    if (channelId) {
      const client = getSession(channelId)
      if (!client) return reply.code(503).send({ error: 'Canal não está conectado. Verifique os canais de atendimento.' })
      await client.sendMessage(`${normalizedPhone}@c.us`, message)
    } else if (whatsappNumberId) {
      const numResult = await db.query(
        `SELECT phone_number_id, access_token FROM whatsapp_numbers WHERE id = $1 AND workspace_id = $2`,
        [whatsappNumberId, workspaceId]
      )
      if (!numResult.rows.length) return reply.code(404).send({ error: 'Número WhatsApp não encontrado' })
      const num = numResult.rows[0]
      await sendWhatsAppMessage({
        phoneNumberId: num.phone_number_id,
        accessToken: num.access_token,
        to: normalizedPhone,
        message
      })
    } else {
      return reply.code(400).send({ error: 'Selecione um canal para envio' })
    }

    // 4. Salvar mensagem
    await db.query(
      `INSERT INTO messages (conversation_id, direction, sender_type, sender_id, content, content_type)
       VALUES ($1, 'outbound', 'agent', $2, $3, 'text')`,
      [conversation.id, userId, message]
    )

    await db.query(
      `UPDATE conversations SET last_message = $1, last_message_at = NOW() WHERE id = $2`,
      [message.substring(0, 200), conversation.id]
    )

    emitToWorkspace(workspaceId, 'conversation_updated', { conversationId: conversation.id })

    return reply.send({
      conversation: {
        ...conversation,
        contact_name: contact.name,
        contact_phone: contact.phone
      }
    })
  })
}
