'use client'
import { useEffect, useState } from 'react'
import { User, Save, Check } from 'lucide-react'

export default function ColaboradorConfiguracoesPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') || '{}')
    setName(user.name || '')
    setEmail(user.email || '')
  }, [])

  function handleSave() {
    const user = JSON.parse(localStorage.getItem('user') || '{}')
    localStorage.setItem('user', JSON.stringify({ ...user, name, email }))
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div className="p-6 max-w-xl mx-auto space-y-6">
      <div>
        <h1 className="font-bold text-lg" style={{ color: '#e8e8f2' }}>Configurações</h1>
        <p className="text-xs mt-0.5" style={{ color: '#5a5a6e' }}>Seus dados de perfil</p>
      </div>

      <div className="card p-6 space-y-4">
        <h2 className="font-semibold flex items-center gap-2" style={{ color: '#e8e8f2' }}>
          <User className="w-4 h-4" style={{ color: '#a78bfa' }} /> Perfil
        </h2>
        <div>
          <label className="block text-sm font-semibold mb-1.5" style={{ color: '#8b8b9e' }}>Nome</label>
          <input value={name} onChange={e => setName(e.target.value)} className="input" />
        </div>
        <div>
          <label className="block text-sm font-semibold mb-1.5" style={{ color: '#8b8b9e' }}>Email</label>
          <input value={email} type="email" onChange={e => setEmail(e.target.value)} className="input" />
        </div>
        <div>
          <label className="block text-sm font-semibold mb-1.5" style={{ color: '#8b8b9e' }}>Nova senha</label>
          <input type="password" placeholder="Deixe em branco para não alterar" className="input" />
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={handleSave} className="btn-primary flex items-center gap-2">
          {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saved ? 'Salvo!' : 'Salvar alterações'}
        </button>
      </div>
    </div>
  )
}
