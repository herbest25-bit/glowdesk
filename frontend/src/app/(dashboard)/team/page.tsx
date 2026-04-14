'use client'
import { useState } from 'react'
import {
  Star, Target, TrendingUp, BarChart2, MessageSquare,
  Users, CheckSquare, Clock, Plus, X,
  Check, Circle, Calendar, BookOpen, ArrowUp, ArrowDown,
  Trophy, AlertTriangle, Zap, Award, Flame, Bell
} from 'lucide-react'

import { MEETING_REMINDERS_KEY, type MeetingNotif } from '@/lib/meetings'

// ─── Types ───────────────────────────────────────────────────────────────────

type Tab = 'performance' | 'goals' | 'development' | 'insights' | 'feedback' | 'meetings' | 'checklist' | 'timeclock' | 'colaboradores'
type Collaborator = { id: string; name: string; role: string; score: number; sales: number; revenue: number; trend: number; avatar: string; phone?: string | null }
type GoalCompanion = { title: string; target: number; current: number; unit: string }
type Goal = { id: string; title: string; collaborator: string; target: number; current: number; unit: string; deadline: string; cycle: string; companion?: GoalCompanion }
type Meeting = { id: string; collaborator: string; date: string; time?: string; notes: string; actions: string[] }
type CheckItem = { id: string; text: string; done: boolean; category: string }
type PunchRecord = { id: string; collaborator: string; date: string; entry: string; exit: string; total: string }
type FeedbackForm = { collaborator: string; type: string; strengths: string; improvements: string; actions: string; rating: number }
type FeedbackRecord = FeedbackForm & { id: string; date: string }

const DEMO_FEEDBACKS: FeedbackRecord[] = [
  { id: '1', collaborator: 'Mariana Costa',  type: 'positivo',     strengths: 'Fechou 3 vendas acima do ticket médio esta semana. Excelente abordagem consultiva.',    improvements: '',                                              actions: 'Compartilhar técnica com a equipe na próxima reunião.', rating: 5, date: '2025-04-05' },
  { id: '2', collaborator: 'Ana Paula',       type: 'construtivo',  strengths: 'Boa empatia com os clientes e respostas rápidas.',                                        improvements: 'Precisa melhorar qualificação BANT antes de oferecer produto.', actions: 'Assistir 2 gravações de chamadas da Mariana.',          rating: 3, date: '2025-04-02' },
  { id: '3', collaborator: 'Júlia Ferreira',  type: 'corretivo',    strengths: 'Demonstra esforço e vontade de aprender.',                                                improvements: 'Taxa de conversão abaixo de 30% — abordagem precisa ajuste.', actions: 'Sessão de roleplay na sexta com a gestora.',            rating: 2, date: '2025-03-28' },
]

// ─── Demo Data ────────────────────────────────────────────────────────────────

// Mutable array — kept in sync by TeamPage via COLLABORATORS.length=0 + push
const COLLABORATORS: Collaborator[] = [
  { id: '1', name: 'Ana Paula',      role: 'Atendente',  score: 87, sales: 24, revenue: 4800,  trend: +5,  avatar: '#7c3aed' },
  { id: '2', name: 'Mariana Costa',  role: 'Consultora', score: 92, sales: 38, revenue: 9200,  trend: +12, avatar: '#db2777' },
  { id: '3', name: 'Júlia Ferreira', role: 'Atendente',  score: 74, sales: 17, revenue: 3100,  trend: -3,  avatar: '#ea580c' },
]

// Skills individuais por colaborador (1–5)
const DEV_MAP: Record<string, Record<string, number>> = {
  'Ana Paula':      { 'Técnicas de venda': 4, 'Conhecimento de produtos': 3, 'Atendimento ao cliente': 5, 'WhatsApp & ferramentas': 3, 'Qualificação BANT': 2, 'Negociação / Fechamento': 3 },
  'Mariana Costa':  { 'Técnicas de venda': 5, 'Conhecimento de produtos': 4, 'Atendimento ao cliente': 5, 'WhatsApp & ferramentas': 4, 'Qualificação BANT': 4, 'Negociação / Fechamento': 5 },
  'Júlia Ferreira': { 'Técnicas de venda': 2, 'Conhecimento de produtos': 2, 'Atendimento ao cliente': 4, 'WhatsApp & ferramentas': 2, 'Qualificação BANT': 1, 'Negociação / Fechamento': 2 },
}

const NEXT_STEP: Record<string, Record<string, string>> = {
  'Ana Paula':      { 'Conhecimento de produtos': 'Treinamento skincare avançado', 'WhatsApp & ferramentas': 'Curso GlowDesk avançado', 'Qualificação BANT': 'Workshop qualificação de leads', 'Negociação / Fechamento': 'Curso técnicas de fechamento' },
  'Mariana Costa':  { 'Conhecimento de produtos': 'Certificação cosméticos premium' },
  'Júlia Ferreira': { 'Técnicas de venda': 'Imersão vendas consultivas', 'Conhecimento de produtos': 'Módulo base de produtos', 'WhatsApp & ferramentas': 'Onboarding GlowDesk', 'Qualificação BANT': 'Workshop qualificação de leads', 'Negociação / Fechamento': 'Curso fundamentos de fechamento' },
}

const SKILLS = ['Técnicas de venda', 'Conhecimento de produtos', 'Atendimento ao cliente', 'WhatsApp & ferramentas', 'Qualificação BANT', 'Negociação / Fechamento']

const DEMO_GOALS: Goal[] = [
  { id: '1', title: 'Vendas mensais',   collaborator: 'Ana Paula',      target: 30,    current: 24,   unit: 'vendas', deadline: '2025-04-30', cycle: 'Abril 2025',
    companion: { title: 'Vendas diárias', target: 1, current: 0, unit: 'vendas' } },
  { id: '2', title: 'Receita mensal',   collaborator: 'Mariana Costa',  target: 10000, current: 9200, unit: 'R$',     deadline: '2025-04-30', cycle: 'Abril 2025',
    companion: { title: 'Receita diária', target: 333, current: 0, unit: 'R$' } },
  { id: '3', title: 'Atendimentos/dia', collaborator: 'Júlia Ferreira', target: 20,    current: 14,   unit: 'atend.', deadline: '2025-04-30', cycle: 'Abril 2025',
    companion: { title: 'Atendimentos/mês', target: 400, current: 280, unit: 'atend.' } },
]

const DEMO_MEETINGS: Meeting[] = [
  { id: '1', collaborator: 'Ana Paula',      date: '2025-04-01', notes: 'Discutimos metas de abril. Ana está motivada e pediu treinamento em skincare. Conversamos sobre oportunidades de aumentar o ticket médio com produtos premium.', actions: ['Enviar material de skincare avançado', 'Revisar meta de vendas em 15 dias', 'Agendar sessão de roleplay de vendas'] },
  { id: '2', collaborator: 'Mariana Costa',  date: '2025-04-03', notes: 'Mariana atingiu 92% da meta. Reconhecimento pelo desempenho. Discutimos possibilidade de ela mentorar a Júlia nas técnicas de fechamento.', actions: ['Preparar material de mentoria para Júlia', 'Avaliar promoção para Consultora Sênior'] },
  { id: '3', collaborator: 'Júlia Ferreira', date: '2025-03-28', notes: 'Conversa de alinhamento. Júlia está abaixo da meta em 30%. Identificamos dificuldades na qualificação de leads e no fechamento. Combinamos um plano de ação de 30 dias.', actions: ['Assistir 3 gravações de chamadas da Mariana', 'Sessão de roleplay na sexta', 'Check-in semanal toda segunda às 9h'] },
]

const DEMO_CHECKLIST: CheckItem[] = [
  { id: '1', text: 'Revisar metas da equipe',                        done: true,  category: 'Gestão' },
  { id: '2', text: 'Dar feedback para Ana Paula',                    done: false, category: 'Feedback' },
  { id: '3', text: 'Preparar pauta reunião 1:1 Mariana',             done: false, category: 'Reunião' },
  { id: '4', text: 'Enviar material de treinamento maquiagem',       done: true,  category: 'Desenvolvimento' },
  { id: '5', text: 'Conferir relatório de ponto — semana passada',   done: false, category: 'Ponto' },
]

