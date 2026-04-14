-- ============================================================
-- GlowDesk — Schema para Supabase
-- Execute este arquivo no SQL Editor do Supabase
-- ============================================================

-- Extensões (já disponíveis no Supabase, mas declaramos por segurança)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================
-- WORKSPACE
-- ============================================================
CREATE TABLE IF NOT EXISTS workspaces (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  logo_url TEXT,
  timezone VARCHAR(100) DEFAULT 'America/Sao_Paulo',
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- USUÁRIOS
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  avatar_url TEXT,
  role VARCHAR(50) DEFAULT 'agent',
  status VARCHAR(50) DEFAULT 'active',
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CANAIS WHATSAPP
-- ============================================================
CREATE TABLE IF NOT EXISTS whatsapp_numbers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  display_name VARCHAR(255) NOT NULL,
  phone_number VARCHAR(50) NOT NULL,
  phone_number_id VARCHAR(255) NOT NULL,
  business_account_id VARCHAR(255),
  access_token TEXT NOT NULL,
  webhook_verify_token TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  ai_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PIPELINE DE VENDAS
-- ============================================================
CREATE TABLE IF NOT EXISTS pipelines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pipeline_stages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pipeline_id UUID NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  color VARCHAR(7) DEFAULT '#6366f1',
  position INTEGER NOT NULL DEFAULT 0,
  is_won BOOLEAN DEFAULT false,
  is_lost BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CONTATOS / LEADS
-- ============================================================
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name VARCHAR(255),
  phone VARCHAR(50) NOT NULL,
  email VARCHAR(255),
  avatar_url TEXT,
  tags TEXT[] DEFAULT '{}',
  custom_fields JSONB DEFAULT '{}',
  lead_score INTEGER DEFAULT 0,
  total_spent DECIMAL(10,2) DEFAULT 0,
  purchase_count INTEGER DEFAULT 0,
  is_blocked BOOLEAN DEFAULT false,
  opted_out BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, phone)
);

-- ============================================================
-- NEGÓCIOS (KANBAN)
-- ============================================================
CREATE TABLE IF NOT EXISTS deals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  pipeline_id UUID NOT NULL REFERENCES pipelines(id),
  stage_id UUID NOT NULL REFERENCES pipeline_stages(id),
  assigned_to UUID REFERENCES users(id),
  title VARCHAR(255) NOT NULL,
  value DECIMAL(10,2) DEFAULT 0,
  expected_close_date DATE,
  status VARCHAR(50) DEFAULT 'open',
  lost_reason TEXT,
  custom_fields JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CONVERSAS (INBOX)
-- ============================================================
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  whatsapp_number_id UUID NOT NULL REFERENCES whatsapp_numbers(id),
  deal_id UUID REFERENCES deals(id),
  assigned_to UUID REFERENCES users(id),
  status VARCHAR(50) DEFAULT 'open',
  ai_mode BOOLEAN DEFAULT true,
  ai_context JSONB DEFAULT '{}',
  unread_count INTEGER DEFAULT 0,
  last_message TEXT,
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- MENSAGENS
-- ============================================================
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  whatsapp_message_id VARCHAR(255),
  direction VARCHAR(10) NOT NULL,
  sender_type VARCHAR(20) NOT NULL,
  sender_id UUID,
  content TEXT,
  content_type VARCHAR(50) DEFAULT 'text',
  media_url TEXT,
  media_caption TEXT,
  is_read BOOLEAN DEFAULT false,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TAREFAS
-- ============================================================
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id),
  assigned_to UUID REFERENCES users(id),
  created_by UUID REFERENCES users(id),
  title VARCHAR(500) NOT NULL,
  description TEXT,
  type VARCHAR(50) DEFAULT 'follow_up',
  priority VARCHAR(20) DEFAULT 'medium',
  status VARCHAR(50) DEFAULT 'pending',
  due_date TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- AUTOMAÇÕES
-- ============================================================
CREATE TABLE IF NOT EXISTS automations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  trigger_type VARCHAR(100) NOT NULL,
  trigger_config JSONB DEFAULT '{}',
  actions JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  runs_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- FORMULÁRIOS
