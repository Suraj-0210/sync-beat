import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from '../../firebase'; // Adjust the path based on your structure
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css'],
})
export class LoginComponent {
  constructor(private router: Router, private http: HttpClient) {}

  async handleGoogleClick() {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    try {
      const results = await signInWithPopup(auth, provider);

      // User data
      const { displayName, email, photoURL } = results.user;

      // Your own backend login/signup
      const res = await this.http
        .post<any>('https://sync-beat.onrender.com/api/auth/google', {
          name: displayName,
          email,
          googlePhotoUrl: photoURL,
        })
        .toPromise();

      document.cookie = `access_token=${res.access_token}; path=/;`;

      this.router.navigate(['/']);
    } catch (err: any) {
      console.error('Google login error:', err.message);
    }
  }
}
