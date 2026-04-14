# GlowDesk — Guia de Deploy

## Arquitetura

```
Vercel (frontend Next.js)
    ↕ HTTPS
Railway (backend Fastify + WhatsApp + Redis)
    ↕ PostgreSQL
Supabase (banco de dados)
```

---

## 1. Supabase — Criar o banco de dados

1. Acesse https://supabase.com e crie uma conta
2. Clique em **New Project**
   - Nome: `glowdesk`
   - Senha: crie uma senha forte (guarde!)
   - Região: **South America (São Paulo)**
3. Aguarde o projeto criar (~2 min)
4. Vá em **SQL Editor** → **New query**
5. Cole o conteúdo de `supabase/migrations/001_initial_schema.sql` e clique **Run**
6. Copie a connection string:
   - **Settings → Database → Connection string → URI**
   - Use a **Transaction pooler** (porta 6543) para produção
   - Formato: `postgresql://postgres.[ref]:[senha]@aws-0-sa-east-1.pooler.supabase.com:6543/postgres`

---

## 2. Railway — Hospedar o backend

1. Acesse https://railway.app e crie uma conta (pode usar GitHub)
2. Clique em **New Project → Deploy from GitHub repo**
   - Selecione o repositório GlowDesk
   - Selecione a pasta `backend` (ou configure o root directory)
3. Adicione um **Redis Plugin**:
   - No projeto → **New → Database → Add Redis**
   - O `REDIS_URL` será configurado automaticamente
4. Configure as variáveis de ambiente (**Variables**):
   ```
   NODE_ENV=production
   PORT=3001
   FRONTEND_URL=https://seu-app.vercel.app
   DATABASE_URL=postgresql://postgres.[ref]:[senha]@aws-0-sa-east-1.pooler.supabase.com:6543/postgres
   JWT_SECRET=[chave aleatória longa]
   ANTHROPIC_API_KEY=sk-ant-...
   ```
5. Em **Settings → Networking**, ative o domínio público
   - Anote a URL: `https://glowdesk-backend.up.railway.app`

### Criar o admin no banco (primeiro deploy)

No Railway, abra o terminal do serviço e execute:
```bash
node src/utils/create-admin.js
```

---

## 3. Vercel — Hospedar o frontend

1. Acesse https://vercel.com e crie uma conta (pode usar GitHub)
2. Clique em **Add New Project → Import Git Repository**
   - Selecione o repositório GlowDesk
   - **Root Directory**: `frontend`
3. Configure as variáveis de ambiente:
   ```
   NEXT_PUBLIC_API_URL=https://glowdesk-backend.up.railway.app
   ```
4. Clique em **Deploy**
5. Anote a URL: `https://glowdesk.vercel.app`

### Atualizar o FRONTEND_URL no Railway

Após ter a URL do Vercel, volte ao Railway e atualize:
```
FRONTEND_URL=https://glowdesk.vercel.app
```

---

## 4. Domínio personalizado (opcional)

### No Vercel
- **Settings → Domains → Add** → `app.glowdesk.com.br`

### No Railway
- **Settings → Networking → Custom Domain** → `api.glowdesk.com.br`

---

## 5. Variáveis de ambiente — resumo completo

### Backend (Railway)
| Variável | Valor |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `3001` |
| `DATABASE_URL` | Connection string do Supabase |
| `REDIS_URL` | Gerado pelo Railway Redis Plugin |
| `JWT_SECRET` | Chave aleatória (mín. 64 chars) |
| `ANTHROPIC_API_KEY` | Chave da Anthropic |
| `FRONTEND_URL` | URL do Vercel |

### Frontend (Vercel)
| Variável | Valor |
|---|---|
| `NEXT_PUBLIC_API_URL` | URL do Railway |

---

## 6. Checklist pós-deploy

- [ ] Schema criado no Supabase sem erros
- [ ] Backend respondendo em `/health` → `{"status":"ok"}`
- [ ] Frontend carregando sem erros no console
- [ ] Login funcionando
- [ ] WhatsApp QR code aparecendo em Canais
- [ ] Mensagens chegando no Inbox
- [ ] CORS configurado corretamente (FRONTEND_URL correto)
