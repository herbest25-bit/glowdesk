/**
 * Script para inicializar o banco de dados com o schema completo.
 * Execute: node src/utils/setup-db.js
 */
import 'dotenv/config'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import pg from 'pg'

const { Client } = pg
const __dirname = dirname(fileURLToPath(import.meta.url))

const sql = readFileSync(resolve(__dirname, '../../../database/schema.sql'), 'utf8')

const client = new Client({ connectionString: process.env.DATABASE_URL })

try {
  await client.connect()
  console.log('✅ Conectado ao banco de dados')
  await client.query(sql)
  console.log('✅ Schema aplicado com sucesso!')
  console.log('\nPróximo passo: criar o usuário admin')
  console.log('  node src/utils/create-admin.js\n')
} catch (err) {
  console.error('❌ Erro:', err.message)
} finally {
  await client.end()
}
