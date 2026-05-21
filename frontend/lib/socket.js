// lib/socket.js
// Cliente Socket.io para mensagens em tempo real

import { io } from 'socket.io-client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://chat.chatgruporango.tech';

let socket;

export function getSocket() {
  if (!socket) {
    socket = io(API_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
    });
  }
  return socket;
}
