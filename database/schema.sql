-- ============================================
-- GlowDesk - WhatsApp CRM para Cosméticos
-- Schema completo do banco de dados
-- ============================================

-- Extensões
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- busca por texto

-- ============================================
-- EMPRESA / WORKSPACE
-- ============================================
CREATE TABLE workspaces (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  logo_url TEXT,
  timezone VARCHAR(100) DEFAULT 'America/Sao_Paulo',
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- USUÁRIOS / EQUIPE
-- ============================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  avatar_url TEXT,
  role VARCHAR(50) DEFAULT 'agent', -- admin, supervisor, agent
  status VARCHAR(50) DEFAULT 'active', -- active, inactive
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- NÚMEROS WHATSAPP (multi-número)
-- ============================================
CREATE TABLE whatsapp_numbers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  display_name VARCHAR(255) NOT NULL,
  phone_number VARCHAR(50) NOT NULL,
  phone_number_id VARCHAR(255) NOT NULL, -- Meta API
  business_account_id VARCHAR(255),
  access_token TEXT NOT NULL,
  webhook_verify_token TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  ai_enabled BOOLEAN DEFAULT true, -- IA ativa neste número
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PIPELINE DE VENDAS (estilo Kommo)
-- ============================================
CREATE TABLE pipelines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE pipeline_stages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pipeline_id UUID NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  color VARCHAR(7) DEFAULT '#6366f1', -- hex color
  position INTEGER NOT NULL DEFAULT 0,
  is_won BOOLEAN DEFAULT false,
  is_lost BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- CONTATOS / LEADS
-- ============================================
CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name VARCHAR(255),
  phone VARCHAR(50) NOT NULL,
  email VARCHAR(255),
  avatar_url TEXT,
  tags TEXT[] DEFAULT '{}',
  custom_fields JSONB DEFAULT '{}',
  -- Dados de qualificação
  lead_score INTEGER DEFAULT 0,
  total_spent DECIMAL(10,2) DEFAULT 0,
  purchase_count INTEGER DEFAULT 0,
  -- Controle
  is_blocked BOOLEAN DEFAULT false,
  opted_out BOOLEAN DEFAULT false, -- optou por não receber mensagens
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, phone)
);

-- ============================================
-- NEGÓCIOS / DEALS (cards no kanban)
-- ============================================
CREATE TABLE deals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  pipeline_id UUID NOT NULL REFERENCES pipelines(id),
  stage_id UUID NOT NULL REFERENCES pipeline_stages(id),
  assigned_to UUID REFERENCES users(id),
  title VARCHAR(255) NOT NULL,
  value DECIMAL(10,2) DEFAULT 0,
  expected_close_date DATE,
  status VARCHAR(50) DEFAULT 'open', -- open, won, lost
  lost_reason TEXT,
  custom_fields JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- CONVERSAS (inbox)
-- ============================================
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  whatsapp_number_id UUID NOT NULL REFERENCES whatsapp_numbers(id),
  deal_id UUID REFERENCES deals(id),
  assigned_to UUID REFERENCES users(id),
  status VARCHAR(50) DEFAULT 'open', -- open, pending, resolved, bot
  ai_mode BOOLEAN DEFAULT true, -- IA está respondendo?
  ai_context JSONB DEFAULT '{}', -- contexto/memória da IA
  unread_count INTEGER DEFAULT 0,
  last_message TEXT,
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- MENSAGENS
-- ============================================
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  whatsapp_message_id VARCHAR(255), -- ID da Meta
  direction VARCHAR(10) NOT NULL, -- inbound | outbound
  sender_type VARCHAR(20) NOT NULL, -- contact | agent | ai | system
  sender_id UUID, -- user_id se agente humano
  content TEXT,
  content_type VARCHAR(50) DEFAULT 'text', -- text, image, audio, video, document, sticker
  media_url TEXT,
  media_caption TEXT,
  is_read BOOLEAN DEFAULT false,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TAREFAS
-- ============================================
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id),
  assigned_to UUID REFERENCES users(id),
  created_by UUID REFERENCES users(id),
  title VARCHAR(500) NOT NULL,
  description TEXT,
  type VARCHAR(50) DEFAULT 'follow_up', -- follow_up, call, meeting, send_message, custom
  priority VARCHAR(20) DEFAULT 'medium', -- low, medium, high
  status VARCHAR(50) DEFAULT 'pending', -- pending, in_progress, done, cancelled
  due_date TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- CHAT INTERNO DA EQUIPE
