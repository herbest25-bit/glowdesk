import { db } from '../utils/db.js'
import { startSession, destroySession } from '../services/whatsapp-web.js'

export default async function channelsRoutes(fastify) {
  // GET /api/channels — listar canais
  fastify.get('/api/channels', async (req, reply) => {
    const { workspaceId } = req.user
    const result = await db.query(
      `SELECT id, name, phone_number, status, connected_at, created_at
       FROM channels WHERE workspace_id = $1 ORDER BY created_at DESC`,
      [workspaceId]
    )
    return { channels: result.rows }
  })

  // POST /api/channels — criar canal
  fastify.post('/api/channels', async (req, reply) => {
    const { workspaceId } = req.user
    const { name } = req.body
    if (!name?.trim()) return reply.code(400).send({ error: 'Nome obrigatório' })

    const result = await db.query(
      `INSERT INTO channels (workspace_id, name, status)
       VALUES ($1, $2, 'disconnected') RETURNING *`,
      [workspaceId, name.trim()]
    )
    const channel = result.rows[0]
    return reply.code(201).send({ channel })
  })

  // GET /api/channels/:id/qrcode — iniciar sessão e emitir QR via socket
  fastify.get('/api/channels/:id/qrcode', async (req, reply) => {
    const { workspaceId } = req.user
    const { id } = req.params

    const result = await db.query(
      `SELECT * FROM channels WHERE id = $1 AND workspace_id = $2`,
      [id, workspaceId]
    )
    if (!result.rows.length) return reply.code(404).send({ error: 'Canal não encontrado' })

    // Iniciar sessão em background (QR chega via socket)
    startSession(id, workspaceId).catch(e =>
      console.error('[Channels] Erro ao iniciar sessão:', e.message)
    )

    return { status: 'starting' }
  })

  // GET /api/channels/:id/status — verificar status
  fastify.get('/api/channels/:id/status', async (req, reply) => {
    const { workspaceId } = req.user
    const { id } = req.params
    const result = await db.query(
      `SELECT id, name, phone_number, status, connected_at FROM channels WHERE id = $1 AND workspace_id = $2`,
      [id, workspaceId]
    )
    if (!result.rows.length) return reply.code(404).send({ error: 'Canal não encontrado' })
    return { channel: result.rows[0] }
  })

  // PATCH /api/channels/:id — renomear canal
  fastify.patch('/api/channels/:id', async (req, reply) => {
    const { workspaceId } = req.user
    const { id } = req.params
    const { name } = req.body
    if (!name?.trim()) return reply.code(400).send({ error: 'Nome obrigatório' })

    const result = await db.query(
      `UPDATE channels SET name = $1, updated_at = NOW()
       WHERE id = $2 AND workspace_id = $3 RETURNING *`,
      [name.trim(), id, workspaceId]
    )
    if (!result.rows.length) return reply.code(404).send({ error: 'Canal não encontrado' })
    return { channel: result.rows[0] }
  })

  // DELETE /api/channels/:id — desconectar e remover canal
  fastify.delete('/api/channels/:id', async (req, reply) => {
    const { workspaceId } = req.user
    const { id } = req.params

    const result = await db.query(
      `SELECT * FROM channels WHERE id = $1 AND workspace_id = $2`,
      [id, workspaceId]
    )
    if (!result.rows.length) return reply.code(404).send({ error: 'Canal não encontrado' })

    await destroySession(id)
    await db.query(`DELETE FROM channels WHERE id = $1`, [id])

    return { ok: true }
  })
}
