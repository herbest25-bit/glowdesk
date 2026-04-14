'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const data = await api.post('/auth/login', { email, password })
      localStorage.setItem('token', data.token)
      localStorage.setItem('user', JSON.stringify(data.user))
      router.push('/overview')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao fazer login')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex" style={{ background: '#09090f' }}>
      {/* Left — Brand Panel */}
      <div
        className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center p-12 text-white relative overflow-hidden"
        style={{ background: 'linear-gradient(155deg, #0f0a1e 0%, #1a0a35 30%, #2d1060 60%, #3d1480 100%)' }}
      >
        {/* Decorative orbs */}
        <div className="absolute top-[-100px] right-[-100px] w-[400px] h-[400px] rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, #7c3aed, transparent 70%)' }} />
        <div className="absolute bottom-[-80px] left-[-80px] w-[300px] h-[300px] rounded-full opacity-15"
          style={{ background: 'radial-gradient(circle, #f43f5e, transparent 70%)' }} />
        <div className="absolute top-1/3 right-1/4 w-[200px] h-[200px] rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #3b82f6, transparent 70%)' }} />

        {/* Grid overlay */}
        <div className="absolute inset-0 opacity-5"
          style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)", backgroundSize: '40px 40px' }} />

        <div className="relative z-10 max-w-sm text-center">
          <div
            className="inline-flex items-center justify-center w-20 h-20 rounded-3xl mb-6"
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.15)',
              boxShadow: '0 0 40px rgba(124,58,237,0.4)',
              backdropFilter: 'blur(10px)',
            }}
          >
            <span className="text-4xl">✨</span>
          </div>

          <h1 className="text-4xl font-bold mb-2 tracking-tight">GlowDesk</h1>
          <p className="text-lg font-medium mb-8" style={{ color: '#c4b5fd' }}>
            Sua consultora de beleza 24h no WhatsApp.
          </p>

          <div className="space-y-3 text-left">
            {[
              { icon: '🤖', title: 'IA que vende por você', desc: 'Glow atende, qualifica e fecha vendas automaticamente' },
              { icon: '📊', title: 'Pipeline estilo Kommo', desc: 'Kanban visual com todos os seus negócios em aberto' },
              { icon: '⚡', title: 'Venda enquanto dorme', desc: 'Atendimento 24h sem precisar estar online' },
            ].map(item => (
              <div
                key={item.title}
                className="flex items-start gap-3 rounded-2xl p-4"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  backdropFilter: 'blur(10px)',
                }}
              >
                <span className="text-2xl flex-shrink-0">{item.icon}</span>
                <div>
                  <p className="font-semibold text-sm">{item.title}</p>
                  <p className="text-xs mt-0.5" style={{ color: '#a78bfa' }}>{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right — Login form */}
      <div className="flex-1 flex flex-col items-center justify-center p-8" style={{ background: '#09090f' }}>
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <div
              className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-3"
              style={{ background: 'linear-gradient(135deg, #6b21a8, #f43f5e)', boxShadow: '0 0 24px rgba(124,58,237,0.4)' }}
            >
              <span className="text-2xl">✨</span>
            </div>
            <h1 className="text-2xl font-bold" style={{ color: '#e8e8f2' }}>GlowDesk</h1>
            <p className="text-sm mt-1" style={{ color: '#5a5a6e' }}>Sua consultora de beleza 24h no WhatsApp.</p>
          </div>

          {/* Card */}
          <div className="card p-8" style={{ background: '#111118', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="mb-6">
              <h2 className="text-xl font-bold" style={{ color: '#e8e8f2' }}>Bem-vinda de volta</h2>
              <p className="text-sm mt-1" style={{ color: '#5a5a6e' }}>Entre para acessar seu painel</p>
            </div>

            {error && (
              <div className="text-sm rounded-xl px-4 py-3 mb-4" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#fca5a5' }}>
                {error}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: '#8b8b9e' }}>Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="input"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: '#8b8b9e' }}>Senha</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input"
                  required
                />
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full py-2.5 mt-2">
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                    </svg>
                    Entrando...
                  </span>
                ) : 'Entrar'}
              </button>
            </form>
          </div>

          <p className="text-center text-xs mt-6" style={{ color: '#3a3a50' }}>
            GlowDesk © 2025 &mdash; Powered by Claude AI ✨
          </p>
        </div>
      </div>
    </div>
  )
}
