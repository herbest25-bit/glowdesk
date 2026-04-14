'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { Kanban, RefreshCw, DollarSign } from 'lucide-react'

type Deal = {
  id: string
  title: string
  value: number
  stage: string
  contact_name?: string
  assigned_to?: string
  updated_at: string
}

type Stage = {
  name: string
  deals: Deal[]
  color: string
}

const STAGE_COLORS: Record<string, { color: string; bg: string; border: string }> = {
  'Novo Lead':   { color: '#c4b5fd', bg: 'rgba(124,58,237,0.12)', border: 'rgba(124,58,237,0.3)' },
  'Qualificado': { color: '#93c5fd', bg: 'rgba(59,130,246,0.12)',  border: 'rgba(59,130,246,0.3)'  },
  'Proposta':    { color: '#fcd34d', bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.3)'  },
  'Negociação':  { color: '#f9a8d4', bg: 'rgba(236,72,153,0.12)', border: 'rgba(236,72,153,0.3)' },
  'Ganho':       { color: '#6ee7b7', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.3)'  },
  'Perdido':     { color: '#9ca3af', bg: 'rgba(107,114,128,0.12)', border: 'rgba(107,114,128,0.3)' },
}

export default function ColaboradorPipelinePage() {
  const [stages, setStages] = useState<Stage[]>([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<{ id: string } | null>(null)

  useEffect(() => {
    const u = JSON.parse(localStorage.getItem('user') || '{}')
    setUser(u)
    load(u.id)
  }, [])

  async function load(userId?: string) {
    setLoading(true)
    try {
      const data = await api.get('/api/pipeline')
      const stagesRaw: Stage[] = data.stages || []
      if (userId) {
        stagesRaw.forEach(s => {
          s.deals = s.deals.filter((d: Deal) => d.assigned_to === userId)
        })
      }
      setStages(stagesRaw.filter(s => s.name !== 'Perdido' || s.deals.length > 0))
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  const totalDeals = stages.reduce((acc, s) => acc + s.deals.length, 0)
  const totalValue = stages.reduce((acc, s) => acc + s.deals.reduce((a, d) => a + (d.value || 0), 0), 0)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-bold text-lg" style={{ color: '#e8e8f2' }}>Meu Pipeline</h1>
          <p className="text-xs mt-0.5" style={{ color: '#5a5a6e' }}>
            {totalDeals} negócio(s) · R$ {totalValue.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} em valor
          </p>
        </div>
        <button onClick={() => load(user?.id)} className="p-2 rounded-lg transition-colors" style={{ color: '#5a5a6e' }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : totalDeals === 0 ? (
        <div className="text-center py-16">
          <Kanban className="w-10 h-10 mx-auto mb-3 opacity-20" style={{ color: '#8b8b9e' }} />
          <p className="text-sm" style={{ color: '#5a5a6e' }}>Nenhum negócio no seu pipeline</p>
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {stages.map(stage => {
            const sc = STAGE_COLORS[stage.name] || STAGE_COLORS['Novo Lead']
            return (
              <div key={stage.name} className="w-64 flex-shrink-0">
                <div
                  className="flex items-center justify-between px-3 py-2 rounded-xl mb-3"
                  style={{ background: sc.bg, border: `1px solid ${sc.border}` }}
                >
                  <span className="text-xs font-semibold" style={{ color: sc.color }}>{stage.name}</span>
                  <span className="text-xs font-bold" style={{ color: sc.color }}>{stage.deals.length}</span>
                </div>
                <div className="space-y-2">
                  {stage.deals.length === 0 ? (
                    <div className="rounded-xl border-2 border-dashed p-4 text-center text-xs" style={{ borderColor: 'rgba(255,255,255,0.06)', color: '#5a5a6e' }}>
                      Nenhum negócio
                    </div>
                  ) : stage.deals.map(deal => (
                    <div key={deal.id} className="card p-3">
                      <p className="text-sm font-medium truncate" style={{ color: '#e8e8f2' }}>{deal.title}</p>
                      {deal.contact_name && (
                        <p className="text-xs mt-0.5 truncate" style={{ color: '#5a5a6e' }}>{deal.contact_name}</p>
                      )}
                      {deal.value > 0 && (
                        <div className="flex items-center gap-1 mt-2">
                          <DollarSign className="w-3 h-3" style={{ color: '#6ee7b7' }} />
                          <span className="text-xs font-semibold" style={{ color: '#6ee7b7' }}>
                            R$ {deal.value.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
