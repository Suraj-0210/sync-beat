import { Injectable } from '@angular/core';
import { io } from 'socket.io-client';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class ChatService {
  private socket: any;

  constructor() {
    // Connect to the server
    this.socket = io(environment.backendUrl); // Adjust the URL if needed
  }

  // Join a room
  joinRoom(roomCode: string) {
    this.socket.emit('joinRoom', roomCode);
  }

  // Send a chat message

  sendMessage(newMessage: string, roomCode: string, userName: string) {
    if (newMessage.trim()) {
      const messageData = {
        roomCode: roomCode,
        userName: userName,
        message: newMessage,
        time: new Date().toLocaleTimeString(),
      };
      this.socket.emit('chatMessage', messageData);
    }
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
