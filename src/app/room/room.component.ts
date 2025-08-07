import {
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { io } from 'socket.io-client';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { HttpClient } from '@angular/common/http';
import { ChatService } from '../service/chat.service';
import { environment } from '../../environments/environment';
import { AuthService } from '../services/auth.service';

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
  backendUrl: string = environment.backendUrl;
  roomCode: string = '';
  userName: string = localStorage.getItem('userName') || '';
  uid: string = '';
  messages: ChatMessage[] = [];
  newMessage: string = '';
  currentSongIndex: number = 0;
  roomUsers: { userName: string; uid: string }[] = [];
  showFullUsernames = false;
  selectedUserIndex: number | null = null;
  showCopiedMessage = false;

  private socket: any;
  currentSong: { name: string; url: string; idx: number } | undefined;
  currentVideo: { name: string; url: string; idx: number } | undefined;
  isPlaying: boolean = false;
  isVideoMode: boolean = false;
  isSomeoneTyping: boolean = false;
  private typingTimer: any;

  toastMessage: string | null = null;

  @ViewChild('audio') audioRef!: ElementRef<HTMLAudioElement>;
  @ViewChild('video') videoRef!: ElementRef<HTMLVideoElement>;

  showMusicModal = false;
  showVideoModal = false;
  currentTime: number = 0;
  audioDuration: number = 0;
  videoDuration: number = 0;

  togglePlayback() {
    if (this.isVideoMode) {
      if (this.isPlaying) {
        this.pauseVideo();
      } else {
        this.resumeVideo();
      }
    } else {
      if (this.isPlaying) {
        this.pauseAudio();
      } else {
        this.resumeSong();
      }
    }
    this.isPlaying = !this.isPlaying;
  }

  //private audioElement: HTMLAudioElement = new Audio(); // Audio element to control music

  showToast(message: string) {
    this.toastMessage = message;
    setTimeout(() => {
      this.toastMessage = null;
    }, 3000); // Hide after 3 seconds
  }

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

          this.showDesktopNotificationWithSound(
            'New Message!',
            'You have a new chat message.',
            '/assets/chat-icon.png',
            '/assets/sounds/notification.mp3'
          );
        });
      });

      this.socket.on('resumeSong', () => {
        const audio = this.audioRef.nativeElement;
        if (audio.src) {
          audio.play();
        }
      });

      this.socket.on('resumeVideo', () => {
        const video = this.videoRef.nativeElement;
        if (video.src) {
          video.play();
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
            this.isVideoMode = false;
            this.playAudio(data);
          });
        }
      );

      // Listen for video to play
      this.socket.on(
        'playVideo',
        (data: {
          video: { name: string; url: string; idx: number };
          startTime: number;
          isPlaying: boolean;
        }) => {
          this.ngZone.run(() => {
            this.isVideoMode = true;
            this.playVideo(data);
          });
        }
      );

      // Listen for song pause
      this.socket.on('pauseSong', () => {
        this.ngZone.run(() => {
          this.audioRef.nativeElement.pause();
        });
      });

      // Listen for video pause
      this.socket.on('pauseVideo', () => {
        this.ngZone.run(() => {
          this.videoRef.nativeElement.pause();
        });
      });

      this.socket.on('seek-audio', (data: { time: number }) => {
        const { time } = data;
        console.log(`🎯 Received sync time: ${time}`);
        this.audioRef.nativeElement.currentTime = time;
      });

      this.socket.on('seek-video', (data: { time: number }) => {
        const { time } = data;
        console.log(`🎯 Received video sync time: ${time}`);
        this.videoRef.nativeElement.currentTime = time;
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

  onTyping() {
    // Clear any existing timer
    if (this.typingTimer) {
      clearTimeout(this.typingTimer);
    }

    // Set typing indicator
    this.isSomeoneTyping = true;

    // Set timer to clear typing indicator after 1 second of inactivity
    this.typingTimer = setTimeout(() => {
      this.isSomeoneTyping = false;
    }, 1000);
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

      // Clear typing indicator
      this.isSomeoneTyping = false;
      if (this.typingTimer) {
        clearTimeout(this.typingTimer);
      }
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
    console.log('Song is emitted');
  }

  playSelectedVideo(video: { name: string; url: string; idx: number }) {
    this.currentSongIndex = video.idx;
    const startTime = Date.now(); // timestamp when video is played
    this.socket.emit('playVideo', {
      roomCode: this.roomCode,
      video,
      startTime,
    });
    console.log('Video is emitted');
  }

  playPreviousSong() {
    const previousIndex = this.currentSongIndex - 1;
    if (previousIndex >= 0) {
      const previousSong = this.songs[previousIndex];
      this.playSelectedSong(previousSong);
    } else {
      this.showToast('This is the first song!');
    }
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

  // Sample videos
  videos = [
    {
      name: 'Sample Video 1',
      url: 'https://firebasestorage.googleapis.com/v0/b/mern-blog-4cc1b.appspot.com/o/Bubble%20_%20No-code%20apps%20-%20Brave%202023-11-29%2009-22-59.mp4?alt=media&token=1047345a-f6b9-4086-8e41-dca84627df4c',
      idx: 0,
    },
    {
      name: 'Sample Video 2',
      url: 'https://firebasestorage.googleapis.com/v0/b/mern-blog-4cc1b.appspot.com/o/Bubble%20_%20No-code%20apps%20-%20Brave%202023-11-29%2009-22-59.mp4?alt=media&token=1047345a-f6b9-4086-8e41-dca84627df4c',
      idx: 1,
    },
  ];

  openMusicModal() {
    this.showMusicModal = true;
  }

  closeMusicModal() {
    this.showMusicModal = false;
  }

  openVideoModal() {
    this.showVideoModal = true;
  }

  closeVideoModal() {
    this.showVideoModal = false;
  }

  resumeSong() {
    this.socket.emit('resumeSong', this.roomCode);
  }

  resumeVideo() {
    this.socket.emit('resumeVideo', this.roomCode);
  }

  pauseVideo() {
    this.socket.emit('pauseVideo', this.roomCode);
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

  playVideo(data: {
    video: { name: string; url: string; idx: number };
    startTime: number;
    isPlaying: boolean;
  }) {
    const { name, url, idx } = data.video;
    this.currentVideo = data.video;
    const video = this.videoRef.nativeElement;
    console.log('🎬 Received playVideo:', data);

    const elapsed = (Date.now() - data.startTime) / 1000;

    // Set the video source
    video.src = this.currentVideo.url;
    video.load(); // Reset state
    video.currentTime = elapsed;

    // Wait for a user interaction once before allowing playback
    const tryPlay = () => {
      video
        .play()
        .then(() => {
          console.log('✅ Video playback started');
          this.isPlaying = true;
          this.showToast('Playing Video: ' + name);
        })
        .catch((err) => {
          console.error('❌ Video play error:', err);
        });
    };

    if (video.paused) {
      setTimeout(() => {
        tryPlay();
      }, 1000); // 1000 ms = 1 second
    }
  }

  onTimeUpdate(event: Event) {
    if (this.isVideoMode) {
      const video = this.videoRef.nativeElement;
      this.currentTime = video.currentTime;
      this.videoDuration = video.duration;
    } else {
      const audio = this.audioRef.nativeElement;
      this.currentTime = audio.currentTime;
      this.audioDuration = audio.duration;
    }
  }

  seekAudio(event: Event) {
    const input = event.target as HTMLInputElement;
    const time = Number(input.value);

    if (this.isVideoMode) {
      this.videoRef.nativeElement.currentTime = time;
      this.socket.emit('seek-video', {
        time,
        roomCode: this.roomCode,
      });
      console.log(`⏱️ User seeked video to: ${time} seconds`);
    } else {
      this.audioRef.nativeElement.currentTime = time;
      this.socket.emit('seek-audio', {
        time,
        roomCode: this.roomCode,
      });
      console.log(`⏱️ User seeked audio to: ${time} seconds`);
    }
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

  // spotifyLink: string = ''; // Holds the Spotify link
  // generateUniqueName(prefix: string): string {
  //   return `${prefix}_${Math.random()
  //     .toString(36)
  //     .substring(2, 10)}_${Date.now()}`;
  // }
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

  showDesktopNotificationWithSound(
    title: string,
    body: string,
    iconPath: string,
    soundPath: string
  ) {
    if (Notification.permission === 'granted') {
      new Notification(title, { body, icon: iconPath });
      const audio = new Audio(soundPath);
      audio.play();
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then((permission) => {
        if (permission === 'granted') {
          new Notification(title, { body, icon: iconPath });
          const audio = new Audio(soundPath);
          audio.play();
        }
      });
    }
  }

  constructor(
    private chat: ChatService,
    private route: ActivatedRoute,
    private router: Router,
    private ngZone: NgZone,
    private afAuth: AngularFireAuth,
    private http: HttpClient,
    private authService: AuthService
  ) {}

  async handleLogout() {
    try {
      // Leave the room before logging out
      if (this.socket) {
        this.socket.disconnect();
      }
      await this.authService.signOut();
    } catch (error) {
      console.error('Logout error:', error);
    }
  }

  async shareRoom() {
    try {
      const roomUrl = `${window.location.origin}/room/${this.roomCode}`;
      await navigator.clipboard.writeText(roomUrl);

      // Show success message
      this.showCopiedMessage = true;

      // Hide message after 2 seconds
      setTimeout(() => {
        this.showCopiedMessage = false;
      }, 2000);

      // Show toast
      this.showToast('Room link copied to clipboard! 🎉');
    } catch (error) {
      console.error('Failed to copy room link:', error);
      this.showToast('Failed to copy room link. Please try again.');
    }
  }
}
