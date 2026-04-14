import { Server } from 'socket.io'

let io

export function initRealtime(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: true,
      credentials: true
    }
  })

  io.on('connection', (socket) => {
    console.log(`[Socket] Cliente conectado: ${socket.id}`)

    // Agente entra na sala do workspace
    socket.on('join_workspace', ({ workspaceId }) => {
      socket.join(`workspace:${workspaceId}`)
    })

    // Agente entra em uma conversa específica
    socket.on('join_conversation', ({ conversationId }) => {
      socket.join(`conversation:${conversationId}`)
    })

    socket.on('disconnect', () => {
      console.log(`[Socket] Cliente desconectado: ${socket.id}`)
    })
  })

  return io
}

export function emitToWorkspace(workspaceId, event, data) {
  if (!io) return
  io.to(`workspace:${workspaceId}`).emit(event, data)
}

export function emitToConversation(conversationId, event, data) {
  if (!io) return
  io.to(`conversation:${conversationId}`).emit(event, data)
}

export function getIO() {
  return io
}
