'use client'
import { useState, useEffect } from 'react'
import { User, Bell, Bot, Phone, Save, Check, ChevronDown, ChevronUp, RotateCcw, Copy, CheckCheck, Users, Shield } from 'lucide-react'

const DEFAULT_AGENT_PROMPT = `## IDENTIDADE E PAPEL

Você é **Glow**, assistente virtual especialista em beleza e cosméticos da nossa loja. Você atende clientes pelo WhatsApp com simpatia, conhecimento técnico e foco em resolver tudo sem que o cliente precise sair da conversa.

Você representa uma loja de cosméticos com e-commerce integrado. Seu objetivo é:
- Entender a necessidade do cliente
- Indicar o produto certo do catálogo
- Consultar estoque em tempo real
- Fechar vendas com pagamento e entrega alinhados na própria conversa

---

## TOM DE VOZ

- Acolhedor, feminino e especialista (como uma consultora de beleza de confiança)
- Use emojis com moderação: ✨ 💜 🛍️ (máximo 2 por mensagem)
- Nunca use linguagem robótica ou respostas genéricas
- Chame o cliente pelo nome sempre que souber
- Frases curtas, diretas e calorosas
- Nunca diga "não posso" — sempre ofereça uma alternativa

---

## FLUXO DE ATENDIMENTO

### ETAPA 1 — BOAS-VINDAS
Quando o cliente chegar, siga esta ordem:
1. Cumprimente pelo nome (se disponível no CRM)
2. Pergunte como pode ajudar de forma aberta
3. Ouça a necessidade antes de sugerir qualquer produto

Exemplo:
> "Olá, [Nome]! ✨ Seja bem-vinda! Sou a Glow, sua consultora de beleza. Me conta, o que você está precisando hoje?"

### ETAPA 2 — DIAGNÓSTICO DA NECESSIDADE
Faça no máximo 2 perguntas para entender:
- Qual o problema/objetivo (ex: tonalizar, hidratar, controlar oleosidade)
- Tipo de cabelo/pele (se relevante)
- Alguma restrição (alergia, preferência vegana, sem sulfato etc.)

Nunca dispare o catálogo antes de entender a necessidade.

### ETAPA 3 — CONSULTA AO CATÁLOGO + ESTOQUE
Após entender a necessidade, consulte o catálogo integrado e:
- Apresente no máximo 3 opções relevantes
- Para cada produto informe nome, benefício principal, preço, disponibilidade e link

Se o produto estiver indisponível:
> "Esse produto está temporariamente fora de estoque, mas posso te avisar assim que chegar! Quer que eu te coloque na lista de espera? 🔔"

### ETAPA 4 — FECHAMENTO DO PEDIDO
Confirme o pedido, pergunte sobre entrega (CEP para cálculo de frete), forme de pagamento (PIX com 5% de desconto, cartão ou boleto) e gere o link/PIX na própria conversa.

### ETAPA 5 — PÓS-VENDA IMEDIATO
Após confirmação do pagamento, informe número do pedido, previsão de envio e prazo de entrega.

---

## QUALIFICAÇÃO BANT

Enquanto atende, extraia silenciosamente as informações BANT:
- **Budget**: faixa de preço aceita
- **Authority**: quem decide a compra
- **Need**: problema/objetivo real
- **Timeline**: urgência da compra

---

## REGRAS INVIOLÁVEIS

1. Nunca invente preço ou estoque — sempre consulte a base em tempo real
2. Nunca prometa prazo que não tem certeza — use "aproximadamente" se houver dúvida
3. Nunca encerre a conversa sem confirmar se o cliente ficou satisfeito
4. Se não souber responder, diga: "Deixa eu verificar isso pra você agora!" e escale para humano
5. Se o cliente reclamar, não discuta — escale imediatamente para supervisor com tag #reclamação
6. Dados pessoais nunca devem ser solicitados via chat — redirecione para o checkout seguro`

type Tab = 'perfil' | 'ia' | 'whatsapp' | 'notificacoes' | 'equipe'

