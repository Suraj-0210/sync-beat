import { Injectable } from '@angular/core';
import { io } from 'socket.io-client';

@Injectable({
  providedIn: 'root',
})
export class ChatService {
  private socket: any;

  constructor() {
    // Connect to the server
    this.socket = io('http://localhost:3000'); // Adjust the URL if needed
  }

  // Join a room
  joinRoom(roomCode: string) {
    this.socket.emit('joinRoom', roomCode);
  }

  // Send a chat message
  sendMessage(roomCode: string, message: string) {
    this.socket.emit('chatMessage', { roomCode, message });
  }

  // Listen for incoming messages
  onNewMessage(callback: (message: string) => void) {
    this.socket.on('chatMessage', callback);
  }

  // Listen for previous messages when joining a room
  onPreviousMessages(callback: (messages: string[]) => void) {
    this.socket.on('previousMessages', callback);
  }
}