-- ============================================
CREATE TABLE internal_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id),
  recipient_id UUID REFERENCES users(id), -- null = mensagem de grupo/canal
  conversation_id UUID REFERENCES conversations(id), -- menção em conversa
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- AUTOMAÇÕES
-- ============================================
CREATE TABLE automations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  trigger_type VARCHAR(100) NOT NULL, -- new_contact, keyword, stage_change, inactivity, schedule
  trigger_config JSONB DEFAULT '{}',
  actions JSONB DEFAULT '[]', -- array de ações a executar
  is_active BOOLEAN DEFAULT true,
  runs_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- FORMULÁRIOS DE CAPTAÇÃO
-- ============================================
CREATE TABLE forms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  pipeline_id UUID REFERENCES pipelines(id),
  stage_id UUID REFERENCES pipeline_stages(id), -- onde o lead cai
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  fields JSONB NOT NULL DEFAULT '[]',
  theme JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  submissions_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE form_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  form_id UUID NOT NULL REFERENCES forms(id),
  contact_id UUID REFERENCES contacts(id),
  data JSONB NOT NULL,
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ETIQUETAS (TAGS)
-- ============================================
CREATE TABLE labels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  color VARCHAR(7) DEFAULT '#6366f1',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, name)
);

-- ============================================
-- CONTROLE DE ACESSO (quem vê qual inbox)
-- ============================================
CREATE TABLE inbox_permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  whatsapp_number_id UUID NOT NULL REFERENCES whatsapp_numbers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  can_view BOOLEAN DEFAULT true,
  can_reply BOOLEAN DEFAULT true,
  can_assign BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(whatsapp_number_id, user_id)
);

-- ============================================
-- RELATÓRIOS / ANALYTICS (cache)
-- ============================================
CREATE TABLE analytics_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  metrics JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, date)
);

-- ============================================
-- ÍNDICES PARA PERFORMANCE
-- ============================================
CREATE INDEX idx_contacts_workspace ON contacts(workspace_id);
CREATE INDEX idx_contacts_phone ON contacts(phone);
CREATE INDEX idx_conversations_workspace ON conversations(workspace_id);
CREATE INDEX idx_conversations_contact ON conversations(contact_id);
CREATE INDEX idx_conversations_status ON conversations(status);
CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_messages_created ON messages(created_at DESC);
CREATE INDEX idx_deals_workspace ON deals(workspace_id);
CREATE INDEX idx_deals_stage ON deals(stage_id);
CREATE INDEX idx_tasks_assigned ON tasks(assigned_to);
CREATE INDEX idx_tasks_due ON tasks(due_date);

-- ============================================
-- DADOS INICIAIS
-- ============================================

-- Workspace padrão
INSERT INTO workspaces (id, name, slug) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Minha Loja', 'minha-loja');

-- Pipeline padrão para cosméticos
INSERT INTO pipelines (id, workspace_id, name, is_default) VALUES
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Vendas', true);

-- Etapas do funil
INSERT INTO pipeline_stages (pipeline_id, name, color, position) VALUES
  ('00000000-0000-0000-0000-000000000002', 'Novo Lead', '#6366f1', 0),
  ('00000000-0000-0000-0000-000000000002', 'Em Atendimento', '#f59e0b', 1),
  ('00000000-0000-0000-0000-000000000002', 'Proposta Enviada', '#3b82f6', 2),
  ('00000000-0000-0000-0000-000000000002', 'Aguardando Pagamento', '#8b5cf6', 3),
  ('00000000-0000-0000-0000-000000000002', 'Pedido Confirmado', '#10b981', 4),
  ('00000000-0000-0000-0000-000000000002', 'Entregue', '#06b6d4', 5),
  ('00000000-0000-0000-0000-000000000002', 'Perdido', '#ef4444', 6);

-- Etiquetas padrão para cosméticos
INSERT INTO labels (workspace_id, name, color) VALUES
  ('00000000-0000-0000-0000-000000000001', 'VIP', '#f59e0b'),
  ('00000000-0000-0000-0000-000000000001', 'Cliente Fiel', '#10b981'),
  ('00000000-0000-0000-0000-000000000001', 'Primeira Compra', '#6366f1'),
  ('00000000-0000-0000-0000-000000000001', 'Interessa em Maquiagem', '#ec4899'),
  ('00000000-0000-0000-0000-000000000001', 'Interessa em Skincare', '#06b6d4'),
  ('00000000-0000-0000-0000-000000000001', 'Recompra', '#8b5cf6'),
  ('00000000-0000-0000-0000-000000000001', 'Carrinho Abandonado', '#ef4444');
