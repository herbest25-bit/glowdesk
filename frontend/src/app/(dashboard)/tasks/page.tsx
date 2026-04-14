'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { Plus, CheckCircle, Clock, AlertCircle, Phone, Calendar, X } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

type Task = {
  id: string
  title: string
  type: string
  priority: string
  status: string
  due_date?: string
  contact_name?: string
  contact_phone?: string
  assigned_name?: string
}

const PRIORITY_COLORS: Record<string, { bg: string; text: string }> = {
  high:   { bg: 'rgba(239,68,68,0.18)',  text: '#fca5a5' },
  medium: { bg: 'rgba(245,158,11,0.18)', text: '#fcd34d' },
  low:    { bg: 'rgba(16,185,129,0.18)', text: '#6ee7b7' },
}
const PRIORITY_LABELS: Record<string, string> = { high: 'Alta', medium: 'Média', low: 'Baixa' }
const TYPE_LABELS: Record<string, string> = {
  follow_up: 'Follow-up', call: 'Ligação', meeting: 'Reunião',
  send_message: 'Mensagem', custom: 'Tarefa'
}

// ─── Calendar Picker ──────────────────────────────────────────────────────────

const MONTHS_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const DAYS_PT   = ['D','S','T','Q','Q','S','S']

function CalendarPicker({ value, onChange, markedDates = [] }: {
  value: string
  onChange: (date: string) => void
  markedDates?: string[]
}) {
  const today    = new Date()
  const selected = value ? new Date(value + 'T12:00:00') : null
  const [viewYear,  setViewYear]  = useState(selected?.getFullYear()  ?? today.getFullYear())
  const [viewMonth, setViewMonth] = useState(selected?.getMonth()     ?? today.getMonth())

  const markedSet = new Set(markedDates)

  const firstDay = new Date(viewYear, viewMonth, 1)
  const lastDay  = new Date(viewYear, viewMonth + 1, 0)
  const startDow = firstDay.getDay()

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
          const hasTask    = markedSet.has(dateStr)
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
              {hasTask && (
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

// ─── Page ─────────────────────────────────────────────────────────────────────

type Collaborator = { id: string; name: string; role: string; avatar: string }

function loadCollaborators(): Collaborator[] {
  if (typeof window === 'undefined') return []
  const stored = localStorage.getItem('team_collaborators')
  if (stored) {
    try { return JSON.parse(stored) } catch { return [] }
  }
  return []
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [filter, setFilter] = useState('pending')
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [collaborators, setCollaborators] = useState<Collaborator[]>([])

  const [title, setTitle] = useState('')
  const [type, setType] = useState('follow_up')
  const [priority, setPriority] = useState('medium')
  const [dueDay, setDueDay] = useState('')
  const [dueTime, setDueTime] = useState('09:00')
  const [description, setDescription] = useState('')
  const [assignedTo, setAssignedTo] = useState('')

  useEffect(() => {
    setCollaborators(loadCollaborators())
    loadTasks()
  }, [filter])

  async function loadTasks() {
    try {
      const data = await api.get(`/api/tasks?status=${filter}`)
      setTasks(data.tasks)
    } catch {
      setTasks([])
    }
  }

  async function completeTask(id: string) {
    await api.patch(`/api/tasks/${id}`, { status: 'done' })
    loadTasks()
  }

  async function createTask(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true)
    try {
      const dueDate = dueDay ? `${dueDay}T${dueTime}:00` : null
      await api.post('/api/tasks', {
        title, type, priority,
        dueDate,
        description: description || null,
        assignedTo: assignedTo || null,
      })
      setShowModal(false)
      setTitle(''); setType('follow_up'); setPriority('medium')
      setDueDay(''); setDueTime('09:00'); setDescription(''); setAssignedTo('')
      loadTasks()
    } finally {
      setSaving(false)
    }
  }

  // Dates that already have tasks (for calendar dots)
  const taskDates = tasks
    .filter(t => t.due_date)
    .map(t => format(new Date(t.due_date!), 'yyyy-MM-dd'))

  const overdue  = tasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.status !== 'done')
  const todayTasks = tasks.filter(t => t.due_date && format(new Date(t.due_date), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd'))
  const upcoming = tasks.filter(t => !overdue.includes(t) && !todayTasks.includes(t))

  function TaskCard({ task }: { task: Task }) {
    const isOverdue = task.due_date && new Date(task.due_date) < new Date()
    const pc = PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.low
    return (
      <div className="card p-4 flex items-start gap-3">
        <button onClick={() => completeTask(task.id)} className="mt-0.5 flex-shrink-0">
          <CheckCircle className={`w-5 h-5 transition-colors ${task.status === 'done' ? '' : 'hover:text-emerald-400'}`}
            style={{ color: task.status === 'done' ? '#6ee7b7' : '#3a3a50' }} />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium" style={{
            color: task.status === 'done' ? '#5a5a6e' : '#e8e8f2',
            textDecoration: task.status === 'done' ? 'line-through' : 'none'
          }}>
            {task.title}
          </p>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className="badge text-xs" style={{ background: pc.bg, color: pc.text }}>
              {PRIORITY_LABELS[task.priority]}
            </span>
            <span className="badge text-xs" style={{ background: 'rgba(255,255,255,0.07)', color: '#8b8b9e' }}>
              {TYPE_LABELS[task.type] || task.type}
            </span>
            {task.contact_name && (
              <span className="flex items-center gap-1 text-xs" style={{ color: '#5a5a6e' }}>
                <Phone className="w-3 h-3" />{task.contact_name}
              </span>
            )}
            {task.due_date && (
              <span className="flex items-center gap-1 text-xs" style={{ color: isOverdue ? '#f87171' : '#5a5a6e' }}>
                {isOverdue ? <AlertCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                {format(new Date(task.due_date), "dd MMM, HH:mm", { locale: ptBR })}
              </span>
            )}
          </div>
        </div>
        {task.assigned_name && (
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0"
            style={{ background: 'rgba(124,58,237,0.2)', color: '#c4b5fd' }}
          >
            {task.assigned_name[0]}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-semibold" style={{ color: '#e8e8f2' }}>Tarefas</h1>
          <p className="text-xs mt-0.5" style={{ color: '#5a5a6e' }}>{tasks.length} tarefas &bull; {overdue.length} atrasadas</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.05)' }}>
            {['pending', 'in_progress', 'done'].map(s => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className="px-3 py-1.5 text-xs rounded-lg transition-all"
                style={filter === s
                  ? { background: '#16161f', color: '#e8e8f2', fontWeight: 600, boxShadow: '0 1px 3px rgba(0,0,0,0.4)' }
                  : { color: '#5a5a6e' }
                }
              >
                {s === 'pending' ? 'Pendentes' : s === 'in_progress' ? 'Em andamento' : 'Concluídas'}
              </button>
            ))}
          </div>
          <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> Nova tarefa
          </button>
        </div>
      </div>

      {overdue.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide mb-2 flex items-center gap-1.5" style={{ color: '#f87171' }}>
            <AlertCircle className="w-3.5 h-3.5" /> Atrasadas ({overdue.length})
          </h2>
          <div className="space-y-2">{overdue.map(t => <TaskCard key={t.id} task={t} />)}</div>
        </div>
      )}

      {todayTasks.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide mb-2 flex items-center gap-1.5" style={{ color: '#fcd34d' }}>
            <Calendar className="w-3.5 h-3.5" /> Hoje ({todayTasks.length})
          </h2>
          <div className="space-y-2">{todayTasks.map(t => <TaskCard key={t.id} task={t} />)}</div>
        </div>
      )}

      {upcoming.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide mb-2 flex items-center gap-1.5" style={{ color: '#5a5a6e' }}>
            <Clock className="w-3.5 h-3.5" /> Próximas ({upcoming.length})
          </h2>
          <div className="space-y-2">{upcoming.map(t => <TaskCard key={t.id} task={t} />)}</div>
        </div>
      )}

      {tasks.length === 0 && (
        <div className="text-center py-12" style={{ color: '#5a5a6e' }}>
          <CheckCircle className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm">Nenhuma tarefa encontrada</p>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
          onClick={() => setShowModal(false)}>
          <div className="card w-full max-w-md p-6 overflow-y-auto" style={{ background: '#16161f', border: '1px solid rgba(255,255,255,0.08)', maxHeight: '90vh' }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold" style={{ color: '#e8e8f2' }}>Nova tarefa</h2>
              <button onClick={() => setShowModal(false)} className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors" style={{ color: '#5a5a6e' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={createTask} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: '#8b8b9e' }}>Título *</label>
                <input value={title} onChange={e => setTitle(e.target.value)}
                  placeholder="Ex: Ligar para cliente..." className="input" required autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold mb-1.5" style={{ color: '#8b8b9e' }}>Tipo</label>
                  <select value={type} onChange={e => setType(e.target.value)} className="input">
                    <option value="follow_up">Follow-up</option>
                    <option value="call">Ligação</option>
                    <option value="meeting">Reunião</option>
                    <option value="send_message">Mensagem</option>
                    <option value="custom">Outro</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1.5" style={{ color: '#8b8b9e' }}>Prioridade</label>
                  <select value={priority} onChange={e => setPriority(e.target.value)} className="input">
                    <option value="low">Baixa</option>
                    <option value="medium">Média</option>
                    <option value="high">Alta</option>
                  </select>
                </div>
              </div>

              {/* Colaboradora — sempre visível */}
              {collaborators.length > 0 && (
                <div>
                  <label className="block text-sm font-semibold mb-2" style={{ color: '#8b8b9e' }}>
                    Colaborador{type === 'meeting' ? ' (reunião)' : ''}
                    <span className="ml-1 font-normal" style={{ color: '#3a3a50' }}>opcional</span>
                  </label>
                  <div className="flex gap-2 flex-wrap">
                    {/* Opção "nenhum" */}
                    <button
                      type="button"
                      onClick={() => setAssignedTo('')}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all"
                      style={assignedTo === ''
                        ? { background: 'rgba(124,58,237,0.25)', color: '#c4b5fd', border: '1px solid rgba(124,58,237,0.4)' }
                        : { background: 'rgba(255,255,255,0.04)', color: '#5a5a6e', border: '1px solid rgba(255,255,255,0.07)' }
                      }
                    >
                      Nenhum
                    </button>
                    {collaborators.map(c => (
                      <button
                        type="button"
                        key={c.id}
                        onClick={() => setAssignedTo(c.name)}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all"
                        style={assignedTo === c.name
                          ? { background: c.avatar, color: 'white', border: '1px solid transparent' }
                          : { background: 'rgba(255,255,255,0.04)', color: '#8b8b9e', border: '1px solid rgba(255,255,255,0.07)' }
                        }
                      >
                        <span
                          className="w-5 h-5 rounded-full flex items-center justify-center text-white font-bold text-[9px] flex-shrink-0"
                          style={{ background: assignedTo === c.name ? 'rgba(255,255,255,0.3)' : c.avatar }}
                        >
                          {c.name[0]}
                        </span>
                        {c.name.split(' ')[0]}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Calendar Picker */}
              <div>
                <label className="block text-sm font-semibold mb-2" style={{ color: '#8b8b9e' }}>Prazo</label>
                <CalendarPicker value={dueDay} onChange={setDueDay} markedDates={taskDates} />
                {dueDay && (
                  <p className="text-xs mt-2 font-semibold" style={{ color: '#a78bfa' }}>
                    {new Date(dueDay + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
                  </p>
                )}
              </div>

              {/* Time picker — only shown when a day is selected */}
              {dueDay && (
                <div>
                  <label className="block text-sm font-semibold mb-1.5" style={{ color: '#8b8b9e' }}>Horário</label>
                  <input type="time" value={dueTime} onChange={e => setDueTime(e.target.value)} className="input" />
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: '#8b8b9e' }}>Descrição</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)}
                  placeholder="Detalhes da tarefa..." className="input resize-none" rows={3} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancelar</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1">
                  {saving ? 'Salvando...' : 'Criar tarefa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
