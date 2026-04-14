/**
 * Cria o usuário admin inicial.
 * Execute: node src/utils/create-admin.js
 */
import 'dotenv/config'
import { createHash } from 'crypto'
import pg from 'pg'

const { Client } = pg

function hashPassword(password) {
  return createHash('sha256').update(password + process.env.JWT_SECRET).digest('hex')
}

const ADMIN_NAME  = 'Admin'
const ADMIN_EMAIL = 'admin@glowdesk.com'
const ADMIN_PASS  = 'admin123'
const WORKSPACE_ID = '00000000-0000-0000-0000-000000000001'

const client = new Client({ connectionString: process.env.DATABASE_URL })

try {
  await client.connect()

  await client.query(
    `INSERT INTO users (workspace_id, name, email, password_hash, role)
     VALUES ($1, $2, $3, $4, 'admin')
     ON CONFLICT (email) DO UPDATE SET password_hash = $4`,
    [WORKSPACE_ID, ADMIN_NAME, ADMIN_EMAIL, hashPassword(ADMIN_PASS)]
  )

  console.log('\n✅ Usuário admin criado!')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`  Email : ${ADMIN_EMAIL}`)
  console.log(`  Senha : ${ADMIN_PASS}`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('\nAcesse: http://localhost:3000/login\n')
} catch (err) {
  console.error('❌ Erro:', err.message)
} finally {
  await client.end()
}
