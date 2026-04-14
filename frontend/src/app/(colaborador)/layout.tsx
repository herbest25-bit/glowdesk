'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Home, MessageSquare, Kanban, Users, CheckSquare,
  Settings, LogOut, Sparkles, Power, Loader2, Bot
} from 'lucide-react'
import { Tooltip } from '@/components/ui/Tooltip'

const navItems = [
  { href: '/colaborador',          icon: Home,          label: 'Meu Painel',         exact: true,  tooltip: 'Visão geral das suas métricas e tarefas do dia.' },
  { href: '/colaborador/inbox',    icon: MessageSquare, label: 'Minhas Conversas',   exact: false, tooltip: 'Conversas atribuídas a você.' },
  { href: '/colaborador/pipeline', icon: Kanban,        label: 'Meu Pipeline',       exact: false, tooltip: 'Seus negócios em andamento.' },
  { href: '/colaborador/contatos', icon: Users,         label: 'Meus Contatos',      exact: false, tooltip: 'Contatos gerenciados por você.' },
  { href: '/colaborador/tarefas',  icon: CheckSquare,   label: 'Minhas Tarefas',     exact: false, tooltip: 'Tarefas atribuídas a você.' },
]

function ColaboradorSidebar() {
  const pathname = usePathname()
  const [glowActive, setGlowActive] = useState(true)
  const [toggling, setToggling] = useState(false)

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
    if (!token) return
    fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/glow`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setGlowActive(d.active) })
      .catch(() => {})
  }, [])

  async function toggleGlow() {
    setToggling(true)
    const next = !glowActive
    setGlowActive(next)
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
      await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/glow`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ active: next })
      })
    } catch {
      setGlowActive(!next)
    }
    setToggling(false)
  }

  function handleLogout() {
    localStorage.clear()
    window.location.href = '/login'
  }

  return (
    <aside
      className="w-60 h-screen flex flex-col flex-shrink-0"
      style={{
        background: 'rgba(11,11,18,0.97)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderRight: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* Logo */}
      <div className="px-4 py-5 flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #6b21a8, #7c3aed, #f43f5e)', boxShadow: '0 0 16px rgba(124,58,237,0.4)' }}
          >
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <span className="font-bold text-sm tracking-tight" style={{ color: '#e8e8f2' }}>GlowDesk</span>
            <p className="text-xs font-medium" style={{ color: '#5a5a6e' }}>Área do Colaborador</p>
          </div>
        </div>
      </div>

      {/* Nav label */}
      <div className="px-4 pt-5 pb-1 flex-shrink-0">
        <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: '#3a3a50' }}>Menu</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 pb-3 space-y-0.5">
        {navItems.map(({ href, icon: Icon, label, tooltip, exact }) => {
          const isActive = exact ? pathname === href : pathname.startsWith(href)
          return (
            <Link key={href} href={href}>
              <div className={`sidebar-item ${isActive ? 'active' : ''}`}>
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1">{label}</span>
                <Tooltip text={tooltip} position="right" />
              </div>
            </Link>
          )
        })}
      </nav>

      {/* Glow status */}
      <div
        className="mx-3 mb-3 p-3 rounded-2xl flex-shrink-0"
        style={glowActive
          ? { background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.25)' }
          : { background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }
        }
      >
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${glowActive ? 'bg-emerald-400 glow-pulse' : 'bg-red-400'}`} />
            <span className="text-xs font-semibold" style={{ color: glowActive ? '#c4b5fd' : '#fca5a5' }}>
              {glowActive ? 'Glow ativa' : 'Glow pausada'}
            </span>
          </div>
          <button
            onClick={toggleGlow}
            disabled={toggling}
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors flex-shrink-0"
            style={glowActive
              ? { background: 'rgba(124,58,237,0.2)', color: '#a78bfa' }
              : { background: 'rgba(239,68,68,0.15)', color: '#fca5a5' }
            }
          >
            {toggling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Power className="w-3.5 h-3.5" />}
          </button>
        </div>
        <p className="text-[10px] leading-relaxed" style={{ color: glowActive ? '#8b6fba' : '#f87171' }}>
          {glowActive ? 'Atendendo clientes automaticamente' : 'Atendimento automático pausado'}
        </p>
      </div>

      {/* Footer */}
      <div className="p-3 flex-shrink-0 space-y-0.5" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <Link href="/colaborador/configuracoes">
          <div className={`sidebar-item ${pathname.startsWith('/colaborador/configuracoes') ? 'active' : ''}`}>
            <Settings className="w-4 h-4" />
            <span>Configurações</span>
          </div>
        </Link>
        <button
          onClick={handleLogout}
          className="sidebar-item w-full text-left"
          style={{ color: '#ef4444' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.1)'; (e.currentTarget as HTMLElement).style.color = '#f87171' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ''; (e.currentTarget as HTMLElement).style.color = '#ef4444' }}
        >
          <LogOut className="w-4 h-4" />
          <span>Sair</span>
        </button>
      </div>
    </aside>
  )
}

export default function ColaboradorLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('token')
    const user = JSON.parse(localStorage.getItem('user') || '{}')
    if (!token) {
      router.replace('/login')
    } else {
      setReady(true)
    }
  }, [])

  if (!ready) return (
    <div className="flex h-screen items-center justify-center" style={{ background: '#09090f' }}>
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm" style={{ color: '#8b8b9e' }}>Carregando...</p>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#09090f' }}>
      <ColaboradorSidebar />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
