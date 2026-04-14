'use client'
import { useState } from 'react'
import {
  ChevronRight, Target, Flame, ChevronDown, ChevronUp,
  RefreshCw, Zap, AlertTriangle, CheckCircle2, TrendingUp,
  MessageSquare, Phone, Send, Clock
} from 'lucide-react'

export type BantStatus = 'qualified' | 'partial' | 'not_qualified' | 'unknown'
export type BantClassification = 'hot' | 'warm' | 'cold' | 'no_data'

export type BantDimension = {
  score: number
  status: BantStatus
  summary: string
  evidence: { text: string; timestamp: string }[]
}

export type BantData = {
  budget: BantDimension
  authority: BantDimension
  need: BantDimension
  timeline: BantDimension
  overall_score: number
  classification: BantClassification
  recommendation: string
  analyzed_at?: string
}

// ─── Estágios de conversão escalonados ───────────────────────────────────────

type ConversionStage = {
  id: string
  label: string
  minScore: number
  color: string
  bg: string
  border: string
  urgency: 'critical' | 'high' | 'medium' | 'low'
  nextAction: string
  tip: string
  icon: React.ElementType
  pulse: boolean
}

const CONVERSION_STAGES: ConversionStage[] = [
  {
    id: 'fechamento',
    label: 'Pronto p/ Fechar',
    minScore: 80,
    color: '#6ee7b7',
    bg: 'rgba(16,185,129,0.12)',
    border: 'rgba(16,185,129,0.3)',
    urgency: 'critical',
    nextAction: 'Envie a proposta AGORA',
    tip: 'Lead altamente qualificado. Cada minuto conta — proponha o fechamento antes de perder o momentum.',
    icon: Zap,
    pulse: true,
  },
  {
    id: 'proposta',
    label: 'Fase de Proposta',
    minScore: 60,
    color: '#fcd34d',
    bg: 'rgba(245,158,11,0.12)',
    border: 'rgba(245,158,11,0.3)',
    urgency: 'high',
    nextAction: 'Apresente uma oferta personalizada',
    tip: 'Lead morno com interesse real. Qualifique o orçamento e faça uma oferta específica.',
    icon: TrendingUp,
    pulse: false,
  },
  {
    id: 'nutricao',
    label: 'Nutrição Ativa',
    minScore: 35,
    color: '#93c5fd',
    bg: 'rgba(59,130,246,0.12)',
    border: 'rgba(59,130,246,0.3)',
    urgency: 'medium',
    nextAction: 'Envie conteúdo de valor + pergunte sobre necessidade',
    tip: 'Lead ainda frio. Aprofunde a conversa para descobrir a dor real antes de propor.',
    icon: MessageSquare,
    pulse: false,
  },
  {
    id: 'descoberta',
    label: 'Descoberta',
    minScore: 0,
    color: '#8b8b9e',
    bg: 'rgba(255,255,255,0.05)',
    border: 'rgba(255,255,255,0.1)',
    urgency: 'low',
    nextAction: 'Faça perguntas abertas para qualificar',
    tip: 'Dados insuficientes. Inicie com perguntas sobre o problema do cliente e o que ele busca.',
    icon: Target,
    pulse: false,
  },
]

function getStage(score: number): ConversionStage {
  return [...CONVERSION_STAGES].reverse().find(s => score >= s.minScore) || CONVERSION_STAGES[3]
}

// ─── Alertas de risco de perda ────────────────────────────────────────────────

function getLossRisk(data: BantData): { level: 'alto' | 'medio' | 'baixo' | null; reason: string } {
  const dims = [data.budget, data.authority, data.need, data.timeline]
  const unknowns = dims.filter(d => d.status === 'unknown').length
  const notQual   = dims.filter(d => d.status === 'not_qualified').length

  if (notQual >= 2)   return { level: 'alto',  reason: `${notQual} dimensões críticas sem qualificação` }
  if (unknowns >= 3)  return { level: 'medio', reason: 'Conversa ainda superficial — aprofunde o diagnóstico' }
  if (data.overall_score >= 60 && data.timeline.status === 'unknown')
                      return { level: 'medio', reason: 'Lead quente sem prazo definido — risco de esfriamento' }
  if (data.overall_score >= 70) return { level: 'baixo', reason: 'Lead bem qualificado' }
  return { level: null, reason: '' }
}

// ─── Ações rápidas sugeridas ──────────────────────────────────────────────────

