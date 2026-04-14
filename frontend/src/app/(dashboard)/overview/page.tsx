'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import {
  MessageSquare, Bot, Users, CheckSquare, TrendingUp,
  DollarSign, Clock, AlertCircle, ArrowRight, Zap,
  Phone, Star, CheckCircle, Circle, RefreshCw,
  Target, BarChart2, UserCog
} from 'lucide-react'

type Overview = {
  conversations: { open: number; bot: number; human: number; waiting: number }
  messages: { today: number; ai_sent: number }
  deals: { open: number; pipeline_value: number; won_today: number; revenue_today: number }
  tasks: { pending: number; due_today: number; overdue: number }
  contacts: { total: number; new_today: number }
  recent_conversations: {
    id: string
    contact_name: string
    contact_phone: string
    last_message: string
    last_message_at: string
    bot_active: boolean
    assigned_agent: string | null
    lead_score: number
  }[]
  recent_tasks: {
    id: string
    title: string
    priority: string
    due_date: string | null
    status: string
  }[]
  pipeline_stages: { stage: string; count: number; value: number; color: string }[]
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'agora'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

export default function OverviewPage() {
  const router = useRouter()
  const [data, setData] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())

  useEffect(() => {
    load()
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [])

  async function load() {
    setRefreshing(true)
    try {
      const [dashboard, convData, tasksData, pipelineData] = await Promise.all([
        api.get('/api/analytics/dashboard?period=1d'),
        api.get('/api/conversations?limit=6'),
        api.get('/api/tasks?limit=5'),
        api.get('/api/pipeline')
      ])

      const conversations = convData.conversations || []
      const tasks = tasksData.tasks || []
      const stages = pipelineData.stages || []

      const stageColors: Record<string, string> = {
        'Novo Lead':   '#7c3aed',
        'Qualificado': '#3b82f6',
        'Proposta':    '#f59e0b',
        'Negociação':  '#ec4899',
        'Ganho':       '#10b981',
        'Perdido':     '#6b7280',
      }

      setData({
        conversations: {
          open:    dashboard.conversations?.open_count || 0,
          bot:     dashboard.conversations?.bot_count || 0,
          human:   (dashboard.conversations?.open_count || 0) - (dashboard.conversations?.bot_count || 0),
          waiting: 0,
        },
        messages: {
          today:   dashboard.messages?.received || 0,
          ai_sent: dashboard.messages?.ai_sent || 0,
        },
        deals: {
          open:           dashboard.deals?.open_deals || 0,
          pipeline_value: dashboard.deals?.pipeline_value || 0,
          won_today:      dashboard.deals?.won_deals || 0,
          revenue_today:  dashboard.deals?.revenue || 0,
        },
        tasks: {
          pending:  tasks.filter((t: { status: string }) => t.status !== 'done').length,
          due_today: tasks.filter((t: { status: string; due_date: string | null }) => {
            if (!t.due_date) return false
            return new Date(t.due_date).toDateString() === new Date().toDateString()
          }).length,
          overdue: tasks.filter((t: { status: string; due_date: string | null }) => {
            if (!t.due_date || t.status === 'done') return false
            return new Date(t.due_date) < new Date()
          }).length,
        },
        contacts: {
          total:     dashboard.contacts?.new_contacts || 0,
          new_today: dashboard.contacts?.new_contacts || 0,
        },
        recent_conversations: conversations.slice(0, 6).map((c: {
          id: string; contact_name: string; contact_phone: string;
          last_message: string; last_message_at: string; bot_active: boolean;
          assigned_agent: string | null; lead_score: number
        }) => ({
          id:             c.id,
          contact_name:   c.contact_name || c.contact_phone,
          contact_phone:  c.contact_phone,
          last_message:   c.last_message || '',
          last_message_at: c.last_message_at || new Date().toISOString(),
          bot_active:     c.bot_active,
          assigned_agent: c.assigned_agent,
          lead_score:     c.lead_score || 0,
        })),
        recent_tasks:    tasks.slice(0, 5),
        pipeline_stages: stages.map((s: { name: string; deals: { id: string; value: number }[] }) => ({
          stage: s.name,
          count: s.deals?.length || 0,
          value: s.deals?.reduce((acc: number, d: { value: number }) => acc + (d.value || 0), 0) || 0,
          color: stageColors[s.name] || '#7c3aed',
        })),
      })
      setLastUpdate(new Date())
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Bom dia'
    if (h < 18) return 'Boa tarde'
    return 'Boa noite'
  }

  const priorityColor: Record<string, string> = {
    high:   'bg-red-500/20 text-red-400',
    medium: 'bg-amber-500/20 text-amber-400',
    low:    'bg-slate-500/20 text-slate-400',
  }
  const priorityLabel: Record<string, string> = { high: 'Alta', medium: 'Média', low: 'Baixa' }

  const colorMap: Record<string, { bg: string; text: string }> = {
    violet: { bg: 'rgba(124,58,237,0.18)', text: '#c4b5fd' },
    green:  { bg: 'rgba(16,185,129,0.18)', text: '#6ee7b7' },
    amber:  { bg: 'rgba(245,158,11,0.18)', text: '#fcd34d' },
    blue:   { bg: 'rgba(59,130,246,0.18)', text: '#93c5fd' },
    red:    { bg: 'rgba(239,68,68,0.18)',  text: '#fca5a5' },
  }

  const kpis = data ? [
    { icon: MessageSquare, label: 'Conversas abertas',    value: data.conversations.open,    sub: `${data.conversations.bot} com Glow IA`,       color: 'violet', href: '/inbox'    },
    { icon: Bot,           label: 'Atendidas pela Glow',  value: data.messages.ai_sent,      sub: 'mensagens hoje',                               color: 'violet', href: '/inbox'    },
    { icon: Users,         label: 'Novos contatos hoje',  value: data.contacts.new_today,    sub: 'pelo WhatsApp',                                color: 'blue',   href: '/contacts' },
    { icon: TrendingUp,    label: 'Negócios no funil',    value: data.deals.open,            sub: `R$ ${Number(data.deals.pipeline_value).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} em valor`, color: 'amber', href: '/pipeline' },
    { icon: CheckSquare,   label: 'Tarefas pendentes',    value: data.tasks.pending,         sub: data.tasks.overdue > 0 ? `${data.tasks.overdue} atrasada(s)` : 'em dia', color: data.tasks.overdue > 0 ? 'red' : 'green', href: '/tasks' },
    { icon: DollarSign,    label: 'Receita hoje',         value: `R$ ${Number(data.deals.revenue_today).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`, sub: `${data.deals.won_today} venda(s) fechada(s)`, color: 'green', href: '/analytics' },
  ] : []

  const teamShortcuts = [
    { icon: Star,          label: 'Desempenho',     tab: 'performance',  color: 'rgba(245,158,11,0.18)', text: '#fcd34d' },
    { icon: Target,        label: 'Metas',          tab: 'goals',        color: 'rgba(16,185,129,0.18)', text: '#6ee7b7' },
    { icon: TrendingUp,    label: 'Desenvolvimento', tab: 'development', color: 'rgba(59,130,246,0.18)', text: '#93c5fd' },
    { icon: BarChart2,     label: 'Insights',       tab: 'insights',     color: 'rgba(124,58,237,0.18)', text: '#c4b5fd' },
    { icon: MessageSquare, label: 'Feedback',       tab: 'feedback',     color: 'rgba(236,72,153,0.18)', text: '#f9a8d4' },
    { icon: Users,         label: 'Reuniões 1:1',   tab: 'meetings',     color: 'rgba(99,102,241,0.18)', text: '#a5b4fc' },
    { icon: CheckSquare,   label: 'Checklist',      tab: 'checklist',    color: 'rgba(20,184,166,0.18)', text: '#5eead4' },
    { icon: Clock,         label: 'Ponto Digital',  tab: 'timeclock',    color: 'rgba(249,115,22,0.18)', text: '#fdba74' },
  ]

  if (loading) return (
    <div className="flex items-center justify-center h-full" style={{ color: '#5a5a6e' }}>
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm">Carregando visão geral...</p>
      </div>
    </div>
  )

  if (!data) return null

  return (
    <div className="p-6 space-y-6 overflow-auto">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-bold text-lg" style={{ color: '#e8e8f2' }}>{greeting()}, tudo sob controle? 👋</h1>
          <p className="text-xs mt-0.5" style={{ color: '#5a5a6e' }}>
            Visão geral atualizada às {lastUpdate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <button
          onClick={load}
          disabled={refreshing}
          className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg transition-all disabled:opacity-50"
          style={{ color: '#8b8b9e' }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.background = 'rgba(124,58,237,0.12)'
            ;(e.currentTarget as HTMLElement).style.color = '#c4b5fd'
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.background = ''
            ;(e.currentTarget as HTMLElement).style.color = '#8b8b9e'
          }}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Atualizando...' : 'Atualizar'}
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {kpis.map((kpi) => {
          const c = colorMap[kpi.color]
          return (
            <button key={kpi.label} onClick={() => router.push(kpi.href)} className="text-left">
              <div className="card p-5 cursor-pointer h-full">
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: c.bg }}
                  >
                    <kpi.icon className="w-4 h-4" style={{ color: c.text }} />
                  </div>
                  <span className="text-xs leading-tight" style={{ color: '#8b8b9e' }}>{kpi.label}</span>
                </div>
                <p className="text-2xl font-bold" style={{ color: '#e8e8f2' }}>{kpi.value}</p>
                {kpi.sub && <p className="text-xs mt-1" style={{ color: '#5a5a6e' }}>{kpi.sub}</p>}
              </div>
            </button>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Conversas ao vivo */}
        <div className="lg:col-span-2 card">
          <div className="flex items-center justify-between px-5 pt-5 pb-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <div>
              <h2 className="text-sm font-semibold" style={{ color: '#e8e8f2' }}>Atendimentos ao vivo</h2>
              <p className="text-xs" style={{ color: '#5a5a6e' }}>Conversas mais recentes do WhatsApp</p>
            </div>
            <button
              onClick={() => router.push('/inbox')}
              className="text-xs flex items-center gap-1 font-medium transition-colors"
              style={{ color: '#a78bfa' }}
            >
              Ver todas <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          {data.recent_conversations.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm" style={{ color: '#5a5a6e' }}>
              <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-20" />
              Nenhuma conversa ainda hoje
            </div>
          ) : (
            <div>
              {data.recent_conversations.map((conv, i) => (
                <button
                  key={conv.id}
                  onClick={() => router.push('/inbox')}
                  className="w-full text-left"
                  style={{ borderBottom: i < data.recent_conversations.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}
                >
                  <div
                    className="flex items-center gap-3 px-5 py-3.5 transition-colors"
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}
                  >
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                      style={{ background: 'linear-gradient(135deg, #7c3aed, #ec4899)' }}
                    >
                      {(conv.contact_name?.[0] || '?').toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate" style={{ color: '#e8e8f2' }}>{conv.contact_name}</span>
                        {conv.lead_score >= 70 && <Star className="w-3 h-3 flex-shrink-0" style={{ color: '#fcd34d', fill: '#fcd34d' }} />}
                      </div>
                      <p className="text-xs truncate" style={{ color: '#5a5a6e' }}>{conv.last_message || '—'}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span className="text-xs" style={{ color: '#5a5a6e' }}>{timeAgo(conv.last_message_at)}</span>
                      {conv.bot_active ? (
                        <span className="badge text-[10px] flex items-center gap-1" style={{ background: 'rgba(124,58,237,0.2)', color: '#c4b5fd' }}>
                          <Bot className="w-2.5 h-2.5" /> Glow
                        </span>
                      ) : (
                        <span className="badge text-[10px] flex items-center gap-1" style={{ background: 'rgba(59,130,246,0.2)', color: '#93c5fd' }}>
                          <Phone className="w-2.5 h-2.5" /> {conv.assigned_agent || 'Humano'}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Coluna direita */}
        <div className="space-y-4">

          {/* Pipeline */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold" style={{ color: '#e8e8f2' }}>Pipeline de vendas</h2>
              <button onClick={() => router.push('/pipeline')} className="text-xs flex items-center gap-1 font-medium" style={{ color: '#a78bfa' }}>
                Ver <ArrowRight className="w-3 h-3" />
              </button>
            </div>
            {data.pipeline_stages.filter(s => s.count > 0).length === 0 ? (
              <p className="text-xs text-center py-4" style={{ color: '#5a5a6e' }}>Nenhum negócio no funil</p>
            ) : (
              <div className="space-y-2.5">
                {data.pipeline_stages.filter(s => s.count > 0).map(stage => (
                  <div key={stage.stage} className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: stage.color }} />
                    <span className="text-xs flex-1 truncate" style={{ color: '#8b8b9e' }}>{stage.stage}</span>
                    <span className="text-xs font-semibold" style={{ color: '#e8e8f2' }}>{stage.count}</span>
                    {stage.value > 0 && (
                      <span className="text-[10px]" style={{ color: '#5a5a6e' }}>
                        R$ {Number(stage.value).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tarefas */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold" style={{ color: '#e8e8f2' }}>Tarefas</h2>
              <button onClick={() => router.push('/tasks')} className="text-xs flex items-center gap-1 font-medium" style={{ color: '#a78bfa' }}>
                Ver <ArrowRight className="w-3 h-3" />
              </button>
            </div>
            {data.tasks.overdue > 0 && (
              <div className="flex items-center gap-2 mb-3 p-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#f87171' }} />
                <span className="text-xs font-medium" style={{ color: '#fca5a5' }}>{data.tasks.overdue} tarefa(s) atrasada(s)</span>
              </div>
            )}
            {data.recent_tasks.length === 0 ? (
              <p className="text-xs text-center py-4" style={{ color: '#5a5a6e' }}>Nenhuma tarefa pendente</p>
            ) : (
              <div className="space-y-2">
                {data.recent_tasks.map(task => (
                  <div key={task.id} className="flex items-start gap-2">
                    {task.status === 'done'
                      ? <CheckCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: '#6ee7b7' }} />
                      : <Circle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: '#3a3a50' }} />
                    }
                    <div className="flex-1 min-w-0">
                      <p className="text-xs truncate" style={{ color: '#c4c4d4' }}>{task.title}</p>
                      {task.due_date && (
                        <p className="text-[10px] flex items-center gap-1 mt-0.5" style={{ color: '#5a5a6e' }}>
                          <Clock className="w-2.5 h-2.5" />
                          {new Date(task.due_date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                        </p>
                      )}
                    </div>
                    <span className={`badge text-[10px] flex-shrink-0 ${priorityColor[task.priority] || 'bg-slate-500/20 text-slate-400'}`}>
                      {priorityLabel[task.priority] || task.priority}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Status Glow */}
          <div className="card p-4" style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.2)' }}>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400 glow-pulse" />
              <span className="text-xs font-semibold" style={{ color: '#c4b5fd' }}>Glow IA ativa</span>
            </div>
            <p className="text-[11px] leading-relaxed" style={{ color: '#8b6fba' }}>
              {data.conversations.bot} conversa(s) sendo atendida(s) automaticamente agora.
            </p>
            <div className="mt-3 flex items-center gap-3">
              <button onClick={() => router.push('/automations')} className="text-[11px] flex items-center gap-1 transition-colors" style={{ color: '#a78bfa' }}>
                <Zap className="w-3 h-3" /> Ver automações
              </button>
              <span style={{ color: '#3a3a50' }}>·</span>
              <button onClick={() => router.push('/settings')} className="text-[11px] transition-colors" style={{ color: '#a78bfa' }}>
                Configurar Glow
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* Gestão de Equipe */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold" style={{ color: '#e8e8f2' }}>Gestão de Equipe</h2>
            <p className="text-xs" style={{ color: '#5a5a6e' }}>Acesso rápido às ferramentas da sua equipe</p>
          </div>
          <button onClick={() => router.push('/team')} className="text-xs flex items-center gap-1 font-medium" style={{ color: '#a78bfa' }}>
            Abrir módulo <ArrowRight className="w-3 h-3" />
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {teamShortcuts.map(item => (
            <button
              key={item.tab}
              onClick={() => router.push('/team')}
              className="card p-4 flex flex-col items-center gap-2 text-center"
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: item.color }}
              >
                <item.icon className="w-5 h-5" style={{ color: item.text }} />
              </div>
              <span className="text-xs font-medium leading-tight" style={{ color: '#8b8b9e' }}>{item.label}</span>
            </button>
          ))}
        </div>
      </div>

    </div>
  )
}
