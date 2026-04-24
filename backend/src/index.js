import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import bcrypt from 'bcryptjs'

import { authRoutes } from './routes/auth.js'
import { conversationRoutes } from './routes/conversations.js'
import { contactRoutes } from './routes/contacts.js'
import { pipelineRoutes } from './routes/pipeline.js'
import { analyticsRoutes } from './routes/analytics.js'
import { taskRoutes } from './routes/tasks.js'
import channelsRoutes from './routes/channels.js'
import { glowRoutes } from './routes/glow.js'
import { authMiddleware } from './middleware/auth.js'
import { initChannels } from './services/whatsapp-web.js'
import { verifyWebhook, receiveWebhook } from './webhooks/whatsapp.js'
import { initRealtime } from './services/realtime.js'
import { initQueue } from './queue/index.js'
import { db } from './utils/db.js'

const fastify = Fastify({ logger: false })

// ── Plugins ────────────────────────────────────────────────────
await fastify.register(cors, {
  origin: (origin, cb) => {
    const allowed = [
      process.env.FRONTEND_URL,
      'http://localhost:3000',
      'http://localhost:3001',
    ].filter(Boolean)
    // Permite *.vercel.app, *.glowdeskhq.com.br e domínios configurados
    if (!origin || allowed.includes(origin) || origin.endsWith('.vercel.app') || origin.endsWith('.glowdeskhq.com.br') || origin === 'https://glowdeskhq.com.br') {
      cb(null, true)
    } else {
      cb(new Error('Not allowed by CORS'), false)
    }
  },
  credentials: true
})

await fastify.register(jwt, {
  secret: process.env.JWT_SECRET
})

// ── Auth middleware ────────────────────────────────────────────
// Chamar diretamente (não via register) para que o hook seja global
authMiddleware(fastify)

// ── Rotas públicas ─────────────────────────────────────────────
fastify.get('/health', async () => ({ status: 'ok', version: '2.0.0-baileys' }))
fastify.get('/webhook/whatsapp', verifyWebhook)
fastify.post('/webhook/whatsapp', receiveWebhook)

// ── API ────────────────────────────────────────────────────────
await fastify.register(authRoutes)
await fastify.register(conversationRoutes, { prefix: '/api' })
await fastify.register(contactRoutes, { prefix: '/api' })
await fastify.register(pipelineRoutes, { prefix: '/api' })
await fastify.register(analyticsRoutes, { prefix: '/api' })
await fastify.register(taskRoutes, { prefix: '/api' })
await fastify.register(channelsRoutes)
await fastify.register(glowRoutes)

// ── Migrações ──────────────────────────────────────────────────
try {
  await db.query(`ALTER TABLE conversations ALTER COLUMN whatsapp_number_id DROP NOT NULL`)
  console.log('[Migration] whatsapp_number_id: nullable OK')
} catch (e) { console.log('[Migration] whatsapp_number_id:', e.message) }
try {
  await db.query(`ALTER TABLE conversations ADD COLUMN IF NOT EXISTS channel_id UUID`)
  console.log('[Migration] channel_id: OK')
} catch (e) { console.log('[Migration] channel_id ERRO:', e.message) }
try {
  await db.query(`
    CREATE TABLE IF NOT EXISTS channels (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      phone_number VARCHAR(50),
      status VARCHAR(20) DEFAULT 'disconnected',
      connected_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)
} catch (_) {}
try {
  await db.query(`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS is_group BOOLEAN DEFAULT false`)
  console.log('[Migration] contacts.is_group: OK')
} catch (e) { console.log('[Migration] contacts.is_group ERRO:', e.message) }
try {
  await db.query(`
    CREATE TABLE IF NOT EXISTS channel_sessions (
      session_id VARCHAR(255) PRIMARY KEY,
      session_data TEXT NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)
  console.log('[Migration] channel_sessions: OK')
} catch (e) { console.log('[Migration] channel_sessions ERRO:', e.message) }
try {
  await db.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS whatsapp_message_id VARCHAR(255)`)
  console.log('[Migration] messages.whatsapp_message_id: OK')
} catch (e) { console.log('[Migration] messages.whatsapp_message_id ERRO:', e.message) }
try {
  await db.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_url TEXT`)
  console.log('[Migration] messages.media_url: OK')
} catch (e) { console.log('[Migration] messages.media_url ERRO:', e.message) }
try {
  await db.query(`CREATE UNIQUE INDEX IF NOT EXISTS messages_whatsapp_message_id_idx ON messages(whatsapp_message_id) WHERE whatsapp_message_id IS NOT NULL`)
  console.log('[Migration] messages.whatsapp_message_id unique index: OK')
} catch (e) { console.log('[Migration] messages unique index ERRO:', e.message) }
try {
  // Migrar chave de sessão baileys-{id} → wab-{id}
  await db.query(`
    INSERT INTO channel_sessions (session_id, session_data, updated_at)
    SELECT REPLACE(session_id, 'baileys-', 'wab-'), session_data, NOW()
    FROM channel_sessions
    WHERE session_id LIKE 'baileys-%'
    ON CONFLICT (session_id) DO NOTHING
  `)
  console.log('[Migration] channel_sessions key rename: OK')
} catch (e) { console.log('[Migration] channel_sessions rename ERRO:', e.message) }

// Preencher channel_id em conversas antigas que não têm
try {
  await db.query(`
    UPDATE conversations c
    SET channel_id = ch.id
    FROM channels ch
    WHERE c.channel_id IS NULL
      AND ch.workspace_id = c.workspace_id
      AND ch.status = 'connected'
  `)
  console.log('[Migration] conversations.channel_id backfill: OK')
} catch (e) { console.log('[Migration] conversations.channel_id backfill ERRO:', e.message) }

