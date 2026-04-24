import { Server } from 'socket.io'

let io

export function initRealtime(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: true,
      credentials: true
    }
  })

  // conversationId → { agentName, workspaceId }
  const viewing = new Map()

  io.on('connection', (socket) => {
    console.log(`[Socket] Cliente conectado: ${socket.id}`)

    socket.on('join_workspace', ({ workspaceId }) => {
      socket.join(`workspace:${workspaceId}`)
    })

    socket.on('join_conversation', ({ conversationId }) => {
      socket.join(`conversation:${conversationId}`)
    })

    // Agente abre uma conversa
    socket.on('conversation_viewing', ({ conversationId, agentName, workspaceId }) => {
      viewing.set(socket.id, { conversationId, agentName, workspaceId })
      socket.to(`workspace:${workspaceId}`).emit('conversation_viewing', { conversationId, agentName })
    })

    // Agente fecha / troca de conversa
    socket.on('conversation_viewing_stopped', ({ conversationId, workspaceId }) => {
      viewing.delete(socket.id)
      socket.to(`workspace:${workspaceId}`).emit('conversation_viewing_stopped', { conversationId })
    })

    socket.on('disconnect', () => {
      const info = viewing.get(socket.id)
      if (info) {
        io.to(`workspace:${info.workspaceId}`).emit('conversation_viewing_stopped', { conversationId: info.conversationId })
        viewing.delete(socket.id)
      }
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
