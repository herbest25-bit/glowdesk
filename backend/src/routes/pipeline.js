import { db } from '../utils/db.js'
import { emitToWorkspace } from '../services/realtime.js'

export async function pipelineRoutes(fastify) {
  // Buscar pipeline completo (Kanban)
  fastify.get('/pipeline', async (req, reply) => {
    const { workspaceId } = req.user
    const { pipelineId } = req.query

    // Buscar estágios
    let pipelineQuery = `SELECT p.*, array_agg(
      json_build_object(
        'id', ps.id, 'name', ps.name, 'color', ps.color,
        'position', ps.position, 'is_won', ps.is_won, 'is_lost', ps.is_lost
      ) ORDER BY ps.position
    ) as stages
    FROM pipelines p
    JOIN pipeline_stages ps ON ps.pipeline_id = p.id
    WHERE p.workspace_id = $1`

    const params = [workspaceId]
    if (pipelineId) { pipelineQuery += ` AND p.id = $2`; params.push(pipelineId) }
    else { pipelineQuery += ` AND p.is_default = true` }

    pipelineQuery += ` GROUP BY p.id LIMIT 1`

    const pipelineResult = await db.query(pipelineQuery, params)
    if (!pipelineResult.rows.length) return reply.status(404).send({ error: 'Pipeline não encontrado' })

    const pipeline = pipelineResult.rows[0]

    // Buscar deals por estágio
    const dealsResult = await db.query(
      `SELECT d.*,
              ct.name as contact_name, ct.phone as contact_phone,
              ct.avatar_url, ct.tags, ct.lead_score,
              u.name as assigned_name
       FROM deals d
       JOIN contacts ct ON ct.id = d.contact_id
       LEFT JOIN users u ON u.id = d.assigned_to
       WHERE d.workspace_id = $1 AND d.status = 'open'
       ORDER BY d.updated_at DESC`,
      [workspaceId]
    )

    // Agrupar deals por estágio
    const dealsByStage = {}
    for (const deal of dealsResult.rows) {
      if (!dealsByStage[deal.stage_id]) dealsByStage[deal.stage_id] = []
      dealsByStage[deal.stage_id].push(deal)
    }

    return reply.send({ pipeline, dealsByStage })
  })

  // Criar deal
  fastify.post('/deals', async (req, reply) => {
    const { workspaceId, userId } = req.user
    const { contactId, pipelineId, stageId, title, value, expectedCloseDate } = req.body

    const result = await db.query(
      `INSERT INTO deals (workspace_id, contact_id, pipeline_id, stage_id, assigned_to, title, value, expected_close_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [workspaceId, contactId, pipelineId, stageId, userId, title, value || 0, expectedCloseDate || null]
    )

    return reply.status(201).send({ deal: result.rows[0] })
  })

  // Mover deal entre estágios (drag & drop)
  fastify.patch('/deals/:id/stage', async (req, reply) => {
    const { workspaceId } = req.user
    const { id } = req.params
    const { stageId, status, lostReason } = req.body

    const result = await db.query(
      `UPDATE deals SET stage_id = $1, status = COALESCE($2, status),
       lost_reason = $3, updated_at = NOW()
       WHERE id = $4 AND workspace_id = $5 RETURNING *`,
      [stageId, status, lostReason || null, id, workspaceId]
    )

    emitToWorkspace(workspaceId, 'deal_updated', { dealId: id })
    return reply.send({ deal: result.rows[0] })
  })

  // Atualizar deal
  fastify.patch('/deals/:id', async (req, reply) => {
    const { workspaceId } = req.user
    const { id } = req.params
    const { title, value, assignedTo, expectedCloseDate } = req.body

    const result = await db.query(
      `UPDATE deals SET title = COALESCE($1, title), value = COALESCE($2, value),
       assigned_to = COALESCE($3, assigned_to),
       expected_close_date = COALESCE($4, expected_close_date), updated_at = NOW()
       WHERE id = $5 AND workspace_id = $6 RETURNING *`,
      [title, value, assignedTo, expectedCloseDate, id, workspaceId]
    )

    return reply.send({ deal: result.rows[0] })
  })
}
