'use client'
import { useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api'
import { getSocket } from '@/lib/socket'
import { Plus, DollarSign, User, X, RefreshCw } from 'lucide-react'

type Stage = {
  id: string
  name: string
  color: string
  position: number
  is_won: boolean
  is_lost: boolean
}

type Deal = {
  id: string
  title: string
  value: number
  contact_name: string
  contact_phone: string
  lead_score: number
  tags: string[]
  assigned_name?: string
  stage_id: string
}

type Contact = {
  id: string
  name: string | null
  phone: string
}

export default function PipelinePage() {
  const [stages, setStages] = useState<Stage[]>([])
  const [dealsByStage, setDealsByStage] = useState<Record<string, Deal[]>>({})
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState<Deal | null>(null)
  const [dragOver, setDragOver] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)

  const [dealTitle, setDealTitle] = useState('')
  const [dealValue, setDealValue] = useState('')
  const [dealContact, setDealContact] = useState('')
  const [dealStage, setDealStage] = useState('')

  const loadPipeline = useCallback(async () => {
    try {
      const data = await api.get('/api/pipeline')
      setStages(data.pipeline.stages || [])
      setDealsByStage(data.dealsByStage || {})
      if (data.pipeline.stages?.length > 0 && !dealStage) {
        setDealStage(data.pipeline.stages[0].id)
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar pipeline')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadPipeline()
    api.get('/api/contacts?limit=100').then(d => setContacts(d.contacts)).catch(() => {})
    const interval = setInterval(loadPipeline, 15000)

    const user = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('user') || '{}') : {}
    let socket: ReturnType<typeof getSocket> | null = null
    if (user?.workspaceId) {
      try {
        socket = getSocket(user.workspaceId)
        socket.on('conversation_updated', loadPipeline)
        socket.on('deal_updated', loadPipeline)
      } catch {}
    }

    return () => {
      clearInterval(interval)
      if (socket) {
        socket.off('conversation_updated', loadPipeline)
        socket.off('deal_updated', loadPipeline)
      }
    }
  }, [loadPipeline])

  async function moveDeal(deal: Deal, targetStageId: string) {
    if (deal.stage_id === targetStageId) return
    await api.patch(`/api/deals/${deal.id}/stage`, { stageId: targetStageId })
    loadPipeline()
  }

  async function createDeal(e: React.FormEvent) {
    e.preventDefault()
    if (!dealTitle.trim() || !dealContact) return
    setSaving(true)
    try {
      const pipeline = await api.get('/api/pipeline')
      await api.post('/api/deals', {
        contactId: dealContact,
        pipelineId: pipeline.pipeline.id,
        stageId: dealStage || stages[0]?.id,
        title: dealTitle,
        value: dealValue ? Number(dealValue) : 0,
      })
      setShowModal(false)
      setDealTitle('')
      setDealValue('')
      setDealContact('')
      loadPipeline()
    } finally {
      setSaving(false)
    }
  }

  function totalValue(stageId: string) {
    return (dealsByStage[stageId] || []).reduce((s, d) => s + Number(d.value || 0), 0)
  }

  const allDeals = Object.values(dealsByStage).flat()

  if (loading) return (
    <div className="flex items-center justify-center h-full text-sm" style={{ color: '#5a5a6e' }}>
      Carregando pipeline...
    </div>
  )
  if (error) return (
    <div className="flex items-center justify-center h-full text-sm" style={{ color: '#f87171' }}>
      {error}
    </div>
  )

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div
        className="px-6 py-4 flex items-center justify-between flex-shrink-0"
        style={{ background: '#111118', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div>
          <h1 className="font-semibold" style={{ color: '#e8e8f2' }}>Pipeline de Vendas</h1>
          <p className="text-xs mt-0.5" style={{ color: '#5a5a6e' }}>
            {allDeals.length} negócios &bull;{' '}
            R$ {allDeals.reduce((s, d) => s + Number(d.value || 0), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} no funil
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadPipeline} className="btn-secondary flex items-center gap-1.5 py-1.5 px-3">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Novo negócio
          </button>
        </div>
      </div>

      {/* Kanban board */}
      <div className="flex-1 overflow-x-auto p-6">
        <div className="flex gap-4 h-full" style={{ minWidth: `${stages.length * 280}px` }}>
          {stages.map(stage => (
            <div
              key={stage.id}
              className="w-64 flex-shrink-0 flex flex-col"
              onDragOver={e => { e.preventDefault(); setDragOver(stage.id) }}
              onDragLeave={() => setDragOver(null)}
              onDrop={() => {
                if (dragging) { moveDeal(dragging, stage.id); setDragging(null) }
                setDragOver(null)
              }}
            >
              {/* Column header */}
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: stage.color }} />
                  <span className="text-sm font-medium" style={{ color: '#c4c4d4' }}>{stage.name}</span>
                  <span
                    className="badge text-xs"
                    style={{ background: 'rgba(255,255,255,0.07)', color: '#8b8b9e' }}
                  >
                    {(dealsByStage[stage.id] || []).length}
                  </span>
                </div>
                <span className="text-xs" style={{ color: '#5a5a6e' }}>
                  R$ {totalValue(stage.id).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                </span>
              </div>

              {/* Cards */}
              <div
                className="flex-1 space-y-2 overflow-y-auto rounded-2xl p-2 transition-colors"
                style={{
                  background: dragOver === stage.id
                    ? 'rgba(124,58,237,0.06)'
                    : 'rgba(255,255,255,0.02)',
                  border: dragOver === stage.id
                    ? '1px dashed rgba(124,58,237,0.4)'
                    : '1px solid rgba(255,255,255,0.04)',
                  minHeight: '120px',
                }}
              >
                {(dealsByStage[stage.id] || []).map(deal => (
                  <div
                    key={deal.id}
                    draggable
                    onDragStart={() => setDragging(deal)}
                    className="card p-3 cursor-grab active:cursor-grabbing transition-all"
                    style={{ background: '#16161f' }}
                  >
                    <p className="text-sm font-medium truncate" style={{ color: '#e8e8f2' }}>{deal.title}</p>
                    {deal.value > 0 && (
                      <div className="flex items-center gap-1 mt-1.5" style={{ color: '#6ee7b7' }}>
                        <DollarSign className="w-3 h-3" />
                        <span className="text-xs font-medium">R$ {Number(deal.value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1 mt-2" style={{ color: '#5a5a6e' }}>
                      <User className="w-3 h-3" />
                      <span className="text-xs truncate">{deal.contact_name || deal.contact_phone}</span>
                    </div>
                  </div>
                ))}
                {(dealsByStage[stage.id] || []).length === 0 && (
                  <div className="rounded-xl p-4 text-center text-xs" style={{ color: '#3a3a50' }}>
                    Arraste negócios aqui
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal Novo Negócio */}
      {showModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
          <div className="card w-full max-w-md p-6" style={{ background: '#16161f', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold" style={{ color: '#e8e8f2' }}>Novo negócio</h2>
              <button
                onClick={() => setShowModal(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                style={{ color: '#5a5a6e' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={createDeal} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: '#8b8b9e' }}>Título *</label>
                <input
                  value={dealTitle}
                  onChange={e => setDealTitle(e.target.value)}
                  placeholder="Ex: Venda kit maquiagem..."
                  className="input"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: '#8b8b9e' }}>Contato *</label>
                <select value={dealContact} onChange={e => setDealContact(e.target.value)} className="input" required>
                  <option value="">Selecione um contato</option>
                  {contacts.map(c => (
                    <option key={c.id} value={c.id}>{c.name || c.phone}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold mb-1.5" style={{ color: '#8b8b9e' }}>Estágio</label>
                  <select value={dealStage} onChange={e => setDealStage(e.target.value)} className="input">
                    {stages.filter(s => !s.is_won && !s.is_lost).map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1.5" style={{ color: '#8b8b9e' }}>Valor (R$)</label>
                  <input
                    type="number"
                    value={dealValue}
                    onChange={e => setDealValue(e.target.value)}
                    placeholder="0,00"
                    className="input"
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">
                  Cancelar
                </button>
                <button type="submit" disabled={saving} className="btn-primary flex-1">
                  {saving ? 'Salvando...' : 'Criar negócio'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
