import { Component } from '@angular/core';

@Component({
  selector: 'app-test-play',
  templateUrl: './test-play.component.html',
  styleUrl: './test-play.component.css',
})
export class TestPlayComponent {
  audio = new Audio();
  audioUrl = '';

  fetchAndPrepareAudio() {
    const formData = new URLSearchParams();
    formData.set(
      'url',
      'https://awd13.mymp3.xyz/phmp3?fname=suryakanta-IndreshUpadhyay.m4a'
    );

    fetch(
      'https://corsproxy.io/?https://spotisongdownloader.to/api/composer/ffmpeg/saveid3.php',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'url=https://awd13.mymp3.xyz/phmp3?fname=suryakanta-IndreshUpadhyay.m4a',
      }
    )
      .then((response) => response.text()) // or .json() if API returns JSON
      .then((data) => {
        this.audioUrl = data; // Save the URL if it's direct
        this.audio.src = this.audioUrl;
        // DO NOT play automatically, wait for user interaction
      });
  }

  playAudio() {
    this.audio.play();
  }
}
