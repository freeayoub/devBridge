import {
  HttpClient,
  HttpErrorResponse,
  HttpHeaders,
  HttpParams,
} from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { JwtHelperService } from '@auth0/angular-jwt';
import {
  BehaviorSubject,
  catchError,
  Observable,
  of,
  shareReplay,
  tap,
  throwError,
} from 'rxjs';
import { environment } from 'src/environments/environment';
import { User } from '../models/user.model';

@Injectable({
  providedIn: 'root',
})
export class AuthuserService {
  private currentUserSubject = new BehaviorSubject<any>(null);
  public currentUser$ = this.currentUserSubject.asObservable();
  private isInitialized = false;
  constructor(
    private http: HttpClient,
    private router: Router,
    private jwtHelper: JwtHelperService
  ) {
    this.initializeCurrentUser();
  }
  // Authentification
  private getUserHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    if (!token || this.jwtHelper.isTokenExpired(token)) {
      throw new Error('Token invalide ou expiré');
    }
    return new HttpHeaders({
      Authorization: `Bearer ${token || ''}`,
      'Content-Type': 'application/json',
    });
  }
  private getCommonParams(): HttpParams {
    return new HttpParams()
      .set('secret', environment.secret)
      .set('client', environment.client);
  }

  initializeCurrentUser(): void {
    if (this.isInitialized) return;

    const token = localStorage.getItem('token');
    if (!token || this.jwtHelper.isTokenExpired(token)) {
      this.isInitialized = true;
      return;
    }

    const decodedToken = this.jwtHelper.decodeToken(token);
    const fallbackUser: User = {
      _id: decodedToken.id,
      username: decodedToken.username,
      email: decodedToken.email,
      role: decodedToken.role,
      image: decodedToken.image || 'assets/images/default-profile.png',
      isActive: true,
    };
    this.currentUserSubject.next(fallbackUser);
    this.isInitialized = true;
  }
  // Typage plus strict pour les réponses
  register(userData: User): Observable<{ user: User; token: string }> {
    return this.http
      .post<{ user: User; token: string }>(
        `${environment.urlBackend}users/register`,
        userData
      )
      .pipe(
        tap((response) => {
          this.saveToken(response.token);
          this.setCurrentUser(response.user);
        }),
        catchError(this.handleError)
      );
  }
  login(credentials: {
    email: string;
    password: string;
  }): Observable<{ user: User; token: string }> {
    return this.http
      .post<{ user: User; token: string }>(
        `${environment.urlBackend}users/login`,
        credentials
      )
      .pipe(
        tap((response) => {
          this.saveToken(response.token);
          this.setCurrentUser(response.user);
        }),
        catchError(this.handleError)
      );
  }
  setCurrentUser(user: any): void {
    this.currentUserSubject.next(user);
  }
  getCurrentUser(): any {
    return this.currentUserSubject.value;
  }
  saveToken(token: string): void {
    localStorage.setItem('token', token);
    this.initializeCurrentUser();
  }
  getToken(): string | null {
    return localStorage.getItem('token');
  }
  userLoggedIn(): boolean {
    const token = localStorage.getItem('token');
    if (!token) return false;

    const decodedToken = this.jwtHelper.decodeToken(token);
    return !!decodedToken?.role && !this.jwtHelper.isTokenExpired(token);
  }
  getCurrentUserId(): string | null {
    const token = localStorage.getItem('token');
    if (!token) return null;
    return this.jwtHelper.decodeToken(token)?.id || null;
  }
  // Déconnexion plus robuste
  // Modifiez la méthode logout
  logout(): Observable<void> {
    return this.http
      .put<void>(
        `${environment.urlBackend}users/logout`,
        {},
        {
          headers: this.getUserHeaders(),
          params: this.getCommonParams(),
        }
      )
      .pipe(
        tap(() => {
          this.clearAuthData();
          this.router.navigate(['/loginuser'], {
            queryParams: { message: 'Vous avez été déconnecté avec succès' },
            replaceUrl: true,
          });
        }),
        catchError((error) => {
          this.clearAuthData();
          return throwError(() => error);
        })
      );
  }
  deactivateSelf(): Observable<void> {
    if (!this.userLoggedIn()) {
      return throwError(() => new Error('User not logged in'));
    }

    return this.http.put<void>(
      `${environment.urlBackend}users/deactivateself`,
      {},
      {
        headers: this.getUserHeaders(),
        params: this.getCommonParams(),
      }
    ).pipe(
      tap(() => this.clearAuthData())
    );
  }
  clearAuthData(): void {
    localStorage.removeItem('token');
    this.currentUserSubject.next(null);
    this.isInitialized = false;
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = "Authentication error";

    if (error.error instanceof ErrorEvent) {
      errorMessage = `Client error: ${error.error.message}`;
    } else {
      errorMessage = error.error?.message || error.message || 'Unknown authentication error';
    }

    return throwError(() => new Error(errorMessage));
  }
}
