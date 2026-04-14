'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from 'recharts'
import { MessageSquare, TrendingUp, Users, Bot, CheckCircle, DollarSign } from 'lucide-react'
import { Tooltip as InfoTooltip } from '@/components/ui/Tooltip'

type DashboardData = {
  conversations: { open_count: number; resolved_count: number; bot_count: number; new_count: number }
  messages: { received: number; ai_sent: number; agent_sent: number }
  deals: { open_deals: number; won_deals: number; revenue: number; pipeline_value: number }
  contacts: { new_contacts: number }
  aiPerformance: { ai_conversations: number; handover_rate: number }
  agentPerformance: { name: string; conversations: number; messages_sent: number }[]
}

const PERIOD_OPTIONS = [
  { value: '1d', label: 'Hoje' },
  { value: '7d', label: '7 dias' },
  { value: '30d', label: '30 dias' },
  { value: '90d', label: '90 dias' }
]

const COLOR_MAP: Record<string, { bg: string; text: string }> = {
  violet: { bg: 'rgba(124,58,237,0.18)', text: '#c4b5fd' },
  green:  { bg: 'rgba(16,185,129,0.18)', text: '#6ee7b7' },
  amber:  { bg: 'rgba(245,158,11,0.18)', text: '#fcd34d' },
  blue:   { bg: 'rgba(59,130,246,0.18)', text: '#93c5fd' },
  pink:   { bg: 'rgba(236,72,153,0.18)', text: '#f9a8d4' },
}

function StatCard({ icon: Icon, label, value, sub, color = 'violet', tooltip }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; color?: string; tooltip?: string
}) {
  const c = COLOR_MAP[color] || COLOR_MAP.violet
  return (
    <div className="card p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: c.bg }}>
          <Icon className="w-4 h-4" style={{ color: c.text }} />
        </div>
        <div className="flex items-center gap-1 flex-1 min-w-0">
          <span className="text-sm truncate" style={{ color: '#8b8b9e' }}>{label}</span>
          {tooltip && <InfoTooltip text={tooltip} position="top" />}
        </div>
      </div>
      <p className="text-2xl font-bold" style={{ color: '#e8e8f2' }}>{value}</p>
      {sub && <p className="text-xs mt-1" style={{ color: '#5a5a6e' }}>{sub}</p>}
    </div>
  )
}

