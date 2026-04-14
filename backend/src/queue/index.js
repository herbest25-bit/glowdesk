import { createRequire } from 'module'
const { PgBoss } = createRequire(import.meta.url)('pg-boss')

import { db } from '../utils/db.js'

let boss

export async function initQueue() {
  boss = new PgBoss(process.env.DATABASE_URL)
  await boss.start()

  // Criar filas antes de registrar workers (obrigatório no pg-boss v12)
  await boss.createQueue('create_task')
  await boss.createQueue('automation')
  await boss.createQueue('notification')

  await boss.work('create_task', async (job) => {
    const { workspaceId, contactId, title, type, dueDate } = job.data
    await db.query(
      `INSERT INTO tasks (workspace_id, contact_id, title, type, due_date, status)
       VALUES ($1, $2, $3, $4, $5, 'pending')
       ON CONFLICT DO NOTHING`,
      [workspaceId, contactId, title, type, dueDate]
    )
    console.log(`[Queue] Tarefa criada: ${title}`)
  })

  await boss.work('automation', async (job) => {
    console.log('[Queue] Automação:', job.data)
  })

  console.log('[Queue] pg-boss iniciado')
  return boss
}

export async function addJob(queue, data, options = {}) {
  if (!boss) return
  await boss.send(queue, data, options)
}

export const taskQueue = {
  add: (_name, data, opts) => addJob('create_task', data, opts)
}
export const notificationQueue = {
  add: (_name, data, opts) => addJob('notification', data, opts)
}
export const automationQueue = {
  add: (_name, data, opts) => addJob('automation', data, opts)
}
