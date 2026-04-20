import { db } from '../utils/db.js'

export async function authMiddleware(fastify) {
  fastify.addHook('preHandler', async (req, reply) => {
    const publicPaths = ['/webhook', '/auth/login', '/auth/register', '/auth/demo', '/health']
    if (publicPaths.some(p => req.url.startsWith(p))) return

    try {
      const decoded = await req.jwtVerify()

      const user = await db.query(
        'SELECT id, workspace_id, name, email, role FROM users WHERE id = $1 AND status = $2',
        [decoded.id, 'active']
      )

      if (!user.rows.length) {
        return reply.status(401).send({ error: 'Usuário inativo ou não encontrado' })
      }

      req.user = { ...decoded, ...user.rows[0] }
    } catch (err) {
      return reply.status(401).send({ error: 'Token inválido ou expirado' })
    }
  })
}
