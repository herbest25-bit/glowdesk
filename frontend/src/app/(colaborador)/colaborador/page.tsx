'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { getSocket } from '@/lib/socket'
import {
  MessageSquare, TrendingUp, Target, CheckSquare,
  RefreshCw, ArrowRight, Send, Phone, Calendar,
  UserPlus, FileText, Circle, CheckCircle, Clock,
  Zap, Star, Smartphone, Wifi, WifiOff, X, QrCode
} from 'lucide-react'

type ColabMetrics = {
  conversas_ativas: number
  vendas_mes: number
  meta_mes: number
  taxa_conversao: number
  tarefas_pendentes: number
  tarefas_hoje: number
}

type Tarefa = {
  id: string
  title: string
  priority: string
  due_date: string | null
  status: string
}

type Channel = {
  id: string
  name: string
  phone_number: string | null
  status: 'connected' | 'disconnected' | 'connecting'
}

const PERMISSOES_DEFAULT: Record<string, boolean> = {
  nova_venda: true,
  registrar_contato: true,
  emitir_proposta: false,
  agendar_followup: true,
  abrir_ticket: false,
  enviar_mensagem_whatsapp: true,
  ver_relatorios: false,
}

function getPermissoes(): Record<string, boolean> {
  try {
    const stored = localStorage.getItem('colaborador_permissoes')
    if (stored) return { ...PERMISSOES_DEFAULT, ...JSON.parse(stored) }
  } catch {}
  return PERMISSOES_DEFAULT
}

const ACOES = [
  { key: 'nova_venda',               icon: TrendingUp,  label: 'Nova venda',        color: '#6ee7b7', bg: 'rgba(16,185,129,0.12)',  href: '/colaborador/pipeline' },
  { key: 'registrar_contato',        icon: UserPlus,    label: 'Novo contato',      color: '#93c5fd', bg: 'rgba(59,130,246,0.12)',  href: '/colaborador/contatos' },
  { key: 'emitir_proposta',          icon: FileText,    label: 'Emitir proposta',   color: '#fcd34d', bg: 'rgba(245,158,11,0.12)',  href: '/colaborador/pipeline' },
  { key: 'agendar_followup',         icon: Calendar,    label: 'Agendar follow-up', color: '#c4b5fd', bg: 'rgba(124,58,237,0.12)', href: '/colaborador/tarefas'  },
  { key: 'abrir_ticket',             icon: Zap,         label: 'Abrir ticket',      color: '#fca5a5', bg: 'rgba(239,68,68,0.12)',   href: '/colaborador/inbox'    },
  { key: 'enviar_mensagem_whatsapp', icon: Send,        label: 'Enviar mensagem',   color: '#6ee7b7', bg: 'rgba(16,185,129,0.12)',  href: '/colaborador/inbox'    },
]

const priorityBg: Record<string, string>   = { high: 'rgba(239,68,68,0.15)', medium: 'rgba(245,158,11,0.12)', low: 'rgba(255,255,255,0.05)' }
const priorityText: Record<string, string> = { high: '#fca5a5', medium: '#fcd34d', low: '#8b8b9e' }
const priorityLabel: Record<string, string>= { high: 'Alta', medium: 'Média', low: 'Baixa' }