-- ============================================================
CREATE TABLE IF NOT EXISTS forms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  pipeline_id UUID REFERENCES pipelines(id),
  stage_id UUID REFERENCES pipeline_stages(id),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  fields JSONB NOT NULL DEFAULT '[]',
  theme JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  submissions_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS form_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  form_id UUID NOT NULL REFERENCES forms(id),
  contact_id UUID REFERENCES contacts(id),
  data JSONB NOT NULL,
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ETIQUETAS
-- ============================================================
CREATE TABLE IF NOT EXISTS labels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  color VARCHAR(7) DEFAULT '#6366f1',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, name)
);

-- ============================================================
-- PERMISSÕES DE INBOX
-- ============================================================
CREATE TABLE IF NOT EXISTS inbox_permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  whatsapp_number_id UUID NOT NULL REFERENCES whatsapp_numbers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  can_view BOOLEAN DEFAULT true,
  can_reply BOOLEAN DEFAULT true,
  can_assign BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(whatsapp_number_id, user_id)
);

-- ============================================================
-- ANALYTICS (cache)
-- ============================================================
CREATE TABLE IF NOT EXISTS analytics_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  metrics JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, date)
);

-- ============================================================
-- ÍNDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_contacts_workspace ON contacts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_contacts_phone ON contacts(phone);
CREATE INDEX IF NOT EXISTS idx_conversations_workspace ON conversations(workspace_id);
CREATE INDEX IF NOT EXISTS idx_conversations_contact ON conversations(contact_id);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deals_workspace ON deals(workspace_id);
CREATE INDEX IF NOT EXISTS idx_deals_stage ON deals(stage_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(due_date);

-- ============================================================
-- ROW LEVEL SECURITY (RLS) — segurança por workspace
-- ============================================================
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE automations ENABLE ROW LEVEL SECURITY;

-- Política: backend com service_role bypassa RLS (acesso total)
-- O frontend nunca acessa o Supabase diretamente — passa sempre pelo backend

-- ============================================================
-- DADOS INICIAIS (seed)
-- ============================================================
INSERT INTO workspaces (id, name, slug) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Minha Loja', 'minha-loja')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO pipelines (id, workspace_id, name, is_default) VALUES
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Vendas', true)
ON CONFLICT DO NOTHING;

INSERT INTO pipeline_stages (pipeline_id, name, color, position) VALUES
  ('00000000-0000-0000-0000-000000000002', 'Novo Lead',              '#6366f1', 0),
  ('00000000-0000-0000-0000-000000000002', 'Em Atendimento',         '#f59e0b', 1),
  ('00000000-0000-0000-0000-000000000002', 'Proposta Enviada',       '#3b82f6', 2),
  ('00000000-0000-0000-0000-000000000002', 'Aguardando Pagamento',   '#8b5cf6', 3),
  ('00000000-0000-0000-0000-000000000002', 'Pedido Confirmado',      '#10b981', 4),
  ('00000000-0000-0000-0000-000000000002', 'Entregue',               '#06b6d4', 5),
  ('00000000-0000-0000-0000-000000000002', 'Perdido',                '#ef4444', 6)
ON CONFLICT DO NOTHING;

INSERT INTO labels (workspace_id, name, color) VALUES
  ('00000000-0000-0000-0000-000000000001', 'VIP',                       '#f59e0b'),
  ('00000000-0000-0000-0000-000000000001', 'Cliente Fiel',              '#10b981'),
  ('00000000-0000-0000-0000-000000000001', 'Primeira Compra',           '#6366f1'),
  ('00000000-0000-0000-0000-000000000001', 'Interessa em Maquiagem',    '#ec4899'),
  ('00000000-0000-0000-0000-000000000001', 'Interessa em Skincare',     '#06b6d4'),
  ('00000000-0000-0000-0000-000000000001', 'Recompra',                  '#8b5cf6'),
  ('00000000-0000-0000-0000-000000000001', 'Carrinho Abandonado',       '#ef4444')
ON CONFLICT DO NOTHING;
