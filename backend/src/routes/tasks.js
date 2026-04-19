import { db } from '../utils/db.js'

export async function taskRoutes(fastify) {
  // Listar tarefas
  fastify.get('/tasks', async (req, reply) => {
    const { workspaceId, id: userId, role } = req.user
    const { assignedTo, status, dueToday } = req.query

    let where = ['t.workspace_id = $1']
    const params = [workspaceId]
    let i = 2

    if (role === 'agent') { where.push(`t.assigned_to = $${i++}`); params.push(userId) }
    else if (assignedTo) { where.push(`t.assigned_to = $${i++}`); params.push(assignedTo) }

    if (status) { where.push(`t.status = $${i++}`); params.push(status) }
    if (dueToday) where.push(`DATE(t.due_date) = CURRENT_DATE`)

    const result = await db.query(
      `SELECT t.*, ct.name as contact_name, ct.phone as contact_phone,
              u.name as assigned_name
       FROM tasks t
       LEFT JOIN contacts ct ON ct.id = t.contact_id
       LEFT JOIN users u ON u.id = t.assigned_to
       WHERE ${where.join(' AND ')}
       ORDER BY t.due_date ASC NULLS LAST, t.created_at DESC`,
      params
    )

    return reply.send({ tasks: result.rows })
  })

  // Criar tarefa
  fastify.post('/tasks', async (req, reply) => {
    const { workspaceId, id: userId } = req.user
    const { contactId, dealId, assignedTo, title, description, type, priority, dueDate } = req.body

    const result = await db.query(
      `INSERT INTO tasks (workspace_id, contact_id, deal_id, assigned_to, created_by, title, description, type, priority, due_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [workspaceId, contactId || null, dealId || null, assignedTo || userId, userId,
       title, description || null, type || 'follow_up', priority || 'medium', dueDate || null]
    )

    return reply.status(201).send({ task: result.rows[0] })
  })

  // Atualizar tarefa
  fastify.patch('/tasks/:id', async (req, reply) => {
    const { workspaceId } = req.user
    const { id } = req.params
    const { status, title, dueDate, priority } = req.body

    const result = await db.query(
      `UPDATE tasks SET
        status = COALESCE($1, status),
        title = COALESCE($2, title),
        due_date = COALESCE($3, due_date),
        priority = COALESCE($4, priority),
        completed_at = CASE WHEN $1 = 'done' THEN NOW() ELSE NULL END,
        updated_at = NOW()
       WHERE id = $5 AND workspace_id = $6 RETURNING *`,
      [status, title, dueDate, priority, id, workspaceId]
    )

    return reply.send({ task: result.rows[0] })
  })
}
