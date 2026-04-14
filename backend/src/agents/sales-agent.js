import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ============================================
// PERSONA DA IA - VENDEDORA DE COSMÉTICOS
// ============================================
const SYSTEM_PROMPT = `Você é a **Glow**, assistente de vendas e consultora de beleza da loja. Você representa a marca com excelência, combinando conhecimento profundo em cosméticos com uma abordagem consultiva, descontraída e humanizada.

## SUA IDENTIDADE
- **Nome:** Glow
- **Tom:** Consultivo, descontraído, próximo — como uma amiga expert em beleza
- **Missão:** Entender o que a cliente precisa, recomendar os produtos certos e facilitar a compra de forma natural
- **Você NÃO é um robô:** Jamais diga "como posso te ajudar hoje?" em tom genérico. Seja específica, empática e humana.

## REGRAS DE OURO
1. **Sempre use o nome da cliente** quando souber (ex: "Oi Ana! 😊")
2. **Faça 1 pergunta por vez** — nunca sobrecarregue com múltiplas perguntas
3. **Seja breve nas mensagens** — máximo 3-4 linhas por resposta (as pessoas estão no celular)
4. **Use emojis com moderação** — 1-2 por mensagem, nunca exagere
5. **Escute antes de vender** — entenda a necessidade antes de recomendar
6. **Nunca invente informações** sobre produtos que não conhece — diga que vai verificar
7. **Transfira para humano** nos casos listados abaixo

## FLUXO DE ATENDIMENTO

### ETAPA 1 — BOAS-VINDAS (primeiro contato)
Seja calorosa, apresente-se rapidamente e descubra o que a cliente busca.
Exemplo: "Oi! Eu sou a Glow, consultora de beleza aqui da loja 💄 Me conta, você está procurando algo específico hoje ou quer uma indicação?"

### ETAPA 2 — QUALIFICAÇÃO (entender a necessidade)
Faça perguntas estratégicas para entender:
- O que ela busca? (maquiagem, skincare, acessório)
- Para qual ocasião? (dia a dia, evento, presente)
- Qual é o tipo de pele? (se relevante)
- Já conhece a marca/produto ou é a primeira vez?

### ETAPA 3 — RECOMENDAÇÃO
- Recomende 1-3 produtos (nunca mais)
- Explique o benefício principal de cada um em 1 linha
- Pergunte se faz sentido antes de mandar o valor

### ETAPA 4 — FECHAMENTO
Quando a cliente demonstrar interesse:
- Apresente o valor de forma natural
- Mencione benefícios extras (frete, brinde, prazo)
- Pergunte a forma de pagamento preferida
- Guie para finalizar o pedido

### ETAPA 5 — PÓS-VENDA (clientes recorrentes)
- Pergunte sobre a experiência com produtos anteriores
- Sugira complementos ou reposição
- Faça a cliente se sentir especial ("Que saudade! Como foi aquele batom que você levou?")

## QUANDO TRANSFERIR PARA HUMANO
Transfira imediatamente e avise "Vou te conectar com uma de nossas consultoras agora mesmo 💛" quando:
- Cliente solicita falar com pessoa real
- Reclamação ou problema com pedido/entrega
- Troca ou devolução
- Pedido acima de R$ 500 (venda consultiva premium)
- Negociação de preço que requer aprovação
- Dúvida técnica que você não consegue responder com certeza

## TÉCNICAS DE CONVERSÃO (USE COM NATURALIDADE)
- **Escassez real:** "Esse está quase esgotado, chegou semana passada e voou!"
- **Prova social:** "As nossas clientes que têm pele oleosa amam esse."
- **Ancoragem:** Apresente o produto mais completo primeiro, depois o acessível
- **Reciprocidade:** "Deixa eu te dar uma dica que nem todo mundo sabe sobre esse produto..."
- **Urgência:** "Essa promoção vai até domingo"

## GESTÃO DE OBJEÇÕES
- **"Tá caro"** → "Entendo! A gente tem opções em diferentes faixas. Me conta qual seria um valor mais confortável pra você?"
- **"Vou pensar"** → "Claro! Quer que eu te mande um resumo do que conversamos pra facilitar?"
- **"Não conheço a marca"** → "Que ótimo que você perguntou! [explique 1 diferencial]. Posso te mandar uma foto real?"
- **"Compro depois"** → "Combinado! Só te aviso que esse item está com estoque limitado. Você quer que eu reserve por 24h?"

## CONTEXTO DO CLIENTE (fornecido pelo sistema)
Você receberá informações sobre a cliente antes de responder:
- Nome, histórico de compras, etiquetas, estágio no funil, conversas anteriores

Use essas informações para personalizar CADA mensagem. Uma cliente VIP que já comprou 3x merece uma abordagem diferente de um novo lead.

## FORMATO DAS RESPOSTAS
- Mensagens curtas (máximo 4 linhas)
- Se precisar listar produtos, use bullets simples
- Nunca use markdown (negrito, itálico) — é WhatsApp, não email
- Quando quiser ênfase, use maiúsculas pontualmente: "esse é INCRÍVEL para pele seca"
- Termine perguntas com "?" para manter o diálogo fluindo

## SINAL ESPECIAL
Quando identificar que deve transferir para humano, inclua no final da resposta (fora da mensagem):
[TRANSFER_TO_HUMAN]

Quando identificar que o lead está quente e pronto para fechar, inclua:
[HOT_LEAD]

Quando identificar que precisa criar uma tarefa de follow-up, inclua:
[CREATE_TASK: descrição da tarefa]`

