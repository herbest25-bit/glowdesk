import { db } from '../utils/db.js'

export async function glowRoutes(fastify) {
  // GET /api/glow — buscar status e agendamento
  fastify.get('/api/glow', async (req, reply) => {
    const { workspaceId } = req.user
    const result = await db.query(
      `SELECT settings FROM workspaces WHERE id = $1`,
      [workspaceId]
    )
    const settings = result.rows[0]?.settings || {}
    return reply.send({
      active: settings.glow_active !== false, // default true
      scheduleEnabled: settings.glow_schedule_enabled || false,
      activateAt: settings.glow_activate_at || '08:00',
      deactivateAt: settings.glow_deactivate_at || '18:00',
    })
  })

  // PATCH /api/glow — atualizar status e/ou agendamento
  fastify.patch('/api/glow', async (req, reply) => {
    const { workspaceId } = req.user
    const { active, scheduleEnabled, activateAt, deactivateAt } = req.body

    const current = await db.query(
      `SELECT settings FROM workspaces WHERE id = $1`,
      [workspaceId]
    )
    const settings = current.rows[0]?.settings || {}

    const updated = {
      ...settings,
      ...(active !== undefined && { glow_active: active }),
      ...(scheduleEnabled !== undefined && { glow_schedule_enabled: scheduleEnabled }),
      ...(activateAt !== undefined && { glow_activate_at: activateAt }),
      ...(deactivateAt !== undefined && { glow_deactivate_at: deactivateAt }),
    }

    await db.query(
      `UPDATE workspaces SET settings = settings || $1::jsonb WHERE id = $2`,
      [JSON.stringify(updated), workspaceId]
    )

    // Sincronizar ai_enabled em todos os números do workspace
    if (active !== undefined) {
      await db.query(
        `UPDATE whatsapp_numbers SET ai_enabled = $1 WHERE workspace_id = $2`,
        [active, workspaceId]
      )
    }

    return reply.send({ ok: true, active: updated.glow_active })
  })
}
