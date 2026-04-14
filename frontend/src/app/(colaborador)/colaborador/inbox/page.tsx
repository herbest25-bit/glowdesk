'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { MessageSquare, Bot, Phone, Search, RefreshCw, Bell, Calendar, X, ChevronDown, ChevronUp } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { MEETING_REMINDERS_KEY, type MeetingNotif } from '@/lib/meetings'

type Conversation = {
  id: string
  contact_name: string
  contact_phone: string
  last_message: string
  last_message_at: string
  status: string
  ai_mode: boolean
  unread_count: number
  assigned_to?: string
}

function MeetingNotifBanner({ userName }: { userName: string }) {
  const [notifs, setNotifs] = useState<MeetingNotif[]>([])
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    function load() {
      const all: MeetingNotif[] = JSON.parse(localStorage.getItem(MEETING_REMINDERS_KEY) || '[]')
      const mine = all.filter(n => n.collaborator === userName && !n.dismissed_by.includes(userName))
      setNotifs(mine)
    }
    if (userName) { load() }
    window.addEventListener('storage', load)
    return () => window.removeEventListener('storage', load)
  }, [userName])

  function dismiss(id: string) {
    const all: MeetingNotif[] = JSON.parse(localStorage.getItem(MEETING_REMINDERS_KEY) || '[]')
    const updated = all.map(n => n.id === id ? { ...n, dismissed_by: [...n.dismissed_by, userName] } : n)
    localStorage.setItem(MEETING_REMINDERS_KEY, JSON.stringify(updated))
    setNotifs(prev => prev.filter(n => n.id !== id))
  }

  if (notifs.length === 0) return null

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(124,58,237,0.3)', background: 'rgba(124,58,237,0.07)' }}>
      <button
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center justify-between px-4 py-3"
      >
        <div className="flex items-center gap-2">
          <Bell className="w-3.5 h-3.5" style={{ color: '#a78bfa' }} />
          <span className="text-xs font-semibold" style={{ color: '#c4b5fd' }}>
            {notifs.length} reunião{notifs.length > 1 ? 'ões' : ''} agendada{notifs.length > 1 ? 's' : ''}
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: '#7c3aed', color: 'white' }}>{notifs.length}</span>
        </div>
        {collapsed
          ? <ChevronDown className="w-3.5 h-3.5" style={{ color: '#5a5a6e' }} />
          : <ChevronUp   className="w-3.5 h-3.5" style={{ color: '#5a5a6e' }} />
        }
      </button>

      {!collapsed && (
        <div className="px-3 pb-3 space-y-2" style={{ borderTop: '1px solid rgba(124,58,237,0.15)' }}>
          {notifs.map(n => {
            const dateObj = new Date(n.date + 'T12:00:00')
            const isToday = dateObj.toDateString() === new Date().toDateString()
            const isPast  = dateObj < new Date(new Date().toDateString())
            const label   = isToday ? 'Hoje' : isPast ? 'Passou' : dateObj.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })
            return (
              <div key={n.id} className="flex items-start gap-3 rounded-xl px-3 py-2.5 mt-2"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(124,58,237,0.2)' }}>
                  <Calendar className="w-4 h-4" style={{ color: '#a78bfa' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold" style={{ color: '#e8e8f2' }}>Reunião 1:1 agendada</p>
                  <p className="text-[10px] mt-0.5" style={{ color: '#5a5a6e' }}>
                    <span style={{ color: isToday ? '#a78bfa' : isPast ? '#ef4444' : '#8b8b9e', fontWeight: isToday ? 700 : 400 }}>{label}</span>
                    {n.time && ` · ${n.time}`}
                  </p>
                  {n.notes && <p className="text-[10px] mt-1 leading-relaxed line-clamp-2" style={{ color: '#5a5a6e' }}>{n.notes}</p>}
                </div>
                <button onClick={() => dismiss(n.id)} className="flex-shrink-0 mt-0.5"
                  style={{ color: '#3a3a50' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#ef4444'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#3a3a50'}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function ColaboradorInboxPage() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [user, setUser] = useState<{ id: string; name?: string } | null>(null)

  useEffect(() => {
    const u = JSON.parse(localStorage.getItem('user') || '{}')
    setUser(u)
    load(u.id)
  }, [])

  async function load(userId?: string) {
    setLoading(true)
    try {
      const data = await api.get('/api/conversations?limit=100')
      const all = data.conversations || []
      const minhas = userId ? all.filter((c: Conversation) => c.assigned_to === userId) : all
      setConversations(minhas)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  const filtered = conversations.filter(c =>
    (c.contact_name || c.contact_phone).toLowerCase().includes(search.toLowerCase()) ||
    (c.last_message || '').toLowerCase().includes(search.toLowerCase())
  )

  const statusLabel: Record<string, string> = {
    bot: 'IA', open: 'Aberto', pending: 'Aguardando', resolved: 'Resolvido'
  }
  const statusStyle: Record<string, { bg: string; color: string }> = {
    bot:      { bg: 'rgba(124,58,237,0.2)', color: '#c4b5fd' },
    open:     { bg: 'rgba(59,130,246,0.2)', color: '#93c5fd' },
    pending:  { bg: 'rgba(245,158,11,0.2)', color: '#fcd34d' },
    resolved: { bg: 'rgba(16,185,129,0.2)', color: '#6ee7b7' },
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-bold text-lg" style={{ color: '#e8e8f2' }}>Minhas Conversas</h1>
          <p className="text-xs mt-0.5" style={{ color: '#5a5a6e' }}>{filtered.length} conversa(s) atribuída(s) a você</p>
        </div>
        <button onClick={() => load(user?.id)} className="p-2 rounded-lg transition-colors" style={{ color: '#5a5a6e' }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Meeting reminders */}
      {user?.name && <MeetingNotifBanner userName={user.name} />}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#5a5a6e' }} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar conversa..."
          className="input pl-9"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-20" style={{ color: '#8b8b9e' }} />
          <p className="text-sm" style={{ color: '#5a5a6e' }}>Nenhuma conversa atribuída a você</p>
        </div>
      ) : (
        <div className="card divide-y" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
          {filtered.map(conv => {
            const st = statusStyle[conv.status] || statusStyle.open
            return (
              <div
                key={conv.id}
                className="flex items-center gap-3 px-5 py-4 transition-colors cursor-pointer"
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}
              >
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, #7c3aed, #f43f5e)' }}>
                  {(conv.contact_name?.[0] || '?').toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate" style={{ color: '#e8e8f2' }}>
                      {conv.contact_name || conv.contact_phone}
                    </p>
                    {conv.unread_count > 0 && (
                      <span className="badge text-[10px]" style={{ background: '#7c3aed', color: 'white' }}>
                        {conv.unread_count}
                      </span>
                    )}
                  </div>
                  <p className="text-xs truncate mt-0.5" style={{ color: '#5a5a6e' }}>{conv.last_message || '—'}</p>
                </div>
                <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                  {conv.last_message_at && (
                    <span className="text-[10px]" style={{ color: '#5a5a6e' }}>
                      {formatDistanceToNow(new Date(conv.last_message_at), { locale: ptBR, addSuffix: false })}
                    </span>
                  )}
                  <span className="badge text-[10px]" style={{ background: st.bg, color: st.color }}>
                    {conv.ai_mode ? <><Bot className="w-2.5 h-2.5 inline mr-0.5" />IA</> : statusLabel[conv.status]}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
