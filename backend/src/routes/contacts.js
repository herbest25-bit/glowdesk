import { db } from '../utils/db.js'

export async function contactRoutes(fastify) {
  // Verificar contato por telefone
  fastify.get('/contacts/check', async (req, reply) => {
    const { workspaceId } = req.user
    const { phone } = req.query
    if (!phone) return reply.code(400).send({ error: 'Telefone obrigatório' })

    const digits = phone.replace(/\D/g, '')
    const normalized = digits.startsWith('55') && digits.length >= 12 ? digits : '55' + digits

    const result = await db.query(
      `SELECT id, name, phone FROM contacts WHERE workspace_id = $1 AND phone = $2`,
      [workspaceId, normalized]
    )
    return reply.send({ contact: result.rows[0] || null })
  })

  // Listar contatos
  fastify.get('/contacts', async (req, reply) => {
    const { workspaceId } = req.user
    const { search, tags, page = 1, limit = 50 } = req.query
    const offset = (page - 1) * limit

    let where = ['workspace_id = $1']
    const params = [workspaceId]
    let i = 2

    if (search) {
      where.push(`(name ILIKE $${i} OR phone ILIKE $${i} OR email ILIKE $${i})`)
      params.push(`%${search}%`); i++
    }
    if (tags) {
      where.push(`tags && $${i}::text[]`)
      params.push(tags.split(',')); i++
    }

    const result = await db.query(
      `SELECT * FROM contacts WHERE ${where.join(' AND ')}
       ORDER BY updated_at DESC LIMIT $${i} OFFSET $${i + 1}`,
      [...params, limit, offset]
    )

    const countResult = await db.query(
      `SELECT COUNT(*) FROM contacts WHERE ${where.join(' AND ')}`,
      params
    )

    return reply.send({ contacts: result.rows, total: parseInt(countResult.rows[0].count) })
  })

  // Detalhes do contato
  fastify.get('/contacts/:id', async (req, reply) => {
    const { workspaceId } = req.user
    const { id } = req.params

    const contact = await db.query(
      'SELECT * FROM contacts WHERE id = $1 AND workspace_id = $2',
      [id, workspaceId]
    )
    if (!contact.rows.length) return reply.status(404).send({ error: 'Contato não encontrado' })

    const deals = await db.query(
      `SELECT d.*, ps.name as stage_name, ps.color as stage_color
       FROM deals d JOIN pipeline_stages ps ON ps.id = d.stage_id
       WHERE d.contact_id = $1 ORDER BY d.created_at DESC`,
      [id]
    )

    const tasks = await db.query(
      `SELECT * FROM tasks WHERE contact_id = $1 ORDER BY due_date ASC LIMIT 10`,
      [id]
    )

    return reply.send({
      contact: contact.rows[0],
      deals: deals.rows,
      tasks: tasks.rows
    })
  })

  // Criar contato
  fastify.post('/contacts', async (req, reply) => {
    const { workspaceId } = req.user
    const { name, phone, email, tags, customFields } = req.body

    const result = await db.query(
      `INSERT INTO contacts (workspace_id, name, phone, email, tags, custom_fields)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [workspaceId, name, phone, email || null, tags || [], customFields || {}]
    )

    return reply.status(201).send({ contact: result.rows[0] })
  })

  // Atualizar contato
  fastify.patch('/contacts/:id', async (req, reply) => {
    const { workspaceId } = req.user
    const { id } = req.params
    const { name, email, tags, customFields } = req.body

    const result = await db.query(
      `UPDATE contacts SET name = COALESCE($1, name), email = COALESCE($2, email),
       tags = COALESCE($3, tags), custom_fields = COALESCE($4, custom_fields), updated_at = NOW()
       WHERE id = $5 AND workspace_id = $6 RETURNING *`,
      [name, email, tags, customFields, id, workspaceId]
    )

    return reply.send({ contact: result.rows[0] })
  })
}
