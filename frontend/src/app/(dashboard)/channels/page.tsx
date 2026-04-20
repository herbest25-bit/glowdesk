'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { api } from '@/lib/api'
import { getSocket } from '@/lib/socket'
import {
  Phone, Plus, X, CheckCircle, XCircle, Wifi, WifiOff,
  RefreshCw, Trash2, Edit2, Check, RotateCcw
} from 'lucide-react'

type Channel = {
  id: string
  name: string
  phone_number: string | null
  status: 'connected' | 'disconnected' | 'connecting'
  connected_at: string | null
  created_at: string
}

type Step = 'name' | 'qrcode' | 'done'

function timeAgo(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function ChannelsPage() {
  const [channels, setChannels] = useState<Channel[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [step, setStep] = useState<Step>('name')
  const [channelName, setChannelName] = useState('')
  const [creatingId, setCreatingId] = useState<string | null>(null)
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [qrExpiry, setQrExpiry] = useState(60)
  const [connectedChannel, setConnectedChannel] = useState<Channel | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)
  const creatingIdRef = useRef<string | null>(null)
  const [reconnectingId, setReconnectingId] = useState<string | null>(null)
  const [qrTimeout, setQrTimeout] = useState(false)

  const load = useCallback(async () => {
    try {
      const data = await api.get('/api/channels')
      setChannels(data.channels || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  const channelNameRef = useRef(channelName)
  useEffect(() => { channelNameRef.current = channelName }, [channelName])

  useEffect(() => {
    load()
    const user = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('user') || '{}') : {}
    const socket = getSocket(user.workspaceId)

    // Handlers usam refs para evitar re-registro (que causa janela de perda de evento)
    function onQR({ channelId, qrcode }: { channelId: string; qrcode: string }) {
      console.log('[Socket] channel_qrcode recebido, channelId:', channelId, 'esperado:', creatingIdRef.current)
      setQrCode(qrcode)
      setQrExpiry(60)
      setRefreshing(false)
      setStartError(null)
    }
    function onConnected({ channelId, phone }: { channelId: string; phone: string }) {
      if (channelId !== creatingIdRef.current) return
      setConnectedChannel({ id: channelId, name: channelNameRef.current, phone_number: phone, status: 'connected', connected_at: new Date().toISOString(), created_at: new Date().toISOString() })
      setStep('done')
      load()
    }
    function onError({ channelId, error }: { channelId: string; error: string }) {
      if (channelId !== creatingIdRef.current) return
      setStartError(`Falha ao iniciar: ${error}. Tente novamente.`)
      setStep('name')
      load()
    }

    socket.on('channel_qrcode', onQR)
    socket.on('channel_connected', onConnected)
    socket.on('channel_error', onError)
    return () => {
      socket.off('channel_qrcode', onQR)
      socket.off('channel_connected', onConnected)
      socket.off('channel_error', onError)
    }
  }, [load])

  useEffect(() => {
    if (step !== 'qrcode') return
    setQrTimeout(false)

    // Polling HTTP como fallback caso socket não entregue o QR
    const pollInterval = setInterval(async () => {
      if (qrCode || !creatingIdRef.current) return
      try {
        const d = await api.get(`/api/channels/${creatingIdRef.current}/qr-poll`) as any
        if (d.qrcode) {
          setQrCode(d.qrcode)
          setQrExpiry(60)
          setRefreshing(false)
          setStartError(null)
        }
      } catch {}
    }, 3000)

    // Timeout de 90s: se QR não aparecer, mostrar erro
    const timeoutId = setTimeout(() => {
      if (!qrCode) setQrTimeout(true)
    }, 90_000)

    const t = setInterval(() => {
      setQrExpiry(e => {
        if (e <= 1) { refreshQr(); return 60 }
        return e - 1
      })
    }, 1000)
    return () => { clearInterval(t); clearTimeout(timeoutId); clearInterval(pollInterval) }
  }, [step])

  async function startChannel() {
    if (!channelName.trim()) return
    setStarting(true)
    setStartError(null)
    try {
      const data = await api.post('/api/channels', { name: channelName.trim() })
      setCreatingId(data.channel.id)
      creatingIdRef.current = data.channel.id
      setStep('qrcode')
      setQrCode(null)
      await api.get(`/api/channels/${data.channel.id}/qrcode`)
    } catch (e: unknown) {
      setStartError(e instanceof Error ? e.message : 'Erro ao criar canal')
    } finally {
      setStarting(false)
    }
  }

  async function refreshQr() {
    if (!creatingIdRef.current) return
    setRefreshing(true)
    setQrCode(null)
    try {
      await api.get(`/api/channels/${creatingIdRef.current}/qrcode`)
    } catch (e) {
      console.error(e)
      setRefreshing(false)
    }
  }

  async function reconnectChannel(ch: Channel) {
    setReconnectingId(ch.id)
    setCreatingId(ch.id)
    creatingIdRef.current = ch.id
    setChannelName(ch.name)
    setQrCode(null)
    setQrExpiry(60)
    setStep('qrcode')
    setShowModal(true)
    try {
      await api.get(`/api/channels/${ch.id}/qrcode`)
    } catch (e) {
      console.error(e)
    } finally {
      setReconnectingId(null)
    }
  }

  async function deleteChannel(id: string) {
    if (!confirm('Desconectar e remover este canal?')) return
    try {
      await api.delete(`/api/channels/${id}`)
      setChannels(c => c.filter(ch => ch.id !== id))
    } catch (e) { console.error(e) }
  }

  async function saveEdit(id: string) {
    if (!editingName.trim()) return
    try {
      await api.patch(`/api/channels/${id}`, { name: editingName.trim() })
      setChannels(c => c.map(ch => ch.id === id ? { ...ch, name: editingName.trim() } : ch))
      setEditingId(null)
    } catch (e) { console.error(e) }
  }

  function closeModal() {
    setShowModal(false)
    setStep('name')
    setChannelName('')
    setCreatingId(null)
    setQrCode(null)
    setQrExpiry(60)
    setConnectedChannel(null)
    setStartError(null)
    setStarting(false)
  }

  const statusStyle = (status: Channel['status']) => {
    if (status === 'connected')  return { bg: 'rgba(16,185,129,0.18)',  text: '#6ee7b7', icon: <Wifi className="w-5 h-5" style={{ color: '#6ee7b7' }} /> }
    if (status === 'connecting') return { bg: 'rgba(245,158,11,0.18)', text: '#fcd34d', icon: <RefreshCw className="w-5 h-5 animate-spin" style={{ color: '#fcd34d' }} /> }
    return { bg: 'rgba(107,107,120,0.2)', text: '#8b8b9e', icon: <WifiOff className="w-5 h-5" style={{ color: '#5a5a6e' }} /> }
  }

  const badgeStyle = (status: Channel['status']) => {
    if (status === 'connected')  return { bg: 'rgba(16,185,129,0.2)',  color: '#6ee7b7' }
    if (status === 'connecting') return { bg: 'rgba(245,158,11,0.2)', color: '#fcd34d' }
    return { bg: 'rgba(107,107,120,0.15)', color: '#5a5a6e' }
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-bold text-lg" style={{ color: '#e8e8f2' }}>Canais de Atendimento</h1>
          <p className="text-xs mt-0.5" style={{ color: '#5a5a6e' }}>Conecte múltiplos números de WhatsApp ao GlowDesk</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Adicionar canal
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-7 h-7 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : channels.length === 0 ? (
        <div className="card p-12 text-center">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: 'rgba(124,58,237,0.18)' }}
          >
            <Phone className="w-7 h-7" style={{ color: '#a78bfa' }} />
          </div>
          <h3 className="text-sm font-semibold mb-1" style={{ color: '#e8e8f2' }}>Nenhum canal conectado ainda</h3>
          <p className="text-xs mb-5 max-w-xs mx-auto" style={{ color: '#5a5a6e' }}>
            Adicione um número de WhatsApp para começar a receber atendimentos pela Glow.
          </p>
          <button onClick={() => setShowModal(true)} className="btn-primary inline-flex items-center gap-2">
            <Plus className="w-4 h-4" /> Adicionar primeiro canal
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {channels.map(ch => {
            const ss = statusStyle(ch.status)
            const bs = badgeStyle(ch.status)
            return (
              <div key={ch.id} className="card p-5 flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: ss.bg }}>
                  {ss.icon}
                </div>

                <div className="flex-1 min-w-0">
                  {editingId === ch.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        className="input text-sm py-1 flex-1"
                        value={editingName}
                        onChange={e => setEditingName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && saveEdit(ch.id)}
                        autoFocus
                      />
                      <button onClick={() => saveEdit(ch.id)} className="p-1.5 rounded-lg transition-colors" style={{ background: 'rgba(124,58,237,0.2)', color: '#c4b5fd' }}>
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setEditingId(null)} className="p-1.5 rounded-lg transition-colors" style={{ color: '#5a5a6e' }}>
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <p className="text-sm font-semibold" style={{ color: '#e8e8f2' }}>{ch.name}</p>
                  )}
                  <div className="flex items-center gap-3 mt-0.5">
                    {ch.phone_number && (
                      <span className="text-xs" style={{ color: '#5a5a6e' }}>+{ch.phone_number}</span>
                    )}
                    <span className="badge text-[10px] flex items-center gap-1" style={{ background: bs.bg, color: bs.color }}>
                      {ch.status === 'connected'  ? <><CheckCircle className="w-2.5 h-2.5" /> Conectado</> :
                       ch.status === 'connecting' ? <>Conectando...</> :
                       <><XCircle className="w-2.5 h-2.5" /> Desconectado</>}
                    </span>
                    {ch.connected_at && (
                      <span className="text-[10px]" style={{ color: '#3a3a50' }}>desde {timeAgo(ch.connected_at)}</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => reconnectChannel(ch)}
                    disabled={reconnectingId === ch.id}
                    className="p-2 rounded-lg transition-colors"
                    style={{ color: '#5a5a6e' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(16,185,129,0.12)'; (e.currentTarget as HTMLElement).style.color = '#6ee7b7' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ''; (e.currentTarget as HTMLElement).style.color = '#5a5a6e' }}
                    title="Reconectar"
                  >
                    <RotateCcw className={`w-3.5 h-3.5 ${reconnectingId === ch.id ? 'animate-spin' : ''}`} />
                  </button>
                  <button
                    onClick={() => { setEditingId(ch.id); setEditingName(ch.name) }}
                    className="p-2 rounded-lg transition-colors"
                    style={{ color: '#5a5a6e' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(124,58,237,0.12)'; (e.currentTarget as HTMLElement).style.color = '#a78bfa' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ''; (e.currentTarget as HTMLElement).style.color = '#5a5a6e' }}
                    title="Renomear"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => deleteChannel(ch.id)}
                    className="p-2 rounded-lg transition-colors"
                    style={{ color: '#5a5a6e' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.12)'; (e.currentTarget as HTMLElement).style.color = '#f87171' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ''; (e.currentTarget as HTMLElement).style.color = '#5a5a6e' }}
                    title="Remover canal"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
          onClick={closeModal}
        >
          <div
            className="rounded-2xl w-full max-w-md overflow-hidden"
            style={{ background: '#16161f', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 24px 80px rgba(0,0,0,0.7)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div>
                <h2 className="font-semibold" style={{ color: '#e8e8f2' }}>
                  {step === 'name'   ? 'Novo canal de atendimento' :
                   step === 'qrcode' ? 'Escaneie o QR Code' :
                   'Canal conectado!'}
                </h2>
                <div className="flex items-center gap-2 mt-2">
                  {(['name', 'qrcode', 'done'] as Step[]).map((s, i) => (
                    <div
                      key={s}
                      className="h-1 rounded-full transition-all"
                      style={{
                        width: step === s ? '32px' : '16px',
                        background: i <= (['name','qrcode','done'].indexOf(step)) ? '#7c3aed' : 'rgba(255,255,255,0.1)',
                      }}
                    />
                  ))}
                </div>
              </div>
              <button
                onClick={closeModal}
                className="p-1.5 rounded-lg transition-colors"
                style={{ color: '#5a5a6e' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Step 1 */}
            {step === 'name' && (
              <div className="p-5 space-y-4">
                <p className="text-xs" style={{ color: '#5a5a6e' }}>Dê um nome para identificar este canal (ex: &quot;Vendas&quot;, &quot;Suporte&quot;).</p>
                <div>
                  <label className="text-xs font-medium block mb-1.5" style={{ color: '#8b8b9e' }}>Nome do canal</label>
                  <input
                    className="input w-full"
                    placeholder="Ex: Atendimento Vendas"
                    value={channelName}
                    onChange={e => setChannelName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && startChannel()}
                    autoFocus
                  />
                </div>
                {startError && (
                  <div className="text-xs rounded-lg px-3 py-2" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#fca5a5' }}>
                    {startError}
                  </div>
                )}
                <div className="flex gap-2 pt-1">
                  <button onClick={closeModal} className="btn-secondary flex-1">Cancelar</button>
                  <button
                    onClick={startChannel}
                    disabled={!channelName.trim() || starting}
                    className="btn-primary flex-1 flex items-center justify-center gap-2"
                  >
                    {starting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                    {starting ? 'Criando...' : 'Continuar'}
                  </button>
                </div>
              </div>
            )}

            {/* Step 2 */}
            {step === 'qrcode' && (
              <div className="p-5 space-y-4 text-center">
                <p className="text-xs leading-relaxed" style={{ color: '#8b8b9e' }}>
                  Abra o WhatsApp no celular → <strong style={{ color: '#e8e8f2' }}>Configurações</strong> → <strong style={{ color: '#e8e8f2' }}>Aparelhos Conectados</strong> → <strong style={{ color: '#e8e8f2' }}>Conectar Aparelho</strong> → escaneie o QR Code abaixo.
                </p>

                <div className="flex items-center justify-center">
                  {qrTimeout && !qrCode ? (
                    <div className="w-52 h-52 rounded-xl flex flex-col items-center justify-center gap-3 text-center px-4"
                      style={{ border: '2px dashed rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.06)' }}>
                      <p className="text-sm font-medium" style={{ color: '#fca5a5' }}>Falha ao iniciar</p>
                      <p className="text-xs" style={{ color: '#8b6fba' }}>O servidor demorou demais. Tente novamente.</p>
                      <button onClick={refreshQr} className="text-xs px-3 py-1.5 rounded-lg" style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171' }}>
                        Tentar novamente
                      </button>
                    </div>
                  ) : qrCode ? (
                    <div className="relative">
                      <img src={qrCode} alt="QR Code" className="w-52 h-52 rounded-xl" style={{ border: '1px solid rgba(255,255,255,0.08)' }} />
                      <div
                        className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full px-3 py-0.5 text-[10px] whitespace-nowrap"
                        style={{ background: '#1c1c27', border: '1px solid rgba(255,255,255,0.1)', color: '#8b8b9e' }}
                      >
                        Expira em {qrExpiry}s
                      </div>
                    </div>
                  ) : (
                    <div
                      className="w-52 h-52 rounded-xl flex items-center justify-center"
                      style={{ border: '2px dashed rgba(124,58,237,0.3)', background: 'rgba(124,58,237,0.06)' }}
                    >
                      <div className="text-center px-4">
                        <div className="w-10 h-10 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" style={{ borderWidth: 3, borderStyle: 'solid' }} />
                        <p className="text-sm font-medium mb-1" style={{ color: '#c4b5fd' }}>Iniciando WhatsApp...</p>
                        <p className="text-xs" style={{ color: '#8b6fba' }}>Aguarde ~30 segundos enquanto o sistema prepara a conexão</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 p-3 rounded-xl" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}>
                  <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse flex-shrink-0" />
                  <p className="text-xs" style={{ color: '#fcd34d' }}>Aguardando conexão...</p>
                </div>

                <button
                  onClick={refreshQr}
                  disabled={refreshing}
                  className="text-xs flex items-center gap-1 mx-auto px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                  style={{ color: '#a78bfa' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(124,58,237,0.1)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}
                >
                  <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
                  {refreshing ? 'Gerando...' : 'Atualizar QR Code'}
                </button>
              </div>
            )}

            {/* Step 3 */}
            {step === 'done' && connectedChannel && (
              <div className="p-5 space-y-4 text-center">
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center mx-auto"
                  style={{ background: 'rgba(16,185,129,0.18)' }}
                >
                  <CheckCircle className="w-8 h-8" style={{ color: '#6ee7b7' }} />
                </div>
                <div>
                  <h3 className="font-semibold" style={{ color: '#e8e8f2' }}>Canal conectado com sucesso!</h3>
                  <p className="text-xs mt-1" style={{ color: '#8b8b9e' }}>
                    <strong style={{ color: '#e8e8f2' }}>{connectedChannel.name}</strong> está ativo e pronto para receber atendimentos.
                  </p>
                  {connectedChannel.phone_number && (
                    <p className="text-xs mt-1" style={{ color: '#5a5a6e' }}>Número: +{connectedChannel.phone_number}</p>
                  )}
                </div>
                <button onClick={closeModal} className="btn-primary w-full">
                  Concluir
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
