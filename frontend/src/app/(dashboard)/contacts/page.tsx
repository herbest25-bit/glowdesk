'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { Users, Search, Phone } from 'lucide-react'
import { Tooltip } from '@/components/ui/Tooltip'

type Contact = {
  id: string
  name: string
  phone: string
  email?: string
  tags: string[]
  lead_score: number
  purchase_count: number
  total_spent: number
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadContacts() }, [search])

  async function loadContacts() {
    try {
      const data = await api.get(`/api/contacts?search=${search}&limit=50`)
      setContacts(data.contacts)
    } catch {
      setContacts([])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-semibold" style={{ color: '#e8e8f2' }}>Contatos</h1>
          <p className="text-xs mt-0.5" style={{ color: '#5a5a6e' }}>{contacts.length} contatos</p>
        </div>
        <Tooltip text="Os contatos são criados automaticamente quando um cliente envia a primeira mensagem no WhatsApp. Você não precisa cadastrar manualmente." position="left" />
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#5a5a6e' }} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nome ou telefone..."
          className="input pl-9 max-w-md"
        />
      </div>

      {loading ? (
        <div className="text-center py-12 text-sm" style={{ color: '#5a5a6e' }}>Carregando...</div>
      ) : contacts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16" style={{ color: '#5a5a6e' }}>
          <Users className="w-10 h-10 mb-3 opacity-20" />
          <p className="text-sm">Nenhum contato encontrado</p>
          <p className="text-xs mt-1">Os contatos aparecem automaticamente quando clientes enviam mensagens</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-left" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <th className="px-4 py-3 font-medium" style={{ color: '#5a5a6e' }}>Nome</th>
                  <th className="px-4 py-3 font-medium" style={{ color: '#5a5a6e' }}>Telefone</th>
                  <th className="px-4 py-3 font-medium" style={{ color: '#5a5a6e' }}>Etiquetas</th>
                  <th className="px-4 py-3 text-right font-medium" style={{ color: '#5a5a6e' }}>
                    <div className="flex items-center justify-end gap-1">
                      Score
                      <Tooltip text="Lead Score: pontuação de 0 a 100 calculada pela Glow com base no interesse demonstrado pelo cliente. Acima de 70 = cliente quente." position="bottom" />
                    </div>
                  </th>
                  <th className="px-4 py-3 text-right font-medium" style={{ color: '#5a5a6e' }}>
                    <div className="flex items-center justify-end gap-1">
                      Compras
                      <Tooltip text="Número de compras confirmadas registradas para este contato." position="bottom" />
                    </div>
                  </th>
                  <th className="px-4 py-3 text-right font-medium" style={{ color: '#5a5a6e' }}>
                    <div className="flex items-center justify-end gap-1">
                      Total gasto
                      <Tooltip text="Valor total em compras feitas por este cliente na sua loja." position="left" />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {contacts.map(c => (
                  <tr
                    key={c.id}
                    className="transition-colors"
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.025)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-medium flex-shrink-0"
                          style={{ background: 'linear-gradient(135deg, #7c3aed, #ec4899)' }}
                        >
                          {c.name?.[0]?.toUpperCase() || c.phone?.[0]}
                        </div>
                        <span className="font-medium" style={{ color: '#e8e8f2' }}>{c.name || '—'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1" style={{ color: '#8b8b9e' }}>
                        <Phone className="w-3 h-3" />{c.phone}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {c.tags?.slice(0, 3).map(tag => (
                          <span key={tag} className="badge text-xs" style={{ background: 'rgba(124,58,237,0.2)', color: '#c4b5fd' }}>{tag}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className="badge text-xs"
                        style={
                          c.lead_score >= 70
                            ? { background: 'rgba(16,185,129,0.2)', color: '#6ee7b7' }
                            : c.lead_score >= 40
                            ? { background: 'rgba(245,158,11,0.2)', color: '#fcd34d' }
                            : { background: 'rgba(107,107,120,0.2)', color: '#8b8b9e' }
                        }
                      >
                        {c.lead_score}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right" style={{ color: '#8b8b9e' }}>{c.purchase_count}</td>
                    <td className="px-4 py-3 text-right" style={{ color: '#8b8b9e' }}>
                      R$ {Number(c.total_spent || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
