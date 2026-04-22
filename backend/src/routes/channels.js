import { db } from '../utils/db.js'
import { startSession, destroySession, getSessions, getPendingQR } from '../services/whatsapp-web.js'

export default async function channelsRoutes(fastify) {
  // GET /api/channels — listar canais
  fastify.get('/api/channels', async (req, reply) => {
    const { workspaceId } = req.user
    const result = await db.query(
      `SELECT id, name, phone_number, status, connected_at, created_at
       FROM channels WHERE workspace_id = $1 ORDER BY created_at DESC`,
      [workspaceId]
    )
    const activeSessions = getSessions()
    const channels = result.rows.map(ch => ({
      ...ch,
      active: activeSessions.includes(ch.id)
    }))
    return { channels }
  })

  // GET /api/channels/sessions — sessões ativas em memória
  fastify.get('/api/channels/sessions', async (req, reply) => {
    return { activeSessions: getSessions() }
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

    // Destruir sessão ativa e apagar credenciais antigas para forçar novo QR
    await destroySession(id)
    await db.query(`DELETE FROM channel_sessions WHERE session_id = $1`, [`wab-${id}`])
    await db.query(`UPDATE channels SET status = 'connecting', updated_at = NOW() WHERE id = $1`, [id])

    // Iniciar sessão em background (QR chega via socket)
    startSession(id, workspaceId).catch(async (e) => {
      console.error('[Channels] Erro ao iniciar sessão:', e.message)
      const { getIO } = await import('../services/realtime.js')
      const io = getIO()
      if (io) {
        io.to(`workspace:${workspaceId}`).emit('channel_error', { channelId: id, error: e.message })
      }
      await db.query(`UPDATE channels SET status = 'disconnected', updated_at = NOW() WHERE id = $1`, [id])
    })

    return { status: 'starting' }
  })

  // GET /api/channels/:id/qr-poll — polling HTTP para QR code (fallback ao socket)
  fastify.get('/api/channels/:id/qr-poll', async (req, reply) => {
    const { id } = req.params
    const qr = getPendingQR(id)
    return { qrcode: qr }
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

  // POST /api/channels/:id/disconnect — desconectar sem remover
  fastify.post('/api/channels/:id/disconnect', async (req, reply) => {
    const { workspaceId } = req.user
    const { id } = req.params
    const result = await db.query(
      `SELECT * FROM channels WHERE id = $1 AND workspace_id = $2`,
      [id, workspaceId]
    )
    if (!result.rows.length) return reply.code(404).send({ error: 'Canal não encontrado' })
    await destroySession(id)
    await db.query(`DELETE FROM channel_sessions WHERE session_id = $1`, [`wab-${id}`])
    await db.query(`UPDATE channels SET status='disconnected', phone_number=NULL, updated_at=NOW() WHERE id=$1`, [id])
    const { getIO } = await import('../services/realtime.js')
    const io = getIO()
    if (io) io.to(`workspace:${workspaceId}`).emit('channel_disconnected', { channelId: id })
    return { ok: true }
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