// ─── Modal QR Code ────────────────────────────────────────────────────────────
function QrModal({ user, onClose }: { user: { name: string; workspaceId: string } | null; onClose: () => void }) {
  const [step, setStep] = useState<'form' | 'qrcode' | 'done'>('form')
  const [channelName, setChannelName] = useState(user?.name ? `WhatsApp de ${user.name.split(' ')[0]}` : '')
  const [creatingId, setCreatingId] = useState<string | null>(null)
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [qrExpiry, setQrExpiry] = useState(60)
  const [connectedPhone, setConnectedPhone] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const creatingIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!user?.workspaceId) return
    const socket = getSocket(user.workspaceId)
    socket.on('channel_qrcode', ({ channelId, qrcode }: { channelId: string; qrcode: string }) => {
      if (channelId === creatingIdRef.current) { setQrCode(qrcode); setQrExpiry(60) }
    })
    socket.on('channel_connected', ({ channelId, phone }: { channelId: string; phone: string }) => {
      if (channelId !== creatingIdRef.current) return
      setConnectedPhone(phone)
      setStep('done')
      // Registrar colaborador na gestão de equipe automaticamente
      if (user?.name) {
        try {
          const stored = localStorage.getItem('team_collaborators')
          const list = stored ? JSON.parse(stored) : []
          const fullUser = JSON.parse(localStorage.getItem('user') || '{}')
          const alreadyIn = list.some((c: { id: string }) => c.id === fullUser.id)
          if (!alreadyIn) {
            const AVATAR_COLORS = ['#7c3aed','#db2777','#ea580c','#0891b2','#16a34a','#ca8a04','#6366f1','#0d9488']
            const novo = {
              id: fullUser.id || Date.now().toString(),
              name: fullUser.name || user.name,
              role: fullUser.role === 'admin' ? 'Gestor' : 'Atendente',
              avatar: AVATAR_COLORS[list.length % AVATAR_COLORS.length],
              score: 70, sales: 0, revenue: 0, trend: 0,
              phone: phone || null,
            }
            localStorage.setItem('team_collaborators', JSON.stringify([...list, novo]))
          }
        } catch {}
      }
    })
    return () => { socket.off('channel_qrcode'); socket.off('channel_connected') }
  }, [user])

  useEffect(() => {
    if (step !== 'qrcode') return
    const t = setInterval(() => setQrExpiry(e => {
      if (e <= 1) { refreshQr(); return 60 }
      return e - 1
    }), 1000)
    return () => clearInterval(t)
  }, [step])

  async function startChannel() {
    if (!channelName.trim()) return
    setLoading(true); setError(null)
    try {
      const data = await api.post('/api/channels', { name: channelName.trim() })
      setCreatingId(data.channel.id)
      creatingIdRef.current = data.channel.id
      setStep('qrcode'); setQrCode(null)
      await api.get(`/api/channels/${data.channel.id}/qrcode`)
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Erro ao criar canal') }
    finally { setLoading(false) }
  }

  async function refreshQr() {
    if (!creatingIdRef.current) return
    setQrCode(null)
    try { await api.get(`/api/channels/${creatingIdRef.current}/qrcode`) }
    catch {}
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="rounded-2xl w-full max-w-md overflow-hidden"
        style={{ background: '#16161f', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 24px 80px rgba(0,0,0,0.7)' }}>

        {/* Header */}
        <div className="flex items-center justify-between p-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(124,58,237,0.2)' }}>
              <Smartphone className="w-4 h-4" style={{ color: '#a78bfa' }} />
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: '#e8e8f2' }}>Conectar meu WhatsApp</p>
              <p className="text-xs" style={{ color: '#5a5a6e' }}>
                {step === 'form' ? 'Dê um nome para identificar seu número' : step === 'qrcode' ? 'Escaneie o QR Code com seu celular' : 'Conectado com sucesso!'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg transition-colors" style={{ color: '#5a5a6e' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6">
          {/* Step 1 — nome */}
          {step === 'form' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: '#8b8b9e' }}>Nome do canal</label>
                <input
                  value={channelName}
                  onChange={e => setChannelName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && startChannel()}
                  className="input"
                  placeholder="Ex: Meu WhatsApp"
                  autoFocus
                />
              </div>
              {error && <p className="text-xs rounded-lg px-3 py-2" style={{ background: 'rgba(239,68,68,0.1)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.2)' }}>{error}</p>}
              <button
                onClick={startChannel}
                disabled={loading || !channelName.trim()}
                className="btn-primary w-full py-2.5 flex items-center justify-center gap-2"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <QrCode className="w-4 h-4" />}
                {loading ? 'Iniciando...' : 'Gerar QR Code'}
              </button>
            </div>
          )}

          {/* Step 2 — QR */}
          {step === 'qrcode' && (
            <div className="space-y-4 text-center">
              <div className="rounded-2xl p-4 mx-auto w-fit" style={{ background: 'white' }}>
                {qrCode ? (
                  <img src={qrCode} alt="QR Code" className="w-52 h-52" />
                ) : (
                  <div className="w-52 h-52 flex items-center justify-center">
                    <RefreshCw className="w-8 h-8 animate-spin" style={{ color: '#7c3aed' }} />
                  </div>
                )}
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium" style={{ color: '#c4c4d4' }}>Abra o WhatsApp no celular</p>
                <p className="text-xs" style={{ color: '#5a5a6e' }}>
                  Menu → Dispositivos conectados → Conectar dispositivo
                </p>
                <p className="text-xs font-semibold" style={{ color: qrExpiry <= 15 ? '#fca5a5' : '#5a5a6e' }}>
                  Expira em {qrExpiry}s
                </p>
              </div>
              <button onClick={refreshQr} className="btn-secondary text-xs flex items-center gap-1.5 mx-auto">
                <RefreshCw className="w-3 h-3" /> Atualizar QR Code
              </button>
            </div>
          )}

          {/* Step 3 — done */}
          {step === 'done' && (
            <div className="text-center space-y-4 py-4">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto" style={{ background: 'rgba(16,185,129,0.15)' }}>
                <Wifi className="w-8 h-8" style={{ color: '#6ee7b7' }} />
              </div>
              <div>
                <p className="text-base font-semibold" style={{ color: '#e8e8f2' }}>WhatsApp conectado!</p>
                {connectedPhone && <p className="text-sm mt-1" style={{ color: '#6ee7b7' }}>+{connectedPhone}</p>}
              </div>
              <button onClick={onClose} className="btn-primary w-full py-2.5">Fechar</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Página Principal ─────────────────────────────────────────────────────────
export default function ColaboradorPage() {
  const router = useRouter()
  const [user, setUser] = useState<{ id: string; name: string; role: string; workspaceId: string } | null>(null)
  const [metrics, setMetrics] = useState<ColabMetrics | null>(null)
  const [tarefas, setTarefas] = useState<Tarefa[]>([])
  const [channels, setChannels] = useState<Channel[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdate, setLastUpdate] = useState(new Date())
  const [showQrModal, setShowQrModal] = useState(false)

  useEffect(() => {
    const u = JSON.parse(localStorage.getItem('user') || '{}')
    setUser(u)
    load(u.id)
    const interval = setInterval(() => load(u.id), 30000)
    return () => clearInterval(interval)
  }, [])

  async function load(userId?: string) {
    setRefreshing(true)
    try {
      const [convData, tasksData, dashboard, channelsData] = await Promise.all([
        api.get('/api/conversations?limit=100'),
        api.get('/api/tasks?limit=50'),
        api.get('/api/analytics/dashboard?period=30d'),
        api.get('/api/channels'),
      ])

      const uid = userId || user?.id
      const minhasConversas = (convData.conversations || []).filter(
        (c: { assigned_to?: string }) => !uid || c.assigned_to === uid
      )
      const minhasTarefas = (tasksData.tasks || []).filter(
        (t: { assigned_to?: string }) => !uid || t.assigned_to === uid
      )
      const vendasMes = dashboard.deals?.won_deals || 0

      setMetrics({
        conversas_ativas: minhasConversas.filter((c: { status: string }) => c.status !== 'resolved').length,
        vendas_mes: vendasMes,
        meta_mes: Math.min(Math.round((vendasMes / 10) * 100), 100),
        taxa_conversao: minhasConversas.length > 0 ? Math.round((vendasMes / Math.max(minhasConversas.length, 1)) * 100) : 0,
        tarefas_pendentes: minhasTarefas.filter((t: { status: string }) => t.status !== 'done').length,
        tarefas_hoje: minhasTarefas.filter((t: { due_date: string | null; status: string }) =>
          t.due_date && t.status !== 'done' && new Date(t.due_date).toDateString() === new Date().toDateString()
        ).length,
      })
      setTarefas(minhasTarefas.slice(0, 6))
      setChannels(channelsData.channels || [])
      setLastUpdate(new Date())
    } catch (e) { console.error(e) }
    finally { setLoading(false); setRefreshing(false) }
  }

  function toggleTarefa(id: string) {
    setTarefas(prev => prev.map(t => t.id === id ? { ...t, status: t.status === 'done' ? 'pending' : 'done' } : t))
  }

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Bom dia'
    if (h < 18) return 'Boa tarde'
    return 'Boa noite'
  }

  const permissoes = getPermissoes()
  const acoesVisiveis = ACOES.filter(a => permissoes[a.key])
  const meuCanal = channels[0] || null

  if (loading) return (
    <div className="flex items-center justify-center h-full" style={{ color: '#5a5a6e' }}>
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm">Carregando painel...</p>
      </div>
    </div>
  )

  return (
    <div className="p-6 space-y-6 overflow-auto">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-bold text-lg" style={{ color: '#e8e8f2' }}>
            {greeting()}, {user?.name?.split(' ')[0] || 'Colaborador'}! 👋
          </h1>
          <p className="text-xs mt-0.5" style={{ color: '#5a5a6e' }}>
            Atualizado às {lastUpdate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Avatar + nome (sem role) */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #f43f5e)' }}>
              {(user?.name?.[0] || 'C').toUpperCase()}
            </div>
            <span className="text-sm font-medium" style={{ color: '#c4c4d4' }}>{user?.name?.split(' ')[0]}</span>
          </div>
          <button
            onClick={() => load(user?.id)}
            disabled={refreshing}
            className="p-2 rounded-lg transition-all disabled:opacity-50"
            style={{ color: '#5a5a6e' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; (e.currentTarget as HTMLElement).style.color = '#c4b5fd' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ''; (e.currentTarget as HTMLElement).style.color = '#5a5a6e' }}
            title="Atualizar"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Conectar WhatsApp */}
      <div
        className="rounded-2xl p-4 flex items-center justify-between gap-4"
        style={meuCanal?.status === 'connected'
          ? { background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }
          : { background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.25)' }
        }
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: meuCanal?.status === 'connected' ? 'rgba(16,185,129,0.18)' : 'rgba(124,58,237,0.2)' }}>
            {meuCanal?.status === 'connected'
              ? <Wifi className="w-5 h-5" style={{ color: '#6ee7b7' }} />
              : <Smartphone className="w-5 h-5" style={{ color: '#a78bfa' }} />
            }
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: meuCanal?.status === 'connected' ? '#6ee7b7' : '#c4b5fd' }}>
              {meuCanal?.status === 'connected' ? 'WhatsApp conectado' : 'Conectar meu WhatsApp'}
            </p>
            <p className="text-xs mt-0.5" style={{ color: meuCanal?.status === 'connected' ? '#4a9f82' : '#8b6fba' }}>
              {meuCanal?.status === 'connected'
                ? `${meuCanal.name}${meuCanal.phone_number ? ` · +${meuCanal.phone_number}` : ''}`
                : 'Escaneie o QR Code para receber atendimentos'
              }
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowQrModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold flex-shrink-0 transition-all"
          style={meuCanal?.status === 'connected'
            ? { background: 'rgba(16,185,129,0.15)', color: '#6ee7b7', border: '1px solid rgba(16,185,129,0.3)' }
            : { background: 'linear-gradient(135deg, #6b21a8, #7c3aed)', color: 'white' }
          }
        >
          <QrCode className="w-4 h-4" />
          {meuCanal?.status === 'connected' ? 'Reconectar' : 'Conectar agora'}
        </button>
      </div>

      {/* KPIs */}
      {metrics && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <button onClick={() => router.push('/colaborador/inbox')} className="text-left">
            <div className="card p-5 h-full cursor-pointer">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(124,58,237,0.18)' }}>
                  <MessageSquare className="w-4 h-4" style={{ color: '#c4b5fd' }} />
                </div>
                <span className="text-xs" style={{ color: '#8b8b9e' }}>Conversas ativas</span>
              </div>
              <p className="text-2xl font-bold" style={{ color: '#e8e8f2' }}>{metrics.conversas_ativas}</p>
              <p className="text-xs mt-1" style={{ color: '#5a5a6e' }}>em andamento</p>
            </div>
          </button>

          <button onClick={() => router.push('/colaborador/pipeline')} className="text-left">
            <div className="card p-5 h-full cursor-pointer">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.18)' }}>
                  <TrendingUp className="w-4 h-4" style={{ color: '#6ee7b7' }} />
                </div>
                <span className="text-xs" style={{ color: '#8b8b9e' }}>Vendas no mês</span>
              </div>
              <p className="text-2xl font-bold" style={{ color: '#e8e8f2' }}>{metrics.vendas_mes}</p>
              <p className="text-xs mt-1" style={{ color: '#5a5a6e' }}>fechadas</p>
            </div>
          </button>

          <div className="card p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(245,158,11,0.18)' }}>
                <Target className="w-4 h-4" style={{ color: '#fcd34d' }} />
              </div>
              <span className="text-xs" style={{ color: '#8b8b9e' }}>Meta do mês</span>
            </div>
            <p className="text-2xl font-bold" style={{ color: '#e8e8f2' }}>{metrics.meta_mes}%</p>
            <div className="mt-2 w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
              <div className="h-full rounded-full transition-all duration-700"
                style={{ width: `${metrics.meta_mes}%`, background: metrics.meta_mes >= 100 ? '#10b981' : '#7c3aed' }} />
            </div>
          </div>

          <div className="card p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(59,130,246,0.18)' }}>
                <Zap className="w-4 h-4" style={{ color: '#93c5fd' }} />
              </div>
              <span className="text-xs" style={{ color: '#8b8b9e' }}>Taxa de conversão</span>
            </div>
            <p className="text-2xl font-bold" style={{ color: '#e8e8f2' }}>{metrics.taxa_conversao}%</p>
            <p className="text-xs mt-1" style={{ color: '#5a5a6e' }}>leads → vendas</p>
          </div>
        </div>
      )}

      {/* Ações rápidas */}
      {acoesVisiveis.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold mb-3" style={{ color: '#e8e8f2' }}>Ações rápidas</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {acoesVisiveis.map(acao => (
              <button key={acao.key} onClick={() => router.push(acao.href)}
                className="card p-4 flex items-center gap-3 text-left">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: acao.bg }}>
                  <acao.icon className="w-4 h-4" style={{ color: acao.color }} />
                </div>
                <span className="text-sm font-medium leading-tight" style={{ color: '#c4c4d4' }}>{acao.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tarefas */}
      <div className="card">
        <div className="flex items-center justify-between px-5 pt-5 pb-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div>
            <h2 className="text-sm font-semibold" style={{ color: '#e8e8f2' }}>Tarefas do dia</h2>
            <p className="text-xs" style={{ color: '#5a5a6e' }}>
              {metrics?.tarefas_pendentes || 0} pendente(s) · {metrics?.tarefas_hoje || 0} para hoje
            </p>
          </div>
          <button onClick={() => router.push('/colaborador/tarefas')}
            className="text-xs flex items-center gap-1 font-medium" style={{ color: '#a78bfa' }}>
            Ver todas <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {tarefas.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <CheckSquare className="w-8 h-8 mx-auto mb-2 opacity-20" style={{ color: '#8b8b9e' }} />
            <p className="text-sm" style={{ color: '#5a5a6e' }}>Nenhuma tarefa atribuída</p>
          </div>
        ) : (
          <div>
            {tarefas.map((tarefa, i) => (
              <div key={tarefa.id}
                className="flex items-center gap-3 px-5 py-3 transition-colors"
                style={{ borderBottom: i < tarefas.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}
              >
                <button onClick={() => toggleTarefa(tarefa.id)} className="flex-shrink-0">
                  {tarefa.status === 'done'
                    ? <CheckCircle className="w-4 h-4" style={{ color: '#6ee7b7' }} />
                    : <Circle className="w-4 h-4" style={{ color: '#3a3a50' }} />
                  }
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate" style={{
                    color: tarefa.status === 'done' ? '#5a5a6e' : '#c4c4d4',
                    textDecoration: tarefa.status === 'done' ? 'line-through' : 'none'
                  }}>{tarefa.title}</p>
                  {tarefa.due_date && (
                    <p className="text-[10px] flex items-center gap-1 mt-0.5" style={{ color: '#5a5a6e' }}>
                      <Clock className="w-2.5 h-2.5" />
                      {new Date(tarefa.due_date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                    </p>
                  )}
                </div>
                <span className="badge text-[10px] flex-shrink-0"
                  style={{ background: priorityBg[tarefa.priority] || priorityBg.low, color: priorityText[tarefa.priority] || '#8b8b9e' }}>
                  {priorityLabel[tarefa.priority] || tarefa.priority}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal QR */}
      {showQrModal && <QrModal user={user} onClose={() => { setShowQrModal(false); load(user?.id) }} />}
    </div>
  )
}
