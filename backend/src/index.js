import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'

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
fastify.get('/health', async () => ({ status: 'ok', version: '1.0.0' }))
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
  await db.query(`
    CREATE TABLE IF NOT EXISTS channel_sessions (
      session_id VARCHAR(255) PRIMARY KEY,
      session_data TEXT NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)
  console.log('[Migration] channel_sessions: OK')
} catch (e) { console.log('[Migration] channel_sessions ERRO:', e.message) }

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