function getQuickActions(data: BantData): { icon: React.ElementType; label: string; color: string }[] {
  const actions: { icon: React.ElementType; label: string; color: string }[] = []
  const score = data.overall_score

  if (score >= 80) {
    actions.push({ icon: Send,    label: 'Enviar proposta agora',      color: '#6ee7b7' })
    actions.push({ icon: Phone,   label: 'Ligar para fechar',          color: '#6ee7b7' })
  } else if (score >= 60) {
    actions.push({ icon: Send,    label: 'Enviar oferta personalizada', color: '#fcd34d' })
    actions.push({ icon: Clock,   label: 'Perguntar prazo de decisão',  color: '#fcd34d' })
  } else if (score >= 35) {
    actions.push({ icon: MessageSquare, label: 'Perguntar sobre orçamento',  color: '#93c5fd' })
    actions.push({ icon: Target,        label: 'Identificar necessidade real', color: '#93c5fd' })
  } else {
    actions.push({ icon: MessageSquare, label: 'Iniciar diagnóstico',     color: '#a78bfa' })
    actions.push({ icon: Target,        label: 'Perguntar objetivo principal', color: '#a78bfa' })
  }
  return actions
}

// ─── Configs por status/classificação ────────────────────────────────────────

const STATUS_CONFIG: Record<BantStatus, { label: string; color: string; bg: string; border: string }> = {
  qualified:     { label: '✓ Qualificado',     color: '#6ee7b7', bg: 'rgba(16,185,129,0.15)',  border: 'rgba(16,185,129,0.25)'  },
  partial:       { label: '◑ Parcial',         color: '#fcd34d', bg: 'rgba(245,158,11,0.15)',  border: 'rgba(245,158,11,0.25)'  },
  not_qualified: { label: '✗ Não qualificado', color: '#fca5a5', bg: 'rgba(239,68,68,0.15)',   border: 'rgba(239,68,68,0.25)'   },
  unknown:       { label: '? Sem dados',       color: '#5a5a6e', bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.08)' },
}

const DIMS = [
  { key: 'budget',    label: 'Orçamento',   emoji: '💰', question: 'Tem budget para isso?' },
  { key: 'authority', label: 'Autoridade',  emoji: '👤', question: 'Quem decide a compra?' },
  { key: 'need',      label: 'Necessidade', emoji: '🎯', question: 'Qual é a dor principal?' },
  { key: 'timeline',  label: 'Prazo',       emoji: '⏰', question: 'Quando precisa resolver?' },
] as const

// ─── Termômetro visual ────────────────────────────────────────────────────────

function Thermometer({ score }: { score: number }) {
  const segments = [
    { min: 0,  max: 35, color: '#3b82f6', label: 'Frio'    },
    { min: 35, max: 60, color: '#f59e0b', label: 'Morno'   },
    { min: 60, max: 80, color: '#f97316', label: 'Quente'  },
    { min: 80, max: 100, color: '#10b981', label: 'Fechar' },
  ]

  return (
    <div className="space-y-1.5">
      <div className="flex gap-0.5 h-2 rounded-full overflow-hidden">
        {segments.map(seg => {
          const segSize = seg.max - seg.min
          const filled = Math.max(0, Math.min(segSize, score - seg.min))
          const pct = (filled / segSize) * 100
          return (
            <div key={seg.label} className="flex-1 rounded-sm overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
              <div
                className="h-full transition-all duration-700"
                style={{ width: `${pct}%`, background: seg.color }}
              />
            </div>
          )
        })}
      </div>
      <div className="flex justify-between">
        {segments.map(seg => (
          <span
            key={seg.label}
            className="text-[9px] font-medium"
            style={{ color: score >= seg.min ? seg.color : '#3a3a50' }}
          >
            {seg.label}
          </span>
        ))}
      </div>
    </div>
  )
}

// ─── DimCard ─────────────────────────────────────────────────────────────────

