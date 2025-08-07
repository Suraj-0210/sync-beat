import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import firebase from 'firebase/compat/app';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private userSubject = new BehaviorSubject<any>(null);
  user$ = this.userSubject.asObservable();

  constructor(
    private afAuth: AngularFireAuth,
    private router: Router,
    private http: HttpClient
  ) {
    // Subscribe to auth state changes
    this.afAuth.authState.subscribe(user => {
      this.userSubject.next(user);
    });
  }

  async googleSignIn() {
    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      
      const results = await this.afAuth.signInWithPopup(provider);
      if (!results.user) throw new Error('No user data received from Google');

      const { displayName, email, photoURL } = results.user;

      try {
        const res = await this.http
          .post<any>(`${environment.backendUrl}/api/auth/google`, {
            name: displayName,
            email,
            googlePhotoUrl: photoURL,
          })
          .toPromise();

        if (!res?.access_token) {
          throw new Error('No access token received from server');
        }

        document.cookie = `access_token=${res.access_token}; path=/; secure; samesite=strict`;
        return results.user;
      } catch (error) {
        if (error instanceof HttpErrorResponse) {
          if (error.status === 0) {
            throw new Error('Unable to connect to the server. Please check your internet connection.');
          } else {
            throw new Error(error.error?.message || 'Failed to authenticate with server');
          }
        }
        throw error;
      }
    } catch (error: any) {
      // Handle Firebase Auth errors
      if (error.code) {
        switch (error.code) {
          case 'auth/popup-closed-by-user':
            throw new Error('Sign-in cancelled. Please try again.');
          case 'auth/popup-blocked':
            throw new Error('Pop-up blocked by browser. Please allow pop-ups and try again.');
          case 'auth/cancelled-popup-request':
            throw new Error('Multiple pop-up requests detected. Please try again.');
          case 'auth/network-request-failed':
            throw new Error('Network error. Please check your internet connection.');
          default:
            throw new Error(error.message || 'Failed to sign in with Google');
        }
      }
      throw error;
    }
  }

  async signOut() {
    try {
      await this.afAuth.signOut();
      // Clear the access token cookie
      document.cookie = 'access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT; secure; samesite=strict';
      // Navigate to landing page
      this.router.navigate(['/']);
    } catch (error: any) {
      console.error('Sign out error:', error);
      throw new Error('Failed to sign out. Please try again.');
    }
  }

  getCurrentUser() {
    return this.afAuth.currentUser;
  }

  isLoggedIn() {
    return this.afAuth.authState;
  }
} 