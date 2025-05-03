import {
  Component,
  ElementRef,
  NgZone,
  OnInit,
  ViewChild,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { io } from 'socket.io-client';
import { AngularFireAuth } from '@angular/fire/compat/auth';

interface ChatMessage {
  userName: string;
  message: string;
  time: string;
}

@Component({
  selector: 'app-room',
  templateUrl: './room.component.html',
  styleUrls: ['./room.component.css'],
})
export class RoomComponent implements OnInit {
  roomCode: string = '';
  userName: string = localStorage.getItem('userName') || '';
  messages: ChatMessage[] = [];
  newMessage: string = '';

  private socket: any;
  songUrl: string = ''; // Store the song URL to play it
  isPlaying: boolean = false; // Track whether the song is playing

  private audioElement: HTMLAudioElement = new Audio(); // Audio element to control music

  toastMessage: string | null = null;

  showToast(message: string) {
    this.toastMessage = message;
    setTimeout(() => {
      this.toastMessage = null;
    }, 3000); // Hide after 3 seconds
  }

  ngOnInit(): void {
    this.afAuth.authState.subscribe((user) => {
      if (user) {
        this.userName = user.displayName || user.email || 'Guest';
      } else {
        this.userName = 'Anonymous';
      }

      // Retrieve the room code from the URL params
      this.roomCode = this.route.snapshot.paramMap.get('code')!;
      this.socket = io('https://sync-beat.onrender.com');
      this.socket.emit('joinRoom', this.roomCode);

      // Listen for new chat messages
      this.socket.on('chatMessage', (message: ChatMessage) => {
        this.ngZone.run(() => {
          this.messages.push(message);
          setTimeout(() => this.scrollToBottom(), 100);
          this.showToast('New Message!');
        });
      });

      // Listen for previous messages when a new user joins
      this.socket.on('previousMessages', (messages: ChatMessage[]) => {
        this.ngZone.run(() => {
          this.messages = messages;
          setTimeout(() => this.scrollToBottom(), 100);
          this.showToast('Loaded Messages!');
        });
      });

      // Listen for the song to play
      this.socket.on(
        'playSong',
        (data: { songUrl: string; startTime: number; isPlaying: boolean }) => {
          this.ngZone.run(() => {
            console.log('🔊 Received playSong:', data);
            this.songUrl = data.songUrl;
            const elapsed = (Date.now() - data.startTime) / 1000;

            if (!this.audioElement) this.audioElement = new Audio();

            this.audioElement.src = this.songUrl;
            this.audioElement.currentTime = elapsed;

            if (data.isPlaying) {
              this.audioElement
                .play()
                .then(() => {
                  console.log('✅ Playback started');
                  this.isPlaying = true;
                  this.showToast('Playing Song');
                })
                .catch((err) => {
                  console.error('❌ Audio play error:', err);
                });
            }
          });
        }
      );

      // Listen for song pause
      this.socket.on('pauseSong', () => {
        this.ngZone.run(() => {
          this.audioElement.pause();
          this.isPlaying = false;
        });
      });
    });
  }

  @ViewChild('chatContainer') chatContainer!: ElementRef;
  private scrollToBottom(): void {
    try {
      this.chatContainer.nativeElement.scrollTop =
        this.chatContainer.nativeElement.scrollHeight;
    } catch (err) {
      console.error('Scroll failed:', err);
    }
  }
  sendMessage() {
    if (this.newMessage.trim()) {
      const messageData = {
        roomCode: this.roomCode,
        userName: this.userName,
        message: this.newMessage,
        time: new Date().toLocaleTimeString(),
      };
      this.socket.emit('chatMessage', messageData);
      this.newMessage = '';
    }
  }

  playSong() {
    if (this.songUrl) {
      this.audioElement.src = this.songUrl;
      this.audioElement.play();
      this.isPlaying = true;
    }
  }

  pauseSong() {
    this.audioElement.pause();
    this.isPlaying = false;
  }

  playSelectedSong(songUrl: string) {
    const startTime = Date.now(); // timestamp when song is played
    this.socket.emit('playSong', {
      roomCode: this.roomCode,
      songUrl,
      startTime,
    });
    console.log('SOng is emmited');
  }

  pauseSelectedSong() {
    this.socket.emit('pauseSong', this.roomCode);
  }

  constructor(
    private route: ActivatedRoute,
    private ngZone: NgZone,
    private afAuth: AngularFireAuth
  ) {}
}
