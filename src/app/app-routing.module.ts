import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LandingPageComponent } from './landing-page/landing-page.component';
import { LoginComponent } from './login/login.component';
import { SignupComponent } from './signup/signup.component';
import { CreateRoomComponent } from './create-room/create-room.component';
import { RoomComponent } from './room/room.component';
import { AuthGuard } from './auth.guard';
import { NoAuthGuard } from './no-auth.guard';
import { TestPlayComponent } from './test-play/test-play.component';

const routes: Routes = [
  { path: '', component: LandingPageComponent },
  {
    path: 'create-room',
    component: CreateRoomComponent,
    canActivate: [AuthGuard],
  },
  { path: 'room/:code', component: RoomComponent, canActivate: [AuthGuard] },
  { path: 'login', component: LoginComponent, canActivate: [NoAuthGuard] },
  { path: 'signup', component: SignupComponent },
  { path: 'test-play', component: TestPlayComponent },
  {
    path: '**',
    redirectTo: '/create-room',
    pathMatch: 'full',
  },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