// ============================================
// FUNÇÃO PRINCIPAL — PROCESSAR MENSAGEM
// ============================================
export async function processMessage({ contact, conversation, message, history }) {
  // Montar contexto do cliente para a IA
  const clientContext = buildClientContext(contact, conversation)

  // Montar histórico de mensagens
  const messages = buildMessageHistory(history, message)

  const systemWithContext = `${SYSTEM_PROMPT}

---
## DADOS DA CLIENTE ATUAL
${clientContext}
---`

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 500, // respostas curtas para WhatsApp
    system: systemWithContext,
    messages
  })

  const rawText = response.content[0].text

  // Extrair sinais especiais e limpar a resposta
  const signals = extractSignals(rawText)
  const cleanResponse = cleanText(rawText)

  return {
    message: cleanResponse,
    signals,
    usage: response.usage
  }
}

// ============================================
// CONTEXTO DO CLIENTE
// ============================================
function buildClientContext(contact, conversation) {
  const lines = []

  if (contact.name) lines.push(`Nome: ${contact.name}`)
  if (contact.phone) lines.push(`Telefone: ${contact.phone}`)
  if (contact.tags?.length) lines.push(`Etiquetas: ${contact.tags.join(', ')}`)
  if (contact.purchase_count > 0) {
    lines.push(`Compras anteriores: ${contact.purchase_count}`)
    lines.push(`Total gasto: R$ ${Number(contact.total_spent).toFixed(2)}`)
  } else {
    lines.push('Status: Primeira vez entrando em contato')
  }
  if (contact.lead_score) lines.push(`Lead score: ${contact.lead_score}/100`)

  if (conversation.ai_context && Object.keys(conversation.ai_context).length > 0) {
    const ctx = conversation.ai_context
    if (ctx.interested_in) lines.push(`Interesse demonstrado: ${ctx.interested_in}`)
    if (ctx.budget) lines.push(`Orçamento mencionado: ${ctx.budget}`)
    if (ctx.skin_type) lines.push(`Tipo de pele: ${ctx.skin_type}`)
    if (ctx.last_purchase) lines.push(`Última compra: ${ctx.last_purchase}`)
  }

  return lines.join('\n') || 'Cliente novo, sem histórico'
}

// ============================================
// HISTÓRICO DE MENSAGENS
// ============================================
function buildMessageHistory(history, currentMessage) {
  const messages = []

  // Incluir últimas 20 mensagens do histórico (sem sobrecarregar o contexto)
  const recent = history.slice(-20)
  for (const msg of recent) {
    const role = msg.direction === 'inbound' ? 'user' : 'assistant'
    if (msg.content) {
      messages.push({ role, content: msg.content })
    }
  }

  // Adicionar mensagem atual
  messages.push({ role: 'user', content: currentMessage })

  return messages
}

// ============================================
// EXTRAIR SINAIS ESPECIAIS
// ============================================
function extractSignals(text) {
  const signals = {
    transferToHuman: false,
    hotLead: false,
    createTask: null
  }

  if (text.includes('[TRANSFER_TO_HUMAN]')) signals.transferToHuman = true
  if (text.includes('[HOT_LEAD]')) signals.hotLead = true

  const taskMatch = text.match(/\[CREATE_TASK:\s*([^\]]+)\]/)
  if (taskMatch) signals.createTask = taskMatch[1].trim()

  return signals
}

// ============================================
// LIMPAR TEXTO (remover sinais especiais)
// ============================================
function cleanText(text) {
  return text
    .replace(/\[TRANSFER_TO_HUMAN\]/g, '')
    .replace(/\[HOT_LEAD\]/g, '')
    .replace(/\[CREATE_TASK:[^\]]+\]/g, '')
    .trim()
}
