'use client'
import { FileText, Plus, Copy, Eye, Trash2, X, Check, ExternalLink, Share2, BarChart2, Clock } from 'lucide-react'
import { useState } from 'react'

type Field = { label: string; type: string; required: boolean }

type Form = {
  id: string
  name: string
  fields: Field[]
  responses: number
  url: string
  active: boolean
  createdAt: string
}

const FIELD_TYPES = [
  { value: 'text',     label: 'Texto curto',  icon: '✏️' },
  { value: 'textarea', label: 'Texto longo',  icon: '📝' },
  { value: 'phone',    label: 'Telefone',     icon: '📱' },
  { value: 'email',    label: 'E-mail',       icon: '📧' },
  { value: 'select',   label: 'Seleção',      icon: '📋' },
  { value: 'date',     label: 'Data',         icon: '📅' },
  { value: 'number',   label: 'Número',       icon: '🔢' },
]

const DEMO_FORMS: Form[] = [
  {
    id: '1',
    name: 'Ficha de cliente — Maquiagem',
    fields: [
      { label: 'Nome completo', type: 'text', required: true },
      { label: 'WhatsApp', type: 'phone', required: true },
      { label: 'Tipo de pele', type: 'select', required: false },
      { label: 'Alergias', type: 'textarea', required: false },
      { label: 'Data do agendamento', type: 'date', required: true },
      { label: 'Observações', type: 'textarea', required: false },
    ],
    responses: 12,
    url: 'https://glowdesk.app/f/maquiagem',
    active: true,
    createdAt: '2025-01-10',
  },
  {
    id: '2',
    name: 'Orçamento de skincare',
    fields: [
      { label: 'Nome', type: 'text', required: true },
      { label: 'E-mail', type: 'email', required: false },
      { label: 'Principal preocupação com a pele', type: 'select', required: true },
      { label: 'Orçamento disponível', type: 'select', required: false },
    ],
    responses: 5,
    url: 'https://glowdesk.app/f/skincare',
    active: true,
    createdAt: '2025-01-15',
  },
]

