import {
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
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
export class RoomComponent implements OnInit, OnDestroy {
  backendUrl: string = 'https://sync-beat.onrender.com';
  roomCode: string = '';
  userName: string = localStorage.getItem('userName') || '';
  uid: string = '';
  messages: ChatMessage[] = [];
  newMessage: string = '';
  currentSongIndex: number = 0;

  private socket: any;
  currentSong: { name: string; url: string; idx: number } | undefined; // Store the song URL to play it
  isPlaying: boolean = false; // Track whether the song is playing

  togglePlayback() {
    if (this.isPlaying) {
      this.pauseAudio();
    } else {
      this.resumeSong();
    }
    this.isPlaying = !this.isPlaying;
  }

  //private audioElement: HTMLAudioElement = new Audio(); // Audio element to control music

  toastMessage: string | null = null;

  showToast(message: string) {
    this.toastMessage = message;
    setTimeout(() => {
      this.toastMessage = null;
    }, 3000); // Hide after 3 seconds
  }

  roomUsers: { userName: string; uid: string }[] = [];
  showFullUsernames = false;
  selectedUserIndex: number | null = null;

  toggleUsername(index: number) {
    this.selectedUserIndex = this.selectedUserIndex === index ? null : index;
  }

  ngOnInit(): void {
    this.afAuth.authState.subscribe((user) => {
      if (user) {
        this.userName = user.displayName || user.email || 'Guest';
      } else {
        this.userName = 'Anonymous';
      }
      this.uid = crypto.randomUUID().toString();
      // Retrieve the room code from the URL params
      this.roomCode = this.route.snapshot.paramMap.get('code')!;
      this.socket = io(this.backendUrl);
      this.socket.emit('joinRoom', {
        roomCode: this.roomCode,
        userName: this.userName,
        uid: this.uid,
      });

      this.socket.on(
        'roomUsers',
        (users: { userName: string; uid: string }[]) => {
          this.roomUsers = users;
        }
      );

      this.socket.on('userJoined', (data: ChatMessage) => {
        console.log(data.message); // e.g., "Alice has joined the room."
        this.messages.push({
          userName: 'Sync-Beat',
          message: data.message,
          time: data.time,
        });
      });

      this.socket.on('userLeft', (data: ChatMessage) => {
        console.log(data.message); // e.g., "Bob has left the room."
        this.messages.push({
          userName: 'Sync-Beat',
          message: data.message,
          time: data.time,
        });
      });

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
        (data: {
          song: { name: string; url: string; idx: number };
          startTime: number;
          isPlaying: boolean;
        }) => {
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

      this.socket.on('seek-audio', (data: { time: number }) => {
        const { time } = data;
        console.log(`🎯 Received sync time: ${time}`);
        this.audioRef.nativeElement.currentTime = time;
      });

      this.audioRef.nativeElement.addEventListener('ended', () => {
        console.log('the current song is finished playing');
        this.ngZone.run(() => this.playNextSong());
      });
    });
  }

  ngOnDestroy(): void {
    if (this.socket) {
      this.socket.emit('pauseSong', this.roomCode);
      this.socket.disconnect();
      console.log('🛑 Socket disconnected');
    }
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

  playSelectedSong(song: { name: string; url: string; idx: number }) {
    this.currentSongIndex = song.idx;
    const startTime = Date.now(); // timestamp when song is played
    this.socket.emit('playSong', {
      roomCode: this.roomCode,
      song,
      startTime,
    });
    console.log('SOng is emmited');
  }

  playNextSong() {
    const nextIndex = this.currentSongIndex + 1;
    if (nextIndex < this.songs.length) {
      const nextSong = this.songs[nextIndex];
      this.playSelectedSong(nextSong);
    } else {
      this.isPlaying = false;
      this.showToast('Playlist finished!');
    }
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
      idx: 0,
    },
    {
      name: 'Jhol',
      url: 'https://firebasestorage.googleapis.com/v0/b/mern-blog-4cc1b.appspot.com/o/Jhol.mp3?alt=media&token=4fa7677f-d10d-4bb6-9ad4-7457109ebbfa',
      idx: 1,
    },
    {
      name: 'Sang Rahiyo',
      url: 'https://firebasestorage.googleapis.com/v0/b/mern-blog-4cc1b.appspot.com/o/Sang%20Rahiyo.mp3?alt=media&token=d6cbac9b-a822-4450-83a5-a71c2cdfe6a5',
      idx: 2,
    },
    {
      name: 'Tere Naina',
      url: 'https://firebasestorage.googleapis.com/v0/b/mern-blog-4cc1b.appspot.com/o/Tere%20Naina.mp3?alt=media&token=843b06e9-59c4-4bf9-b397-9dfbf8cef29c',
      idx: 3,
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

  playAudio(data: {
    song: { name: string; url: string; idx: number };
    startTime: number;
    isPlaying: boolean;
  }) {
    const { name, url, idx } = data.song;
    this.currentSong = data.song;
    const audio = this.audioRef.nativeElement;
    console.log('🔊 Received playSong:', data);

    const elapsed = (Date.now() - data.startTime) / 1000;

    // Set the audio source
    audio.src = this.currentSong.url;
    audio.load(); // Reset state
    audio.currentTime = elapsed;

    // Wait for a user interaction once before allowing playback
    const tryPlay = () => {
      audio
        .play()
        .then(() => {
          console.log('✅ Playback started');
          this.isPlaying = true;
          this.showToast('Playing Song :' + name);
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

    this.socket.emit('seek-audio', {
      time,
      roomCode: this.roomCode,
    });

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
  generateUniqueName(prefix: string): string {
    return `${prefix}_${Math.random()
      .toString(36)
      .substring(2, 10)}_${Date.now()}`;
  }
  // downloadAndSaveTrack(spotifyLink: string): void {
  //   this.http
  //     .post<any>(`${this.backendUrl}/api/download`, {
  //       song_name: this.generateUniqueName('Song'),
  //       artist_name: this.generateUniqueName('Artist'),
  //       url: spotifyLink,
  //     })
  //     .subscribe({
  //       next: (data) => {
  //         this.songUrl = data.dlink;
  //         this.playSelectedSong(this.songUrl);
  //       },
  //       error: (err) => {
  //         console.error('HTTP error:', err);
  //       },
  //     });
  // }

  constructor(
    private route: ActivatedRoute,
    private ngZone: NgZone,
    private afAuth: AngularFireAuth,
    private http: HttpClient
  ) {}
}