const DEMO_PUNCHES: PunchRecord[] = [
  { id: '1',  collaborator: 'Ana Paula',      date: '2025-04-13', entry: '08:02', exit: '17:05', total: '9h03' },
  { id: '2',  collaborator: 'Mariana Costa',  date: '2025-04-13', entry: '08:15', exit: '17:10', total: '8h55' },
  { id: '3',  collaborator: 'Júlia Ferreira', date: '2025-04-13', entry: '08:30', exit: '',       total: '—'    },
  { id: '4',  collaborator: 'Ana Paula',      date: '2025-04-11', entry: '08:05', exit: '17:00', total: '8h55' },
  { id: '5',  collaborator: 'Mariana Costa',  date: '2025-04-11', entry: '07:58', exit: '17:08', total: '9h10' },
  { id: '6',  collaborator: 'Júlia Ferreira', date: '2025-04-11', entry: '08:45', exit: '17:00', total: '8h15' },
  { id: '7',  collaborator: 'Ana Paula',      date: '2025-04-10', entry: '08:10', exit: '17:05', total: '8h55' },
  { id: '8',  collaborator: 'Mariana Costa',  date: '2025-04-10', entry: '08:00', exit: '17:00', total: '9h00' },
  { id: '9',  collaborator: 'Júlia Ferreira', date: '2025-04-10', entry: '09:00', exit: '17:00', total: '8h00' },
  { id: '10', collaborator: 'Ana Paula',      date: '2025-04-09', entry: '08:03', exit: '17:10', total: '9h07' },
  { id: '11', collaborator: 'Mariana Costa',  date: '2025-04-09', entry: '08:10', exit: '17:05', total: '8h55' },
  { id: '12', collaborator: 'Júlia Ferreira', date: '2025-04-09', entry: '08:30', exit: '16:50', total: '8h20' },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pct(current: number, target: number) {
  return Math.min(100, Math.round((current / target) * 100))
}

function ProgressBar({ value, color }: { value: number; color?: string }) {
  const bg = color || (value >= 90 ? '#10b981' : value >= 60 ? '#7c3aed' : '#f59e0b')
  return (
    <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${value}%`, background: bg }} />
    </div>
  )
}

function ScoreRing({ score, size = 64 }: { score: number; size?: number }) {
  const r = (size - 8) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (score / 100) * circ
  const color = score >= 85 ? '#10b981' : score >= 70 ? '#7c3aed' : '#f59e0b'
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={6} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={6}
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.8s ease' }}
      />
    </svg>
  )
}

const LEVEL_LABELS = ['', 'Iniciante', 'Básico', 'Intermediário', 'Avançado', 'Expert']
const LEVEL_COLORS = ['', '#5a5a6e', '#f59e0b', '#3b82f6', '#7c3aed', '#10b981']
const LEVEL_BG    = ['', 'rgba(90,90,110,0.15)', 'rgba(245,158,11,0.12)', 'rgba(59,130,246,0.12)', 'rgba(124,58,237,0.12)', 'rgba(16,185,129,0.12)']

// ─── Performance ─────────────────────────────────────────────────────────────

function Performance() {
  const totalRevenue = COLLABORATORS.reduce((a, c) => a + c.revenue, 0)
  const avgScore = Math.round(COLLABORATORS.reduce((a, c) => a + c.score, 0) / COLLABORATORS.length)
  const topPerformer = [...COLLABORATORS].sort((a, b) => b.score - a.score)[0]

  return (
    <div className="space-y-5">
      {/* Team KPI banner */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Receita total', value: `R$ ${totalRevenue.toLocaleString('pt-BR')}`, icon: TrendingUp, color: '#6ee7b7', bg: 'rgba(16,185,129,0.12)' },
          { label: 'Score médio',   value: `${avgScore}/100`,                             icon: BarChart2,  color: '#c4b5fd', bg: 'rgba(124,58,237,0.12)' },
          { label: 'Top performer', value: topPerformer.name.split(' ')[0],               icon: Trophy,     color: '#fcd34d', bg: 'rgba(245,158,11,0.12)' },
        ].map(k => (
          <div key={k.label} className="rounded-2xl p-4 flex items-center gap-3" style={{ background: k.bg, border: `1px solid ${k.color}22` }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${k.color}22` }}>
              <k.icon className="w-4 h-4" style={{ color: k.color }} />
            </div>
            <div>
              <p className="text-[10px]" style={{ color: k.color }}>{k.label}</p>
              <p className="text-sm font-bold" style={{ color: '#e8e8f2' }}>{k.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Collaborator cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {COLLABORATORS.map((c, idx) => {
          const scoreColor = c.score >= 85 ? '#10b981' : c.score >= 70 ? '#7c3aed' : '#f59e0b'
          const isTop = idx === 0 && c.score === topPerformer.score
          return (
            <div key={c.id} className="card p-5 space-y-4 relative overflow-hidden">
              {/* Top performer glow */}
              {c.id === topPerformer.id && (
                <div className="absolute top-0 right-0 px-2 py-1 rounded-bl-xl flex items-center gap-1" style={{ background: 'rgba(245,158,11,0.15)' }}>
                  <Flame className="w-3 h-3" style={{ color: '#fcd34d' }} />
                  <span className="text-[10px] font-bold" style={{ color: '#fcd34d' }}>Top</span>
                </div>
              )}

              {/* Header: avatar + score ring */}
              <div className="flex items-center gap-4">
                <div className="relative flex-shrink-0">
                  <ScoreRing score={c.score} size={60} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm"
                      style={{ background: c.avatar }}>
                      {c.name[0]}
                    </div>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: '#e8e8f2' }}>{c.name}</p>
                  <p className="text-xs" style={{ color: '#5a5a6e' }}>{c.role}</p>
                  <div className="flex items-center gap-1 mt-1">
                    <span className="text-lg font-bold" style={{ color: scoreColor }}>{c.score}</span>
                    <span className="text-xs" style={{ color: '#5a5a6e' }}>/100</span>
                    <span className={`ml-1 flex items-center gap-0.5 text-xs font-semibold`}
                      style={{ color: c.trend >= 0 ? '#6ee7b7' : '#fca5a5' }}>
                      {c.trend >= 0
                        ? <ArrowUp className="w-3 h-3" />
                        : <ArrowDown className="w-3 h-3" />
                      }
                      {Math.abs(c.trend)}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Stars */}
              <div className="flex items-center gap-1">
                {[1,2,3,4,5].map(s => (
                  <Star key={s} className="w-4 h-4" style={{
                    color: s <= Math.round(c.score / 20) ? '#f59e0b' : 'rgba(255,255,255,0.1)',
                    fill: s <= Math.round(c.score / 20) ? '#f59e0b' : 'rgba(255,255,255,0.1)'
                  }} />
                ))}
                <span className="text-xs ml-1" style={{ color: '#5a5a6e' }}>{Math.round(c.score / 20)}/5</span>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <p className="text-[10px]" style={{ color: '#5a5a6e' }}>Vendas</p>
                  <p className="text-base font-bold mt-0.5" style={{ color: '#e8e8f2' }}>{c.sales}</p>
                </div>
                <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <p className="text-[10px]" style={{ color: '#5a5a6e' }}>Receita</p>
                  <p className="text-base font-bold mt-0.5" style={{ color: '#e8e8f2' }}>R$ {(c.revenue / 1000).toFixed(1)}k</p>
                </div>
              </div>

              {/* Score bar */}
              <div>
                <ProgressBar value={c.score} color={scoreColor} />
              </div>

              {/* Badge */}
              {c.score < 70 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}>
                  <AlertTriangle className="w-3 h-3 flex-shrink-0" style={{ color: '#fcd34d' }} />
                  <p className="text-[10px]" style={{ color: '#fcd34d' }}>Agende um 1:1 esta semana</p>
                </div>
              )}
              {c.score >= 85 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
                  <Award className="w-3 h-3 flex-shrink-0" style={{ color: '#6ee7b7' }} />
                  <p className="text-[10px]" style={{ color: '#6ee7b7' }}>Performance excelente este mês</p>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Development Map ──────────────────────────────────────────────────────────

function Development() {
  const [selected, setSelected] = useState<string | null>(null)

  // Team average per skill for heatmap
  const teamAvg = SKILLS.map(skill => ({
    skill,
    avg: Math.round(COLLABORATORS.reduce((s, c) => s + (DEV_MAP[c.name]?.[skill] || 0), 0) / COLLABORATORS.length * 10) / 10
  }))

  const collab = selected ? COLLABORATORS.find(c => c.name === selected) : null

  return (
    <div className="space-y-5">
      {/* Team skill heatmap */}
      <div className="card p-5">
        <p className="text-xs font-semibold mb-4" style={{ color: '#e8e8f2' }}>Visão geral da equipe — média de habilidades</p>
        <div className="space-y-3">
          {teamAvg.map(({ skill, avg }) => {
            const avgPct = (avg / 5) * 100
            const color = avg >= 4 ? '#10b981' : avg >= 3 ? '#7c3aed' : avg >= 2 ? '#f59e0b' : '#ef4444'
            return (
              <div key={skill}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs" style={{ color: '#8b8b9e' }}>{skill}</span>
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      {COLLABORATORS.map(c => {
                        const lvl = DEV_MAP[c.name]?.[skill] || 0
                        return (
                          <div key={c.name} title={`${c.name.split(' ')[0]}: ${LEVEL_LABELS[lvl]}`}
                            className="w-4 h-4 rounded-sm flex items-center justify-center text-[8px] font-bold text-white"
                            style={{ background: LEVEL_COLORS[lvl], opacity: lvl === 0 ? 0.2 : 1 }}>
                            {lvl}
                          </div>
                        )
                      })}
                    </div>
                    <span className="text-xs font-semibold w-8 text-right" style={{ color }}>{avg.toFixed(1)}</span>
                  </div>
                </div>
                <ProgressBar value={avgPct} color={color} />
              </div>
            )
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 mt-4 flex-wrap">
          {[1,2,3,4,5].map(l => (
            <div key={l} className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-sm" style={{ background: LEVEL_COLORS[l] }} />
              <span className="text-[10px]" style={{ color: '#5a5a6e' }}>{l} — {LEVEL_LABELS[l]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Selector */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setSelected(null)}
          className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
          style={selected === null
            ? { background: '#7c3aed', color: 'white' }
            : { background: 'rgba(255,255,255,0.05)', color: '#8b8b9e', border: '1px solid rgba(255,255,255,0.08)' }
          }
        >
          Todos
        </button>
        {COLLABORATORS.map(c => (
          <button key={c.id}
            onClick={() => setSelected(c.name === selected ? null : c.name)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5"
            style={selected === c.name
              ? { background: c.avatar, color: 'white' }
              : { background: 'rgba(255,255,255,0.05)', color: '#8b8b9e', border: '1px solid rgba(255,255,255,0.08)' }
            }
          >
            <span className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[9px] font-bold"
              style={{ background: c.avatar }}>{c.name[0]}</span>
            {c.name.split(' ')[0]}
          </button>
        ))}
      </div>

      {/* Individual cards or all */}
      <div className={selected ? '' : 'grid grid-cols-1 md:grid-cols-3 gap-4'}>
        {(selected ? COLLABORATORS.filter(c => c.name === selected) : COLLABORATORS).map(c => {
          const skills = DEV_MAP[c.name] || {}
          const devScore = Math.round(Object.values(skills).reduce((a, v) => a + v, 0) / Object.values(skills).length * 20)
          const gaps = SKILLS.filter(s => (skills[s] || 0) <= 2)
          return (
            <div key={c.id} className="card p-5 space-y-4">
              {/* Header */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                  style={{ background: c.avatar }}>
                  {c.name[0]}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold" style={{ color: '#e8e8f2' }}>{c.name}</p>
                  <p className="text-xs" style={{ color: '#5a5a6e' }}>{c.role}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold" style={{ color: devScore >= 70 ? '#10b981' : devScore >= 50 ? '#7c3aed' : '#f59e0b' }}>{devScore}%</p>
                  <p className="text-[10px]" style={{ color: '#5a5a6e' }}>Desenvolvimento</p>
                </div>
              </div>

              {/* Skills */}
              <div className="space-y-3">
                {SKILLS.map(skill => {
                  const lvl = skills[skill] || 0
                  const nextStep = NEXT_STEP[c.name]?.[skill]
                  return (
                    <div key={skill}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs" style={{ color: '#8b8b9e' }}>{skill}</span>
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                          style={{ background: LEVEL_BG[lvl], color: LEVEL_COLORS[lvl] }}>
                          {LEVEL_LABELS[lvl]}
                        </span>
                      </div>
                      <div className="flex gap-1 mb-1">
                        {[1,2,3,4,5].map(s => (
                          <div key={s} className="flex-1 h-2 rounded-sm transition-all"
                            style={{ background: s <= lvl ? LEVEL_COLORS[lvl] : 'rgba(255,255,255,0.06)' }} />
                        ))}
                      </div>
                      {nextStep && lvl < 5 && (
                        <p className="text-[10px] flex items-center gap-1" style={{ color: '#5a5a6e' }}>
                          <BookOpen className="w-2.5 h-2.5 flex-shrink-0" />
                          {nextStep}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Gaps alert */}
              {gaps.length > 0 && (
                <div className="rounded-xl p-3" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
                  <p className="text-[10px] font-semibold mb-1" style={{ color: '#fcd34d' }}>
                    {gaps.length} gap{gaps.length > 1 ? 's' : ''} de desenvolvimento
                  </p>
                  {gaps.map(g => (
                    <p key={g} className="text-[10px]" style={{ color: '#8b6030' }}>· {g}</p>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Goals ────────────────────────────────────────────────────────────────────

function Goals() {
  const [goals, setGoals] = useState<Goal[]>(DEMO_GOALS)
  const [showModal, setShowModal] = useState(false)
  const [filterCollab, setFilterCollab] = useState<string>('todos')
  const [form, setForm] = useState({ title: '', collaborator: '', target: '', unit: 'vendas', deadline: '', cycle: 'Abril 2025' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [companionEdit, setCompanionEdit] = useState<string | null>(null)
  const [companionInput, setCompanionInput] = useState('')

  function updateCompanion(goalId: string, value: number) {
    setGoals(gs => gs.map(g => g.id === goalId && g.companion
      ? { ...g, companion: { ...g.companion, current: Math.max(0, value) } }
      : g
    ))
    setCompanionEdit(null)
    setCompanionInput('')
  }

  function close() {
    setShowModal(false); setErrors({})
    setForm({ title: '', collaborator: '', target: '', unit: 'vendas', deadline: '', cycle: 'Abril 2025' })
  }

  function save() {
    const e: Record<string, string> = {}
    if (!form.title.trim()) e.title = 'Informe o título'
    if (!form.collaborator) e.collaborator = 'Selecione um colaborador'
    if (!form.target || Number(form.target) <= 0) e.target = 'Informe um valor'
    if (Object.keys(e).length) { setErrors(e); return }
    setGoals(g => [...g, { id: Date.now().toString(), ...form, target: Number(form.target), current: 0 }])
    close()
  }

  const filtered = filterCollab === 'todos' ? goals : goals.filter(g => g.collaborator === filterCollab)

  const totalGoals     = goals.length
  const onTrack        = goals.filter(g => pct(g.current, g.target) >= 70).length
  const completed      = goals.filter(g => pct(g.current, g.target) >= 100).length
  const atRisk         = goals.filter(g => pct(g.current, g.target) < 50).length
  const avgPct         = goals.length > 0 ? Math.round(goals.reduce((a, g) => a + pct(g.current, g.target), 0) / goals.length) : 0

  return (
    <div className="space-y-5">

      {/* KPI banner */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total de metas',  value: `${totalGoals}`,    color: '#c4b5fd', bg: 'rgba(124,58,237,0.1)',  border: 'rgba(124,58,237,0.2)',  icon: Target     },
          { label: 'No prazo',        value: `${onTrack}`,       color: '#6ee7b7', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.2)', icon: CheckSquare },
          { label: 'Concluídas',      value: `${completed}`,     color: '#fcd34d', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.2)', icon: Trophy      },
          { label: 'Em risco',        value: `${atRisk}`,        color: '#fca5a5', bg: 'rgba(239,68,68,0.1)',  border: 'rgba(239,68,68,0.2)',  icon: AlertTriangle },
        ].map(k => (
          <div key={k.label} className="rounded-2xl p-4 flex items-center gap-3" style={{ background: k.bg, border: `1px solid ${k.border}` }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${k.color}22` }}>
              <k.icon className="w-4 h-4" style={{ color: k.color }} />
            </div>
            <div>
              <p className="text-[10px] font-medium" style={{ color: k.color }}>{k.label}</p>
              <p className="text-base font-bold mt-0.5" style={{ color: '#e8e8f2' }}>{k.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Progress geral */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold" style={{ color: '#e8e8f2' }}>Progresso geral do ciclo</p>
          <span className="text-sm font-bold" style={{ color: avgPct >= 80 ? '#10b981' : avgPct >= 50 ? '#7c3aed' : '#f59e0b' }}>{avgPct}%</span>
        </div>
        <ProgressBar value={avgPct} />
        <div className="flex items-center gap-4 mt-3">
          {COLLABORATORS.map(c => {
            const myGoals = goals.filter(g => g.collaborator === c.name)
            const myAvg = myGoals.length > 0 ? Math.round(myGoals.reduce((a, g) => a + pct(g.current, g.target), 0) / myGoals.length) : 0
            return (
              <div key={c.id} className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: c.avatar }} />
                <span className="text-[10px]" style={{ color: '#5a5a6e' }}>{c.name.split(' ')[0]}</span>
                <span className="text-[10px] font-bold" style={{ color: myAvg >= 80 ? '#6ee7b7' : myAvg >= 50 ? '#c4b5fd' : '#fca5a5' }}>{myAvg}%</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Filtros + nova meta */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => setFilterCollab('todos')}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={filterCollab === 'todos'
              ? { background: '#7c3aed', color: 'white' }
              : { background: 'rgba(255,255,255,0.04)', color: '#8b8b9e', border: '1px solid rgba(255,255,255,0.07)' }
            }
          >Todos</button>
          {COLLABORATORS.map(c => (
            <button key={c.id}
              onClick={() => setFilterCollab(c.name === filterCollab ? 'todos' : c.name)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5"
              style={filterCollab === c.name
                ? { background: c.avatar, color: 'white' }
                : { background: 'rgba(255,255,255,0.04)', color: '#8b8b9e', border: '1px solid rgba(255,255,255,0.07)' }
              }
            >
              <span className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-white text-[8px] font-bold"
                style={{ background: c.avatar }}>{c.name[0]}</span>
              {c.name.split(' ')[0]}
            </button>
          ))}
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary text-xs flex items-center gap-1.5 py-1.5 px-3">
          <Plus className="w-3.5 h-3.5" /> Nova meta
        </button>
      </div>

      {/* Goals list */}
      <div className="space-y-3">
        {filtered.map(g => {
          const p = pct(g.current, g.target)
          const collab = COLLABORATORS.find(c => c.name === g.collaborator)
          const barColor = p >= 100 ? '#10b981' : p >= 70 ? '#7c3aed' : p >= 40 ? '#f59e0b' : '#ef4444'
          const daysLeft = Math.ceil((new Date(g.deadline).getTime() - Date.now()) / 86400000)
          const isUrgent = daysLeft <= 7 && p < 100
          const isDone   = p >= 100

          return (
            <div key={g.id} className="card p-5 space-y-4"
              style={isDone
                ? { borderColor: 'rgba(16,185,129,0.25)' }
                : isUrgent ? { borderColor: 'rgba(239,68,68,0.25)' } : {}
              }>
              {/* Header */}
              <div className="flex items-center gap-3">
                {/* Avatar com score ring */}
                <div className="relative flex-shrink-0">
                  <ScoreRing score={p} size={52} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm"
                      style={{ background: collab?.avatar || '#7c3aed' }}>
                      {g.collaborator[0]}
                    </div>
                  </div>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold" style={{ color: '#e8e8f2' }}>{g.title}</p>
                      <p className="text-xs mt-0.5" style={{ color: '#5a5a6e' }}>{g.collaborator} · {g.cycle}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className="text-xl font-bold" style={{ color: barColor }}>{p}%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Progress bar with milestones */}
              <div>
                <div className="relative">
                  <ProgressBar value={p} color={barColor} />
                  {/* Milestone markers at 50% and 100% */}
                  <div className="absolute top-0 bottom-0 w-px" style={{ left: '50%', background: 'rgba(255,255,255,0.1)' }} />
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs" style={{ color: '#5a5a6e' }}>
                    {g.current.toLocaleString('pt-BR')} {g.unit} de {g.target.toLocaleString('pt-BR')} {g.unit}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs flex items-center gap-1" style={{ color: '#5a5a6e' }}>
                      <Calendar className="w-3 h-3" />
                      {new Date(g.deadline).toLocaleDateString('pt-BR')}
                    </span>
                    {!isDone && (
                      <span className="text-xs font-semibold" style={{ color: isUrgent ? '#fca5a5' : '#5a5a6e' }}>
                        {daysLeft > 0 ? `${daysLeft}d restantes` : `${Math.abs(daysLeft)}d em atraso`}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Companion sub-goal */}
              {g.companion && (
                <div className="rounded-xl px-4 py-3 space-y-2" style={{ background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.12)' }}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold" style={{ color: '#c4b5fd' }}>{g.companion.title}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold" style={{ color: '#a78bfa' }}>
                        {pct(g.companion.current, g.companion.target)}%
                      </span>
                      {companionEdit === g.id ? (
                        <div className="flex items-center gap-1">
                          <input
                            autoFocus
                            type="number"
                            value={companionInput}
                            onChange={e => setCompanionInput(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') updateCompanion(g.id, Number(companionInput)); if (e.key === 'Escape') { setCompanionEdit(null); setCompanionInput('') } }}
                            className="input text-xs px-2 py-1 w-20"
                            placeholder={String(g.companion.current)}
                          />
                          <button onClick={() => updateCompanion(g.id, Number(companionInput))} className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: 'rgba(124,58,237,0.3)', color: '#c4b5fd' }}>
                            <Check className="w-3 h-3" />
                          </button>
                          <button onClick={() => { setCompanionEdit(null); setCompanionInput('') }} className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.06)', color: '#5a5a6e' }}>
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setCompanionEdit(g.id); setCompanionInput(String(g.companion!.current)) }}
                          className="text-[10px] px-2 py-0.5 rounded-md font-medium transition-colors"
                          style={{ background: 'rgba(124,58,237,0.2)', color: '#a78bfa' }}
                        >
                          + progresso
                        </button>
                      )}
                    </div>
                  </div>
                  <ProgressBar value={pct(g.companion.current, g.companion.target)} color="#7c3aed" />
                  <span className="text-[10px]" style={{ color: '#5a5a6e' }}>
                    {g.companion.current.toLocaleString('pt-BR')} {g.companion.unit} de {g.companion.target.toLocaleString('pt-BR')} {g.companion.unit}
                  </span>
                </div>
              )}

              {/* Status badge */}
              {isDone && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
                  <Trophy className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#6ee7b7' }} />
                  <p className="text-xs font-medium" style={{ color: '#6ee7b7' }}>Meta concluída! Parabéns, {g.collaborator.split(' ')[0]}.</p>
                </div>
              )}
              {isUrgent && !isDone && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#fca5a5' }} />
                  <p className="text-xs font-medium" style={{ color: '#fca5a5' }}>
                    Prazo se aproxima — falta {g.target - g.current} {g.unit} para atingir a meta.
                  </p>
                </div>
              )}
            </div>
          )
        })}

        {filtered.length === 0 && (
          <div className="text-center py-12">
            <Target className="w-10 h-10 mx-auto mb-3 opacity-20" style={{ color: '#8b8b9e' }} />
            <p className="text-sm" style={{ color: '#5a5a6e' }}>Nenhuma meta para este colaborador</p>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={close}>
          <div className="rounded-2xl w-full max-w-md" style={{ background: '#16161f', border: '1px solid rgba(255,255,255,0.08)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(124,58,237,0.2)' }}>
                  <Target className="w-4 h-4" style={{ color: '#a78bfa' }} />
                </div>
                <h3 className="font-semibold" style={{ color: '#e8e8f2' }}>Nova meta</h3>
              </div>
              <button onClick={close} className="p-1.5 rounded-lg" style={{ color: '#5a5a6e' }}><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="text-xs font-medium block mb-1.5" style={{ color: '#8b8b9e' }}>Título da meta *</label>
                <input className={`input w-full ${errors.title ? 'border-red-500/50' : ''}`} placeholder="Ex: Vendas mensais" value={form.title}
                  onChange={e => { setForm(f => ({ ...f, title: e.target.value })); setErrors(er => ({ ...er, title: '' })) }} />
                {errors.title && <p className="text-xs mt-1" style={{ color: '#fca5a5' }}>{errors.title}</p>}
              </div>
              <div>
                <label className="text-xs font-medium block mb-1.5" style={{ color: '#8b8b9e' }}>Colaborador *</label>
                <select className={`input w-full ${errors.collaborator ? 'border-red-500/50' : ''}`} value={form.collaborator}
                  onChange={e => { setForm(f => ({ ...f, collaborator: e.target.value })); setErrors(er => ({ ...er, collaborator: '' })) }}>
                  <option value="">Selecione...</option>
                  {COLLABORATORS.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
                {errors.collaborator && <p className="text-xs mt-1" style={{ color: '#fca5a5' }}>{errors.collaborator}</p>}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium block mb-1.5" style={{ color: '#8b8b9e' }}>Meta *</label>
                  <input className="input" placeholder="Ex: 30" type="number" value={form.target}
                    onChange={e => setForm(f => ({ ...f, target: e.target.value }))} />
                  {errors.target && <p className="text-xs mt-1" style={{ color: '#fca5a5' }}>{errors.target}</p>}
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1.5" style={{ color: '#8b8b9e' }}>Unidade</label>
                  <input className="input" placeholder="Ex: vendas" value={form.unit}
                    onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium block mb-1.5" style={{ color: '#8b8b9e' }}>Prazo</label>
                <input className="input w-full" type="date" value={form.deadline}
                  onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1.5" style={{ color: '#8b8b9e' }}>Ciclo</label>
                <input className="input w-full" placeholder="Ex: Abril 2025" value={form.cycle}
                  onChange={e => setForm(f => ({ ...f, cycle: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-2 p-5 pt-0">
              <button onClick={close} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={save} className="btn-primary flex-1">Salvar meta</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Insights ────────────────────────────────────────────────────────────────

// Mini sparkline bars (simulated weekly data per collaborator)
const WEEKLY_DATA: Record<string, number[]> = {
  'Ana Paula':      [18, 22, 19, 24, 21, 24, 26],
  'Mariana Costa':  [30, 33, 35, 36, 38, 37, 40],
  'Júlia Ferreira': [10, 12, 14, 13, 15, 16, 17],
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data)
  return (
    <div className="flex items-end gap-0.5 h-8">
      {data.map((v, i) => (
        <div
          key={i}
          className="flex-1 rounded-sm transition-all"
          style={{
            height: `${Math.round((v / max) * 100)}%`,
            background: i === data.length - 1 ? color : `${color}55`,
            minHeight: 3
          }}
        />
      ))}
    </div>
  )
}

function Insights() {
  const [view, setView] = useState<'cards' | 'ranking'>('cards')

  const totalRevenue = COLLABORATORS.reduce((a, c) => a + c.revenue, 0)
  const totalSales   = COLLABORATORS.reduce((a, c) => a + c.sales, 0)

  const ranked = [...COLLABORATORS].sort((a, b) => b.revenue - a.revenue)

  return (
    <div className="space-y-5">

      {/* Summary banner */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Receita total',   value: `R$ ${totalRevenue.toLocaleString('pt-BR')}`,              color: '#6ee7b7', bg: 'rgba(16,185,129,0.1)',   border: 'rgba(16,185,129,0.2)'  },
          { label: 'Vendas totais',   value: `${totalSales} vendas`,                                   color: '#93c5fd', bg: 'rgba(59,130,246,0.1)',    border: 'rgba(59,130,246,0.2)'  },
          { label: 'Ticket médio',    value: `R$ ${Math.round(totalRevenue / totalSales)}`,             color: '#fcd34d', bg: 'rgba(245,158,11,0.1)',    border: 'rgba(245,158,11,0.2)'  },
          { label: 'Score da equipe', value: `${Math.round(COLLABORATORS.reduce((a,c)=>a+c.score,0)/COLLABORATORS.length)}/100`, color: '#c4b5fd', bg: 'rgba(124,58,237,0.1)', border: 'rgba(124,58,237,0.2)' },
        ].map(k => (
          <div key={k.label} className="rounded-2xl p-4" style={{ background: k.bg, border: `1px solid ${k.border}` }}>
            <p className="text-[10px] font-medium" style={{ color: k.color }}>{k.label}</p>
            <p className="text-base font-bold mt-1" style={{ color: '#e8e8f2' }}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* View toggle */}
      <div className="flex items-center gap-2">
        {(['cards', 'ranking'] as const).map(v => (
          <button key={v} onClick={() => setView(v)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={view === v
              ? { background: '#7c3aed', color: 'white' }
              : { background: 'rgba(255,255,255,0.04)', color: '#8b8b9e', border: '1px solid rgba(255,255,255,0.07)' }
            }>
            {v === 'cards' ? 'Perfis detalhados' : 'Ranking comparativo'}
          </button>
        ))}
      </div>

      {/* Cards view */}
      {view === 'cards' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {COLLABORATORS.map((c, idx) => {
            const avgTicket  = c.sales > 0 ? Math.round(c.revenue / c.sales) : 0
            const convRate   = Math.round(55 + (c.score / 100) * 35)
            const revShare   = Math.round((c.revenue / totalRevenue) * 100)
            const salesShare = Math.round((c.sales / totalSales) * 100)
            const weekData   = WEEKLY_DATA[c.name] || []
            const scoreColor = c.score >= 85 ? '#10b981' : c.score >= 70 ? '#7c3aed' : '#f59e0b'

            const insight = c.score >= 85
              ? { text: `Top performer — candidata a mentora da equipe.`, color: '#6ee7b7', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.2)', icon: '🏆' }
              : c.score >= 70
              ? { text: `Progredindo bem. Foco em aumentar ticket médio.`, color: '#c4b5fd', bg: 'rgba(124,58,237,0.08)', border: 'rgba(124,58,237,0.2)', icon: '💡' }
              : { text: `Precisa de atenção. Agende 1:1 esta semana.`, color: '#fcd34d', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)', icon: '⚠️' }

            return (
              <div key={c.id} className="card p-5 space-y-4">

                {/* Header */}
                <div className="flex items-center gap-3">
                  <div className="relative flex-shrink-0">
                    <ScoreRing score={c.score} size={52} />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm"
                        style={{ background: c.avatar }}>
                        {c.name[0]}
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: '#e8e8f2' }}>{c.name}</p>
                    <p className="text-xs" style={{ color: '#5a5a6e' }}>{c.role}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="text-sm font-bold" style={{ color: scoreColor }}>{c.score}</span>
                      <span className="text-xs" style={{ color: '#5a5a6e' }}>/100</span>
                      <span className="text-xs font-semibold flex items-center gap-0.5 ml-1"
                        style={{ color: c.trend >= 0 ? '#6ee7b7' : '#fca5a5' }}>
                        {c.trend >= 0 ? <ArrowUp className="w-2.5 h-2.5" /> : <ArrowDown className="w-2.5 h-2.5" />}
                        {Math.abs(c.trend)}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Sparkline — últimas 7 semanas */}
                <div>
                  <p className="text-[10px] mb-1.5" style={{ color: '#5a5a6e' }}>Evolução de vendas (7 semanas)</p>
                  <Sparkline data={weekData} color={c.avatar} />
                </div>

                {/* Metrics */}
                <div className="space-y-2">
                  {[
                    { label: 'Receita',       value: `R$ ${c.revenue.toLocaleString('pt-BR')}`, pct: revShare,   color: '#6ee7b7' },
                    { label: 'Vendas',        value: `${c.sales} vendas`,                       pct: salesShare, color: '#93c5fd' },
                    { label: 'Ticket médio',  value: `R$ ${avgTicket}`,                         pct: Math.min(100, Math.round((avgTicket / 300) * 100)), color: '#fcd34d' },
                    { label: 'Conversão',     value: `${convRate}%`,                            pct: convRate,   color: '#c4b5fd' },
                  ].map(m => (
                    <div key={m.label}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px]" style={{ color: '#5a5a6e' }}>{m.label}</span>
                        <span className="text-[10px] font-semibold" style={{ color: '#c4c4d4' }}>{m.value}</span>
                      </div>
                      <ProgressBar value={m.pct} color={m.color} />
                    </div>
                  ))}
                </div>

                {/* Insight */}
                <div className="rounded-xl p-3" style={{ background: insight.bg, border: `1px solid ${insight.border}` }}>
                  <p className="text-[11px] leading-relaxed" style={{ color: insight.color }}>
                    {insight.icon} {insight.text}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Ranking view */}
      {view === 'ranking' && (
        <div className="card overflow-hidden">
          <div className="px-5 py-3" style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-xs font-semibold" style={{ color: '#8b8b9e' }}>Ranking por receita — ciclo atual</p>
          </div>
          <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
            {ranked.map((c, i) => {
              const avgTicket = c.sales > 0 ? Math.round(c.revenue / c.sales) : 0
              const convRate  = Math.round(55 + (c.score / 100) * 35)
              const medals = ['🥇', '🥈', '🥉']
              return (
                <div key={c.id} className="px-5 py-4 flex items-center gap-4">
                  {/* Position */}
                  <span className="text-lg flex-shrink-0 w-8 text-center">{medals[i] || `#${i+1}`}</span>

                  {/* Avatar */}
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0"
                    style={{ background: c.avatar }}>
                    {c.name[0]}
                  </div>

                  {/* Name + role */}
                  <div className="w-36 flex-shrink-0">
                    <p className="text-sm font-semibold" style={{ color: '#e8e8f2' }}>{c.name}</p>
                    <p className="text-xs" style={{ color: '#5a5a6e' }}>{c.role}</p>
                  </div>

                  {/* Bar */}
                  <div className="flex-1">
                    <ProgressBar value={Math.round((c.revenue / ranked[0].revenue) * 100)} color={c.avatar} />
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-6 flex-shrink-0">
                    <div className="text-right">
                      <p className="text-xs" style={{ color: '#5a5a6e' }}>Receita</p>
                      <p className="text-sm font-bold" style={{ color: '#6ee7b7' }}>R$ {c.revenue.toLocaleString('pt-BR')}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs" style={{ color: '#5a5a6e' }}>Vendas</p>
                      <p className="text-sm font-bold" style={{ color: '#e8e8f2' }}>{c.sales}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs" style={{ color: '#5a5a6e' }}>Ticket</p>
                      <p className="text-sm font-bold" style={{ color: '#fcd34d' }}>R$ {avgTicket}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs" style={{ color: '#5a5a6e' }}>Conv.</p>
                      <p className="text-sm font-bold" style={{ color: '#c4b5fd' }}>{convRate}%</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs" style={{ color: '#5a5a6e' }}>Score</p>
                      <p className="text-sm font-bold" style={{ color: c.score >= 85 ? '#10b981' : c.score >= 70 ? '#7c3aed' : '#f59e0b' }}>{c.score}</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Feedback ────────────────────────────────────────────────────────────────

const TYPE_META: Record<string, { label: string; color: string; bg: string; border: string; icon: string }> = {
  positivo:    { label: 'Positivo',    color: '#6ee7b7', bg: 'rgba(16,185,129,0.1)',  border: 'rgba(16,185,129,0.25)',  icon: '🏆' },
  construtivo: { label: 'Construtivo', color: '#c4b5fd', bg: 'rgba(124,58,237,0.1)',  border: 'rgba(124,58,237,0.25)', icon: '💡' },
  corretivo:   { label: 'Corretivo',   color: '#fcd34d', bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.25)', icon: '⚠️' },
}

function Feedback() {
  const [view, setView] = useState<'form' | 'history'>('form')
  const [records, setRecords] = useState<FeedbackRecord[]>(DEMO_FEEDBACKS)
  const [form, setForm] = useState<FeedbackForm>({ collaborator: '', type: 'positivo', strengths: '', improvements: '', actions: '', rating: 4 })
  const [saved, setSaved] = useState(false)
  const [filterCollab, setFilterCollab] = useState('todos')

  function save() {
    if (!form.collaborator || !form.strengths) return
    setRecords(r => [{
      ...form,
      id: Date.now().toString(),
      date: new Date().toISOString().split('T')[0],
    }, ...r])
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
    setForm({ collaborator: '', type: 'positivo', strengths: '', improvements: '', actions: '', rating: 4 })
  }

  const selectedCollab = form.collaborator ? COLLABORATORS.find(c => c.name === form.collaborator) : null

  const filteredRecords = filterCollab === 'todos'
    ? records
    : records.filter(r => r.collaborator === filterCollab)

  return (
    <div className="space-y-5">

      {/* KPI banner */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total de feedbacks', value: `${records.length}`,                                           color: '#c4b5fd', bg: 'rgba(124,58,237,0.1)', border: 'rgba(124,58,237,0.2)' },
          { label: 'Positivos',          value: `${records.filter(r => r.type === 'positivo').length}`,        color: '#6ee7b7', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.2)' },
          { label: 'Requerem ação',      value: `${records.filter(r => r.type !== 'positivo').length}`,        color: '#fcd34d', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.2)' },
        ].map(k => (
          <div key={k.label} className="rounded-2xl p-4" style={{ background: k.bg, border: `1px solid ${k.border}` }}>
            <p className="text-[10px] font-medium" style={{ color: k.color }}>{k.label}</p>
            <p className="text-xl font-bold mt-1" style={{ color: '#e8e8f2' }}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Toggle */}
      <div className="flex gap-1.5">
        {([['form', 'Novo feedback'], ['history', 'Histórico']] as const).map(([v, label]) => (
          <button key={v} onClick={() => setView(v)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={view === v
              ? { background: '#7c3aed', color: 'white' }
              : { background: 'rgba(255,255,255,0.04)', color: '#8b8b9e', border: '1px solid rgba(255,255,255,0.07)' }
            }>
            {label}
            {v === 'history' && records.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                style={{ background: 'rgba(255,255,255,0.15)' }}>{records.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Form view */}
      {view === 'form' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

          {/* Preview card */}
          <div className="md:col-span-1">
            <div className="card p-5 space-y-4 sticky top-4">
              <p className="text-xs font-semibold" style={{ color: '#8b8b9e' }}>Pré-visualização</p>

              {selectedCollab ? (
                <>
                  <div className="flex items-center gap-3">
                    <div className="relative flex-shrink-0">
                      <ScoreRing score={form.rating * 20} size={52} />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm"
                          style={{ background: selectedCollab.avatar }}>
                          {selectedCollab.name[0]}
                        </div>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-semibold" style={{ color: '#e8e8f2' }}>{selectedCollab.name}</p>
                      <p className="text-xs" style={{ color: '#5a5a6e' }}>{selectedCollab.role}</p>
                    </div>
                  </div>

                  <div className="rounded-xl p-3" style={{ background: TYPE_META[form.type].bg, border: `1px solid ${TYPE_META[form.type].border}` }}>
                    <p className="text-xs font-semibold mb-1" style={{ color: TYPE_META[form.type].color }}>
                      {TYPE_META[form.type].icon} {TYPE_META[form.type].label}
                    </p>
                    <div className="flex gap-0.5">
                      {[1,2,3,4,5].map(s => (
                        <Star key={s} className="w-3.5 h-3.5"
                          style={{ color: s <= form.rating ? '#f59e0b' : 'rgba(255,255,255,0.1)', fill: s <= form.rating ? '#f59e0b' : 'rgba(255,255,255,0.1)' }} />
                      ))}
                    </div>
                  </div>

                  {form.strengths && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: '#5a5a6e' }}>Pontos fortes</p>
                      <p className="text-xs leading-relaxed line-clamp-3" style={{ color: '#8b8b9e' }}>{form.strengths}</p>
                    </div>
                  )}

                  {form.actions && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: '#5a5a6e' }}>Ações</p>
                      <p className="text-xs leading-relaxed line-clamp-2" style={{ color: '#8b8b9e' }}>{form.actions}</p>
                    </div>
                  )}
                </>
              ) : (
                <div className="py-8 text-center">
                  <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-20" style={{ color: '#8b8b9e' }} />
                  <p className="text-xs" style={{ color: '#5a5a6e' }}>Selecione um colaborador para pré-visualizar</p>
                </div>
              )}
            </div>
          </div>

          {/* Form */}
          <div className="md:col-span-2 space-y-4">
            {saved && (
              <div className="flex items-center gap-2 p-3 rounded-xl text-sm" style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', color: '#6ee7b7' }}>
                <Check className="w-4 h-4" /> Feedback registrado com sucesso!
              </div>
            )}

            <div className="card p-5 space-y-5">

              {/* Colaborador picker visual */}
              <div>
                <label className="text-xs font-medium block mb-2" style={{ color: '#8b8b9e' }}>Colaborador *</label>
                <div className="flex gap-2 flex-wrap">
                  {COLLABORATORS.map(c => (
                    <button key={c.id}
                      onClick={() => setForm(f => ({ ...f, collaborator: c.name }))}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all"
                      style={form.collaborator === c.name
                        ? { background: c.avatar, color: 'white', boxShadow: `0 0 12px ${c.avatar}55` }
                        : { background: 'rgba(255,255,255,0.04)', color: '#8b8b9e', border: '1px solid rgba(255,255,255,0.07)' }
                      }
                    >
                      <span className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                        style={{ background: form.collaborator === c.name ? 'rgba(255,255,255,0.25)' : c.avatar }}>
                        {c.name[0]}
                      </span>
                      {c.name.split(' ')[0]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tipo */}
              <div>
                <label className="text-xs font-medium block mb-2" style={{ color: '#8b8b9e' }}>Tipo de feedback *</label>
                <div className="flex gap-2">
                  {Object.entries(TYPE_META).map(([key, meta]) => (
                    <button key={key}
                      onClick={() => setForm(f => ({ ...f, type: key }))}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium flex-1 justify-center transition-all"
                      style={form.type === key
                        ? { background: meta.bg, color: meta.color, border: `1px solid ${meta.border}` }
                        : { background: 'rgba(255,255,255,0.04)', color: '#8b8b9e', border: '1px solid rgba(255,255,255,0.07)' }
                      }
                    >
                      <span>{meta.icon}</span> {meta.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Rating */}
              <div>
                <label className="text-xs font-medium block mb-2" style={{ color: '#8b8b9e' }}>Avaliação geral</label>
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    {[1,2,3,4,5].map(s => (
                      <button key={s} onClick={() => setForm(f => ({ ...f, rating: s }))}>
                        <Star className="w-7 h-7 transition-all"
                          style={{ color: s <= form.rating ? '#f59e0b' : 'rgba(255,255,255,0.1)', fill: s <= form.rating ? '#f59e0b' : 'rgba(255,255,255,0.1)' }} />
                      </button>
                    ))}
                  </div>
                  <span className="text-sm font-semibold" style={{ color: form.rating >= 4 ? '#6ee7b7' : form.rating >= 3 ? '#c4b5fd' : '#fca5a5' }}>
                    {['', 'Insatisfatório', 'Abaixo do esperado', 'Em desenvolvimento', 'Bom', 'Excelente'][form.rating]}
                  </span>
                </div>
              </div>

              {/* Textareas */}
              <div>
                <label className="text-xs font-medium block mb-1.5" style={{ color: '#8b8b9e' }}>
                  Pontos fortes observados <span style={{ color: '#fca5a5' }}>*</span>
                </label>
                <textarea className="input w-full resize-none" rows={3}
                  placeholder="O que essa pessoa fez bem? Seja específico com exemplos..."
                  value={form.strengths} onChange={e => setForm(f => ({ ...f, strengths: e.target.value }))} />
              </div>

              <div>
                <label className="text-xs font-medium block mb-1.5" style={{ color: '#8b8b9e' }}>Oportunidades de melhoria</label>
                <textarea className="input w-full resize-none" rows={3}
                  placeholder="O que pode melhorar? Como?"
                  value={form.improvements} onChange={e => setForm(f => ({ ...f, improvements: e.target.value }))} />
              </div>

              <div>
                <label className="text-xs font-medium block mb-1.5" style={{ color: '#8b8b9e' }}>Ações combinadas</label>
                <textarea className="input w-full resize-none" rows={2}
                  placeholder="O que ficou acordado? Próximos passos..."
                  value={form.actions} onChange={e => setForm(f => ({ ...f, actions: e.target.value }))} />
              </div>

              <button onClick={save}
                disabled={!form.collaborator || !form.strengths}
                className="btn-primary w-full py-2.5 disabled:opacity-40 flex items-center justify-center gap-2">
                <MessageSquare className="w-4 h-4" />
                Registrar feedback
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History view */}
      {view === 'history' && (
        <div className="space-y-4">
          {/* Filter */}
          <div className="flex gap-1.5 flex-wrap">
            <button onClick={() => setFilterCollab('todos')}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={filterCollab === 'todos'
                ? { background: '#7c3aed', color: 'white' }
                : { background: 'rgba(255,255,255,0.04)', color: '#8b8b9e', border: '1px solid rgba(255,255,255,0.07)' }
              }>Todos</button>
            {COLLABORATORS.map(c => (
              <button key={c.id} onClick={() => setFilterCollab(c.name === filterCollab ? 'todos' : c.name)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5"
                style={filterCollab === c.name
                  ? { background: c.avatar, color: 'white' }
                  : { background: 'rgba(255,255,255,0.04)', color: '#8b8b9e', border: '1px solid rgba(255,255,255,0.07)' }
                }>
                <span className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-white text-[8px] font-bold"
                  style={{ background: c.avatar }}>{c.name[0]}</span>
                {c.name.split(' ')[0]}
              </button>
            ))}
          </div>

          {/* Records */}
          <div className="space-y-3">
            {filteredRecords.map(r => {
              const meta = TYPE_META[r.type] || TYPE_META.positivo
              const collab = COLLABORATORS.find(c => c.name === r.collaborator)
              return (
                <div key={r.id} className="card p-5 space-y-4">
                  {/* Header */}
                  <div className="flex items-start gap-3">
                    <div className="relative flex-shrink-0">
                      <ScoreRing score={r.rating * 20} size={48} />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-xs"
                          style={{ background: collab?.avatar || '#7c3aed' }}>
                          {r.collaborator[0]}
                        </div>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold" style={{ color: '#e8e8f2' }}>{r.collaborator}</p>
                          <p className="text-xs" style={{ color: '#5a5a6e' }}>{new Date(r.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                        </div>
                        <span className="text-xs font-semibold px-2 py-1 rounded-lg flex-shrink-0"
                          style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.border}` }}>
                          {meta.icon} {meta.label}
                        </span>
                      </div>
                      {/* Stars */}
                      <div className="flex gap-0.5 mt-1.5">
                        {[1,2,3,4,5].map(s => (
                          <Star key={s} className="w-3 h-3"
                            style={{ color: s <= r.rating ? '#f59e0b' : 'rgba(255,255,255,0.1)', fill: s <= r.rating ? '#f59e0b' : 'rgba(255,255,255,0.1)' }} />
                        ))}
                        <span className="text-[10px] ml-1" style={{ color: '#5a5a6e' }}>{r.rating}/5</span>
                      </div>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="space-y-3">
                    {r.strengths && (
                      <div className="rounded-xl p-3" style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.12)' }}>
                        <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: '#4a9f82' }}>Pontos fortes</p>
                        <p className="text-xs leading-relaxed" style={{ color: '#8b8b9e' }}>{r.strengths}</p>
                      </div>
                    )}
                    {r.improvements && (
                      <div className="rounded-xl p-3" style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.12)' }}>
                        <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: '#9a7020' }}>Oportunidades de melhoria</p>
                        <p className="text-xs leading-relaxed" style={{ color: '#8b8b9e' }}>{r.improvements}</p>
                      </div>
                    )}
                    {r.actions && (
                      <div className="rounded-xl p-3" style={{ background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.12)' }}>
                        <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: '#6b4fa8' }}>Ações combinadas</p>
                        <p className="text-xs leading-relaxed" style={{ color: '#8b8b9e' }}>{r.actions}</p>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}

            {filteredRecords.length === 0 && (
              <div className="text-center py-12">
                <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-20" style={{ color: '#8b8b9e' }} />
                <p className="text-sm" style={{ color: '#5a5a6e' }}>Nenhum feedback registrado</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Calendar Picker ─────────────────────────────────────────────────────────

const MONTHS_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const DAYS_PT   = ['D','S','T','Q','Q','S','S']

function CalendarPicker({ value, onChange, meetings }: {
  value: string
  onChange: (date: string) => void
  meetings: Meeting[]
}) {
  const today    = new Date()
  const selected = value ? new Date(value + 'T12:00:00') : null
  const [viewYear,  setViewYear]  = useState(selected?.getFullYear()  ?? today.getFullYear())
  const [viewMonth, setViewMonth] = useState(selected?.getMonth()     ?? today.getMonth())

  const firstDay = new Date(viewYear, viewMonth, 1)
  const lastDay  = new Date(viewYear, viewMonth + 1, 0)
  const startDow = firstDay.getDay()

  const meetingDates = new Set(meetings.map(m => m.date))

  const cells: (number | null)[] = []
  for (let i = 0; i < startDow; i++) cells.push(null)
  for (let d = 1; d <= lastDay.getDate(); d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  function selectDay(day: number) {
    const m = String(viewMonth + 1).padStart(2, '0')
    const d = String(day).padStart(2, '0')
    onChange(`${viewYear}-${m}-${d}`)
  }

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
      {/* Month nav */}
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <button type="button" onClick={prevMonth}
          className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
          style={{ background: 'rgba(255,255,255,0.05)', color: '#8b8b9e' }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(124,58,237,0.2)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M8 2L4 6l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <span className="text-sm font-semibold" style={{ color: '#e8e8f2' }}>
          {MONTHS_PT[viewMonth]} {viewYear}
        </span>
        <button type="button" onClick={nextMonth}
          className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
          style={{ background: 'rgba(255,255,255,0.05)', color: '#8b8b9e' }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(124,58,237,0.2)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 px-3 pt-2">
        {DAYS_PT.map((d, i) => (
          <div key={i} className="text-center text-[10px] font-bold py-1" style={{ color: '#3a3a50' }}>{d}</div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 px-3 pb-3 gap-y-0.5">
        {cells.map((day, i) => {
          if (!day) return <div key={i} />
          const mm      = String(viewMonth + 1).padStart(2, '0')
          const dd      = String(day).padStart(2, '0')
          const dateStr = `${viewYear}-${mm}-${dd}`
          const isToday    = viewYear === today.getFullYear() && viewMonth === today.getMonth() && day === today.getDate()
          const isSelected = selected && viewYear === selected.getFullYear() && viewMonth === selected.getMonth() && day === selected.getDate()
          const hasMeeting = meetingDates.has(dateStr)
          const isPast     = new Date(dateStr + 'T12:00:00') < new Date(today.toDateString())

          return (
            <button
              type="button"
              key={i}
              onClick={() => selectDay(day)}
              className="relative flex flex-col items-center justify-center rounded-xl transition-all"
              style={{
                height: 34,
                background: isSelected ? '#7c3aed' : isToday ? 'rgba(124,58,237,0.18)' : 'transparent',
                color: isSelected ? 'white' : isToday ? '#a78bfa' : isPast ? '#3a3a50' : '#c4c4d4',
                fontWeight: isSelected || isToday ? 700 : 400,
                fontSize: 13,
                outline: isToday && !isSelected ? '1px solid rgba(124,58,237,0.4)' : 'none',
              }}
              onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'rgba(124,58,237,0.12)' }}
              onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = isToday ? 'rgba(124,58,237,0.18)' : 'transparent' }}
            >
              {day}
              {hasMeeting && (
                <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                  style={{ background: isSelected ? 'rgba(255,255,255,0.7)' : '#7c3aed' }} />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Meetings ────────────────────────────────────────────────────────────────

function Meetings() {
  const [meetings, setMeetings] = useState<Meeting[]>(DEMO_MEETINGS)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ collaborator: '', date: '', time: '09:00', notes: '', actions: '' })
  const [filterCollab, setFilterCollab] = useState('todos')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [actionsDone, setActionsDone] = useState<Record<string, boolean>>({})
  const [savedToast, setSavedToast] = useState(false)

  function save() {
    if (!form.collaborator || !form.date) return
    const id = Date.now().toString()
    const novo: Meeting = {
      id,
      collaborator: form.collaborator,
      date: form.date,
      time: form.time,
      notes: form.notes,
      actions: form.actions.split('\n').filter(Boolean)
    }
    setMeetings(m => [novo, ...m])

    // Write reminder to localStorage for inbox notifications
    const notif: MeetingNotif = {
      id,
      collaborator: form.collaborator,
      date: form.date,
      time: form.time,
      notes: form.notes,
      created_at: new Date().toISOString(),
      dismissed_by: []
    }
    const existing: MeetingNotif[] = JSON.parse(localStorage.getItem(MEETING_REMINDERS_KEY) || '[]')
    localStorage.setItem(MEETING_REMINDERS_KEY, JSON.stringify([notif, ...existing]))

    setShowModal(false)
    setForm({ collaborator: '', date: '', time: '09:00', notes: '', actions: '' })
    setSavedToast(true)
    setTimeout(() => setSavedToast(false), 3500)
  }

  function toggleAction(meetingId: string, idx: number) {
    const key = `${meetingId}_${idx}`
    setActionsDone(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const filtered = filterCollab === 'todos' ? meetings : meetings.filter(m => m.collaborator === filterCollab)

  const totalActions  = meetings.reduce((a, m) => a + m.actions.length, 0)
  const doneActions   = Object.values(actionsDone).filter(Boolean).length
  const nextMeeting   = meetings.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]

  return (
    <div className="space-y-5">

      {/* Saved toast */}
      {savedToast && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl"
          style={{ background: 'rgba(22,22,31,0.98)', border: '1px solid rgba(124,58,237,0.4)', color: '#e8e8f2' }}>
          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(124,58,237,0.25)' }}>
            <Bell className="w-4 h-4" style={{ color: '#a78bfa' }} />
          </div>
          <div>
            <p className="text-sm font-semibold">Reunião agendada!</p>
            <p className="text-xs" style={{ color: '#5a5a6e' }}>Lembrete enviado para o inbox do colaborador e do admin.</p>
          </div>
        </div>
      )}

      {/* KPI banner */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Reuniões realizadas', value: `${meetings.length}`,                               color: '#c4b5fd', bg: 'rgba(124,58,237,0.1)', border: 'rgba(124,58,237,0.2)', icon: Users         },
          { label: 'Ações pendentes',     value: `${totalActions - doneActions} de ${totalActions}`, color: '#fcd34d', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.2)', icon: CheckSquare    },
          { label: 'Última reunião',      value: nextMeeting ? new Date(nextMeeting.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : '—', color: '#6ee7b7', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.2)', icon: Calendar },
        ].map(k => (
          <div key={k.label} className="rounded-2xl p-4 flex items-center gap-3" style={{ background: k.bg, border: `1px solid ${k.border}` }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${k.color}22` }}>
              <k.icon className="w-4 h-4" style={{ color: k.color }} />
            </div>
            <div>
              <p className="text-[10px] font-medium" style={{ color: k.color }}>{k.label}</p>
              <p className="text-base font-bold mt-0.5" style={{ color: '#e8e8f2' }}>{k.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Progresso de ações */}
      {totalActions > 0 && (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold" style={{ color: '#e8e8f2' }}>Ações combinadas concluídas</p>
            <span className="text-sm font-bold" style={{ color: doneActions === totalActions ? '#10b981' : '#7c3aed' }}>
              {doneActions}/{totalActions}
            </span>
          </div>
          <ProgressBar value={totalActions > 0 ? Math.round((doneActions / totalActions) * 100) : 0} />
        </div>
      )}

      {/* Filtros + nova reunião */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-1.5 flex-wrap">
          <button onClick={() => setFilterCollab('todos')}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={filterCollab === 'todos'
              ? { background: '#7c3aed', color: 'white' }
              : { background: 'rgba(255,255,255,0.04)', color: '#8b8b9e', border: '1px solid rgba(255,255,255,0.07)' }
            }>Todos</button>
          {COLLABORATORS.map(c => (
            <button key={c.id} onClick={() => setFilterCollab(c.name === filterCollab ? 'todos' : c.name)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5"
              style={filterCollab === c.name
                ? { background: c.avatar, color: 'white' }
                : { background: 'rgba(255,255,255,0.04)', color: '#8b8b9e', border: '1px solid rgba(255,255,255,0.07)' }
              }>
              <span className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-white text-[8px] font-bold"
                style={{ background: c.avatar }}>{c.name[0]}</span>
              {c.name.split(' ')[0]}
            </button>
          ))}
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary text-xs flex items-center gap-1.5 py-1.5 px-3">
          <Plus className="w-3.5 h-3.5" /> Nova reunião
        </button>
      </div>

      {/* Meeting cards */}
      <div className="space-y-3">
        {filtered.map(m => {
          const collab = COLLABORATORS.find(c => c.name === m.collaborator)
          const isExpanded = expandedId === m.id
          const daysSince = Math.floor((Date.now() - new Date(m.date).getTime()) / 86400000)
          const pendingActions = m.actions.filter((_, i) => !actionsDone[`${m.id}_${i}`]).length

          return (
            <div key={m.id} className="card overflow-hidden">
              {/* Header — always visible */}
              <button
                onClick={() => setExpandedId(isExpanded ? null : m.id)}
                className="w-full flex items-center gap-4 px-5 py-4 text-left transition-colors"
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}
              >
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0"
                  style={{ background: collab?.avatar || '#7c3aed' }}>
                  {m.collaborator[0]}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold" style={{ color: '#e8e8f2' }}>1:1 com {m.collaborator}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-xs flex items-center gap-1" style={{ color: '#5a5a6e' }}>
                      <Calendar className="w-3 h-3" />
                      {new Date(m.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                      {m.time && ` · ${m.time}`}
                    </span>
                    <span className="text-xs" style={{ color: '#3a3a50' }}>·</span>
                    <span className="text-xs" style={{ color: '#5a5a6e' }}>
                      {daysSince === 0 ? 'hoje' : daysSince === 1 ? 'ontem' : `${daysSince} dias atrás`}
                    </span>
                  </div>
                </div>

                {/* Badges */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {pendingActions > 0 && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                      style={{ background: 'rgba(245,158,11,0.15)', color: '#fcd34d' }}>
                      {pendingActions} ação{pendingActions > 1 ? 'ões' : ''} pendente{pendingActions > 1 ? 's' : ''}
                    </span>
                  )}
                  {pendingActions === 0 && m.actions.length > 0 && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                      style={{ background: 'rgba(16,185,129,0.12)', color: '#6ee7b7' }}>
                      Todas concluídas
                    </span>
                  )}
                  <div className="w-5 h-5 rounded-lg flex items-center justify-center transition-transform"
                    style={{ background: 'rgba(255,255,255,0.05)', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path d="M2 4l3 3 3-3" stroke="#5a5a6e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                </div>
              </button>

              {/* Expanded content */}
              {isExpanded && (
                <div className="px-5 pb-5 space-y-4" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  <div className="pt-4" />

                  {/* Notes */}
                  {m.notes && (
                    <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <p className="text-[10px] font-semibold uppercase tracking-wide mb-2" style={{ color: '#5a5a6e' }}>Anotações</p>
                      <p className="text-xs leading-relaxed" style={{ color: '#8b8b9e' }}>{m.notes}</p>
                    </div>
                  )}

                  {/* Actions */}
                  {m.actions.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide mb-2" style={{ color: '#5a5a6e' }}>
                        Ações combinadas · {m.actions.filter((_, i) => actionsDone[`${m.id}_${i}`]).length}/{m.actions.length} concluídas
                      </p>
                      <div className="space-y-2">
                        {m.actions.map((a, i) => {
                          const done = !!actionsDone[`${m.id}_${i}`]
                          return (
                            <button
                              key={i}
                              onClick={() => toggleAction(m.id, i)}
                              className="w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all"
                              style={{
                                background: done ? 'rgba(16,185,129,0.06)' : 'rgba(255,255,255,0.03)',
                                border: `1px solid ${done ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.06)'}`
                              }}
                            >
                              <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                                style={{ background: done ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.05)', border: `1px solid ${done ? 'rgba(16,185,129,0.4)' : 'rgba(255,255,255,0.1)'}` }}>
                                {done && <Check className="w-3 h-3" style={{ color: '#6ee7b7' }} />}
                              </div>
                              <span className="text-xs flex-1" style={{
                                color: done ? '#4a9f82' : '#c4c4d4',
                                textDecoration: done ? 'line-through' : 'none'
                              }}>{a}</span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}

        {filtered.length === 0 && (
          <div className="text-center py-12">
            <Users className="w-10 h-10 mx-auto mb-3 opacity-20" style={{ color: '#8b8b9e' }} />
            <p className="text-sm" style={{ color: '#5a5a6e' }}>Nenhuma reunião registrada</p>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowModal(false)}>
          <div className="rounded-2xl w-full max-w-md" style={{ background: '#16161f', border: '1px solid rgba(255,255,255,0.08)' }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(124,58,237,0.2)' }}>
                  <Users className="w-4 h-4" style={{ color: '#a78bfa' }} />
                </div>
                <h3 className="font-semibold" style={{ color: '#e8e8f2' }}>Nova reunião 1:1</h3>
              </div>
              <button onClick={() => setShowModal(false)} style={{ color: '#5a5a6e' }}><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs font-medium block mb-2" style={{ color: '#8b8b9e' }}>Colaborador *</label>
                <div className="flex gap-2 flex-wrap">
                  {COLLABORATORS.map(c => (
                    <button key={c.id}
                      onClick={() => setForm(f => ({ ...f, collaborator: c.name }))}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all"
                      style={form.collaborator === c.name
                        ? { background: c.avatar, color: 'white' }
                        : { background: 'rgba(255,255,255,0.04)', color: '#8b8b9e', border: '1px solid rgba(255,255,255,0.07)' }
                      }>
                      <span className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold"
                        style={{ background: form.collaborator === c.name ? 'rgba(255,255,255,0.25)' : c.avatar }}>
                        {c.name[0]}
                      </span>
                      {c.name.split(' ')[0]}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium block mb-2" style={{ color: '#8b8b9e' }}>Data *</label>
                <CalendarPicker value={form.date} onChange={date => setForm(f => ({ ...f, date }))} meetings={meetings} />
                {form.date && (
                  <p className="text-xs mt-2 font-semibold" style={{ color: '#a78bfa' }}>
                    {new Date(form.date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
                  </p>
                )}
              </div>
              <div>
                <label className="text-xs font-medium block mb-1.5" style={{ color: '#8b8b9e' }}>Horário *</label>
                <input className="input w-full" type="time" value={form.time}
                  onChange={e => setForm(f => ({ ...f, time: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1.5" style={{ color: '#8b8b9e' }}>Anotações da reunião</label>
                <textarea className="input w-full resize-none" rows={4}
                  placeholder="O que foi discutido? Pontos principais..."
                  value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1.5" style={{ color: '#8b8b9e' }}>Ações combinadas <span style={{ color: '#5a5a6e' }}>(uma por linha)</span></label>
                <textarea className="input w-full resize-none" rows={3}
                  placeholder={"Enviar material de treinamento\nAgendar próxima reunião em 2 semanas"}
                  value={form.actions} onChange={e => setForm(f => ({ ...f, actions: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-2 p-5 pt-0">
              <button onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={save} disabled={!form.collaborator || !form.date}
                className="btn-primary flex-1 disabled:opacity-40">Salvar reunião</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Checklist ───────────────────────────────────────────────────────────────

const CAT_META: Record<string, { color: string; bg: string; border: string; icon: string }> = {
  'Gestão':         { color: '#c4b5fd', bg: 'rgba(124,58,237,0.12)', border: 'rgba(124,58,237,0.25)', icon: '📋' },
  'Feedback':       { color: '#93c5fd', bg: 'rgba(59,130,246,0.12)',  border: 'rgba(59,130,246,0.25)',  icon: '💬' },
  'Reunião':        { color: '#fcd34d', bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.25)',  icon: '🤝' },
  'Desenvolvimento':{ color: '#6ee7b7', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.25)', icon: '📈' },
  'Ponto':          { color: '#fca5a5', bg: 'rgba(239,68,68,0.1)',    border: 'rgba(239,68,68,0.2)',    icon: '🕐' },
  'Outro':          { color: '#8b8b9e', bg: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.1)',  icon: '📌' },
}
const ALL_CATS = ['Gestão', 'Feedback', 'Reunião', 'Desenvolvimento', 'Ponto', 'Outro']

function Checklist() {
  const [items, setItems]   = useState<CheckItem[]>(DEMO_CHECKLIST)
  const [newText, setNewText] = useState('')
  const [newCat, setNewCat]   = useState('Gestão')
  const [filterCat, setFilterCat] = useState('Todos')

  function add() {
    if (!newText.trim()) return
    setItems(i => [...i, { id: Date.now().toString(), text: newText.trim(), done: false, category: newCat }])
    setNewText('')
  }

  function toggle(id: string) {
    setItems(i => i.map(x => x.id === id ? { ...x, done: !x.done } : x))
  }

  function remove(id: string) {
    setItems(i => i.filter(x => x.id !== id))
  }

  const categories   = Array.from(new Set(items.map(i => i.category)))
  const done         = items.filter(i => i.done).length
  const pctDone      = items.length > 0 ? Math.round((done / items.length) * 100) : 0
  const urgent       = items.filter(i => !i.done && i.category === 'Ponto').length
  const devPending   = items.filter(i => !i.done && i.category === 'Desenvolvimento').length

  const visibleCats  = filterCat === 'Todos' ? categories : categories.filter(c => c === filterCat)

  return (
    <div className="space-y-5">

      {/* KPI banner */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl p-4 flex items-center gap-3" style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.2)' }}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(124,58,237,0.2)' }}>
            <CheckSquare className="w-4 h-4" style={{ color: '#c4b5fd' }} />
          </div>
          <div>
            <p className="text-[10px] font-medium" style={{ color: '#c4b5fd' }}>Concluídos</p>
            <p className="text-base font-bold mt-0.5" style={{ color: '#e8e8f2' }}>{done}/{items.length}</p>
          </div>
        </div>
        <div className="rounded-2xl p-4 flex items-center gap-3" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(245,158,11,0.2)' }}>
            <Clock className="w-4 h-4" style={{ color: '#fcd34d' }} />
          </div>
          <div>
            <p className="text-[10px] font-medium" style={{ color: '#fcd34d' }}>Pendentes</p>
            <p className="text-base font-bold mt-0.5" style={{ color: '#e8e8f2' }}>{items.length - done}</p>
          </div>
        </div>
        <div className="rounded-2xl p-4 flex items-center gap-3" style={{ background: pctDone >= 80 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.08)', border: `1px solid ${pctDone >= 80 ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}` }}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: pctDone >= 80 ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.15)' }}>
            <Zap className="w-4 h-4" style={{ color: pctDone >= 80 ? '#6ee7b7' : '#fca5a5' }} />
          </div>
          <div>
            <p className="text-[10px] font-medium" style={{ color: pctDone >= 80 ? '#6ee7b7' : '#fca5a5' }}>Progresso</p>
            <p className="text-base font-bold mt-0.5" style={{ color: '#e8e8f2' }}>{pctDone}%</p>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold" style={{ color: '#e8e8f2' }}>Progresso geral da semana</p>
          <span className="text-sm font-bold" style={{ color: pctDone >= 80 ? '#10b981' : pctDone >= 50 ? '#7c3aed' : '#f59e0b' }}>{pctDone}%</span>
        </div>
        <ProgressBar value={pctDone} />
        {/* Per-category mini progress */}
        <div className="flex items-center gap-4 mt-3 flex-wrap">
          {categories.map(cat => {
            const catItems = items.filter(i => i.category === cat)
            const catDone  = catItems.filter(i => i.done).length
            const meta     = CAT_META[cat] || CAT_META['Outro']
            return (
              <div key={cat} className="flex items-center gap-1.5">
                <span className="text-sm">{meta.icon}</span>
                <span className="text-[10px]" style={{ color: '#5a5a6e' }}>{cat}</span>
                <span className="text-[10px] font-bold" style={{ color: catDone === catItems.length ? '#6ee7b7' : meta.color }}>
                  {catDone}/{catItems.length}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Add + filter */}
      <div className="space-y-3">
        {/* Input */}
        <div className="flex gap-2">
          <input
            className="input flex-1"
            placeholder="Novo item... (Enter para adicionar)"
            value={newText}
            onChange={e => setNewText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && add()}
          />
          <select className="input w-40" value={newCat} onChange={e => setNewCat(e.target.value)}>
            {ALL_CATS.map(c => <option key={c}>{c}</option>)}
          </select>
          <button onClick={add} className="btn-primary px-4 flex items-center gap-1.5 text-sm">
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Category filter */}
        <div className="flex gap-1.5 flex-wrap">
          {['Todos', ...categories].map(cat => {
            const meta = CAT_META[cat]
            return (
              <button key={cat}
                onClick={() => setFilterCat(cat)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1"
                style={filterCat === cat
                  ? meta ? { background: meta.bg, color: meta.color, border: `1px solid ${meta.border}` } : { background: '#7c3aed', color: 'white' }
                  : { background: 'rgba(255,255,255,0.04)', color: '#8b8b9e', border: '1px solid rgba(255,255,255,0.07)' }
                }
              >
                {meta && <span>{meta.icon}</span>}
                {cat}
                {cat !== 'Todos' && (
                  <span className="ml-0.5 text-[10px] opacity-70">
                    {items.filter(i => i.category === cat && !i.done).length > 0
                      ? `${items.filter(i => i.category === cat && !i.done).length}`
                      : '✓'}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Items grouped by category */}
      <div className="space-y-5">
        {visibleCats.map(cat => {
          const catItems = items.filter(i => i.category === cat)
          const catMeta  = CAT_META[cat] || CAT_META['Outro']
          const catDone  = catItems.filter(i => i.done).length
          const allDone  = catDone === catItems.length

          return (
            <div key={cat}>
              {/* Category header */}
              <div className="flex items-center gap-2 mb-2.5">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
                  style={{ background: catMeta.bg, border: `1px solid ${catMeta.border}` }}>
                  <span className="text-sm">{catMeta.icon}</span>
                  <span className="text-xs font-semibold" style={{ color: catMeta.color }}>{cat}</span>
                </div>
                <span className="text-[10px]" style={{ color: '#5a5a6e' }}>{catDone}/{catItems.length}</span>
                {allDone && catItems.length > 0 && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(16,185,129,0.12)', color: '#6ee7b7' }}>
                    Tudo concluído ✓
                  </span>
                )}
              </div>

              <div className="space-y-1.5">
                {catItems.map(item => (
                  <div key={item.id}
                    className="flex items-center gap-3 p-3.5 rounded-xl transition-all group"
                    style={{
                      background: item.done ? 'rgba(16,185,129,0.04)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${item.done ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.07)'}`
                    }}
                  >
                    {/* Checkbox */}
                    <button onClick={() => toggle(item.id)} className="flex-shrink-0">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center transition-all"
                        style={{
                          background: item.done ? 'rgba(16,185,129,0.2)' : 'transparent',
                          border: `1.5px solid ${item.done ? '#10b981' : '#3a3a50'}`
                        }}>
                        {item.done && <Check className="w-3 h-3" style={{ color: '#6ee7b7' }} />}
                      </div>
                    </button>

                    {/* Text */}
                    <span className="flex-1 text-sm transition-all" style={{
                      color: item.done ? '#5a5a6e' : '#c4c4d4',
                      textDecoration: item.done ? 'line-through' : 'none'
                    }}>
                      {item.text}
                    </span>

                    {/* Category badge (só se filtro = Todos) */}
                    {filterCat === 'Todos' && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ background: catMeta.bg, color: catMeta.color }}>
                        {catMeta.icon}
                      </span>
                    )}

                    {/* Remove */}
                    <button onClick={() => remove(item.id)} className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ color: '#3a3a50' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#fca5a5'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#3a3a50'}>
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )
        })}

        {items.length === 0 && (
          <div className="text-center py-12">
            <CheckSquare className="w-10 h-10 mx-auto mb-3 opacity-20" style={{ color: '#8b8b9e' }} />
            <p className="text-sm" style={{ color: '#5a5a6e' }}>Nenhum item no checklist</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── TimeClock ───────────────────────────────────────────────────────────────

function TimeClock() {
  const [punches, setPunches] = useState<PunchRecord[]>(DEMO_PUNCHES)
  const [showModal, setShowModal] = useState(false)
  const [viewDate, setViewDate] = useState<'today' | 'week'>('today')
  const [form, setForm] = useState({ collaborator: '', date: new Date().toISOString().split('T')[0], entry: '', exit: '' })

  const todayStr = new Date().toISOString().split('T')[0]

  function calcTotal(entry: string, exit: string) {
    if (!entry || !exit) return '—'
    const [eh, em] = entry.split(':').map(Number)
    const [sh, sm] = exit.split(':').map(Number)
    const diff = (sh * 60 + sm) - (eh * 60 + em)
    if (diff < 0) return 'Inválido'
    return `${Math.floor(diff / 60)}h${String(diff % 60).padStart(2, '0')}`
  }

  function calcMinutes(total: string) {
    if (!total || total === '—' || total === 'Inválido') return 0
    const match = total.match(/(\d+)h(\d+)/)
    if (!match) return 0
    return parseInt(match[1]) * 60 + parseInt(match[2])
  }

  function save() {
    if (!form.collaborator || !form.entry) return
    setPunches(p => [{ id: Date.now().toString(), collaborator: form.collaborator, date: form.date, entry: form.entry, exit: form.exit, total: calcTotal(form.entry, form.exit) }, ...p])
    setShowModal(false)
    setForm({ collaborator: '', date: todayStr, entry: '', exit: '' })
  }

  const todayPunches = punches.filter(p => p.date === todayStr)
  const weekPunches  = punches

  // Per-collaborator weekly summary
  const weeklySummary = COLLABORATORS.map(c => {
    const cp   = weekPunches.filter(p => p.collaborator === c.name)
    const mins  = cp.reduce((a, p) => a + calcMinutes(p.total), 0)
    const days  = cp.length
    const active= todayPunches.find(p => p.collaborator === c.name && !p.exit)
    const encerrado = todayPunches.find(p => p.collaborator === c.name && p.exit)
    return { collab: c, cp, mins, days, active: !!active, encerrado: !!encerrado }
  })

  const totalHoursWeek = Math.floor(weeklySummary.reduce((a, s) => a + s.mins, 0) / 60)
  const activeNow      = weeklySummary.filter(s => s.active).length
  const lateEntry      = todayPunches.filter(p => {
    const [h] = p.entry.split(':').map(Number)
    return h >= 9
  }).length

  const displayPunches = viewDate === 'today' ? todayPunches : weekPunches

  // Group week view by date
  const dateGroups = Array.from(new Set(displayPunches.map(p => p.date)))
    .sort((a, b) => b.localeCompare(a))

  return (
    <div className="space-y-5">

      {/* KPI banner */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Horas semana',    value: `${totalHoursWeek}h registradas`, color: '#c4b5fd', bg: 'rgba(124,58,237,0.1)', border: 'rgba(124,58,237,0.2)', icon: Clock      },
          { label: 'Ativos agora',    value: `${activeNow} colaborador${activeNow !== 1 ? 'es' : ''}`, color: '#6ee7b7', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.2)', icon: Zap       },
          { label: 'Entradas tardias',value: `${lateEntry} hoje`,              color: lateEntry > 0 ? '#fca5a5' : '#5a5a6e', bg: lateEntry > 0 ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.04)', border: lateEntry > 0 ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.07)', icon: AlertTriangle },
        ].map(k => (
          <div key={k.label} className="rounded-2xl p-4 flex items-center gap-3" style={{ background: k.bg, border: `1px solid ${k.border}` }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${k.color}22` }}>
              <k.icon className="w-4 h-4" style={{ color: k.color }} />
            </div>
            <div>
              <p className="text-[10px] font-medium" style={{ color: k.color }}>{k.label}</p>
              <p className="text-sm font-bold mt-0.5" style={{ color: '#e8e8f2' }}>{k.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Per-collaborator status cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {weeklySummary.map(({ collab, mins, days, active, encerrado }) => {
          const avgDay = days > 0 ? Math.round(mins / days) : 0
          const weekPct = Math.min(100, Math.round((mins / (40 * 60)) * 100)) // 40h week target
          const statusColor = active ? '#6ee7b7' : encerrado ? '#c4b5fd' : '#5a5a6e'
          const statusLabel = active ? 'Ativo agora' : encerrado ? 'Encerrado hoje' : 'Sem registro hoje'
          const statusBg    = active ? 'rgba(16,185,129,0.1)' : encerrado ? 'rgba(124,58,237,0.1)' : 'rgba(255,255,255,0.04)'

          return (
            <div key={collab.id} className="card p-4 space-y-3">
              {/* Header */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0"
                  style={{ background: collab.avatar }}>
                  {collab.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: '#e8e8f2' }}>{collab.name}</p>
                  <p className="text-xs" style={{ color: '#5a5a6e' }}>{collab.role}</p>
                </div>
                <span className="text-[10px] font-semibold px-2 py-1 rounded-lg flex-shrink-0 flex items-center gap-1"
                  style={{ background: statusBg, color: statusColor }}>
                  {active && <span className="w-1.5 h-1.5 rounded-full animate-pulse inline-block" style={{ background: '#6ee7b7' }} />}
                  {statusLabel}
                </span>
              </div>

              {/* Hours this week */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px]" style={{ color: '#5a5a6e' }}>Horas semana (meta 40h)</span>
                  <span className="text-xs font-bold" style={{ color: weekPct >= 80 ? '#6ee7b7' : '#c4b5fd' }}>
                    {Math.floor(mins / 60)}h{String(mins % 60).padStart(2, '0')}
                  </span>
                </div>
                <ProgressBar value={weekPct} color={weekPct >= 80 ? '#10b981' : '#7c3aed'} />
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl p-2.5 text-center" style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <p className="text-[10px]" style={{ color: '#5a5a6e' }}>Dias registrados</p>
                  <p className="text-sm font-bold mt-0.5" style={{ color: '#e8e8f2' }}>{days}</p>
                </div>
                <div className="rounded-xl p-2.5 text-center" style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <p className="text-[10px]" style={{ color: '#5a5a6e' }}>Média/dia</p>
                  <p className="text-sm font-bold mt-0.5" style={{ color: '#e8e8f2' }}>
                    {Math.floor(avgDay / 60)}h{String(avgDay % 60).padStart(2, '0')}
                  </p>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* View toggle + register */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-1.5">
          {([['today', 'Hoje'], ['week', 'Histórico semanal']] as const).map(([v, label]) => (
            <button key={v} onClick={() => setViewDate(v)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={viewDate === v
                ? { background: '#7c3aed', color: 'white' }
                : { background: 'rgba(255,255,255,0.04)', color: '#8b8b9e', border: '1px solid rgba(255,255,255,0.07)' }
              }>{label}</button>
          ))}
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary text-xs flex items-center gap-1.5 py-1.5 px-3">
          <Plus className="w-3.5 h-3.5" /> Registrar ponto
        </button>
      </div>

      {/* Punch table */}
      {dateGroups.length === 0 ? (
        <div className="card p-12 text-center">
          <Clock className="w-10 h-10 mx-auto mb-3 opacity-20" style={{ color: '#8b8b9e' }} />
          <p className="text-sm" style={{ color: '#5a5a6e' }}>Nenhum ponto registrado hoje</p>
          <button onClick={() => setShowModal(true)} className="btn-primary text-xs mt-4 mx-auto flex items-center gap-1.5 py-1.5 px-3">
            <Plus className="w-3.5 h-3.5" /> Registrar primeiro ponto
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {dateGroups.map(date => {
            const dayPunches = displayPunches.filter(p => p.date === date)
            const isToday = date === todayStr
            return (
              <div key={date} className="card overflow-hidden">
                <div className="px-4 py-3 flex items-center justify-between"
                  style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <p className="text-xs font-semibold" style={{ color: '#8b8b9e' }}>
                    {isToday ? '📅 Hoje — ' : ''}{new Date(date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
                  </p>
                  <span className="text-[10px]" style={{ color: '#5a5a6e' }}>{dayPunches.length} registro{dayPunches.length !== 1 ? 's' : ''}</span>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', color: '#5a5a6e' }}>
                      <th className="px-4 py-2 text-left">Colaborador</th>
                      <th className="px-4 py-2 text-center">Entrada</th>
                      <th className="px-4 py-2 text-center">Saída</th>
                      <th className="px-4 py-2 text-center">Total</th>
                      <th className="px-4 py-2 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dayPunches.map((p, i) => {
                      const collab = COLLABORATORS.find(c => c.name === p.collaborator)
                      const isLate = parseInt(p.entry.split(':')[0]) >= 9
                      return (
                        <tr key={p.id} style={{ borderBottom: i < dayPunches.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                                style={{ background: collab?.avatar || '#7c3aed' }}>
                                {p.collaborator[0]}
                              </div>
                              <span className="font-medium" style={{ color: '#e8e8f2' }}>{p.collaborator}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`text-sm font-mono`} style={{ color: isLate ? '#fca5a5' : '#8b8b9e' }}>
                              {p.entry}
                            </span>
                            {isLate && <span className="ml-1 text-[9px]" style={{ color: '#fca5a5' }}>tarde</span>}
                          </td>
                          <td className="px-4 py-3 text-center font-mono text-sm" style={{ color: '#8b8b9e' }}>
                            {p.exit || '—'}
                          </td>
                          <td className="px-4 py-3 text-center font-mono font-semibold text-sm" style={{ color: '#e8e8f2' }}>
                            {p.total}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {p.exit
                              ? <span className="badge text-xs" style={{ background: 'rgba(16,185,129,0.12)', color: '#6ee7b7' }}>Encerrado</span>
                              : <span className="badge text-xs flex items-center gap-1 justify-center" style={{ background: 'rgba(59,130,246,0.12)', color: '#93c5fd' }}>
                                  <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#93c5fd' }} />
                                  Ativo
                                </span>
                            }
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowModal(false)}>
          <div className="rounded-2xl w-full max-w-sm" style={{ background: '#16161f', border: '1px solid rgba(255,255,255,0.08)' }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(124,58,237,0.2)' }}>
                  <Clock className="w-4 h-4" style={{ color: '#a78bfa' }} />
                </div>
                <h3 className="font-semibold" style={{ color: '#e8e8f2' }}>Registrar ponto</h3>
              </div>
              <button onClick={() => setShowModal(false)} style={{ color: '#5a5a6e' }}><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs font-medium block mb-2" style={{ color: '#8b8b9e' }}>Colaborador *</label>
                <div className="flex gap-2 flex-wrap">
                  {COLLABORATORS.map(c => (
                    <button key={c.id}
                      onClick={() => setForm(f => ({ ...f, collaborator: c.name }))}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all"
                      style={form.collaborator === c.name
                        ? { background: c.avatar, color: 'white' }
                        : { background: 'rgba(255,255,255,0.04)', color: '#8b8b9e', border: '1px solid rgba(255,255,255,0.07)' }
                      }>
                      <span className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold"
                        style={{ background: form.collaborator === c.name ? 'rgba(255,255,255,0.25)' : c.avatar }}>
                        {c.name[0]}
                      </span>
                      {c.name.split(' ')[0]}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium block mb-1.5" style={{ color: '#8b8b9e' }}>Data</label>
                <input className="input w-full" type="date" value={form.date}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium block mb-1.5" style={{ color: '#8b8b9e' }}>Entrada *</label>
                  <input className="input w-full font-mono" type="time" value={form.entry}
                    onChange={e => setForm(f => ({ ...f, entry: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1.5" style={{ color: '#8b8b9e' }}>Saída <span style={{ color: '#5a5a6e' }}>(opcional)</span></label>
                  <input className="input w-full font-mono" type="time" value={form.exit}
                    onChange={e => setForm(f => ({ ...f, exit: e.target.value }))} />
                </div>
              </div>
              {form.entry && form.exit && (
                <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.2)' }}>
                  <p className="text-xs" style={{ color: '#8b6fba' }}>Total calculado</p>
                  <p className="text-lg font-bold font-mono" style={{ color: '#c4b5fd' }}>{calcTotal(form.entry, form.exit)}</p>
                </div>
              )}
            </div>
            <div className="flex gap-2 p-5 pt-0">
              <button onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={save} disabled={!form.collaborator || !form.entry}
                className="btn-primary flex-1 disabled:opacity-40">Registrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Manage Collaborators ─────────────────────────────────────────────────────

const AVATAR_OPTIONS = [
  '#7c3aed', '#db2777', '#ea580c', '#0891b2',
  '#16a34a', '#ca8a04', '#dc2626', '#7c3aed',
  '#6366f1', '#0d9488',
]

function ManageCollaborators({
  collaborators, setCollaborators
}: {
  collaborators: Collaborator[]
  setCollaborators: (c: Collaborator[]) => void
}) {
  const [showModal, setShowModal]   = useState(false)
  const [editing, setEditing]       = useState<Collaborator | null>(null)
  const [confirmDel, setConfirmDel] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', role: '', avatar: '#7c3aed' })
  const [error, setError] = useState('')

  const ROLES = ['Atendente', 'Consultora', 'Consultora Sênior', 'Coordenadora', 'Supervisora', 'Gerente']

  function openNew() {
    setEditing(null)
    setForm({ name: '', role: 'Atendente', avatar: '#7c3aed' })
    setError('')
    setShowModal(true)
  }

  function openEdit(c: Collaborator) {
    setEditing(c)
    setForm({ name: c.name, role: c.role, avatar: c.avatar })
    setError('')
    setShowModal(true)
  }

  function save() {
    if (!form.name.trim()) { setError('Informe o nome'); return }
    if (!form.role.trim()) { setError('Informe o cargo'); return }
    if (editing) {
      const updated = collaborators.map(c => c.id === editing.id ? { ...c, ...form } : c)
      setCollaborators(updated)
      localStorage.setItem('team_collaborators', JSON.stringify(updated))
    } else {
      const novo: Collaborator = {
        id: Date.now().toString(),
        name: form.name.trim(),
        role: form.role.trim(),
        avatar: form.avatar,
        score: 70, sales: 0, revenue: 0, trend: 0,
      }
      const updated = [...collaborators, novo]
      setCollaborators(updated)
      localStorage.setItem('team_collaborators', JSON.stringify(updated))
    }
    setShowModal(false)
  }

  function remove(id: string) {
    const updated = collaborators.filter(c => c.id !== id)
    setCollaborators(updated)
    localStorage.setItem('team_collaborators', JSON.stringify(updated))
    setConfirmDel(null)
  }

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold" style={{ color: '#e8e8f2' }}>Membros da equipe</p>
          <p className="text-xs mt-0.5" style={{ color: '#5a5a6e' }}>
            {collaborators.length} colaborador{collaborators.length !== 1 ? 'es' : ''} cadastrado{collaborators.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button onClick={openNew} className="btn-primary flex items-center gap-1.5 text-xs py-1.5 px-3">
          <Plus className="w-3.5 h-3.5" /> Adicionar colaborador
        </button>
      </div>

      {/* Info banner */}
      <div className="rounded-2xl p-4 flex items-start gap-3" style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)' }}>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(124,58,237,0.2)' }}>
          <Users className="w-4 h-4" style={{ color: '#a78bfa' }} />
        </div>
        <div>
          <p className="text-sm font-semibold" style={{ color: '#c4b5fd' }}>Aqui você gerencia sua equipe</p>
          <p className="text-xs mt-0.5 leading-relaxed" style={{ color: '#8b6fba' }}>
            Colaboradores são adicionados automaticamente quando conectam o WhatsApp pelo QR Code no painel deles.
            Você também pode adicionar manualmente. Eles aparecem em todas as abas: Desempenho, Metas, Feedback, Reuniões e Ponto Digital.
          </p>
        </div>
      </div>

      {/* Collaborator list */}
      <div className="space-y-2">
        {collaborators.map((c, i) => (
          <div key={c.id} className="card px-5 py-4 flex items-center gap-4">
            {/* Avatar */}
            <div className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
              style={{ background: c.avatar }}>
              {c.name[0].toUpperCase()}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate" style={{ color: '#e8e8f2' }}>{c.name}</p>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <p className="text-xs" style={{ color: '#5a5a6e' }}>{c.role}</p>
                {c.phone && (
                  <span className="text-[10px] flex items-center gap-1 px-1.5 py-0.5 rounded-md"
                    style={{ background: 'rgba(16,185,129,0.1)', color: '#6ee7b7', border: '1px solid rgba(16,185,129,0.2)' }}>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                    WhatsApp +{c.phone}
                  </span>
                )}
              </div>
            </div>

            {/* Score pill */}
            <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
              <ScoreRing score={c.score} size={36} />
              <div className="text-right">
                <p className="text-xs font-bold" style={{ color: c.score >= 85 ? '#10b981' : c.score >= 70 ? '#c4b5fd' : '#f59e0b' }}>{c.score}</p>
                <p className="text-[10px]" style={{ color: '#5a5a6e' }}>score</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <button onClick={() => openEdit(c)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1"
                style={{ background: 'rgba(255,255,255,0.05)', color: '#8b8b9e', border: '1px solid rgba(255,255,255,0.08)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#c4b5fd'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(124,58,237,0.3)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#8b8b9e'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)' }}
              >
                Editar
              </button>
              {collaborators.length > 1 && (
                confirmDel === c.id ? (
                  <div className="flex items-center gap-1">
                    <span className="text-[10px]" style={{ color: '#fca5a5' }}>Confirmar?</span>
                    <button onClick={() => remove(c.id)}
                      className="px-2 py-1 rounded-lg text-xs font-medium"
                      style={{ background: 'rgba(239,68,68,0.15)', color: '#fca5a5' }}>
                      Sim
                    </button>
                    <button onClick={() => setConfirmDel(null)}
                      className="px-2 py-1 rounded-lg text-xs font-medium"
                      style={{ background: 'rgba(255,255,255,0.05)', color: '#8b8b9e' }}>
                      Não
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmDel(c.id)}
                    className="p-1.5 rounded-lg transition-all"
                    style={{ color: '#3a3a50' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#fca5a5'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#3a3a50'}
                  >
                    <X className="w-4 h-4" />
                  </button>
                )
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowModal(false)}>
          <div className="rounded-2xl w-full max-w-sm" style={{ background: '#16161f', border: '1px solid rgba(255,255,255,0.08)' }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(124,58,237,0.2)' }}>
                  <Users className="w-4 h-4" style={{ color: '#a78bfa' }} />
                </div>
                <h3 className="font-semibold" style={{ color: '#e8e8f2' }}>
                  {editing ? 'Editar colaborador' : 'Novo colaborador'}
                </h3>
              </div>
              <button onClick={() => setShowModal(false)} style={{ color: '#5a5a6e' }}><X className="w-4 h-4" /></button>
            </div>

            <div className="p-5 space-y-4">
              {/* Preview */}
              <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg"
                  style={{ background: form.avatar }}>
                  {form.name ? form.name[0].toUpperCase() : '?'}
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: form.name ? '#e8e8f2' : '#3a3a50' }}>
                    {form.name || 'Nome do colaborador'}
                  </p>
                  <p className="text-xs" style={{ color: '#5a5a6e' }}>{form.role || 'Cargo'}</p>
                </div>
              </div>

              {/* Nome */}
              <div>
                <label className="text-xs font-medium block mb-1.5" style={{ color: '#8b8b9e' }}>Nome completo *</label>
                <input className="input w-full" placeholder="Ex: Maria Silva"
                  value={form.name} onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setError('') }} autoFocus />
              </div>

              {/* Cargo */}
              <div>
                <label className="text-xs font-medium block mb-1.5" style={{ color: '#8b8b9e' }}>Cargo *</label>
                <div className="flex gap-2">
                  <select className="input flex-1" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              </div>

              {/* Cor do avatar */}
              <div>
                <label className="text-xs font-medium block mb-2" style={{ color: '#8b8b9e' }}>Cor do avatar</label>
                <div className="flex gap-2 flex-wrap">
                  {AVATAR_OPTIONS.map(color => (
                    <button key={color} onClick={() => setForm(f => ({ ...f, avatar: color }))}
                      className="w-8 h-8 rounded-full transition-all"
                      style={{
                        background: color,
                        outline: form.avatar === color ? `3px solid white` : '3px solid transparent',
                        outlineOffset: '2px',
                        transform: form.avatar === color ? 'scale(1.15)' : 'scale(1)',
                      }}
                    />
                  ))}
                </div>
              </div>

              {error && <p className="text-xs" style={{ color: '#fca5a5' }}>{error}</p>}
            </div>

            <div className="flex gap-2 p-5 pt-0">
              <button onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={save} className="btn-primary flex-1">
                {editing ? 'Salvar alterações' : 'Adicionar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const DEFAULT_COLLABORATORS: Collaborator[] = [
  { id: '1', name: 'Ana Paula',      role: 'Atendente',  score: 87, sales: 24, revenue: 4800,  trend: +5,  avatar: '#7c3aed' },
  { id: '2', name: 'Mariana Costa',  role: 'Consultora', score: 92, sales: 38, revenue: 9200,  trend: +12, avatar: '#db2777' },
  { id: '3', name: 'Júlia Ferreira', role: 'Atendente',  score: 74, sales: 17, revenue: 3100,  trend: -3,  avatar: '#ea580c' },
]

function loadCollaborators(): Collaborator[] {
  if (typeof window === 'undefined') return DEFAULT_COLLABORATORS
  try {
    const saved = localStorage.getItem('team_collaborators')
    if (saved) return JSON.parse(saved)
  } catch {}
  return DEFAULT_COLLABORATORS
}

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'colaboradores', label: 'Colaboradores',   icon: Users        },
  { id: 'performance',   label: 'Desempenho',       icon: Star         },
  { id: 'goals',         label: 'Metas',            icon: Target       },
  { id: 'development',   label: 'Desenvolvimento',  icon: TrendingUp   },
  { id: 'insights',      label: 'Insights',         icon: BarChart2    },
  { id: 'feedback',      label: 'Feedback',         icon: MessageSquare},
  { id: 'meetings',      label: 'Reuniões 1:1',     icon: Users        },
  { id: 'checklist',     label: 'Checklist',        icon: CheckSquare  },
  { id: 'timeclock',     label: 'Ponto Digital',    icon: Clock        },
]

export default function TeamPage() {
  const [tab, setTab] = useState<Tab>('colaboradores')
  const [collaborators, setCollaborators] = useState<Collaborator[]>(loadCollaborators)

  // Keep module-level COLLABORATORS in sync so all sub-components see the latest
  COLLABORATORS.length = 0
  collaborators.forEach(c => COLLABORATORS.push(c))

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="font-bold text-lg" style={{ color: '#e8e8f2' }}>Gestão de Equipe</h1>
        <p className="text-xs mt-0.5" style={{ color: '#5a5a6e' }}>Desempenho, metas, desenvolvimento e organização da sua equipe</p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all"
            style={tab === t.id
              ? { background: '#7c3aed', color: 'white', boxShadow: '0 2px 8px rgba(124,58,237,0.35)' }
              : { background: 'rgba(255,255,255,0.04)', color: '#8b8b9e', border: '1px solid rgba(255,255,255,0.07)' }
            }
            onMouseEnter={e => { if (tab !== t.id) { (e.currentTarget as HTMLElement).style.color = '#c4b5fd'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(124,58,237,0.3)' } }}
            onMouseLeave={e => { if (tab !== t.id) { (e.currentTarget as HTMLElement).style.color = '#8b8b9e'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.07)' } }}
          >
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      <div>
        {tab === 'colaboradores' && <ManageCollaborators collaborators={collaborators} setCollaborators={setCollaborators} />}
        {tab === 'performance'   && <Performance />}
        {tab === 'goals'         && <Goals />}
        {tab === 'development'   && <Development />}
        {tab === 'insights'      && <Insights />}
        {tab === 'feedback'      && <Feedback />}
        {tab === 'meetings'      && <Meetings />}
        {tab === 'checklist'     && <Checklist />}
        {tab === 'timeclock'     && <TimeClock />}
      </div>
    </div>
  )
}