export default function AnalyticsPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [chart, setChart] = useState<{ date: string; received: number; ai_sent: number; agent_sent: number }[]>([])
  const [funnel, setFunnel] = useState<{ stage: string; color: string; deals: number; value: number }[]>([])
  const [period, setPeriod] = useState('7d')

  useEffect(() => { loadAll() }, [period])

  async function loadAll() {
    const [dashboard, chartData, funnelData] = await Promise.all([
      api.get(`/api/analytics/dashboard?period=${period}`),
      api.get(`/api/analytics/messages-chart?days=${period.replace('d', '')}`),
      api.get('/api/analytics/funnel')
    ])
    setData(dashboard)
    setChart(chartData.chart)
    setFunnel(funnelData.funnel)
  }

  if (!data) return (
    <div className="flex items-center justify-center h-full text-sm" style={{ color: '#5a5a6e' }}>
      Carregando analytics...
    </div>
  )

  return (
    <div className="p-6 space-y-6 overflow-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-semibold" style={{ color: '#e8e8f2' }}>Analytics</h1>
          <p className="text-xs" style={{ color: '#5a5a6e' }}>Métricas em tempo real do seu atendimento</p>
        </div>
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.05)' }}>
          {PERIOD_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setPeriod(opt.value)}
              className="px-3 py-1.5 text-xs rounded-lg transition-all"
              style={period === opt.value
                ? { background: '#16161f', color: '#e8e8f2', fontWeight: 600, boxShadow: '0 1px 3px rgba(0,0,0,0.4)' }
                : { color: '#5a5a6e' }
              }
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard icon={MessageSquare} label="Conversas abertas" value={data.conversations.open_count} color="violet"
          tooltip="Total de conversas no WhatsApp que ainda não foram resolvidas no período selecionado." />
        <StatCard icon={CheckCircle} label="Resolvidas" value={data.conversations.resolved_count} color="green"
          tooltip="Conversas marcadas como resolvidas — cliente atendido e assunto encerrado." />
        <StatCard icon={Bot} label="Com IA ativa" value={data.conversations.bot_count}
          sub={`${data.aiPerformance.handover_rate}% transferidas`} color="violet"
          tooltip="Conversas onde a Glow está respondendo automaticamente." />
        <StatCard icon={Users} label="Novos leads" value={data.contacts.new_contacts} color="blue"
          tooltip="Novos contatos que entraram em contato pela primeira vez no período selecionado." />
        <StatCard icon={TrendingUp} label="Vendas ganhas" value={data.deals.won_deals} color="green"
          tooltip="Negócios marcados como 'Ganho' no Pipeline de Vendas no período selecionado." />
        <StatCard
          icon={DollarSign}
          label="Receita"
          value={`R$ ${Number(data.deals.revenue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`}
          sub={`R$ ${Number(data.deals.pipeline_value || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} no funil`}
          color="green"
          tooltip="Receita gerada pelos negócios ganhos no período."
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Gráfico de mensagens */}
        <div className="card p-5 lg:col-span-2">
          <h3 className="text-sm font-semibold mb-4" style={{ color: '#e8e8f2' }}>Volume de mensagens</h3>
          {chart.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chart} barSize={12}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#5a5a6e' }} tickFormatter={d => d.slice(5)} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#5a5a6e' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: '#16161f', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', color: '#e8e8f2' }}
                  labelFormatter={l => `Data: ${l}`}
                  formatter={(val, name) => [val, name === 'received' ? 'Recebidas' : name === 'ai_sent' ? 'IA' : 'Agente']}
                />
                <Bar dataKey="received" fill="rgba(124,58,237,0.3)" name="received" radius={[4,4,0,0]} />
                <Bar dataKey="ai_sent" fill="#7c3aed" name="ai_sent" radius={[4,4,0,0]} />
                <Bar dataKey="agent_sent" fill="#ec4899" name="agent_sent" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-sm" style={{ color: '#5a5a6e' }}>
              Sem dados no período
            </div>
          )}
          <div className="flex gap-4 mt-3 text-xs" style={{ color: '#5a5a6e' }}>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm inline-block" style={{ background: 'rgba(124,58,237,0.3)' }} />Recebidas
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm inline-block" style={{ background: '#7c3aed' }} />IA
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm inline-block" style={{ background: '#ec4899' }} />Agente
            </span>
          </div>
        </div>

        {/* Funil */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold mb-4" style={{ color: '#e8e8f2' }}>Funil de vendas</h3>
          <div className="space-y-2">
            {funnel.map(stage => (
              <div key={stage.stage} className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: stage.color }} />
                <span className="text-xs flex-1 truncate" style={{ color: '#8b8b9e' }}>{stage.stage}</span>
                <span className="badge text-xs" style={{ background: 'rgba(255,255,255,0.07)', color: '#e8e8f2' }}>
                  {stage.deals}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Performance por agente */}
      {data.agentPerformance.length > 0 && (
        <div className="card p-5">
          <h3 className="text-sm font-semibold mb-4" style={{ color: '#e8e8f2' }}>Performance da equipe</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#5a5a6e' }}>
                  <th className="pb-2 font-medium">Agente</th>
                  <th className="pb-2 text-right font-medium">Conversas</th>
                  <th className="pb-2 text-right font-medium">Mensagens</th>
                  <th className="pb-2 text-right font-medium">Resp. média</th>
                </tr>
              </thead>
              <tbody>
                {data.agentPerformance.map(agent => (
                  <tr key={agent.name} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td className="py-2.5 flex items-center gap-2" style={{ color: '#e8e8f2' }}>
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium"
                        style={{ background: 'rgba(124,58,237,0.2)', color: '#c4b5fd' }}>
                        {agent.name[0]}
                      </div>
                      {agent.name}
                    </td>
                    <td className="py-2.5 text-right" style={{ color: '#8b8b9e' }}>{agent.conversations}</td>
                    <td className="py-2.5 text-right" style={{ color: '#8b8b9e' }}>{agent.messages_sent}</td>
                    <td className="py-2.5 text-right" style={{ color: '#5a5a6e' }}>—</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
