'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { CheckSquare, Circle, CheckCircle, Clock, RefreshCw, AlertCircle } from 'lucide-react'

type Tarefa = {
  id: string
  title: string
  description?: string
  priority: string
  due_date: string | null
  status: string
  assigned_to?: string
}

const priorityBg: Record<string, string>   = { high: 'rgba(239,68,68,0.15)',   medium: 'rgba(245,158,11,0.12)',  low: 'rgba(255,255,255,0.05)' }
const priorityText: Record<string, string> = { high: '#fca5a5',                medium: '#fcd34d',                low: '#8b8b9e' }
const priorityLabel: Record<string, string>= { high: 'Alta',                   medium: 'Média',                  low: 'Baixa' }

export default function ColaboradorTarefasPage() {
  const [tarefas, setTarefas] = useState<Tarefa[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'todas' | 'pendentes' | 'concluidas'>('pendentes')
  const [user, setUser] = useState<{ id: string } | null>(null)

  useEffect(() => {
    const u = JSON.parse(localStorage.getItem('user') || '{}')
    setUser(u)
    load(u.id)
  }, [])

  async function load(userId?: string) {
    setLoading(true)
    try {
      const data = await api.get('/api/tasks?limit=100')
      const all: Tarefa[] = data.tasks || []
      const minhas = userId ? all.filter(t => t.assigned_to === userId) : all
      setTarefas(minhas)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  async function toggleStatus(tarefa: Tarefa) {
    const newStatus = tarefa.status === 'done' ? 'pending' : 'done'
    setTarefas(prev => prev.map(t => t.id === tarefa.id ? { ...t, status: newStatus } : t))
    try {
      await api.patch(`/api/tasks/${tarefa.id}`, { status: newStatus })
    } catch {
      setTarefas(prev => prev.map(t => t.id === tarefa.id ? { ...t, status: tarefa.status } : t))
    }
  }

  const filtered = tarefas.filter(t => {
    if (filter === 'pendentes') return t.status !== 'done'
    if (filter === 'concluidas') return t.status === 'done'
    return true
  })

  const pendentes = tarefas.filter(t => t.status !== 'done').length
  const atrasadas = tarefas.filter(t => {
    if (!t.due_date || t.status === 'done') return false
    return new Date(t.due_date) < new Date()
  }).length

  const tabs: { id: typeof filter; label: string }[] = [
    { id: 'pendentes',  label: `Pendentes (${pendentes})` },
    { id: 'todas',      label: 'Todas' },
    { id: 'concluidas', label: 'Concluídas' },
  ]

  return (
    <div className="p-6 space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-bold text-lg" style={{ color: '#e8e8f2' }}>Minhas Tarefas</h1>
          <p className="text-xs mt-0.5" style={{ color: '#5a5a6e' }}>{pendentes} pendente(s)</p>
        </div>
        <button onClick={() => load(user?.id)} className="p-2 rounded-lg transition-colors" style={{ color: '#5a5a6e' }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {atrasadas > 0 && (
        <div className="flex items-center gap-2 p-3 rounded-xl" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <AlertCircle className="w-4 h-4 flex-shrink-0" style={{ color: '#f87171' }} />
          <p className="text-sm" style={{ color: '#fca5a5' }}>{atrasadas} tarefa(s) atrasada(s)!</p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: 'rgba(255,255,255,0.05)' }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={filter === tab.id
              ? { background: '#16161f', color: '#e8e8f2', boxShadow: '0 1px 3px rgba(0,0,0,0.4)' }
              : { color: '#5a5a6e' }
            }
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <CheckSquare className="w-10 h-10 mx-auto mb-3 opacity-20" style={{ color: '#8b8b9e' }} />
          <p className="text-sm" style={{ color: '#5a5a6e' }}>Nenhuma tarefa aqui</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(tarefa => {
            const isOverdue = tarefa.due_date && tarefa.status !== 'done' && new Date(tarefa.due_date) < new Date()
            return (
              <div
                key={tarefa.id}
                className="card p-4 flex items-start gap-3"
                style={isOverdue ? { borderColor: 'rgba(239,68,68,0.3)' } : {}}
              >
                <button onClick={() => toggleStatus(tarefa)} className="flex-shrink-0 mt-0.5">
                  {tarefa.status === 'done'
                    ? <CheckCircle className="w-5 h-5" style={{ color: '#6ee7b7' }} />
                    : <Circle className="w-5 h-5" style={{ color: isOverdue ? '#f87171' : '#3a3a50' }} />
                  }
                </button>
                <div className="flex-1 min-w-0">
                  <p
                    className="text-sm font-medium"
                    style={{
                      color: tarefa.status === 'done' ? '#5a5a6e' : '#e8e8f2',
                      textDecoration: tarefa.status === 'done' ? 'line-through' : 'none'
                    }}
                  >
                    {tarefa.title}
                  </p>
                  {tarefa.description && (
                    <p className="text-xs mt-0.5 line-clamp-2" style={{ color: '#5a5a6e' }}>{tarefa.description}</p>
                  )}
                  {tarefa.due_date && (
                    <p className="text-[10px] flex items-center gap-1 mt-1" style={{ color: isOverdue ? '#f87171' : '#5a5a6e' }}>
                      <Clock className="w-2.5 h-2.5" />
                      {new Date(tarefa.due_date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      {isOverdue && ' · Atrasada'}
                    </p>
                  )}
                </div>
                <span
                  className="badge text-[10px] flex-shrink-0"
                  style={{ background: priorityBg[tarefa.priority] || priorityBg.low, color: priorityText[tarefa.priority] || '#8b8b9e' }}
                >
                  {priorityLabel[tarefa.priority] || tarefa.priority}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
