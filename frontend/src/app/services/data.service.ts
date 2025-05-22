import {
  HttpClient,
  HttpErrorResponse,
  HttpHeaders,
  HttpParams,
} from '@angular/common/http';
import { Injectable } from '@angular/core';
import {
  BehaviorSubject,
  Observable,
  catchError,
  of,
  tap,
  throwError,
} from 'rxjs';
import { User } from '../models/user.model';
import { environment } from 'src/environments/environment';
import { JwtHelperService } from '@auth0/angular-jwt';
import { AuthuserService } from './authuser.service';

@Injectable({
  providedIn: 'root',
})
export class DataService {
  private usersCache$ = new BehaviorSubject<User[]>([]);
  private lastFetchTime: number = 0;
  private readonly CACHE_DURATION = 300000;
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  private userAddedSubject = new BehaviorSubject<void | null>(null);
  public userAdded$ = this.userAddedSubject.asObservable();
  public currentUser$ = this.currentUserSubject.asObservable();
  constructor(
    private http: HttpClient,
    private jwtHelper: JwtHelperService,
    private authService: AuthuserService
  ) {
    this.initializeCurrentUser();
  }
  fetchCurrentUser(): Observable<User> {
    return this.getProfile().pipe(
      tap((user) => this.currentUserSubject.next(user))
    );
  }
  private getAdminHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    if (!token || this.jwtHelper.isTokenExpired(token)) {
      throw new Error('Token invalide ou expiré');
    }
    return new HttpHeaders({
      Authorization: `Bearer ${token}`,
      role: 'admin',
      'Content-Type': 'application/json',
    });
  }

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
  syncCurrentUser(): Observable<User> {
    return this.getProfile().pipe(
      tap((user) => {
        this.currentUserSubject.next(user);
        this.authService.setCurrentUser(user);
      }),
      catchError((error) => {
        // If fetch fails, try to get from auth service
        const authUser = this.authService.getCurrentUser();
        if (authUser) {
          this.currentUserSubject.next(authUser);
          return of(authUser);
        }
        return throwError(() => error);
      })
    );
  }
  getProfile(): Observable<User> {
    return this.http
      .get<User>(`${environment.urlBackend}users/profile`, {
        headers: this.getUserHeaders(),
        params: this.getCommonParams(),
      })
      .pipe(catchError(this.handleError));
  }
  private initializeCurrentUser(): void {
    const token = localStorage.getItem('token');
    if (token && !this.jwtHelper.isTokenExpired(token)) {
      this.syncCurrentUser().subscribe({
        error: () => {
          const decodedToken = this.jwtHelper.decodeToken(token);

          // Déterminer l'image de profil à utiliser
          let profileImage = 'assets/images/default-profile.png';

          // Vérifier d'abord profileImage
          if (
            decodedToken.profileImage &&
            decodedToken.profileImage !== 'null' &&
            decodedToken.profileImage !== 'undefined' &&
            decodedToken.profileImage.trim() !== ''
          ) {
            profileImage = decodedToken.profileImage;
          }
          // Ensuite vérifier image si profileImage n'est pas valide
          else if (
            decodedToken.image &&
            decodedToken.image !== 'null' &&
            decodedToken.image !== 'undefined' &&
            decodedToken.image.trim() !== ''
          ) {
            profileImage = decodedToken.image;
          }

          console.log('DataService - Using profile image:', profileImage);

          const fallbackUser = {
            _id: decodedToken.id,
            username: decodedToken.username,
            email: decodedToken.email,
            role: decodedToken.role,
            image: profileImage,
            profileImage: profileImage,
            isActive: true,
          };

          this.currentUserSubject.next(fallbackUser);
          this.authService.setCurrentUser(fallbackUser);
        },
      });
    }
  }
  updateCurrentUser(userData: Partial<User>): void {
    const currentUser = this.currentUserSubject.value;
    if (currentUser) {
      this.currentUserSubject.next({ ...currentUser, ...userData });
    }
  }

  updateSelf(userId: string, updateData: any): Observable<any> {
    return this.http
      .put<User>(
        `${environment.urlBackend}users/updateself/${userId}`,
        updateData,
        {
          headers: this.getUserHeaders(),
          params: this.getCommonParams(),
        }
      )
      .pipe(
        tap((updatedUser) => {
          this.updateUserInCache(updatedUser);
          this.updateCurrentUser(updatedUser);
        }),
        catchError(this.handleError)
      );
  }
  changePassword(
    currentPassword: string,
    newPassword: string
  ): Observable<any> {
    const userId = this.currentUserValue?._id;
    if (!userId) {
      return throwError(() => new Error('User not logged in'));
    }
    const passwordData = {
      currentPassword,
      newPassword,
    };
    return this.http
      .put<any>(
        `${environment.urlBackend}users/updateself/${userId}`,
        passwordData,
        {
          headers: this.getUserHeaders(),
          params: this.getCommonParams(),
        }
      )
      .pipe(
        tap((response) => {
          if (response.token) {
            localStorage.setItem('token', response.token);
            const decodedToken = this.jwtHelper.decodeToken(response.token);
            this.updateCurrentUser(decodedToken);
          }
        }),
        catchError((error: HttpErrorResponse) => {
          if (error.status === 400) {
            if (error.error?.errors?.general) {
              return throwError(() => new Error(error.error.errors.general));
            }
            return throwError(
              () => new Error(error.error?.message || 'Validation failed')
            );
          }
          return throwError(() => new Error('Failed to change password'));
        })
      );
  }
  uploadProfileImage(
    file: File
  ): Observable<{ imageUrl: string; token?: string }> {
    const formData = new FormData();
    formData.append('image', file);

    return this.http
      .post<{ imageUrl: string; token?: string }>(
        `${environment.urlBackend}users/upload-profile-image`,
        formData,
        {
          headers: new HttpHeaders({
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          }),
          params: this.getCommonParams(),
        }
      )
      .pipe(
        tap((response) => {
          if (response.token) {
            localStorage.setItem('token', response.token);
            const decodedToken = this.jwtHelper.decodeToken(response.token);
            this.updateCurrentUser({
              image: response.imageUrl,
              ...decodedToken,
            });
          }
        }),
        catchError(this.handleError)
      );
  }
  removeProfileImage(): Observable<{ message: string; token: string }> {
    return this.http
      .delete<{ message: string; token: string }>(
        `${environment.urlBackend}users/remove-profile-image`,
        {
          headers: this.getUserHeaders(),
          params: this.getCommonParams(),
        }
      )
      .pipe(
        tap((response) => {
          if (response.token) {
            localStorage.setItem('token', response.token);
            let decodeToken = this.jwtHelper.decodeToken(response.token);
            this.updateCurrentUser(decodeToken);
          }
        }),
        catchError(this.handleError)
      );
  }

  get currentUserValue(): User | null {
    return this.currentUserSubject.value;
  }

  isAdmin(): boolean {
    return this.currentUserValue?.role === 'admin';
  }
  isCurrentUser(userId: string): boolean {
    return this.currentUserValue?._id === userId;
  }
  private updateUserInCache(updatedUser: User): void {
    const updatedUsers = this.usersCache$.value.map((u) =>
      u._id === updatedUser._id ? { ...u, ...updatedUser } : u
    );
    this.usersCache$.next(updatedUsers);
  }
  refreshUserCache(): void {
    this.lastFetchTime = 0;
    this.getAllUsers(true).subscribe();
  }
  getAllUsers(forceRefresh = false): Observable<User[]> {
    const now = Date.now();
    const cacheValid =
      !forceRefresh &&
      this.usersCache$.value.length > 0 &&
      now - this.lastFetchTime <= this.CACHE_DURATION;

    if (cacheValid) {
      return this.usersCache$.asObservable();
    }

    this.lastFetchTime = now;
    return this.http
      .get<User[]>(`${environment.urlBackend}users/getall`, {
        headers: this.getAdminHeaders(),
        params: this.getCommonParams(),
      })
      .pipe(
        tap((users) => this.usersCache$.next([...users])),
        catchError(this.handleError)
      );
  }
  getOneUser(id: string): Observable<User> {
    return this.http
      .get<User>(`${environment.urlBackend}users/getone/${id}`, {
        headers: this.getAdminHeaders(),
        params: this.getCommonParams(),
      })
      .pipe(catchError(this.handleError));
  }
  addUser(userData: User): Observable<User> {
    return this.http
      .post<User>(`${environment.urlBackend}users/add`, userData, {
        headers: this.getAdminHeaders(),
        params: this.getCommonParams(),
      })
      .pipe(
        tap((newUser) => {
          const currentUsers = this.usersCache$.value;
          this.usersCache$.next([...currentUsers, newUser]);
          this.userAddedSubject.next();
        }),
        catchError(this.handleError)
      );
  }

  deleteUser(id: string): Observable<void> {
    return this.http
      .delete<void>(`${environment.urlBackend}users/delete/${id}`, {
        headers: this.getAdminHeaders(),
        params: this.getCommonParams(),
      })
      .pipe(
        tap(() => {
          const updatedUsers = this.usersCache$.value.filter(
            (u) => u._id !== id
          );
          this.usersCache$.next(updatedUsers);
        }),
        catchError(this.handleError)
      );
  }
  updateUserByAdmin(id: string, data: Partial<User>): Observable<User> {
    return this.http
      .put<User>(`${environment.urlBackend}users/update/${id}`, data, {
        headers: this.getAdminHeaders(),
        params: this.getCommonParams(),
      })
      .pipe(
        tap((updatedUser) => this.updateUserInCache(updatedUser)),
        catchError(this.handleError)
      );
  }
  deactivateUser(id: string): Observable<User> {
    return this.http
      .put<User>(
        `${environment.urlBackend}users/update/${id}/deactivate`,
        {},
        { headers: this.getAdminHeaders(), params: this.getCommonParams() }
      )
      .pipe(
        tap((updatedUser) => this.updateUserInCache(updatedUser)),
        catchError(this.handleError)
      );
  }
  reactivateUser(id: string): Observable<User> {
    return this.http
      .put<User>(
        `${environment.urlBackend}users/update/${id}/reactivate`,
        {},
        { headers: this.getAdminHeaders(), params: this.getCommonParams() }
      )
      .pipe(
        tap((updatedUser) => this.updateUserInCache(updatedUser)),
        catchError(this.handleError)
      );
  }

  updateUserRole(id: string, role: string): Observable<any> {
    return this.http
      .put<any>(
        `${environment.urlBackend}admin/users/${id}/role`,
        { role },
        { headers: this.getAdminHeaders(), params: this.getCommonParams() }
      )
      .pipe(
        tap((updatedUser) => this.updateUserInCache(updatedUser)),
        catchError(this.handleError)
      );
  }

  toggleUserActivation(id: string, isActive: boolean): Observable<any> {
    return this.http
      .put<any>(
        `${environment.urlBackend}admin/users/${id}/activation`,
        { isActive },
        { headers: this.getAdminHeaders(), params: this.getCommonParams() }
      )
      .pipe(
        tap((updatedUser) => this.updateUserInCache(updatedUser)),
        catchError(this.handleError)
      );
  }
  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'Une erreur est survenue';

    if (error.status === 0) {
      errorMessage = 'Erreur réseau - impossible de contacter le serveur';
    } else if (error.status >= 400 && error.status < 500) {
      errorMessage = error.error?.message || error.message;
    } else if (error.status >= 500) {
      errorMessage = 'Erreur serveur - veuillez réessayer plus tard';
    }

    console.error(`Erreur ${error.status}:`, error.error);
    return throwError(() => new Error(errorMessage));
  }
}
