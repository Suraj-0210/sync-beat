import { TestBed } from '@angular/core/testing';
import { AuthGuard } from './auth.guard';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { Router, UrlTree } from '@angular/router';
import { of } from 'rxjs';

describe('AuthGuard', () => {
  let guard: AuthGuard;
  let afAuthMock: any;
  let routerMock: any;

  beforeEach(() => {
    afAuthMock = {
      authState: of(null), // simulate not logged in
    };

    routerMock = {
      createUrlTree: jasmine
        .createSpy('createUrlTree')
        .and.returnValue('/login'),
    };

    TestBed.configureTestingModule({
      providers: [
        AuthGuard,
        { provide: AngularFireAuth, useValue: afAuthMock },
        { provide: Router, useValue: routerMock },
      ],
    });

    guard = TestBed.inject(AuthGuard);
  });

  it('should return login UrlTree if user is not authenticated', (done) => {
    const routeSnapshot: any = {};
    const stateSnapshot: any = { url: '/room/123ABC' };

    const expectedUrlTree = {} as UrlTree;
    routerMock.createUrlTree.and.returnValue(expectedUrlTree);

    guard.canActivate(routeSnapshot, stateSnapshot).subscribe((result) => {
      expect(result).toBe(expectedUrlTree); // Compare with UrlTree object
      expect(routerMock.createUrlTree).toHaveBeenCalledWith(['/login'], {
        queryParams: { returnUrl: '/room/123ABC' },
      });
      done();
    });
  });

  it('should allow activation if user is authenticated', (done) => {
    afAuthMock.authState = of({ uid: 'mockUser' });

    guard = new AuthGuard(afAuthMock, routerMock);

    guard
      .canActivate({} as any, { url: '/room/456XYZ' } as any)
      .subscribe((result) => {
        expect(result).toBeTrue();
        done();
      });
  });
});
