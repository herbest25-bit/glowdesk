import { db } from '../utils/db.js'

export async function analyticsRoutes(fastify) {
  // Dashboard principal — métricas em tempo real
  fastify.get('/analytics/dashboard', async (req, reply) => {
    const { workspaceId } = req.user
    const { period = '7d' } = req.query

    const daysMap = { '1d': 1, '7d': 7, '30d': 30, '90d': 90 }
    const days = daysMap[period] || 7

    const [
      conversations,
      messages,
      deals,
      contacts,
      aiPerformance,
      agentPerformance
    ] = await Promise.all([
      // Conversas abertas / resolvidas
      db.query(
        `SELECT
          COUNT(*) FILTER (WHERE status = 'open') as open_count,
          COUNT(*) FILTER (WHERE status = 'resolved') as resolved_count,
          COUNT(*) FILTER (WHERE status = 'bot') as bot_count,
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '${days} days') as new_count
         FROM conversations WHERE workspace_id = $1`,
        [workspaceId]
      ),

      // Volume de mensagens
      db.query(
        `SELECT
          COUNT(*) FILTER (WHERE direction = 'inbound') as received,
          COUNT(*) FILTER (WHERE direction = 'outbound' AND sender_type = 'ai') as ai_sent,
          COUNT(*) FILTER (WHERE direction = 'outbound' AND sender_type = 'agent') as agent_sent
         FROM messages m
         JOIN conversations c ON c.id = m.conversation_id
         WHERE c.workspace_id = $1 AND m.created_at >= NOW() - INTERVAL '${days} days'`,
        [workspaceId]
      ),

      // Funil de vendas
      db.query(
        `SELECT
          COUNT(*) FILTER (WHERE status = 'open') as open_deals,
          COUNT(*) FILTER (WHERE status = 'won') as won_deals,
          COUNT(*) FILTER (WHERE status = 'lost') as lost_deals,
          SUM(value) FILTER (WHERE status = 'won' AND updated_at >= NOW() - INTERVAL '${days} days') as revenue,
          SUM(value) FILTER (WHERE status = 'open') as pipeline_value
         FROM deals WHERE workspace_id = $1`,
        [workspaceId]
      ),

      // Novos leads
      db.query(
        `SELECT COUNT(*) as new_contacts
         FROM contacts
         WHERE workspace_id = $1 AND created_at >= NOW() - INTERVAL '${days} days'`,
        [workspaceId]
      ),

      // Performance da IA (taxa de conversão)
      db.query(
        `SELECT
          COUNT(DISTINCT c.id) as ai_conversations,
          COUNT(DISTINCT c.id) FILTER (WHERE c.ai_mode = false) as handed_to_human,
          ROUND(
            COUNT(DISTINCT c.id) FILTER (WHERE c.ai_mode = false)::numeric /
            NULLIF(COUNT(DISTINCT c.id), 0) * 100, 1
          ) as handover_rate
         FROM conversations c
         WHERE c.workspace_id = $1 AND c.created_at >= NOW() - INTERVAL '${days} days'`,
        [workspaceId]
      ),

      // Performance por agente
      db.query(
        `SELECT
          u.name,
          COUNT(DISTINCT c.id) as conversations,
          COUNT(m.id) FILTER (WHERE m.sender_type = 'agent') as messages_sent,
          AVG(EXTRACT(EPOCH FROM (
            (SELECT MIN(m2.created_at) FROM messages m2
             WHERE m2.conversation_id = c.id AND m2.direction = 'outbound' AND m2.sender_type = 'agent')
            - c.created_at
          ))/60) as avg_first_response_min
         FROM users u
         LEFT JOIN conversations c ON c.assigned_to = u.id AND c.workspace_id = $1
         LEFT JOIN messages m ON m.conversation_id = c.id
         WHERE u.workspace_id = $1
         GROUP BY u.id, u.name
         ORDER BY conversations DESC`,
        [workspaceId]
      )
    ])

    return reply.send({
      period,
      conversations: conversations.rows[0],
      messages: messages.rows[0],
      deals: deals.rows[0],
      contacts: contacts.rows[0],
      aiPerformance: aiPerformance.rows[0],
      agentPerformance: agentPerformance.rows
    })
  })

  // Gráfico de volume de mensagens por dia
  fastify.get('/analytics/messages-chart', async (req, reply) => {
    const { workspaceId } = req.user
    const { days = 7 } = req.query

    const result = await db.query(
      `SELECT
        DATE(m.created_at) as date,
        COUNT(*) FILTER (WHERE m.direction = 'inbound') as received,
        COUNT(*) FILTER (WHERE m.direction = 'outbound' AND m.sender_type = 'ai') as ai_sent,
        COUNT(*) FILTER (WHERE m.direction = 'outbound' AND m.sender_type = 'agent') as agent_sent
       FROM messages m
       JOIN conversations c ON c.id = m.conversation_id
       WHERE c.workspace_id = $1 AND m.created_at >= NOW() - INTERVAL '${days} days'
       GROUP BY DATE(m.created_at)
       ORDER BY date`,
      [workspaceId]
    )

    return reply.send({ chart: result.rows })
  })

  // Funil de conversão
  fastify.get('/analytics/funnel', async (req, reply) => {
    const { workspaceId } = req.user

    const result = await db.query(
      `SELECT
        ps.name as stage,
        ps.color,
        ps.position,
        COUNT(d.id) as deals,
        COALESCE(SUM(d.value), 0) as value
       FROM pipeline_stages ps
       LEFT JOIN deals d ON d.stage_id = ps.id AND d.workspace_id = $1 AND d.status = 'open'
       LEFT JOIN pipelines p ON p.id = ps.pipeline_id AND p.workspace_id = $1 AND p.is_default = true
       WHERE p.id IS NOT NULL
       GROUP BY ps.id, ps.name, ps.color, ps.position
       ORDER BY ps.position`,
      [workspaceId]
    )

    return reply.send({ funnel: result.rows })
  })
}
