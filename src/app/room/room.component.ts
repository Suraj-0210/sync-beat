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

import axios from 'axios';
import qs from 'qs';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';

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

  //private audioElement: HTMLAudioElement = new Audio(); // Audio element to control music

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

      this.socket.on('resumeSong', () => {
        const audio = this.audioRef.nativeElement;
        if (audio.src) {
          audio.play();
        }
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
            this.playAudio(data);
          });
        }
      );

      // Listen for song pause
      this.socket.on('pauseSong', () => {
        this.ngZone.run(() => {
          this.audioRef.nativeElement.pause();
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

  playSelectedSong(songUrl: string) {
    const startTime = Date.now(); // timestamp when song is played
    this.socket.emit('playSong', {
      roomCode: this.roomCode,
      songUrl,
      startTime,
    });
    console.log('SOng is emmited');
  }

  @ViewChild('audio') audioRef!: ElementRef<HTMLAudioElement>;

  showMusicModal = false;
  currentTime: number = 0;
  audioDuration: number = 0;

  // Sample songs
  songs = [
    {
      name: 'Premalo',
      url: 'https://firebasestorage.googleapis.com/v0/b/mern-blog-4cc1b.appspot.com/o/Premalo%20-%20Anurag%20kulkarni%20-%20Ameera%20lyrical%20video%20%23lyricalsong%20-%20Naidu%20lyrics.mp3?alt=media&token=89813859-8c81-4dda-9a94-dde20b3650df',
    },
  ];

  openMusicModal() {
    this.showMusicModal = true;
  }

  closeMusicModal() {
    this.showMusicModal = false;
  }

  resumeSong() {
    this.socket.emit('resumeSong', this.roomCode);
  }

  playAudio(data: any) {
    const audio = this.audioRef.nativeElement;
    console.log('🔊 Received playSong:', data);
    this.songUrl = data.songUrl;
    const elapsed = (Date.now() - data.startTime) / 1000;

    // Set the audio source
    audio.src = this.songUrl;
    audio.load(); // Reset state
    audio.currentTime = elapsed;

    // Wait for a user interaction once before allowing playback
    const tryPlay = () => {
      audio
        .play()
        .then(() => {
          console.log('✅ Playback started');
          this.isPlaying = true;
          this.showToast('Playing Song');
        })
        .catch((err) => {
          console.error('❌ Audio play error:', err);
        });
    };

    if (audio.paused) {
      //document.addEventListener('click', tryPlay, { once: true });
      setTimeout(() => {
        tryPlay();
      }, 1000); // 1000 ms = 1 second
    } else {
      //tryPlay();
    }
  }

  pauseAudio() {
    this.socket.emit('pauseSong', this.roomCode);
  }

  onTimeUpdate(event: Event) {
    const audio = this.audioRef.nativeElement;
    this.currentTime = audio.currentTime;
    this.audioDuration = audio.duration;
  }

  seekAudio(event: Event) {
    const input = event.target as HTMLInputElement;
    const time = Number(input.value);
    this.audioRef.nativeElement.currentTime = time;

    // Temporary log
    console.log(`⏱️ User seeked to: ${time} seconds`);
  }

  formatTime(seconds: number): string {
    const min = Math.floor(seconds / 60)
      .toString()
      .padStart(2, '0');
    const sec = Math.floor(seconds % 60)
      .toString()
      .padStart(2, '0');
    return `${min}:${sec}`;
  }

  spotifyLink: string = ''; // Holds the Spotify link

  downloadAndSaveTrack(spotifyLink: string): void {
    this.http
      .post<any>('http://localhost:3000/api/download', {
        song_name: 'Sync-Beat',
        artist_name: 'Hare Krishna',
        url: spotifyLink,
      })
      .subscribe({
        next: (data) => {
          this.songUrl = data.dlink;
          this.playSelectedSong(this.songUrl);
        },
        error: (err) => {
          console.error('HTTP error:', err);
        },
      });
  }

  constructor(
    private route: ActivatedRoute,
    private ngZone: NgZone,
    private afAuth: AngularFireAuth,
    private http: HttpClient
  ) {}
}
