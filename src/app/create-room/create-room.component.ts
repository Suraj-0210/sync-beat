import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-create-room',
  templateUrl: './create-room.component.html',
  styleUrl: './create-room.component.css',
})
export class CreateRoomComponent {
  roomName: string = '';
  roomCode: string = '';

  constructor(private router: Router) {}

  // Method to create a new room
  createRoom() {
    if (this.roomName) {
      const roomId = this.generateRoomCode();
      console.log(`Room "${this.roomName}" created with code: ${roomId}`);

      // Redirect to the room with the generated code
      this.router.navigate([`/room/${roomId}`]);
    }
  }

  // Method to generate a unique room code (you can use any strategy here)
  generateRoomCode(): string {
    return Math.random().toString(36).substr(2, 6).toUpperCase(); // 6-character random code
  }

  // Method to go to an existing room by code
  goToRoom() {
    if (this.roomCode) {
      // Navigate to the room based on the code entered
      this.router.navigate([`/room/${this.roomCode}`]);
    }
  }
}