// ── Garantir tabelas de pipeline e pipeline padrão ────────────
try {
  await db.query(`
    CREATE TABLE IF NOT EXISTS pipelines (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL DEFAULT 'Pipeline de Vendas',
      is_default BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)
  await db.query(`
    CREATE TABLE IF NOT EXISTS pipeline_stages (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      pipeline_id UUID NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      color VARCHAR(50) DEFAULT '#7c3aed',
      position INTEGER DEFAULT 0,
      is_won BOOLEAN DEFAULT false,
      is_lost BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)
  await db.query(`
    CREATE TABLE IF NOT EXISTS deals (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
      pipeline_id UUID REFERENCES pipelines(id) ON DELETE CASCADE,
      stage_id UUID REFERENCES pipeline_stages(id) ON DELETE SET NULL,
      assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
      title VARCHAR(255) NOT NULL,
      value NUMERIC(12,2) DEFAULT 0,
      status VARCHAR(20) DEFAULT 'open',
      lost_reason TEXT,
      expected_close_date DATE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)
  // Criar pipeline padrão para workspaces que não têm
  const workspaces = await db.query(`SELECT id FROM workspaces`)
  for (const ws of workspaces.rows) {
    const existing = await db.query(`SELECT id FROM pipelines WHERE workspace_id=$1 LIMIT 1`, [ws.id])
    if (!existing.rows.length) {
      const pipe = await db.query(
        `INSERT INTO pipelines (workspace_id, name, is_default) VALUES ($1,'Pipeline de Vendas',true) RETURNING id`,
        [ws.id]
      )
      const pid = pipe.rows[0].id
      const stages = [
        { name: 'Primeiro Contato', color: '#7c3aed', pos: 0 },
        { name: 'Qualificação',     color: '#0891b2', pos: 1 },
        { name: 'Proposta Enviada', color: '#ca8a04', pos: 2 },
        { name: 'Negociação',       color: '#ea580c', pos: 3 },
        { name: 'Fechado',          color: '#16a34a', pos: 4, won: true },
        { name: 'Perdido',          color: '#dc2626', pos: 5, lost: true },
      ]
      for (const s of stages) {
        await db.query(
          `INSERT INTO pipeline_stages (pipeline_id,name,color,position,is_won,is_lost) VALUES ($1,$2,$3,$4,$5,$6)`,
          [pid, s.name, s.color, s.pos, s.won||false, s.lost||false]
        )
      }
      console.log(`[Migration] Pipeline padrão criado para workspace ${ws.id}`)
    }
  }
  console.log('[Migration] pipeline tables: OK')
} catch (e) { console.log('[Migration] pipeline ERRO:', e.message) }

// ── Corrigir hashes SHA256 → bcrypt e garantir admin ──────────
try {
  // Usuários com hash não-bcrypt (SHA256 do create-admin.js antigo)
  const badHashes = await db.query(
    `SELECT id, email FROM users WHERE password_hash NOT LIKE '$2%'`
  )
  if (badHashes.rows.length) {
    const newPass  = process.env.ADMIN_DEFAULT_PASSWORD || 'GlowDesk2025!'
    const newHash  = await bcrypt.hash(newPass, 10)
    for (const u of badHashes.rows) {
      await db.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [newHash, u.id])
    }
    console.log(`[Migration] Senha de ${badHashes.rows.length} usuário(s) resetada → ${newPass}`)
    console.log('[Migration] Emails afetados:', badHashes.rows.map(u => u.email).join(', '))
  }
} catch (e) { console.log('[Migration] fix-hashes ERRO:', e.message) }

// ── Iniciar servidor ───────────────────────────────────────────
const PORT = Number(process.env.PORT) || 3001

await fastify.listen({ port: PORT, host: '::' })

// Socket.io usa o servidor interno do Fastify
initRealtime(fastify.server)

// Fila de tarefas (pg-boss)
initQueue().catch(err => console.warn('[Queue]', err.message))

// Reconectar canais WhatsApp Web salvos
initChannels().catch(err => console.warn('[Channels]', err.message))

// Agendador da Glow (verifica a cada minuto)
setInterval(async () => {
  try {
    const workspaces = await db.query(
      `SELECT id, settings FROM workspaces WHERE settings->>'glow_schedule_enabled' = 'true'`
    )
    for (const ws of workspaces.rows) {
      const s = ws.settings
      const now = new Date()
      const pad = n => String(n).padStart(2, '0')
      const current = `${pad(now.getHours())}:${pad(now.getMinutes())}`
      const activate = s.glow_activate_at || '08:00'
      const deactivate = s.glow_deactivate_at || '18:00'
      const shouldBeActive = current >= activate && current < deactivate
      const isActive = s.glow_active !== false
      if (shouldBeActive !== isActive) {
        await db.query(
          `UPDATE workspaces SET settings = settings || $1 WHERE id = $2`,
          [JSON.stringify({ glow_active: shouldBeActive }), ws.id]
        )
        await db.query(
          `UPDATE whatsapp_numbers SET ai_enabled = $1 WHERE workspace_id = $2`,
          [shouldBeActive, ws.id]
        )
        console.log(`[Glow] Workspace ${ws.id}: IA ${shouldBeActive ? 'ativada' : 'desativada'} automaticamente`)
      }
    }
  } catch (e) {
    console.error('[Glow] Erro no agendador:', e.message)
  }
}, 60_000)

console.log(`
  ┌─────────────────────────────────────────┐
  │         GlowDesk API v1.0.0             │
  │  http://localhost:${PORT}                   │
  │  Webhook: /webhook/whatsapp             │
  └─────────────────────────────────────────┘
`)
