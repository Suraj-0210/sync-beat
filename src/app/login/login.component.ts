import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from '../../firebase'; // Adjust the path based on your structure
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css'],
})
export class LoginComponent {
  constructor(
    private router: Router,
    private http: HttpClient,
    private route: ActivatedRoute
  ) {}

  async handleGoogleClick() {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    try {
      const results = await signInWithPopup(auth, provider);

      const { displayName, email, photoURL } = results.user;

      const res = await this.http
        .post<any>(`${environment.backendUrl}/api/auth/google`, {
          name: displayName,
          email,
          googlePhotoUrl: photoURL,
        })
        .toPromise();

      document.cookie = `access_token=${res.access_token}; path=/;`;

      const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');

      if (returnUrl) {
        this.router.navigateByUrl(returnUrl); // goes to /room/49V3LR
      } else {
        this.router.navigate(['/create-room']);
      }
    } catch (error) {
      console.error(error);
    }
  }
}
