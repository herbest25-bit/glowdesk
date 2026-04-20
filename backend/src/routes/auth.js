import { db } from '../utils/db.js'
import bcrypt from 'bcryptjs'

const DEMO_EMAIL    = 'demo@glowdeskhq.com.br'
const DEMO_PASSWORD = 'GlowDemo2025'
const DEMO_WORKSPACE_SLUG = 'demo-glowdesk'

async function ensureDemoAccount(fastify) {
  // Upsert workspace
  const ws = await db.query(
    `INSERT INTO workspaces (name, slug, settings)
     VALUES ('Demo GlowDesk', $1, '{"glow_active":true}')
     ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
     RETURNING *`,
    [DEMO_WORKSPACE_SLUG]
  )
  const workspaceId = ws.rows[0].id

  // Upsert user
  const hash = await bcrypt.hash(DEMO_PASSWORD, 10)
  const user = await db.query(
    `INSERT INTO users (workspace_id, name, email, password_hash, role)
     VALUES ($1, 'Demo Admin', $2, $3, 'admin')
     ON CONFLICT (email) DO UPDATE SET workspace_id = $1, password_hash = $3
     RETURNING *`,
    [workspaceId, DEMO_EMAIL, hash]
  )

  // Sample contacts (skip if already exist)
  const contacts = [
    { name: 'Ana Lima',     phone: '5511999110001' },
    { name: 'Carla Mendes', phone: '5511999110002' },
    { name: 'Julia Santos', phone: '5511999110003' },
  ]
  for (const c of contacts) {
    await db.query(
      `INSERT INTO contacts (workspace_id, name, phone)
       VALUES ($1, $2, $3) ON CONFLICT (workspace_id, phone) DO NOTHING`,
      [workspaceId, c.name, c.phone]
    )
  }

  // Sample pipeline (only create if none exists)
  const existingPipe = await db.query(`SELECT id FROM pipelines WHERE workspace_id = $1 LIMIT 1`, [workspaceId])
  let pipelineId = existingPipe.rows[0]?.id
  if (!pipelineId) {
    const pipe = await db.query(
      `INSERT INTO pipelines (workspace_id, name, is_default) VALUES ($1, 'Pipeline Demo', true) RETURNING id`,
      [workspaceId]
    )
    pipelineId = pipe.rows[0].id
    // Add default stages
    const stages = ['Novo Lead', 'Qualificado', 'Proposta Enviada', 'Fechado']
    for (let i = 0; i < stages.length; i++) {
      await db.query(
        `INSERT INTO pipeline_stages (pipeline_id, name, position) VALUES ($1, $2, $3)`,
        [pipelineId, stages[i], i]
      )
    }
  }

  return { workspaceId, user: user.rows[0] }
}

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

  // Acesso demo — cria conta demo e retorna token sem senha
  fastify.post('/auth/demo', async (req, reply) => {
    try {
      const { workspaceId, user } = await ensureDemoAccount(fastify)
      const token = fastify.jwt.sign(
        { id: user.id, workspaceId, role: user.role },
        { expiresIn: '7d' }
      )
      return reply.send({
        token,
        user: { id: user.id, name: user.name, email: user.email, role: user.role, workspaceId }
      })
    } catch (e) {
      console.error('[Demo] Erro:', e.message)
      return reply.status(500).send({ error: 'Erro ao criar conta demo' })
    }
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
