import { db } from '../utils/db.js'
import bcrypt from 'bcryptjs'

const DEMO_EMAIL    = 'demo@glowdeskhq.com.br'
const DEMO_PASSWORD = 'GlowDemo2025'
const DEMO_WORKSPACE_SLUG = 'demo-glowdesk'

async function ensureDemoAccount(fastify) {
  // 1. Upsert workspace
  const ws = await db.query(
    `INSERT INTO workspaces (name, slug, settings)
     VALUES ('Demo GlowDesk', $1, '{}')
     ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
     RETURNING *`,
    [DEMO_WORKSPACE_SLUG]
  )
  const workspaceId = ws.rows[0].id

  // 2. Upsert user (always refresh hash so password is always valid)
  const hash = await bcrypt.hash(DEMO_PASSWORD, 10)
  const user = await db.query(
    `INSERT INTO users (workspace_id, name, email, password_hash, role, status)
     VALUES ($1, 'Demo', $2, $3, 'admin', 'active')
     ON CONFLICT (email) DO UPDATE SET workspace_id = $1, password_hash = $3, status = 'active'
     RETURNING *`,
    [workspaceId, DEMO_EMAIL, hash]
  )

  // 3. Optional extras — don't fail if these break
  try {
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
  } catch (_) {}

  try {
    const existingPipe = await db.query(`SELECT id FROM pipelines WHERE workspace_id = $1 LIMIT 1`, [workspaceId])
    if (!existingPipe.rows.length) {
      const pipe = await db.query(
        `INSERT INTO pipelines (workspace_id, name, is_default) VALUES ($1, 'Pipeline Demo', true) RETURNING id`,
        [workspaceId]
      )
      const stages = ['Novo Lead', 'Qualificado', 'Proposta Enviada', 'Fechado']
      for (let i = 0; i < stages.length; i++) {
        await db.query(
          `INSERT INTO pipeline_stages (pipeline_id, name, position) VALUES ($1, $2, $3)`,
          [pipe.rows[0].id, stages[i], i]
        )
      }
    }
  } catch (_) {}

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
      console.log('[Demo] Iniciando...')
      const { workspaceId, user } = await ensureDemoAccount(fastify)
      console.log('[Demo] Conta OK:', user.email, 'workspace:', workspaceId)
      const token = fastify.jwt.sign(
        { id: user.id, workspaceId, role: user.role },
        { expiresIn: '7d' }
      )
      return reply.send({
        token,
        user: { id: user.id, name: user.name, email: user.email, role: user.role, workspaceId }
      })
    } catch (e) {
      console.error('[Demo] Erro detalhado:', e.message, e.stack)
      return reply.status(500).send({ error: `Erro ao criar conta demo: ${e.message}` })
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