type Dim = typeof DIMS[number]
function DimCard({ dim, data }: { dim: Dim; data: BantDimension }) {
  const [open, setOpen] = useState(false)
  const st = STATUS_CONFIG[data.status]
  const barColor = data.score >= 70 ? '#10b981' : data.score >= 40 ? '#f59e0b' : data.score > 0 ? '#3b82f6' : '#3a3a50'

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors"
        style={{ background: 'rgba(255,255,255,0.02)' }}
        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'}
        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)'}
      >
        <span className="text-base leading-none flex-shrink-0">{dim.emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold" style={{ color: '#c4c4d4' }}>{dim.label}</span>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold tabular-nums" style={{ color: '#e8e8f2' }}>{data.score}%</span>
              <span
                className="text-[9px] font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap"
                style={{ background: st.bg, color: st.color, border: `1px solid ${st.border}` }}
              >
                {st.label}
              </span>
            </div>
          </div>
          <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${data.score}%`, background: barColor }} />
          </div>
        </div>
        {open
          ? <ChevronUp className="w-3 h-3 flex-shrink-0" style={{ color: '#5a5a6e' }} />
          : <ChevronDown className="w-3 h-3 flex-shrink-0" style={{ color: '#5a5a6e' }} />
        }
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-2" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          {data.status === 'unknown' && (
            <div className="mt-2 flex items-center gap-2 rounded-lg px-2.5 py-2" style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.2)' }}>
              <MessageSquare className="w-3 h-3 flex-shrink-0" style={{ color: '#a78bfa' }} />
              <p className="text-[10px]" style={{ color: '#c4b5fd' }}>
                Pergunte: <em>"{dim.question}"</em>
              </p>
            </div>
          )}
          {data.summary && (
            <p className="text-[11px] mt-2 leading-relaxed" style={{ color: '#8b8b9e' }}>{data.summary}</p>
          )}
          {data.evidence.length > 0 && (
            <div className="space-y-1.5">
              {data.evidence.map((ev, i) => (
                <div key={i} className="flex items-start gap-2 rounded-lg px-2 py-1.5" style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <span className="text-[10px] mt-0.5 flex-shrink-0" style={{ color: '#5a5a6e' }}>📝</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] italic" style={{ color: '#c4c4d4' }}>"{ev.text}"</p>
                    {ev.timestamp && (
                      <p className="text-[10px] mt-0.5" style={{ color: '#5a5a6e' }}>{ev.timestamp}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          {data.evidence.length === 0 && data.status !== 'unknown' && (
            <p className="text-[10px] italic mt-1" style={{ color: '#5a5a6e' }}>Nenhuma evidência detectada ainda</p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export function BantPanel({
  data,
  loading,
  onAnalyze,
  collapsed,
  onToggleCollapse,
}: {
  data: BantData | null
  loading: boolean
  onAnalyze: () => void
  collapsed: boolean
  onToggleCollapse: () => void
}) {
  const stage = data ? getStage(data.overall_score) : CONVERSION_STAGES[3]
  const risk  = data ? getLossRisk(data) : null
  const actions = data ? getQuickActions(data) : []

  return (
    <div
      className={`flex flex-col transition-all duration-200 flex-shrink-0 ${collapsed ? 'w-10' : 'w-72'}`}
      style={{ background: '#0e0e16', borderLeft: '1px solid rgba(255,255,255,0.06)' }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-3 flex-shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        {!collapsed && (
          <div className="flex items-center gap-2 min-w-0">
            <Flame className="w-4 h-4 flex-shrink-0" style={{ color: '#fb923c' }} />
            <span className="text-xs font-semibold truncate" style={{ color: '#e8e8f2' }}>Qualificação BANT</span>
          </div>
        )}
        <div className={`flex items-center gap-1 ${collapsed ? 'w-full justify-center' : ''}`}>
          {!collapsed && (
            <button
              onClick={onAnalyze}
              disabled={loading}
              title="Reanalisar"
              className="p-1 rounded-lg transition-colors"
              style={{ color: '#5a5a6e' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          )}
          <button
            onClick={onToggleCollapse}
            className="p-1 rounded-lg transition-colors"
            style={{ color: '#5a5a6e' }}
            title={collapsed ? 'Expandir BANT' : 'Recolher BANT'}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}
          >
            <ChevronRight className={`w-3.5 h-3.5 transition-transform ${collapsed ? '' : 'rotate-180'}`} />
          </button>
        </div>
      </div>

      {/* Collapsed */}
      {collapsed && data && (
        <div className="flex-1 flex flex-col items-center pt-3 gap-2">
          <div className="text-[10px] font-bold" style={{ color: stage.color }}>{data.overall_score}</div>
          <div className="w-1.5 h-8 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <div
              className="w-full rounded-full transition-all duration-700"
              style={{ height: `${data.overall_score}%`, background: stage.color, marginTop: `${100 - data.overall_score}%` }}
            />
          </div>
        </div>
      )}

      {/* Expanded content */}
      {!collapsed && (
        <div className="flex-1 overflow-y-auto">

          {loading && (
            <div className="flex flex-col items-center justify-center py-10 gap-2" style={{ color: '#5a5a6e' }}>
              <RefreshCw className="w-6 h-6 animate-spin opacity-40" />
              <p className="text-xs">Analisando conversa...</p>
            </div>
          )}

          {!loading && !data && (
            <div className="flex flex-col items-center justify-center py-10 gap-3 px-4">
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.05)' }}>
                <Target className="w-5 h-5 opacity-30" style={{ color: '#8b8b9e' }} />
              </div>
              <div className="text-center">
                <p className="text-xs font-medium" style={{ color: '#8b8b9e' }}>Sem análise ainda</p>
                <p className="text-[10px] mt-1" style={{ color: '#5a5a6e' }}>Analise para ver o estágio de conversão</p>
              </div>
              <button
                onClick={onAnalyze}
                className="text-xs text-white px-4 py-1.5 rounded-lg transition-all font-medium"
                style={{ background: 'linear-gradient(135deg, #6b21a8, #7c3aed)' }}
              >
                Analisar agora
              </button>
            </div>
          )}

          {!loading && data && (
            <div className="p-3 space-y-3">

              {/* ── Estágio de Conversão ────────────────────────── */}
              <div
                className="rounded-xl p-3"
                style={{ background: stage.bg, border: `1px solid ${stage.border}` }}
              >
                {/* Título do estágio */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <stage.icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: stage.color }} />
                    <span className="text-xs font-bold" style={{ color: stage.color }}>{stage.label}</span>
                    {stage.pulse && (
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: stage.color }} />
                        <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: stage.color }} />
                      </span>
                    )}
                  </div>
                  <span className="text-xl font-black tabular-nums" style={{ color: stage.color }}>
                    {data.overall_score}
                  </span>
                </div>

                {/* Termômetro */}
                <Thermometer score={data.overall_score} />

                {/* Score label */}
                <p className="text-[9px] mt-1.5 text-right" style={{ color: stage.color, opacity: 0.6 }}>
                  {data.overall_score}/100 pontos BANT
                </p>
              </div>

              {/* ── Alerta de Risco ─────────────────────────────── */}
              {risk && risk.level && (
                <div
                  className="rounded-xl px-3 py-2.5 flex items-start gap-2"
                  style={
                    risk.level === 'alto'
                      ? { background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)' }
                      : risk.level === 'medio'
                      ? { background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.22)' }
                      : { background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }
                  }
                >
                  {risk.level === 'alto' ? (
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: '#fca5a5' }} />
                  ) : risk.level === 'medio' ? (
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: '#fcd34d' }} />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: '#6ee7b7' }} />
                  )}
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide mb-0.5"
                      style={{ color: risk.level === 'alto' ? '#fca5a5' : risk.level === 'medio' ? '#fcd34d' : '#6ee7b7' }}>
                      {risk.level === 'alto' ? 'Risco de perder o lead' : risk.level === 'medio' ? 'Atenção necessária' : 'Lead bem qualificado'}
                    </p>
                    <p className="text-[11px] leading-relaxed" style={{ color: risk.level === 'alto' ? '#fca5a5' : risk.level === 'medio' ? '#fcd34d' : '#6ee7b7', opacity: 0.8 }}>
                      {risk.reason}
                    </p>
                  </div>
                </div>
              )}

              {/* ── Próximo Passo ────────────────────────────────── */}
              <div className="rounded-xl px-3 py-2.5" style={{ background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.22)' }}>
                <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: '#8b6fba' }}>
                  Próximo passo
                </p>
                <p className="text-xs font-medium leading-relaxed" style={{ color: '#c4b5fd' }}>
                  {stage.nextAction}
                </p>
                <p className="text-[10px] mt-1.5 leading-relaxed" style={{ color: '#7c6a9e' }}>
                  {stage.tip}
                </p>
              </div>

              {/* ── Ações Rápidas ────────────────────────────────── */}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide mb-2 px-0.5" style={{ color: '#3a3a50' }}>
                  Ações recomendadas
                </p>
                <div className="space-y-1.5">
                  {actions.map((action, i) => (
                    <button
                      key={i}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-left transition-all"
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: action.color }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'}
                    >
                      <action.icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: action.color }} />
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Separador ───────────────────────────────────── */}
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }} />

              {/* ── Cards BANT ──────────────────────────────────── */}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide mb-2 px-0.5" style={{ color: '#3a3a50' }}>
                  Diagnóstico BANT
                </p>
                <div className="space-y-2">
                  {DIMS.map(dim => (
                    <DimCard key={dim.key} dim={dim} data={data[dim.key]} />
                  ))}
                </div>
              </div>

              {/* ── Recomendação da IA ──────────────────────────── */}
              {data.recommendation && (
                <div className="rounded-xl px-3 py-2.5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: '#3a3a50' }}>
                    IA diz
                  </p>
                  <p className="text-[11px] leading-relaxed" style={{ color: '#8b8b9e' }}>{data.recommendation}</p>
                </div>
              )}

              {/* Timestamp */}
              {data.analyzed_at && (
                <p className="text-[9px] text-center pb-1" style={{ color: '#3a3a50' }}>
                  Atualizado às {new Date(data.analyzed_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
