import { processMessage } from '../agents/sales-agent.js'
import { db } from '../utils/db.js'
import { sendWhatsAppMessage } from '../services/whatsapp-api.js'
import { emitToWorkspace } from '../services/realtime.js'
import { taskQueue } from '../queue/index.js'

// ============================================
// VERIFICAÇÃO DO WEBHOOK (Meta exige)
// ============================================
export async function verifyWebhook(req, reply) {
  const mode = req.query['hub.mode']
  const token = req.query['hub.verify_token']
  const challenge = req.query['hub.challenge']

  const whatsappNumber = await db.query(
    'SELECT * FROM whatsapp_numbers WHERE webhook_verify_token = $1',
    [token]
  )

  if (mode === 'subscribe' && whatsappNumber.rows.length > 0) {
    return reply.send(challenge)
  }

  return reply.status(403).send('Forbidden')
}

// ============================================
// RECEBER MENSAGEM DO WHATSAPP
// ============================================
export async function receiveWebhook(req, reply) {
  const body = req.body

  // Confirmar recebimento imediatamente (Meta exige resposta rápida)
  reply.send({ status: 'ok' })

  // Processar em background
  try {
    const entry = body?.entry?.[0]
    const change = entry?.changes?.[0]
    const value = change?.value

    if (!value?.messages?.length) return // sem mensagens novas

    const phoneNumberId = value.metadata.phone_number_id
    const message = value.messages[0]
    const contactInfo = value.contacts?.[0]

    await processIncomingMessage({ phoneNumberId, message, contactInfo })
  } catch (err) {
    console.error('[Webhook] Erro ao processar mensagem:', err)
  }
}

// ============================================
// PROCESSAR MENSAGEM RECEBIDA
// ============================================
async function processIncomingMessage({ phoneNumberId, message, contactInfo }) {
  // 1. Buscar o número WhatsApp no sistema
  const numberResult = await db.query(
    'SELECT * FROM whatsapp_numbers WHERE phone_number_id = $1 AND is_active = true',
    [phoneNumberId]
  )
  if (!numberResult.rows.length) return
  const whatsappNumber = numberResult.rows[0]

  // 2. Buscar ou criar o contato
  const phone = message.from
  const contact = await upsertContact({
    workspaceId: whatsappNumber.workspace_id,
    phone,
    name: contactInfo?.profile?.name
  })

  // 3. Buscar ou criar a conversa
  const conversation = await upsertConversation({
    workspaceId: whatsappNumber.workspace_id,
    contactId: contact.id,
    whatsappNumberId: whatsappNumber.id
  })

  // 4. Extrair conteúdo da mensagem
  const content = extractMessageContent(message)

  // 5. Salvar mensagem recebida
  const savedMsg = await saveMessage({
    conversationId: conversation.id,
    whatsappMessageId: message.id,
    direction: 'inbound',
    senderType: 'contact',
    content: content.text,
    contentType: content.type,
    mediaUrl: content.mediaUrl
  })

  // 6. Atualizar conversa (última mensagem)
  await db.query(
    `UPDATE conversations
     SET last_message = $1, last_message_at = NOW(), unread_count = unread_count + 1, updated_at = NOW()
     WHERE id = $2`,
    [content.text || '[mídia]', conversation.id]
  )

  // 7. Emitir evento em tempo real para o painel
  emitToWorkspace(whatsappNumber.workspace_id, 'new_message', {
    conversationId: conversation.id,
    message: savedMsg,
    contact
  })

  // 8. Responder com IA (se ativada)
  console.log('[AI-CHECK] ai_enabled:', whatsappNumber.ai_enabled, '| ai_mode:', conversation.ai_mode, '| type:', content.type)
  if (whatsappNumber.ai_enabled && conversation.ai_mode && content.type === 'text') {
    console.log('[AI-CHECK] Chamando Glow para:', contact.phone)
    await processWithAI({ whatsappNumber, contact, conversation, message: content.text })
  }
}

