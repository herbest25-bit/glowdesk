'use client'
import { useEffect, useState, useRef } from 'react'
import { api } from '@/lib/api'
import { getSocket } from '@/lib/socket'
import { Search, Bot, User, Send, Phone, Star, CheckCheck, MessageSquare, Kanban as KanbanIcon, List, RefreshCw, Plus, X, Loader2, Paperclip, Smile, Mic, MicOff, Trash2, CheckSquare, Square, MoreVertical, XCircle, StopCircle, Bell, Calendar, ChevronDown, ChevronUp } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Tooltip } from '@/components/ui/Tooltip'
import { BantPanel, BantData } from '@/components/bant/BantPanel'
import { MEETING_REMINDERS_KEY, type MeetingNotif } from '@/lib/meetings'

function MeetingNotifBanner() {
  const [notifs, setNotifs] = useState<MeetingNotif[]>([])
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    function load() {
      const all: MeetingNotif[] = JSON.parse(localStorage.getItem(MEETING_REMINDERS_KEY) || '[]')
      const upcoming = all.filter(n => !n.dismissed_by.includes('admin'))
      setNotifs(upcoming)
    }
    load()
    window.addEventListener('storage', load)
    return () => window.removeEventListener('storage', load)
  }, [])

  function dismiss(id: string) {
    const all: MeetingNotif[] = JSON.parse(localStorage.getItem(MEETING_REMINDERS_KEY) || '[]')
    const updated = all.map(n => n.id === id ? { ...n, dismissed_by: [...n.dismissed_by, 'admin'] } : n)
    localStorage.setItem(MEETING_REMINDERS_KEY, JSON.stringify(updated))
    setNotifs(prev => prev.filter(n => n.id !== id))
  }

  if (notifs.length === 0) return null

  return (
    <div className="mx-4 mt-3 rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(124,58,237,0.3)', background: 'rgba(124,58,237,0.07)' }}>
      <button
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center justify-between px-4 py-2.5"
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
            const dateObj  = new Date(n.date + 'T12:00:00')
            const isToday  = dateObj.toDateString() === new Date().toDateString()
            const isPast   = dateObj < new Date(new Date().toDateString())
            const label    = isToday ? 'Hoje' : isPast ? 'Passou' : dateObj.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })
            return (
              <div key={n.id} className="flex items-start gap-3 rounded-xl px-3 py-2.5 mt-2"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(124,58,237,0.2)' }}>
                  <Calendar className="w-4 h-4" style={{ color: '#a78bfa' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold" style={{ color: '#e8e8f2' }}>1:1 com {n.collaborator}</p>
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

type Conversation = {
  id: string
  contact_name: string
  contact_phone: string
  avatar_url?: string
  last_message: string
  last_message_at: string
  status: string
  ai_mode: boolean
  unread_count: number
  tags: string[]
  lead_score: number
  assigned_name?: string
}

type Message = {
  id: string
  direction: 'inbound' | 'outbound'
  sender_type: string
  content: string
  content_type: string
  media_url?: string
  created_at: string
  sender_name?: string
}

const KANBAN_COLUMNS = [
  { key: 'bot',      label: 'Glow (IA)',         color: 'bg-violet-500/100', light: 'bg-violet-500/10 border-violet-200', text: 'text-violet-300' },
  { key: 'open',     label: 'Em Atendimento',     color: 'bg-blue-500',   light: 'bg-blue-50 border-blue-200',    text: 'text-blue-400' },
  { key: 'pending',  label: 'Aguardando',         color: 'bg-amber-500',  light: 'bg-amber-50 border-amber-200',  text: 'text-amber-400' },
  { key: 'resolved', label: 'Resolvidos',         color: 'bg-green-500',  light: 'bg-green-50 border-green-200',  text: 'text-green-400' },
]

function KanbanView({ conversations, onSelect }: { conversations: Conversation[], onSelect: (c: Conversation) => void }) {
  return (
    <div className="flex-1 overflow-x-auto p-4">
      <div className="flex gap-4 h-full" style={{ minWidth: `${KANBAN_COLUMNS.length * 260}px` }}>
        {KANBAN_COLUMNS.map(col => {
          const items = conversations.filter(c => c.status === col.key)
          return (
            <div key={col.key} className="w-60 flex-shrink-0 flex flex-col">
              {/* Column header */}
              <div className={`flex items-center gap-2 mb-3 px-3 py-2 rounded-xl border ${col.light}`}>
                <div className={`w-2 h-2 rounded-full ${col.color}`} />
                <span className={`text-xs font-semibold ${col.text}`}>{col.label}</span>
                <span className={`ml-auto text-xs font-bold ${col.text}`}>{items.length}</span>
              </div>

              {/* Cards */}
              <div className="flex-1 space-y-2 overflow-y-auto">
                {items.length === 0 && (
                  <div className="border-2 border-dashed border-white/[0.08] rounded-xl p-4 text-center text-xs text-slate-500">
                    Nenhuma conversa
                  </div>
                )}
                {items.map(conv => (
                  <button key={conv.id} onClick={() => onSelect(conv)}
                    className="w-full text-left card p-3 hover:shadow-md transition-all hover:border-violet-200">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-400 to-pink-400 flex items-center justify-center text-white text-xs font-medium flex-shrink-0">
                        {conv.contact_name?.[0]?.toUpperCase() || conv.contact_phone?.[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-100 truncate">
                          {conv.contact_name || conv.contact_phone}
                        </p>
                        <p className="text-[10px] text-slate-500">{conv.contact_phone}</p>
                      </div>
                      {conv.unread_count > 0 && (
                        <span className="badge bg-violet-600 text-white text-[10px] px-1.5">{conv.unread_count}</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 truncate mb-2">{conv.last_message}</p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        {conv.ai_mode
                          ? <span className="flex items-center gap-1 text-[10px] text-violet-400 font-medium"><Bot className="w-3 h-3" />Glow</span>
                          : conv.assigned_name
                          ? <span className="flex items-center gap-1 text-[10px] text-slate-400"><User className="w-3 h-3" />{conv.assigned_name}</span>
                          : <span className="text-[10px] text-slate-500">Sem agente</span>
                        }
                      </div>
                      {conv.last_message_at && (
                        <span className="text-[10px] text-slate-500">
                          {formatDistanceToNow(new Date(conv.last_message_at), { locale: ptBR, addSuffix: false })}
                        </span>
                      )}
                    </div>
                    {conv.lead_score > 0 && (
                      <div className="flex items-center gap-0.5 mt-1.5 text-amber-500">
                        <Star className="w-3 h-3 fill-current" />
                        <span className="text-[10px] font-medium">{conv.lead_score}</span>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

type Channel = {
  id: string
  name: string
  phone_number: string | null
  status: string
}

function applyPhoneMask(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 2) return digits
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

function NewConversationModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (conv: Conversation) => void
}) {
  const [phone, setPhone] = useState('')
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')
  const [channels, setChannels] = useState<Channel[]>([])
  const [selectedChannel, setSelectedChannel] = useState('')
  const [existingContact, setExistingContact] = useState<{ id: string; name: string } | null>(null)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const checkTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    api.get('/api/channels').then((d: any) => {
      const connected = d.channels.filter((c: Channel) => c.status === 'connected')
      setChannels(connected)
      if (connected.length > 0) setSelectedChannel(connected[0].id)
    }).catch(() => {})
  }, [])

  function handlePhoneChange(val: string) {
    const masked = applyPhoneMask(val)
    setPhone(masked)
    setExistingContact(null)

    if (checkTimer.current) clearTimeout(checkTimer.current)
    const digits = val.replace(/\D/g, '')
    if (digits.length >= 10) {
      checkTimer.current = setTimeout(async () => {
        try {
          const data = await api.get(`/api/contacts/check?phone=${digits}`) as any
          if (data.contact) setExistingContact(data.contact)
        } catch {}
      }, 500)
    }
  }

  async function handleSend() {
    setError('')
    const digits = phone.replace(/\D/g, '')
    if (digits.length < 10) { setError('Número inválido'); return }
    if (!message.trim()) { setError('Digite uma mensagem'); return }
    if (!selectedChannel) { setError('Nenhum canal WhatsApp conectado. Vá em Canais para conectar.'); return }

    setSending(true)
    try {
      const data = await api.post('/api/conversations/initiate', {
        phone: digits,
        name: name.trim() || undefined,
        message: message.trim(),
        channelId: selectedChannel,
      }) as any
      onCreated(data.conversation)
      onClose()
    } catch (e: any) {
      setError(e.message || 'Erro ao enviar mensagem')
    } finally {
      setSending(false)
    }
  }

  const canSend = phone.replace(/\D/g, '').length >= 10 && message.trim() && selectedChannel && !sending

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-[#111118] rounded-2xl shadow-xl w-full max-w-md mx-4 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
          <h2 className="font-semibold text-slate-100">Nova Conversa</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-slate-500 hover:text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* Phone */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Número WhatsApp <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <div className="flex items-center gap-1.5 px-3 py-2 border border-white/[0.08] rounded-xl text-sm text-slate-400 bg-white/[0.03] flex-shrink-0">
                🇧🇷 +55
              </div>
              <input
                value={phone}
                onChange={(e) => handlePhoneChange(e.target.value)}
                placeholder="(85) 99420-1465"
                className="input flex-1"
                type="tel"
                autoFocus
              />
            </div>
            {existingContact && (
              <p className="text-xs text-violet-400 mt-1.5 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-violet-500/100 inline-block" />
                Contato existente: <strong>{existingContact.name}</strong>
              </p>
            )}
          </div>

          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Nome do contato <span className="text-slate-500">(opcional)</span>
            </label>
            <input
              value={existingContact ? existingContact.name : name}
              onChange={(e) => setName(e.target.value)}
              disabled={!!existingContact}
              placeholder="Ex: Maria Silva"
              className="input w-full"
            />
          </div>

          {/* Channel selector */}
          {channels.length > 1 && (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Canal de envio</label>
              <select
                value={selectedChannel}
                onChange={(e) => setSelectedChannel(e.target.value)}
                className="input w-full"
              >
                {channels.map(ch => (
                  <option key={ch.id} value={ch.id}>
                    {ch.name}{ch.phone_number ? ` (${ch.phone_number})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {channels.length === 0 && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-400">
              Nenhum canal conectado. Vá em <strong>Canais</strong> para conectar um número WhatsApp.
            </div>
          )}

          {/* Message */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Mensagem <span className="text-red-500">*</span>
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Olá! Tudo bem? Vi que você tem interesse em nossos produtos..."
              className="input w-full resize-none"
              rows={4}
            />
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-200 rounded-xl px-3 py-2">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/[0.06] flex items-center justify-end gap-3">
          <button onClick={onClose} className="btn-secondary text-sm">Cancelar</button>
          <button
            onClick={handleSend}
            disabled={!canSend}
            className="btn-primary text-sm flex items-center gap-2"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {sending ? 'Enviando...' : 'Enviar mensagem'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function InboxPage() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selected, setSelected] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [search, setSearch] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')
  const [noChannelActive, setNoChannelActive] = useState(false)
  const [showConnectModal, setShowConnectModal] = useState(false)
  const [connectQR, setConnectQR] = useState<string | null>(null)
  const [connectChannelId, setConnectChannelId] = useState<string | null>(null)
  const connectChannelIdRef = useRef<string | null>(null)
  const [view, setView] = useState<'list' | 'kanban'>('list')
  const [showNewConv, setShowNewConv] = useState(false)
  const [bantData, setBantData] = useState<BantData | null>(null)
  const [bantLoading, setBantLoading] = useState(false)
  const [bantCollapsed, setBantCollapsed] = useState(false)
  const bantTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [showChatSearch, setShowChatSearch] = useState(false)
  const [chatSearch, setChatSearch] = useState('')
  const [recording, setRecording] = useState(false)
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null)
  const [selectMode, setSelectMode] = useState(false)
  const [selectedMsgs, setSelectedMsgs] = useState<Set<string>>(new Set())
  const [showMoreMenu, setShowMoreMenu] = useState(false)

  const user = typeof window !== 'undefined'
    ? JSON.parse(localStorage.getItem('user') || '{}')
    : {}

  useEffect(() => {
    api.get('/api/channels/sessions').then(async (d: any) => {
      const inactive = !d.activeSessions || d.activeSessions.length === 0
      setNoChannelActive(inactive)
      // Load first channel id for the connect button (no auto-open modal)
      if (inactive) {
        try {
          const ch = await api.get('/api/channels') as any
          const channel = ch.channels?.[0]
          if (channel) {
            setConnectChannelId(channel.id)
            connectChannelIdRef.current = channel.id
          }
        } catch {}
      }
    }).catch(() => {})
  }, [])

  useEffect(() => {
    loadConversations()
    const socket = getSocket(user.workspaceId)
    socket.on('new_message', ({ conversationId, message }: any) => {
      if (selected?.id === conversationId) {
        setMessages(prev => {
          const updated = [...prev, message]
          if (message.direction === 'inbound') {
            if (bantTimerRef.current) clearTimeout(bantTimerRef.current)
            bantTimerRef.current = setTimeout(() => {
              runBantAnalysis(updated)
            }, 5000)
          }
          return updated
        })
      }
      loadConversations()
    })
    socket.on('conversation_updated', () => loadConversations())
    socket.on('transfer_to_human', () => loadConversations())
    socket.on('channel_qrcode', ({ channelId, qrcode }: any) => {
      if (channelId === connectChannelIdRef.current) {
        setConnectQR(qrcode)
      }
    })
    socket.on('channel_connected', () => {
      setNoChannelActive(false)
      setShowConnectModal(false)
      setConnectQR(null)
    })
    socket.on('channel_disconnected', () => {
      api.get('/api/channels/sessions').then((d: any) => {
        setNoChannelActive(!d.activeSessions || d.activeSessions.length === 0)
      }).catch(() => {})
    })
    return () => {
      socket.off('new_message')
      socket.off('conversation_updated')
      socket.off('transfer_to_human')
      socket.off('channel_qrcode')
      socket.off('channel_connected')
      socket.off('channel_disconnected')
    }
  }, [selected?.id])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function loadConversations() {
    try {
      const data = await api.get(`/api/conversations?search=${search}&limit=100`)
      setConversations(data.conversations)
    } catch { }
  }

  async function selectConversation(conv: Conversation) {
    setSelected(conv)
    setBantData(null)
    setView('list')
    const data = await api.get(`/api/conversations/${conv.id}/messages`)
    setMessages(data.messages)
    scheduleBantAnalysis(data.messages)
  }

  function scheduleBantAnalysis(msgs: Message[]) {
    if (bantTimerRef.current) clearTimeout(bantTimerRef.current)
    bantTimerRef.current = setTimeout(() => runBantAnalysis(msgs), 800)
  }

  function runBantAnalysis(msgs: Message[]) {
    setBantLoading(true)
    try {
      const inbound = msgs.filter(m => m.direction === 'inbound')
      const result = analyzeBantKeywords(inbound)
      setBantData(result)
    } finally {
      setBantLoading(false)
    }
  }

  async function sendFile(file: File) {
    if (!selected) return
    setSending(true)
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve((reader.result as string).split(',')[1])
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      const msg = await api.post(`/api/conversations/${selected.id}/messages`, {
        content: file.name,
        media_base64: base64,
        media_mimetype: file.type,
        media_filename: file.name,
      })
      setMessages(prev => [...prev, msg.message])
    } catch (e) { console.error('Erro ao enviar arquivo:', e) }
    finally { setSending(false) }
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      const chunks: BlobPart[] = []
      mr.ondataavailable = e => chunks.push(e.data)
      mr.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/ogg; codecs=opus' })
        const file = new File([blob], 'audio.ogg', { type: 'audio/ogg' })
        await sendFile(file)
        stream.getTracks().forEach(t => t.stop())
      }
      mr.start()
      setMediaRecorder(mr)
      setRecording(true)
    } catch (e) { console.error('Microfone negado:', e) }
  }

  function stopRecording() {
    mediaRecorder?.stop()
    setRecording(false)
    setMediaRecorder(null)
  }

  async function deleteConversation(id: string) {
    if (!confirm('Apagar esta conversa?')) return
    try {
      await api.delete(`/api/conversations/${id}`)
      setConversations(prev => prev.filter(c => c.id !== id))
      if (selected?.id === id) setSelected(null)
    } catch (e) { console.error(e) }
  }

  async function deleteSelectedMsgs() {
    if (!selected || selectedMsgs.size === 0) return
    if (!confirm(`Apagar ${selectedMsgs.size} mensagem(ns)?`)) return
    try {
      await Promise.all(
        Array.from(selectedMsgs).map(msgId =>
          api.delete(`/api/conversations/${selected.id}/messages/${msgId}`)
        )
      )
      setMessages(prev => prev.filter(m => !selectedMsgs.has(m.id)))
      setSelectedMsgs(new Set())
      setSelectMode(false)
    } catch (e) { console.error(e) }
  }

  function toggleSelectMsg(id: string) {
    setSelectedMsgs(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const EMOJIS = ['😀','😂','🥰','😍','🤩','😎','🥳','😊','👍','👏','🙏','❤️','🔥','✨','🎉','💯','😅','🤔','😢','😱','🫡','💪','🙌','👌','😃','🥹','😇','🤗','😮','🤝','💅','💋','😏','🫶','💬','📸','🎁','🌸','⭐','🏆']

  function analyzeBantKeywords(msgs: Message[]): BantData {
    const KEYWORDS = {
      budget: ['preço', 'valor', 'quanto custa', 'orçamento', 'caro', 'barato', 'desconto', 'parcela', 'pagar', 'investimento', 'r$', 'reais', 'promoção', 'oferta'],
      authority: ['eu decido', 'sou dona', 'sou dono', 'responsável', 'marido', 'esposa', 'chefe', 'preciso consultar', 'vou perguntar', 'vou ver com', 'deixa eu perguntar'],
      need: ['preciso', 'quero', 'procurando', 'problema', 'necessito', 'urgente', 'resolver', 'melhorar', 'insatisfeito', 'não funciona', 'ressecado', 'danificado', 'ajuda'],
      timeline: ['hoje', 'amanhã', 'semana', 'mês', 'urgente', 'pressa', 'agendar', 'marcar', 'horário', 'pesquisando', 'só olhando', 'mais tarde', 'quando'],
    }

    function scoreDim(keys: string[]): { score: number; evidence: { text: string; timestamp: string }[] } {
      const evidence: { text: string; timestamp: string }[] = []
      let hits = 0
      for (const msg of msgs) {
        const body = msg.content?.toLowerCase() || ''
        for (const kw of keys) {
          if (body.includes(kw)) {
            hits++
            const alreadyAdded = evidence.some(e => e.text === msg.content)
            if (!alreadyAdded && evidence.length < 3) {
              evidence.push({
                text: msg.content.length > 80 ? msg.content.substring(0, 80) + '…' : msg.content,
                timestamp: new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
              })
            }
            break
          }
        }
      }
      const score = Math.min(100, hits * 25)
      return { score, evidence }
    }

    function getStatus(score: number): 'qualified' | 'partial' | 'not_qualified' | 'unknown' {
      if (score >= 70) return 'qualified'
      if (score >= 30) return 'partial'
      if (score > 0) return 'not_qualified'
      return 'unknown'
    }

    function getSummary(key: string, score: number): string {
      if (score === 0) {
        const defaults: Record<string, string> = {
          budget: 'Nenhuma menção a preço ou orçamento',
          authority: 'Não foi possível identificar quem decide',
          need: 'Necessidade não mencionada ainda',
          timeline: 'Prazo não mencionado ainda',
        }
        return defaults[key]
      }
      const summaries: Record<string, Record<string, string>> = {
        budget: { high: 'Cliente demonstrou interesse no preço/investimento', mid: 'Cliente perguntou sobre valores' },
        authority: { high: 'Cliente parece ser o decisor da compra', mid: 'Pode precisar consultar outra pessoa' },
        need: { high: 'Necessidade clara identificada', mid: 'Cliente demonstrou alguma necessidade' },
        timeline: { high: 'Cliente tem urgência ou prazo definido', mid: 'Cliente mencionou algum prazo' },
      }
      return score >= 70 ? summaries[key].high : summaries[key].mid
    }

    const b = scoreDim(KEYWORDS.budget)
    const a = scoreDim(KEYWORDS.authority)
    const n = scoreDim(KEYWORDS.need)
    const t = scoreDim(KEYWORDS.timeline)

    const overall = Math.round((b.score + a.score + n.score + t.score) / 4)
    const classification: BantData['classification'] =
      overall >= 70 ? 'hot' : overall >= 40 ? 'warm' : overall > 0 ? 'cold' : 'no_data'

    const recs: Record<string, string> = {
      hot:     '🔥 Lead quente! Cliente pronto para fechar. Apresente a proposta agora.',
      warm:    '⚠️ Lead morno. Aprofunde as perguntas para qualificar melhor.',
      cold:    '❄️ Lead frio. Mantenha no radar e faça follow-up em 7 dias.',
      no_data: '⚪ Conversa sem dados suficientes. Continue a conversa para qualificar.',
    }

    return {
      budget:    { score: b.score, status: getStatus(b.score), summary: getSummary('budget',    b.score), evidence: b.evidence },
      authority: { score: a.score, status: getStatus(a.score), summary: getSummary('authority', a.score), evidence: a.evidence },
      need:      { score: n.score, status: getStatus(n.score), summary: getSummary('need',      n.score), evidence: n.evidence },
      timeline:  { score: t.score, status: getStatus(t.score), summary: getSummary('timeline',  t.score), evidence: t.evidence },
      overall_score: overall,
      classification,
      recommendation: recs[classification],
      analyzed_at: new Date().toISOString(),
    }
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!newMessage.trim() || !selected || sending) return
    setSending(true)
    setSendError('')
    const text = newMessage
    setNewMessage('')
    try {
      const res = await api.post(`/api/conversations/${selected.id}/messages`, { content: text })
      setMessages(prev => [...prev, res.message])
    } catch (err: unknown) {
      setNewMessage(text)
      setSendError(err instanceof Error ? err.message : 'Erro ao enviar mensagem')
    } finally {
      setSending(false)
    }
  }

  async function takeOver() {
    if (!selected) return
    await api.patch(`/api/conversations/${selected.id}/take-over`, {})
    setSelected(prev => prev ? { ...prev, ai_mode: false } : null)
    loadConversations()
  }

  async function enableAI() {
    if (!selected) return
    await api.patch(`/api/conversations/${selected.id}/enable-ai`, {})
    setSelected(prev => prev ? { ...prev, ai_mode: true } : null)
    loadConversations()
  }

  const filtered = conversations.filter(c =>
    c.contact_name?.toLowerCase().includes(search.toLowerCase()) ||
    c.contact_phone?.includes(search)
  )

  // ── Kanban View ──────────────────────────────────────────────
  if (view === 'kanban') {
    return (
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-[#111118] border-b border-white/[0.06] flex items-center justify-between">
          <div>
            <h1 className="font-semibold text-slate-100">Kanban de Atendimentos</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {conversations.length} conversas •{' '}
              {conversations.filter(c => c.ai_mode).length} com Glow •{' '}
              {conversations.filter(c => !c.ai_mode && c.status === 'open').length} com agente
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Tooltip text="Atualizar conversas" position="left" />
            <button onClick={loadConversations} className="btn-secondary p-2">
              <RefreshCw className="w-4 h-4" />
            </button>
            <button onClick={() => setView('list')} className="btn-secondary flex items-center gap-1.5 text-xs">
              <List className="w-4 h-4" /> Lista
            </button>
          </div>
        </div>
        <KanbanView conversations={filtered} onSelect={selectConversation} />
      </div>
    )
  }

  // ── List View ────────────────────────────────────────────────
  return (
    <div className="flex h-screen">
      {showConnectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setShowConnectModal(false)}>
          <div className="rounded-2xl w-full max-w-sm mx-4 p-6 text-center space-y-4"
            style={{ background: '#16161f', border: '1px solid rgba(255,255,255,0.08)' }}
            onClick={e => e.stopPropagation()}>
            <h2 className="font-semibold" style={{ color: '#e8e8f2' }}>Conectar WhatsApp</h2>
            <p className="text-xs" style={{ color: '#8b8b9e' }}>
              Abra o WhatsApp → <strong style={{ color: '#e8e8f2' }}>Aparelhos Conectados</strong> → <strong style={{ color: '#e8e8f2' }}>Conectar aparelho</strong> → escaneie:
            </p>
            <div className="flex items-center justify-center">
              {connectQR ? (
                <img src={connectQR} alt="QR Code" className="w-52 h-52 rounded-xl"
                  style={{ border: '1px solid rgba(255,255,255,0.08)' }} />
              ) : (
                <div className="w-52 h-52 rounded-xl flex flex-col items-center justify-center gap-3"
                  style={{ border: '2px dashed rgba(124,58,237,0.3)', background: 'rgba(124,58,237,0.06)' }}>
                  <div className="w-8 h-8 border-violet-500 border-t-transparent rounded-full animate-spin" style={{ borderWidth: 3, borderStyle: 'solid' }} />
                  <p className="text-xs" style={{ color: '#c4b5fd' }}>Gerando QR Code...</p>
                  <p className="text-[10px]" style={{ color: '#8b6fba' }}>Aguarde ~30 segundos</p>
                </div>
              )}
            </div>
            <button onClick={() => setShowConnectModal(false)} className="btn-secondary text-xs w-full">Fechar</button>
          </div>
        </div>
      )}

      {showNewConv && (
        <NewConversationModal
          onClose={() => setShowNewConv(false)}
          onCreated={(conv) => {
            setConversations(prev => {
              const exists = prev.find(c => c.id === conv.id)
              if (exists) return prev
              return [{ ...conv, ai_mode: false, unread_count: 0, tags: [], lead_score: 0 } as Conversation, ...prev]
            })
            selectConversation({ ...conv, ai_mode: false, unread_count: 0, tags: [], lead_score: 0 } as Conversation)
            loadConversations()
          }}
        />
      )}

      {/* Lista */}
      <div className="w-80 border-r border-white/[0.06] bg-[#111118] flex flex-col">
        <div className="p-4 border-b border-white/[0.06]">
          <div className="flex items-center justify-between mb-3">
            <h1 className="font-semibold text-slate-100">Inbox</h1>
            <div className="flex items-center gap-1.5">
              <Tooltip text="Todas as conversas do WhatsApp chegam aqui." position="bottom" />
              <button
                onClick={() => setShowNewConv(true)}
                className="btn-secondary p-1.5 text-violet-400 border-violet-200"
                title="Nova conversa">
                <Plus className="w-4 h-4" />
              </button>
              <button onClick={() => setView('kanban')}
                className="btn-secondary p-1.5 text-violet-400 border-violet-200"
                title="Ver como Kanban">
                <KanbanIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar conversa..." className="input pl-9" />
          </div>
        </div>

        {noChannelActive && (
          <button
            onClick={async () => {
              setShowConnectModal(true)
              setConnectQR(null)
              if (connectChannelIdRef.current) {
                try { await api.get(`/api/channels/${connectChannelIdRef.current}/qrcode`) } catch {}
                // Polling HTTP fallback
                const poll = setInterval(async () => {
                  try {
                    const d = await api.get(`/api/channels/${connectChannelIdRef.current}/qr-poll`) as any
                    if (d.qrcode) { setConnectQR(d.qrcode); clearInterval(poll) }
                  } catch {}
                }, 3000)
                setTimeout(() => clearInterval(poll), 120_000)
              }
            }}
            className="mx-3 mt-2 w-[calc(100%-24px)] px-3 py-2.5 rounded-xl text-xs flex items-center gap-2 cursor-pointer transition-all hover:opacity-90"
            style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5' }}
          >
            <span className="flex-shrink-0">⚠️</span>
            <span className="flex-1 text-left">WhatsApp desconectado.</span>
            <span className="font-bold underline" style={{ color: '#f87171' }}>Conectar agora →</span>
          </button>
        )}

        <MeetingNotifBanner />

        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500">
              <MessageSquare className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-xs">Nenhuma conversa</p>
            </div>
          )}
          {filtered.map(conv => (
            <button key={conv.id} onClick={() => selectConversation(conv)}
              className={`w-full text-left px-4 py-3 border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors
                ${selected?.id === conv.id ? 'bg-violet-500/10 border-l-2 border-l-violet-500' : ''}`}>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-400 to-pink-400 flex items-center justify-center flex-shrink-0 text-white font-medium text-sm">
                  {conv.contact_name?.[0]?.toUpperCase() || conv.contact_phone?.[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-100 text-sm truncate">
                      {conv.contact_name || conv.contact_phone}
                    </span>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {conv.ai_mode && <Bot className="w-3 h-3 text-violet-500" />}
                      {conv.unread_count > 0 && (
                        <span className="badge bg-violet-600 text-white">{conv.unread_count}</span>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 truncate mt-0.5">{conv.last_message}</p>
                  <div className="flex items-center justify-between mt-1">
                    <div className="flex items-center gap-1">
                      <span className={`badge text-xs ${
                        conv.status === 'bot' ? 'bg-violet-500/100/20 text-violet-300' :
                        conv.status === 'pending' ? 'bg-amber-500/20 text-amber-400' :
                        conv.status === 'resolved' ? 'bg-green-500/20 text-green-400' :
                        'bg-blue-500/20 text-blue-400'
                      }`}>
                        {conv.status === 'bot' ? 'IA' : conv.status === 'pending' ? 'Aguardando' : conv.status === 'resolved' ? 'Resolvido' : 'Aberto'}
                      </span>
                      {conv.assigned_name && !conv.ai_mode && (
                        <span className="text-[10px] text-slate-500">{conv.assigned_name}</span>
                      )}
                    </div>
                    {conv.last_message_at && (
                      <span className="text-xs text-slate-500">
                        {formatDistanceToNow(new Date(conv.last_message_at), { locale: ptBR, addSuffix: false })}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Chat + BANT */}
      {selected ? (
        <div className="flex-1 flex overflow-hidden">
          {/* Chat */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-4 py-3 bg-[#111118] border-b border-white/[0.06] flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-400 to-pink-400 flex items-center justify-center text-white font-medium text-sm flex-shrink-0">
                    {selected.contact_name?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div>
                    <h2 className="font-semibold text-slate-100 text-sm">{selected.contact_name || selected.contact_phone}</h2>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Phone className="w-3 h-3" />
                      <span>{selected.contact_phone}</span>
                      {selected.lead_score > 0 && (
                        <span className="flex items-center gap-0.5 text-amber-600">
                          <Star className="w-3 h-3 fill-current" />{selected.lead_score}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {selected.ai_mode ? (
                    <button onClick={takeOver} className="btn-secondary text-xs flex items-center gap-1.5 h-7 px-2">
                      <User className="w-3 h-3" /> Assumir
                    </button>
                  ) : (
                    <button onClick={enableAI} className="btn-secondary text-xs flex items-center gap-1.5 h-7 px-2">
                      <Bot className="w-3 h-3 text-violet-500" /> Ativar IA
                    </button>
                  )}
                  <span className={`badge text-[10px] ${selected.ai_mode ? 'bg-violet-500/100/20 text-violet-300' : 'bg-white/[0.06] text-slate-400'}`}>
                    {selected.ai_mode ? '🤖 Glow' : '👤 Humano'}
                  </span>
                  {/* Search */}
                  <button onClick={() => { setShowChatSearch(v => !v); setChatSearch('') }} className={`p-1.5 rounded-lg transition-colors ${showChatSearch ? 'bg-violet-500/100/20 text-violet-400' : 'text-slate-500 hover:text-slate-400 hover:bg-white/[0.06]'}`} title="Pesquisar">
                    <Search className="w-4 h-4" />
                  </button>
                  {/* Select mode */}
                  <button onClick={() => { setSelectMode(v => !v); setSelectedMsgs(new Set()) }} className={`p-1.5 rounded-lg transition-colors ${selectMode ? 'bg-violet-500/100/20 text-violet-400' : 'text-slate-500 hover:text-slate-400 hover:bg-white/[0.06]'}`} title="Selecionar mensagens">
                    <CheckSquare className="w-4 h-4" />
                  </button>
                  {/* More menu */}
                  <div className="relative">
                    <button onClick={() => setShowMoreMenu(v => !v)} className="p-1.5 rounded-lg text-slate-500 hover:text-slate-400 hover:bg-white/[0.06]" title="Mais opções">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                    {showMoreMenu && (
                      <div className="absolute right-0 top-8 bg-[#111118] border border-white/[0.06] rounded-xl shadow-lg z-50 py-1 w-44" onClick={() => setShowMoreMenu(false)}>
                        <button onClick={() => deleteConversation(selected.id)} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10">
                          <Trash2 className="w-4 h-4" /> Apagar conversa
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              {/* Search bar */}
              {showChatSearch && (
                <div className="flex items-center gap-2 bg-white/[0.03] rounded-xl px-3 py-1.5">
                  <Search className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                  <input autoFocus value={chatSearch} onChange={e => setChatSearch(e.target.value)} placeholder="Buscar na conversa..." className="flex-1 bg-transparent text-sm outline-none" />
                  {chatSearch && <button onClick={() => setChatSearch('')}><X className="w-3.5 h-3.5 text-slate-500" /></button>}
                </div>
              )}
              {/* Select mode bar */}
              {selectMode && (
                <div className="flex items-center justify-between bg-violet-500/10 rounded-xl px-3 py-1.5">
                  <span className="text-xs text-violet-300">{selectedMsgs.size} selecionada(s)</span>
                  <div className="flex items-center gap-3">
                    {selectedMsgs.size > 0 && (
                      <button onClick={deleteSelectedMsgs} className="text-xs text-red-400 hover:underline flex items-center gap-1">
                        <Trash2 className="w-3 h-3" /> Apagar
                      </button>
                    )}
                    <button onClick={() => { setSelectMode(false); setSelectedMsgs(new Set()) }} className="text-xs text-violet-400 hover:underline">Cancelar</button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2" style={{ background: '#0d0d14' }}>
              {noChannelActive && (
                <div className="mx-auto max-w-sm mt-4 px-4 py-3 rounded-xl text-xs text-center" style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', color: '#fca5a5' }}>
                  ⚠️ WhatsApp desconectado. <a href="/channels" className="underline font-bold" style={{ color: '#f87171' }}>Reconectar em Canais →</a>
                </div>
              )}
              {messages.length === 0 && (
                <div className="flex items-center justify-center h-full text-xs" style={{ color: '#3a3a50' }}>
                  Nenhuma mensagem ainda
                </div>
              )}
              {messages.filter(msg => !chatSearch || msg.content?.toLowerCase().includes(chatSearch.toLowerCase())).map(msg => (
                <div key={msg.id} onClick={() => selectMode && toggleSelectMsg(msg.id)} className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'} ${selectMode ? 'cursor-pointer' : ''} ${selectMode && selectedMsgs.has(msg.id) ? 'opacity-70' : ''}`}>
                  {selectMode && (
                    <div className="flex items-center mr-2 self-center">
                      {selectedMsgs.has(msg.id) ? <CheckSquare className="w-4 h-4 text-violet-400" /> : <Square className="w-4 h-4 text-slate-600" />}
                    </div>
                  )}
                  <div className={`max-w-[70%] rounded-2xl px-4 py-2.5 text-sm ${
                    msg.direction === 'inbound'
                      ? 'rounded-bl-sm'
                      : msg.sender_type === 'ai'
                      ? 'bg-violet-600 text-white rounded-br-sm'
                      : 'rounded-br-sm'
                  }`} style={
                    msg.direction === 'inbound'
                      ? { background: '#1e1e2e', border: '1px solid rgba(255,255,255,0.08)', color: '#e2e2f0' }
                      : msg.sender_type === 'ai'
                      ? {}
                      : { background: '#2d2d4a', color: '#e2e2f0' }
                  }>
                    {msg.sender_type === 'ai' && (
                      <div className="text-xs text-violet-200 mb-1 flex items-center gap-1">
                        <Bot className="w-3 h-3" /> Glow
                      </div>
                    )}
                    {msg.sender_type === 'agent' && (
                      <div className="text-xs mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>{msg.sender_name || 'Agente'}</div>
                    )}
                    {msg.media_url && msg.content_type === 'image' && (
                      <img src={msg.media_url} alt="imagem" className="max-w-xs rounded-lg mb-1"
                        onError={e => { (e.target as HTMLImageElement).style.display='none' }} />
                    )}
                    {msg.media_url && msg.content_type === 'audio' && (
                      <audio controls src={msg.media_url} className="max-w-xs" />
                    )}
                    {msg.media_url && msg.content_type === 'video' && (
                      <video controls src={msg.media_url} className="max-w-xs rounded-lg mb-1" />
                    )}
                    {msg.media_url && msg.content_type === 'document' && (
                      <a href={msg.media_url} download className="text-xs underline flex items-center gap-1">📎 {msg.content || 'Documento'}</a>
                    )}
                    {msg.media_url && msg.content_type === 'sticker' && (
                      <img src={msg.media_url} alt="sticker" className="w-24 h-24" />
                    )}
                    {(!msg.media_url || !['image','audio','video','document','sticker'].includes(msg.content_type)) && (
                      <p className="whitespace-pre-wrap">{msg.content || <span className="text-xs opacity-50 italic">[mídia]</span>}</p>
                    )}
                    <div className={`text-xs mt-1 flex items-center justify-end gap-1 ${
                      msg.direction === 'outbound' ? 'text-white/60' : 'text-slate-500'
                    }`}>
                      {new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      {msg.direction === 'outbound' && <CheckCheck className="w-3 h-3" />}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {!selected.ai_mode ? (
              <div className="bg-[#111118] border-t border-white/[0.06]">
                {/* Emoji picker */}
                {showEmojiPicker && (
                  <div className="px-4 py-2 border-b border-white/[0.06] flex flex-wrap gap-1 max-h-28 overflow-y-auto">
                    {EMOJIS.map(e => (
                      <button key={e} onClick={() => { setNewMessage(m => m + e); setShowEmojiPicker(false) }} className="text-xl hover:scale-125 transition-transform leading-none p-0.5">{e}</button>
                    ))}
                  </div>
                )}
                {noChannelActive && (
                  <div className="mx-3 mb-1 text-xs px-3 py-2 rounded-lg flex items-center gap-2" style={{ background: 'rgba(239,68,68,0.12)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.25)' }}>
                    <span>⚠️ WhatsApp desconectado.</span>
                    <a href="/channels" className="underline font-bold" style={{ color: '#f87171' }}>Ir para Canais →</a>
                  </div>
                )}
                {sendError && (
                  <div className="mx-3 mb-1 text-xs px-3 py-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.2)' }}>
                    {sendError}
                  </div>
                )}
                <form onSubmit={sendMessage} className="px-3 py-3">
                  <div className="flex items-end gap-2">
                    {/* Emoji */}
                    <button type="button" onClick={() => setShowEmojiPicker(v => !v)} className={`p-2 rounded-xl transition-colors flex-shrink-0 ${showEmojiPicker ? 'text-violet-400 bg-violet-500/10' : 'text-slate-500 hover:text-slate-400 hover:bg-white/[0.06]'}`} title="Emojis">
                      <Smile className="w-5 h-5" />
                    </button>
                    {/* Attachment */}
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2 rounded-xl text-slate-500 hover:text-slate-400 hover:bg-white/[0.06] flex-shrink-0" title="Anexar arquivo">
                      <Paperclip className="w-5 h-5" />
                    </button>
                    <input ref={fileInputRef} type="file" className="hidden" accept="image/*,audio/*,video/*,.pdf,.doc,.docx"
                      onChange={e => { const f = e.target.files?.[0]; if (f) sendFile(f); e.target.value = '' }} />
                    {/* Input */}
                    <input value={newMessage} onChange={e => setNewMessage(e.target.value)}
                      placeholder="Digite uma mensagem..." className="input flex-1 min-w-0"
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(e as any) } }} />
                    {/* Mic or Send */}
                    {newMessage.trim() ? (
                      <button type="submit" disabled={sending} className="p-2 rounded-xl bg-violet-600 text-white hover:bg-violet-700 flex-shrink-0 disabled:opacity-50">
                        <Send className="w-5 h-5" />
                      </button>
                    ) : (
                      <button type="button"
                        onMouseDown={startRecording}
                        onMouseUp={stopRecording}
                        onTouchStart={startRecording}
                        onTouchEnd={stopRecording}
                        className={`p-2 rounded-xl flex-shrink-0 transition-colors ${recording ? 'bg-red-500/100 text-white animate-pulse' : 'text-slate-500 hover:text-slate-400 hover:bg-white/[0.06]'}`}
                        title={recording ? 'Solte para enviar' : 'Segure para gravar'}
                      >
                        {recording ? <StopCircle className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                      </button>
                    )}
                  </div>
                </form>
              </div>
            ) : (
              <div className="px-6 py-3 bg-violet-500/10 border-t border-violet-500/20 text-center text-sm text-violet-400">
                🤖 A Glow está atendendo automaticamente. Clique em "Assumir atendimento" para responder manualmente.
              </div>
            )}
          </div>

          {/* BANT Panel */}
          <BantPanel
            data={bantData}
            loading={bantLoading}
            onAnalyze={() => runBantAnalysis(messages)}
            collapsed={bantCollapsed}
            onToggleCollapse={() => setBantCollapsed(v => !v)}
          />
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-slate-500">
          <div className="text-center">
            <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Selecione uma conversa</p>
            <p className="text-xs mt-1 text-slate-600">ou clique no ícone Kanban para ver o painel de atendimentos</p>
          </div>
        </div>
      )}
    </div>
  )
}
