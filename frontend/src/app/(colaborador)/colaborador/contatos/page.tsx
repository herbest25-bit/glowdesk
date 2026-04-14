'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { Users, Search, RefreshCw, Phone, MessageSquare } from 'lucide-react'

type Contato = {
  id: string
  name?: string
  phone: string
  email?: string
  tags?: string[]
  created_at: string
}

export default function ColaboradorContatosPage() {
  const [contatos, setContatos] = useState<Contato[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const data = await api.get('/api/contacts?limit=100')
      setContatos(data.contacts || [])
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  const filtered = contatos.filter(c =>
    (c.name || c.phone).toLowerCase().includes(search.toLowerCase()) ||
    c.phone.includes(search)
  )

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-bold text-lg" style={{ color: '#e8e8f2' }}>Meus Contatos</h1>
          <p className="text-xs mt-0.5" style={{ color: '#5a5a6e' }}>{filtered.length} contato(s)</p>
        </div>
        <button onClick={load} className="p-2 rounded-lg transition-colors" style={{ color: '#5a5a6e' }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#5a5a6e' }} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar contato..." className="input pl-9" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Users className="w-10 h-10 mx-auto mb-3 opacity-20" style={{ color: '#8b8b9e' }} />
          <p className="text-sm" style={{ color: '#5a5a6e' }}>Nenhum contato encontrado</p>
        </div>
      ) : (
        <div className="card divide-y" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
          {filtered.map(contato => (
            <div
              key={contato.id}
              className="flex items-center gap-3 px-5 py-4 transition-colors"
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #6b21a8, #f43f5e)' }}
              >
                {(contato.name?.[0] || contato.phone[0] || '?').toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium" style={{ color: '#e8e8f2' }}>
                  {contato.name || 'Sem nome'}
                </p>
                <div className="flex items-center gap-1 mt-0.5">
                  <Phone className="w-3 h-3" style={{ color: '#5a5a6e' }} />
                  <p className="text-xs" style={{ color: '#5a5a6e' }}>{contato.phone}</p>
                </div>
              </div>
              {contato.tags && contato.tags.length > 0 && (
                <div className="flex gap-1 flex-wrap justify-end max-w-[120px]">
                  {contato.tags.slice(0, 2).map(tag => (
                    <span key={tag} className="badge text-[10px]" style={{ background: 'rgba(124,58,237,0.15)', color: '#c4b5fd' }}>
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
