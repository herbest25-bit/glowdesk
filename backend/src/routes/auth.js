import { db } from '../utils/db.js'
import bcrypt from 'bcryptjs'

export async function authRoutes(fastify) {
  // Login
  fastify.post('/auth/login', async (req, reply) => {
    const { email, password } = req.body

    const result = await db.query(
      'SELECT * FROM users WHERE email = $1 AND status = $2',
      [email, 'active']
    )

    if (!result.rows.length) {
      return reply.status(401).send({ error: 'Email ou senha incorretos' })
    }

    const user = result.rows[0]
    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) {
      return reply.status(401).send({ error: 'Email ou senha incorretos' })
    }

    const token = fastify.jwt.sign(
      { id: user.id, workspaceId: user.workspace_id, role: user.role },
      { expiresIn: '7d' }
    )

    // Atualizar last_seen
    await db.query('UPDATE users SET last_seen_at = NOW() WHERE id = $1', [user.id])

    return reply.send({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatarUrl: user.avatar_url,
        workspaceId: user.workspace_id
      }
    })
  })

  // Registro (admin cria usuário)
  fastify.post('/auth/register', async (req, reply) => {
    const { name, email, password, workspaceId, role = 'agent' } = req.body

    const existing = await db.query('SELECT id FROM users WHERE email = $1', [email])
    if (existing.rows.length) {
      return reply.status(409).send({ error: 'Email já cadastrado' })
    }

    const password_hash = await bcrypt.hash(password, 10)

    const result = await db.query(
      `INSERT INTO users (workspace_id, name, email, password_hash, role)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, role`,
      [workspaceId, name, email, password_hash, role]
    )

    return reply.status(201).send({ user: result.rows[0] })
  })

  // Dados do usuário logado
  fastify.get('/auth/me', async (req, reply) => {
    const { workspaceId, id } = req.user

    const result = await db.query(
      `SELECT u.*, w.name as workspace_name, w.slug, w.settings as workspace_settings
       FROM users u JOIN workspaces w ON w.id = u.workspace_id
       WHERE u.id = $1`,
      [id]
    )

    return reply.send({ user: result.rows[0] })
  })
}