export default function FormsPage() {
  const [forms, setForms] = useState<Form[]>(DEMO_FORMS)
  const [copied, setCopied] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [previewForm, setPreviewForm] = useState<Form | null>(null)

  // Modal state
  const [name, setName] = useState('')
  const [fields, setFields] = useState<Field[]>([{ label: '', type: 'text', required: false }])
  const [nameError, setNameError] = useState('')

  function copyLink(url: string, id: string) {
    navigator.clipboard.writeText(url).catch(() => {})
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  function addField() {
    setFields(f => [...f, { label: '', type: 'text', required: false }])
  }

  function removeField(i: number) {
    setFields(f => f.filter((_, idx) => idx !== i))
  }

  function updateField(i: number, key: keyof Field, val: string | boolean) {
    setFields(f => f.map((field, idx) => idx === i ? { ...field, [key]: val } : field))
  }

  function openModal() {
    setName('')
    setFields([{ label: '', type: 'text', required: false }])
    setNameError('')
    setShowModal(true)
  }

  function createForm() {
    if (!name.trim()) { setNameError('Dê um nome ao formulário'); return }
    const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    const newForm: Form = {
      id: Date.now().toString(),
      name: name.trim(),
      fields: fields.filter(f => f.label.trim()),
      responses: 0,
      url: `https://glowdesk.app/f/${slug}`,
      active: true,
      createdAt: new Date().toISOString().split('T')[0],
    }
    setForms(f => [newForm, ...f])
    setShowModal(false)
  }

  function deleteForm(id: string) {
    setForms(f => f.filter(form => form.id !== id))
    setDeleteId(null)
  }

  function toggleActive(id: string) {
    setForms(f => f.map(form => form.id === id ? { ...form, active: !form.active } : form))
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-bold text-lg" style={{ color: '#e8e8f2' }}>Formulários</h1>
          <p className="text-xs mt-0.5" style={{ color: '#5a5a6e' }}>
            {forms.length} formulário{forms.length !== 1 ? 's' : ''} •{' '}
            {forms.reduce((a, f) => a + f.responses, 0)} respostas no total
          </p>
        </div>
        <button onClick={openModal} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Novo formulário
        </button>
      </div>

      {/* Info banner */}
      <div className="card-gradient p-4 flex items-start gap-3">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #6b21a8, #f43f5e)' }}
        >
          <FileText className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold" style={{ color: '#c4b5fd' }}>Como usar formulários</p>
          <p className="text-xs mt-0.5 leading-relaxed" style={{ color: '#8b6fba' }}>
            Copie o link e envie pelo WhatsApp antes do atendimento. As respostas aparecem automaticamente no perfil do contato e a Glow usa essas informações para personalizar o atendimento.
          </p>
        </div>
      </div>

      {/* Forms grid */}
      {forms.length === 0 ? (
        <div className="card p-12 flex flex-col items-center justify-center text-center">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'rgba(255,255,255,0.05)' }}>
            <FileText className="w-7 h-7" style={{ color: '#5a5a6e' }} />
          </div>
          <p className="text-sm font-semibold mb-1" style={{ color: '#8b8b9e' }}>Nenhum formulário ainda</p>
          <p className="text-xs mb-5" style={{ color: '#5a5a6e' }}>Crie seu primeiro formulário para coletar dados dos clientes</p>
          <button onClick={openModal} className="btn-primary flex items-center gap-2 text-sm">
            <Plus className="w-4 h-4" /> Criar primeiro formulário
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {forms.map(form => (
            <div key={form.id} className={`card p-5 flex flex-col gap-4 transition-all ${!form.active ? 'opacity-60' : ''}`}>
              {/* Top */}
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(124,58,237,0.18)' }}>
                  <FileText className="w-5 h-5" style={{ color: '#c4b5fd' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: '#e8e8f2' }}>{form.name}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="flex items-center gap-1 text-[11px]" style={{ color: '#5a5a6e' }}>
                      <BarChart2 className="w-3 h-3" /> {form.responses} respostas
                    </span>
                    <span className="flex items-center gap-1 text-[11px]" style={{ color: '#5a5a6e' }}>
                      <FileText className="w-3 h-3" /> {form.fields.length} campos
                    </span>
                    <span className="flex items-center gap-1 text-[11px]" style={{ color: '#5a5a6e' }}>
                      <Clock className="w-3 h-3" /> {form.createdAt}
                    </span>
                  </div>
                </div>
                {/* Active toggle */}
                <button
                  onClick={() => toggleActive(form.id)}
                  className={`flex-shrink-0 w-8 h-4 rounded-full transition-colors relative`}
                  style={{ background: form.active ? '#7c3aed' : '#d1d5db' }}
                  title={form.active ? 'Desativar' : 'Ativar'}
                >
                  <span
                    className="absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform"
                    style={{ transform: form.active ? 'translateX(16px)' : 'translateX(2px)' }}
                  />
                </button>
              </div>

              {/* URL */}
              <div className="rounded-xl px-3 py-2 flex items-center gap-2" style={{ background: 'rgba(255,255,255,0.04)' }}>
                <ExternalLink className="w-3 h-3 flex-shrink-0" style={{ color: '#5a5a6e' }} />
                <span className="text-[11px] truncate flex-1" style={{ color: '#5a5a6e' }}>{form.url}</span>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => copyLink(form.url, form.id)}
                  className="flex-1 flex items-center justify-center gap-1.5 text-xs py-2 rounded-xl font-medium transition-all"
                  style={copied === form.id
                    ? { background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.25)', color: '#6ee7b7' }
                    : { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#8b8b9e' }
                  }
                >
                  {copied === form.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied === form.id ? 'Copiado!' : 'Copiar link'}
                </button>
                <button
                  onClick={() => setPreviewForm(form)}
                  className="flex-1 flex items-center justify-center gap-1.5 text-xs py-2 rounded-xl font-medium transition-all"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#8b8b9e' }}
                >
                  <Eye className="w-3.5 h-3.5" /> Visualizar
                </button>
                <button
                  onClick={() => setDeleteId(form.id)}
                  className="p-2 rounded-xl transition-all"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#5a5a6e' }}
                  title="Excluir"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Create Modal ─────────────────────────────────────────── */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={e => e.target === e.currentTarget && setShowModal(false)}
        >
          <div className="rounded-2xl w-full max-w-lg flex flex-col max-h-[90vh]" style={{ background: '#16161f', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 24px 80px rgba(0,0,0,0.7)' }}>
            <div className="flex items-center justify-between px-6 py-4 flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <h2 className="font-semibold" style={{ color: '#e8e8f2' }}>Novo formulário</h2>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg transition-colors" style={{ color: '#5a5a6e' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              <div>
                <label className="text-xs font-medium block mb-1.5" style={{ color: '#8b8b9e' }}>
                  Nome do formulário <span style={{ color: '#f87171' }}>*</span>
                </label>
                <input
                  value={name}
                  onChange={e => { setName(e.target.value); setNameError('') }}
                  placeholder="Ex: Ficha de anamnese"
                  className={`input w-full ${nameError ? 'border-red-300 focus:border-red-400' : ''}`}
                  autoFocus
                />
                {nameError && <p className="text-xs text-red-500 mt-1">{nameError}</p>}
              </div>

              {/* Fields */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-xs font-medium" style={{ color: '#8b8b9e' }}>
                    Campos ({fields.length})
                  </label>
                  <button
                    onClick={addField}
                    className="text-xs font-medium flex items-center gap-1 px-2 py-1 rounded-lg transition-colors"
                    style={{ color: '#a78bfa' }}
                  >
                    <Plus className="w-3 h-3" /> Adicionar campo
                  </button>
                </div>

                <div className="space-y-2">
                  {fields.map((field, i) => (
                    <div key={i} className="flex gap-2 items-center rounded-xl p-2" style={{ background: 'rgba(255,255,255,0.03)' }}>
                      <span className="text-xs w-5 text-center flex-shrink-0" style={{ color: '#5a5a6e' }}>{i + 1}</span>
                      <input
                        value={field.label}
                        onChange={e => updateField(i, 'label', e.target.value)}
                        placeholder={`Ex: Nome completo`}
                        className="input flex-1 text-sm py-1.5"
                      />
                      <select
                        value={field.type}
                        onChange={e => updateField(i, 'type', e.target.value)}
                        className="input text-sm py-1.5 w-36 flex-shrink-0"
                      >
                        {FIELD_TYPES.map(t => (
                          <option key={t.value} value={t.value}>{t.icon} {t.label}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => updateField(i, 'required', !field.required)}
                        title={field.required ? 'Obrigatório' : 'Opcional'}
                        className={`text-[10px] px-1.5 py-1 rounded-lg border flex-shrink-0 font-medium transition-colors ${
                          field.required
                            ? 'bg-violet-50 border-violet-200 text-violet-700'
                            : 'bg-white border-gray-200 text-gray-400'
                        }`}
                      >
                        {field.required ? 'Obrig.' : 'Opc.'}
                      </button>
                      {fields.length > 1 && (
                        <button
                          onClick={() => removeField(i)}
                          className="p-1 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 flex-shrink-0"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Share preview */}
              {name.trim() && (
                <div className="rounded-xl p-3" style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.2)' }}>
                  <p className="text-[10px] font-medium uppercase tracking-wide mb-1 flex items-center gap-1" style={{ color: '#8b6fba' }}>
                    <Share2 className="w-3 h-3" /> Link do formulário
                  </p>
                  <p className="text-xs font-mono break-all" style={{ color: '#c4b5fd' }}>
                    https://glowdesk.app/f/{name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-2 px-6 py-4 flex-shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <button onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancelar</button>
              <button
                onClick={createForm}
                className="btn-primary flex-1 flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" /> Criar formulário
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal ─────────────────────────────────── */}
      {deleteId && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={e => e.target === e.currentTarget && setDeleteId(null)}
        >
          <div className="rounded-2xl w-full max-w-sm p-6 text-center" style={{ background: '#16161f', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 24px 80px rgba(0,0,0,0.7)' }}>
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(239,68,68,0.15)' }}>
              <Trash2 className="w-6 h-6" style={{ color: '#f87171' }} />
            </div>
            <h3 className="font-semibold mb-1" style={{ color: '#e8e8f2' }}>Excluir formulário?</h3>
            <p className="text-xs mb-5" style={{ color: '#5a5a6e' }}>Esta ação não pode ser desfeita. As respostas coletadas serão perdidas.</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteId(null)} className="btn-secondary flex-1">Cancelar</button>
              <button
                onClick={() => deleteForm(deleteId)}
                className="flex-1 text-white text-sm font-medium py-2 px-4 rounded-xl transition-colors"
                style={{ background: '#dc2626' }}
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Preview Modal ─────────────────────────────────────────── */}
      {previewForm && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={e => e.target === e.currentTarget && setPreviewForm(null)}
        >
          <div className="rounded-2xl w-full max-w-md flex flex-col max-h-[90vh]" style={{ background: '#16161f', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 24px 80px rgba(0,0,0,0.7)' }}>
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div>
                <h2 className="font-semibold text-sm" style={{ color: '#e8e8f2' }}>{previewForm.name}</h2>
                <p className="text-[11px]" style={{ color: '#5a5a6e' }}>Pré-visualização</p>
              </div>
              <button onClick={() => setPreviewForm(null)} className="p-1.5 rounded-lg transition-colors" style={{ color: '#5a5a6e' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              {previewForm.fields.map((field, i) => (
                <div key={i}>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#8b8b9e' }}>
                    {field.label || `Campo ${i + 1}`}
                    {field.required && <span className="ml-0.5" style={{ color: '#f87171' }}>*</span>}
                  </label>
                  {field.type === 'textarea' ? (
                    <textarea className="input w-full resize-none" rows={3} placeholder="..." disabled />
                  ) : field.type === 'select' ? (
                    <select className="input w-full" disabled><option>Selecione...</option></select>
                  ) : (
                    <input type={field.type === 'phone' ? 'tel' : field.type} className="input w-full" placeholder="..." disabled />
                  )}
                </div>
              ))}
              {previewForm.fields.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-6">Nenhum campo adicionado</p>
              )}
            </div>
            <div className="px-6 py-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <button className="btn-primary w-full opacity-50 cursor-not-allowed" disabled>Enviar</button>
              <p className="text-[10px] text-center mt-2" style={{ color: '#5a5a6e' }}>Pré-visualização — formulário não funcional</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
