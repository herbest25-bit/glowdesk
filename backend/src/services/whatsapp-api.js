const WHATSAPP_API_URL = 'https://graph.facebook.com/v19.0'

// ============================================
// ENVIAR MENSAGEM DE TEXTO
// ============================================
export async function sendWhatsAppMessage({ phoneNumberId, accessToken, to, message }) {
  const res = await fetch(`${WHATSAPP_API_URL}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { body: message, preview_url: false }
    })
  })

  if (!res.ok) {
    const err = await res.json()
    throw new Error(`WhatsApp API error: ${JSON.stringify(err)}`)
  }

  return res.json()
}

// ============================================
// ENVIAR TEMPLATE (mensagem proativa)
// ============================================
export async function sendWhatsAppTemplate({ phoneNumberId, accessToken, to, templateName, languageCode = 'pt_BR', components = [] }) {
  const res = await fetch(`${WHATSAPP_API_URL}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode },
        components
      }
    })
  })

  if (!res.ok) {
    const err = await res.json()
    throw new Error(`WhatsApp Template error: ${JSON.stringify(err)}`)
  }

  return res.json()
}

// ============================================
// MARCAR MENSAGEM COMO LIDA
// ============================================
export async function markAsRead({ phoneNumberId, accessToken, messageId }) {
  await fetch(`${WHATSAPP_API_URL}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId
    })
  })
}
