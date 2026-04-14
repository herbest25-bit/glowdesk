'use client'
import { useState } from 'react'
import { Zap, Plus, Clock, MessageSquare, Star, Info } from 'lucide-react'

type Automation = {
  id: string
  name: string
  trigger: string
  action: string
  active: boolean
  runs: number
  tooltip: string
}

const DEFAULT_AUTOMATIONS: Automation[] = [
  {
    id: '1',
    name: 'Boas-vindas automático',
    trigger: 'Novo contato entra em contato',
    action: 'Glow envia mensagem de boas-vindas',
    active: true, runs: 0,
    tooltip: 'Quando um cliente manda a primeira mensagem, a Glow responde automaticamente com uma saudação calorosa e pergunta como pode ajudar.',
  },
  {
    id: '2',
    name: 'Follow-up após 24h sem resposta',
    trigger: 'Conversa sem resposta por 24h',
    action: 'Glow envia follow-up consultivo',
    active: false, runs: 0,
    tooltip: 'Se um cliente parou de responder por mais de 24 horas, a Glow envia uma mensagem gentil de acompanhamento para retomar a conversa.',
  },
  {
    id: '3',
    name: 'Lead quente → Pipeline',
    trigger: 'Glow identifica sinal [HOT_LEAD]',
    action: 'Cria deal no pipeline automaticamente',
    active: true, runs: 0,
    tooltip: 'Quando a Glow percebe interesse real de compra, ela cria automaticamente um negócio no Pipeline de Vendas.',
  },
  {
    id: '4',
    name: 'Transferência para humano',
    trigger: 'Cliente solicita falar com atendente',
    action: 'Desativa Glow e notifica equipe',
    active: true, runs: 0,
    tooltip: 'Se o cliente pedir para falar com uma pessoa real, a Glow desativa o atendimento automático e a conversa aparece no Inbox com destaque.',
  },
]

const TRIGGER_ICONS: Record<string, React.ElementType> = {
  'Novo contato entra em contato': MessageSquare,
  'Conversa sem resposta por 24h': Clock,
  'Glow identifica sinal [HOT_LEAD]': Star,
  'Cliente solicita falar com atendente': MessageSquare,
}

function TooltipInfo({ text }: { text: string }) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative flex items-center">
      <button
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        className="transition-colors"
        style={{ color: '#5a5a6e' }}
      >
        <Info className="w-4 h-4" />
      </button>
      {visible && (
        <div
          className="absolute right-6 top-1/2 -translate-y-1/2 w-64 text-xs rounded-xl p-3 z-50 leading-relaxed"
          style={{ background: '#1c1c27', border: '1px solid rgba(255,255,255,0.1)', color: '#c4c4d4', boxShadow: '0 8px 32px rgba(0,0,0,0.6)' }}
        >
          {text}
          <div className="absolute right-[-6px] top-1/2 -translate-y-1/2 w-0 h-0" style={{ borderTop: '6px solid transparent', borderBottom: '6px solid transparent', borderLeft: '6px solid #1c1c27' }} />
        </div>
      )}
    </div>
  )
}

export default function AutomationsPage() {
  const [automations, setAutomations] = useState<Automation[]>(DEFAULT_AUTOMATIONS)

  function toggle(id: string) {
    setAutomations(prev => prev.map(a => a.id === id ? { ...a, active: !a.active } : a))
  }

  const active = automations.filter(a => a.active).length

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-bold text-lg" style={{ color: '#e8e8f2' }}>Automações</h1>
          <p className="text-xs mt-0.5" style={{ color: '#5a5a6e' }}>
            {active} ativa{active !== 1 ? 's' : ''} de {automations.length} automações
          </p>
        </div>
        <button className="btn-primary flex items-center gap-2 opacity-50 cursor-not-allowed" disabled title="Em breve">
          <Plus className="w-4 h-4" /> Nova automação
        </button>
      </div>

      {/* Info banner */}
      <div className="card-gradient p-4 flex items-start gap-3">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #6b21a8, #f43f5e)', boxShadow: '0 0 16px rgba(124,58,237,0.3)' }}
        >
          <Zap className="w-4 h-4 text-white" />
        </div>
        <div>
          <p className="text-sm font-semibold" style={{ color: '#c4b5fd' }}>Automações com IA</p>
          <p className="text-xs mt-0.5 leading-relaxed" style={{ color: '#8b6fba' }}>
            A Glow executa essas automações automaticamente em todas as conversas.
            Passe o mouse no <Info className="w-3 h-3 inline" /> para entender cada uma.
          </p>
        </div>
      </div>

      {/* List */}
      <div className="space-y-3">
        {automations.map(auto => {
          const Icon = TRIGGER_ICONS[auto.trigger] || Zap
          return (
            <div key={auto.id} className="card p-4 flex items-center gap-4">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={auto.active
                  ? { background: 'rgba(124,58,237,0.18)' }
                  : { background: 'rgba(255,255,255,0.05)' }
                }
              >
                <Icon className="w-5 h-5" style={{ color: auto.active ? '#c4b5fd' : '#5a5a6e' }} />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold" style={{ color: auto.active ? '#e8e8f2' : '#8b8b9e' }}>{auto.name}</p>
                <div className="flex items-center gap-1 mt-1 text-xs flex-wrap">
                  <span className="rounded px-1.5 py-0.5" style={{ background: 'rgba(255,255,255,0.07)', color: '#8b8b9e' }}>{auto.trigger}</span>
                  <span style={{ color: '#3a3a50' }}>→</span>
                  <span className="rounded px-1.5 py-0.5" style={{ background: 'rgba(124,58,237,0.15)', color: '#c4b5fd' }}>{auto.action}</span>
                </div>
              </div>

              <div className="flex items-center gap-3 flex-shrink-0">
                <span className="text-xs" style={{ color: '#5a5a6e' }}>{auto.runs} execuções</span>
                <TooltipInfo text={auto.tooltip} />
                <button
                  onClick={() => toggle(auto.id)}
                  className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer flex-shrink-0"
                  style={{ background: auto.active ? '#7c3aed' : 'rgba(255,255,255,0.1)' }}
                >
                  <span
                    className="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform"
                    style={{ transform: auto.active ? 'translateX(24px)' : 'translateX(4px)' }}
                  />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <p className="text-xs text-center pt-2" style={{ color: '#3a3a50' }}>
        Criação de automações personalizadas disponível em breve
      </p>
    </div>
  )
}