// ============================================
// PROCESSAR COM IA
// ============================================
async function processWithAI({ whatsappNumber, contact, conversation, message }) {
  try {
    // Buscar histórico das últimas 20 mensagens
    const historyResult = await db.query(
      `SELECT direction, content, sender_type FROM messages
       WHERE conversation_id = $1
       ORDER BY created_at DESC LIMIT 20`,
      [conversation.id]
    )
    const history = historyResult.rows.reverse()

    // Chamar a IA
    const aiResponse = await processMessage({
      contact,
      conversation,
      message,
      history
    })

    // Enviar resposta via WhatsApp
    const sent = await sendWhatsAppMessage({
      phoneNumberId: whatsappNumber.phone_number_id,
      accessToken: whatsappNumber.access_token,
      to: contact.phone,
      message: aiResponse.message
    })

    // Salvar resposta da IA
    await saveMessage({
      conversationId: conversation.id,
      whatsappMessageId: sent?.messages?.[0]?.id,
      direction: 'outbound',
      senderType: 'ai',
      content: aiResponse.message,
      contentType: 'text'
    })

    // Processar sinais especiais
    await handleSignals({ aiResponse, contact, conversation, whatsappNumber })

    // Atualizar última mensagem na conversa
    await db.query(
      `UPDATE conversations SET last_message = $1, last_message_at = NOW(), updated_at = NOW() WHERE id = $2`,
      [aiResponse.message.substring(0, 200), conversation.id]
    )

    // Emitir resposta da IA em tempo real
    emitToWorkspace(whatsappNumber.workspace_id, 'new_message', {
      conversationId: conversation.id,
      message: { direction: 'outbound', sender_type: 'ai', content: aiResponse.message },
      contact
    })
  } catch (err) {
    console.error('[AI] Erro ao processar resposta:', err)
  }
}

// ============================================
// TRATAR SINAIS DA IA
// ============================================
async function handleSignals({ aiResponse, contact, conversation, whatsappNumber }) {
  const { signals } = aiResponse

  // Transferir para humano
  if (signals.transferToHuman) {
    await db.query(
      `UPDATE conversations SET ai_mode = false, status = 'pending', updated_at = NOW() WHERE id = $1`,
      [conversation.id]
    )
    emitToWorkspace(whatsappNumber.workspace_id, 'transfer_to_human', {
      conversationId: conversation.id,
      contactName: contact.name,
      contactPhone: contact.phone
    })
  }

  // Lead quente — subir no funil
  if (signals.hotLead) {
    await db.query(
      `UPDATE contacts SET lead_score = LEAST(lead_score + 20, 100) WHERE id = $1`,
      [contact.id]
    )
    emitToWorkspace(whatsappNumber.workspace_id, 'hot_lead', {
      contactId: contact.id,
      contactName: contact.name
    })
  }

  // Criar tarefa de follow-up
  if (signals.createTask) {
    await taskQueue.add('create_task', {
      workspaceId: whatsappNumber.workspace_id,
      contactId: contact.id,
      conversationId: conversation.id,
      title: signals.createTask,
      type: 'follow_up',
      dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24h
    })
  }
}

// ============================================
// HELPERS
// ============================================
async function upsertContact({ workspaceId, phone, name }) {
  const result = await db.query(
    `INSERT INTO contacts (workspace_id, phone, name)
     VALUES ($1, $2, $3)
     ON CONFLICT (workspace_id, phone)
     DO UPDATE SET name = COALESCE($3, contacts.name), updated_at = NOW()
     RETURNING *`,
    [workspaceId, phone, name || null]
  )
  return result.rows[0]
}

async function upsertConversation({ workspaceId, contactId, whatsappNumberId }) {
  const result = await db.query(
    `INSERT INTO conversations (workspace_id, contact_id, whatsapp_number_id)
     VALUES ($1, $2, $3)
     ON CONFLICT DO NOTHING
     RETURNING *`,
    [workspaceId, contactId, whatsappNumberId]
  )

  if (result.rows.length > 0) return result.rows[0]

  const existing = await db.query(
    `SELECT * FROM conversations
     WHERE contact_id = $1 AND whatsapp_number_id = $2 AND status != 'resolved'
     ORDER BY created_at DESC LIMIT 1`,
    [contactId, whatsappNumberId]
  )
  return existing.rows[0]
}

async function saveMessage({ conversationId, whatsappMessageId, direction, senderType, senderId, content, contentType, mediaUrl }) {
  const result = await db.query(
    `INSERT INTO messages (conversation_id, whatsapp_message_id, direction, sender_type, sender_id, content, content_type, media_url)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [conversationId, whatsappMessageId || null, direction, senderType, senderId || null, content || null, contentType, mediaUrl || null]
  )
  return result.rows[0]
}

function extractMessageContent(message) {
  if (message.type === 'text') {
    return { type: 'text', text: message.text.body }
  }
  if (message.type === 'image') {
    return { type: 'image', text: message.image?.caption || null, mediaUrl: message.image?.id }
  }
  if (message.type === 'audio') {
    return { type: 'audio', text: null, mediaUrl: message.audio?.id }
  }
  if (message.type === 'document') {
    return { type: 'document', text: message.document?.filename || null, mediaUrl: message.document?.id }
  }
  return { type: message.type, text: null }
}
