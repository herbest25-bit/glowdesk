import { io, Socket } from 'socket.io-client'

let socket: Socket | null = null

export function getSocket(workspaceId: string): Socket {
  if (socket?.connected) return socket

  socket = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001', {
    auth: { token: localStorage.getItem('token') }
  })

  socket.on('connect', () => {
    socket?.emit('join_workspace', { workspaceId })
    console.log('[Socket] Conectado ao workspace:', workspaceId)
  })

  socket.on('disconnect', () => {
    console.log('[Socket] Desconectado')
  })

  return socket
}

export function disconnectSocket() {
  socket?.disconnect()
  socket = null
}