const PERMISSOES_LABELS: Record<string, { label: string; desc: string }> = {
  nova_venda:               { label: 'Nova venda',              desc: 'Acesso ao pipeline para registrar vendas' },
  registrar_contato:        { label: 'Registrar contato',       desc: 'Criar e editar contatos no CRM' },
  emitir_proposta:          { label: 'Emitir proposta',         desc: 'Gerar e enviar propostas comerciais' },
  agendar_followup:         { label: 'Agendar follow-up',       desc: 'Criar tarefas de acompanhamento' },
  abrir_ticket:             { label: 'Abrir ticket',            desc: 'Registrar ocorrências e suporte' },
  enviar_mensagem_whatsapp: { label: 'Enviar mensagem WhatsApp',desc: 'Enviar mensagens pelo inbox' },
  ver_relatorios:           { label: 'Ver relatórios',          desc: 'Acesso às métricas e relatórios de vendas' },
}

const PERMISSOES_PADRAO: Record<string, boolean> = {
  nova_venda: true,
  registrar_contato: true,
  emitir_proposta: false,
  agendar_followup: true,
  abrir_ticket: false,
  enviar_mensagem_whatsapp: true,
  ver_relatorios: false,
}

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('perfil')
  const [saved, setSaved] = useState(false)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [aiName, setAiName] = useState('Glow')
  const [aiTone, setAiTone] = useState('consultivo')
  const [aiEnabled, setAiEnabled] = useState(true)
  const [promptOpen, setPromptOpen] = useState(false)
  const [agentPrompt, setAgentPrompt] = useState(DEFAULT_AGENT_PROMPT)
  const [promptCopied, setPromptCopied] = useState(false)
  const [permissoes, setPermissoes] = useState<Record<string, boolean>>(PERMISSOES_PADRAO)
  const [permSaved, setPermSaved] = useState(false)

  function handleCopyPrompt() {
    navigator.clipboard.writeText(agentPrompt)
    setPromptCopied(true)
    setTimeout(() => setPromptCopied(false), 2000)
  }

  function handleResetPrompt() {
    setAgentPrompt(DEFAULT_AGENT_PROMPT)
  }

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') || '{}')
    setName(user.name || '')
    setEmail(user.email || '')
    const savedPerms = localStorage.getItem('colaborador_permissoes')
    if (savedPerms) setPermissoes(JSON.parse(savedPerms))
  }, [])

  function handleSavePermissoes() {
    localStorage.setItem('colaborador_permissoes', JSON.stringify(permissoes))
    setPermSaved(true)
    setTimeout(() => setPermSaved(false), 2500)
  }

  function togglePermissao(key: string) {
    setPermissoes(prev => ({ ...prev, [key]: !prev[key] }))
  }

  function handleSave() {
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'perfil',       label: 'Perfil',       icon: User   },
    { id: 'ia',           label: 'Glow IA',      icon: Bot    },
    { id: 'whatsapp',     label: 'WhatsApp',     icon: Phone  },
    { id: 'notificacoes', label: 'Notificações', icon: Bell   },
    { id: 'equipe',       label: 'Equipe',       icon: Users  },
  ]

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="font-bold text-lg" style={{ color: '#e8e8f2' }}>Configurações</h1>
        <p className="text-xs mt-0.5" style={{ color: '#5a5a6e' }}>Personalize o GlowDesk para sua loja</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: 'rgba(255,255,255,0.05)' }}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={tab === t.id
              ? { background: '#16161f', color: '#e8e8f2', boxShadow: '0 1px 3px rgba(0,0,0,0.4)' }
              : { color: '#5a5a6e' }
            }
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Perfil */}
      {tab === 'perfil' && (
        <div className="card p-6 space-y-4">
          <h2 className="font-semibold flex items-center gap-2" style={{ color: '#e8e8f2' }}>
            <User className="w-4 h-4" style={{ color: '#a78bfa' }} /> Dados do perfil
          </h2>
          <div className="space-y-4">
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
        </div>
      )}

      {/* IA */}
      {tab === 'ia' && (
        <div className="card p-6 space-y-5">
          <h2 className="font-semibold flex items-center gap-2" style={{ color: '#e8e8f2' }}>
            <Bot className="w-4 h-4" style={{ color: '#a78bfa' }} /> Configurações da Glow
          </h2>

          <div className="flex items-center justify-between p-4 rounded-xl" style={{ background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.22)' }}>
            <div>
              <p className="text-sm font-semibold" style={{ color: '#c4b5fd' }}>Glow ativa</p>
              <p className="text-xs mt-0.5" style={{ color: '#8b6fba' }}>A IA responde automaticamente no WhatsApp</p>
            </div>
            <button
              onClick={() => setAiEnabled(!aiEnabled)}
              className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0"
              style={{ background: aiEnabled ? '#7c3aed' : 'rgba(255,255,255,0.1)' }}
            >
              <span
                className="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform"
                style={{ transform: aiEnabled ? 'translateX(24px)' : 'translateX(4px)' }}
              />
            </button>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1.5" style={{ color: '#8b8b9e' }}>Nome da IA</label>
            <input value={aiName} onChange={e => setAiName(e.target.value)} className="input" placeholder="Ex: Glow, Luna, Sofia..." />
            <p className="text-xs mt-1" style={{ color: '#5a5a6e' }}>Este é o nome que a IA usa ao se apresentar</p>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1.5" style={{ color: '#8b8b9e' }}>Tom de atendimento</label>
            <select value={aiTone} onChange={e => setAiTone(e.target.value)} className="input">
              <option value="consultivo">Consultivo e caloroso (recomendado)</option>
              <option value="formal">Formal e profissional</option>
              <option value="descontraido">Descontraído e divertido</option>
              <option value="direto">Direto e objetivo</option>
            </select>
          </div>

          <div className="p-4 rounded-xl" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}>
            <p className="text-xs font-medium" style={{ color: '#fcd34d' }}>
              A Glow é especializada em cosméticos, maquiagem e acessórios femininos.
              Ela conhece os produtos e sabe conduzir vendas consultivas.
            </p>
          </div>

          {/* Prompt do Agente */}
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
            <button
              onClick={() => setPromptOpen(v => !v)}
              className="w-full flex items-center justify-between px-4 py-3 text-left transition-colors"
              style={{ background: 'rgba(255,255,255,0.03)' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'}
            >
              <div>
                <p className="text-sm font-semibold" style={{ color: '#e8e8f2' }}>Prompt do agente</p>
                <p className="text-xs mt-0.5" style={{ color: '#5a5a6e' }}>Instruções completas que definem o comportamento da Glow</p>
              </div>
              {promptOpen
                ? <ChevronUp className="w-4 h-4 flex-shrink-0" style={{ color: '#5a5a6e' }} />
                : <ChevronDown className="w-4 h-4 flex-shrink-0" style={{ color: '#5a5a6e' }} />
              }
            </button>

            {promptOpen && (
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="flex items-center justify-between px-4 py-2.5" style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <p className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: '#3a3a50' }}>
                    Edite o prompt conforme sua loja
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCopyPrompt}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all"
                      style={{ background: 'rgba(255,255,255,0.06)', color: '#8b8b9e', border: '1px solid rgba(255,255,255,0.08)' }}
                      title="Copiar prompt"
                    >
                      {promptCopied ? <CheckCheck className="w-3 h-3" style={{ color: '#6ee7b7' }} /> : <Copy className="w-3 h-3" />}
                      {promptCopied ? 'Copiado!' : 'Copiar'}
                    </button>
                    <button
                      onClick={handleResetPrompt}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all"
                      style={{ background: 'rgba(255,255,255,0.06)', color: '#8b8b9e', border: '1px solid rgba(255,255,255,0.08)' }}
                      title="Restaurar padrão"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Restaurar
                    </button>
                  </div>
                </div>
                <div className="p-3">
                  <textarea
                    value={agentPrompt}
                    onChange={e => setAgentPrompt(e.target.value)}
                    rows={20}
                    className="input font-mono text-xs leading-relaxed resize-y"
                    style={{ minHeight: '320px', color: '#c4c4d4', letterSpacing: '0.01em' }}
                    spellCheck={false}
                  />
                  <p className="text-[10px] mt-2" style={{ color: '#3a3a50' }}>
                    {agentPrompt.length} caracteres · Use markdown para formatação
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* WhatsApp */}
      {tab === 'whatsapp' && (
        <div className="card p-6 space-y-4">
          <h2 className="font-semibold flex items-center gap-2" style={{ color: '#e8e8f2' }}>
            <Phone className="w-4 h-4" style={{ color: '#a78bfa' }} /> Número do WhatsApp
          </h2>

          <div className="p-4 rounded-xl flex items-center gap-3" style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}>
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold" style={{ color: '#6ee7b7' }}>WhatsApp conectado</p>
              <p className="text-xs mt-0.5" style={{ color: '#4a9f82' }}>Número de teste Meta — Phone ID: 1055390070992351</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1.5" style={{ color: '#8b8b9e' }}>Phone Number ID</label>
            <input defaultValue="1055390070992351" className="input font-mono text-xs" readOnly style={{ color: '#5a5a6e' }} />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1.5" style={{ color: '#8b8b9e' }}>Business Account ID</label>
            <input defaultValue="1608618003733298" className="input font-mono text-xs" readOnly style={{ color: '#5a5a6e' }} />
          </div>

          <p className="text-xs" style={{ color: '#5a5a6e' }}>
            Para trocar para seu número real, acesse o Meta Business e configure um novo número de produção.
          </p>
        </div>
      )}

      {/* Notificações */}
      {tab === 'notificacoes' && (
        <div className="card p-6 space-y-4">
          <h2 className="font-semibold flex items-center gap-2" style={{ color: '#e8e8f2' }}>
            <Bell className="w-4 h-4" style={{ color: '#a78bfa' }} /> Notificações
          </h2>

          {[
            { label: 'Nova mensagem no inbox', desc: 'Quando um cliente enviar uma mensagem', defaultOn: true },
            { label: 'Lead quente detectado', desc: 'Quando a Glow identificar um [HOT_LEAD]', defaultOn: true },
            { label: 'Transferência para humano', desc: 'Quando a Glow pedir atendente humano', defaultOn: true },
            { label: 'Tarefa com prazo próximo', desc: '1 hora antes do vencimento de uma tarefa', defaultOn: false },
          ].map((item, i, arr) => (
            <div
              key={item.label}
              className="flex items-center justify-between py-3"
              style={i < arr.length - 1 ? { borderBottom: '1px solid rgba(255,255,255,0.05)' } : {}}
            >
              <div>
                <p className="text-sm font-medium" style={{ color: '#e8e8f2' }}>{item.label}</p>
                <p className="text-xs mt-0.5" style={{ color: '#5a5a6e' }}>{item.desc}</p>
              </div>
              <NotificationToggle defaultOn={item.defaultOn} />
            </div>
          ))}
        </div>
      )}

      {/* Equipe */}
      {tab === 'equipe' && (
        <div className="space-y-4">
          <div className="card p-6 space-y-5">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4" style={{ color: '#a78bfa' }} />
              <div>
                <h2 className="font-semibold" style={{ color: '#e8e8f2' }}>Permissões dos colaboradores</h2>
                <p className="text-xs mt-0.5" style={{ color: '#5a5a6e' }}>Controle quais ações ficam disponíveis no painel do colaborador</p>
              </div>
            </div>

            <div className="space-y-1">
              {Object.entries(PERMISSOES_LABELS).map(([key, info], i, arr) => (
                <div
                  key={key}
                  className="flex items-center justify-between py-3.5"
                  style={i < arr.length - 1 ? { borderBottom: '1px solid rgba(255,255,255,0.05)' } : {}}
                >
                  <div className="flex-1 mr-4">
                    <p className="text-sm font-medium" style={{ color: '#e8e8f2' }}>{info.label}</p>
                    <p className="text-xs mt-0.5" style={{ color: '#5a5a6e' }}>{info.desc}</p>
                  </div>
                  <button
                    onClick={() => togglePermissao(key)}
                    className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0"
                    style={{ background: permissoes[key] ? '#7c3aed' : 'rgba(255,255,255,0.1)' }}
                  >
                    <span
                      className="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform"
                      style={{ transform: permissoes[key] ? 'translateX(24px)' : 'translateX(4px)' }}
                    />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <button onClick={handleSavePermissoes} className="btn-primary flex items-center gap-2">
              {permSaved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
              {permSaved ? 'Salvo!' : 'Salvar permissões'}
            </button>
          </div>
        </div>
      )}

      {/* Save */}
      {tab !== 'equipe' && (
        <div className="flex justify-end">
          <button onClick={handleSave} className="btn-primary flex items-center gap-2">
            {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saved ? 'Salvo!' : 'Salvar alterações'}
          </button>
        </div>
      )}
    </div>
  )
}

function NotificationToggle({ defaultOn }: { defaultOn: boolean }) {
  const [on, setOn] = useState(defaultOn)
  return (
    <button
      onClick={() => setOn(!on)}
      className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0"
      style={{ background: on ? '#7c3aed' : 'rgba(255,255,255,0.1)' }}
    >
      <span
        className="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform"
        style={{ transform: on ? 'translateX(24px)' : 'translateX(4px)' }}
      />
    </button>
  )
}
