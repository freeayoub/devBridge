import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, catchError, Observable, tap } from 'rxjs';
import { User } from '../models/user.model';
import { environment } from 'src/environments/environment';
import { JwtHelperService } from '@auth0/angular-jwt';

@Injectable({
  providedIn: 'root',
})
export class DataService {
  private usersCache$ = new BehaviorSubject<User[]>([]);
  private lastFetchTime: number = 0;
  private CACHE_DURATION = 300000; // 5 minutes cache

  constructor(private http: HttpClient) {}
  private getAdminHeaders(): HttpHeaders {
    return new HttpHeaders({
      Authorization: 'Bearer ' + localStorage.getItem('token'),
      role: 'admin',
      'Content-Type': 'application/json',
    });
  }
  private getUserHeaders(): HttpHeaders {
    return new HttpHeaders({
      Authorization: 'Bearer ' + (localStorage.getItem('token') || ''),
    });
  }
  private getCommonParams(): HttpParams {
    return new HttpParams()
      .set('secret', environment.secret)
      .set('client', environment.client);
  }
  // Get all users with caching
  getAllUsers(forceRefresh = false): Observable<User[]> {
    const now = Date.now();
    const shouldRefresh = forceRefresh || 
                        this.usersCache$.value.length === 0 || 
                        (now - this.lastFetchTime) > this.CACHE_DURATION;
  
    if (shouldRefresh) {
      this.lastFetchTime = now;
      return this.http.get<User[]>(`${environment.urlBackend}users/getall`, {
        headers: this.getAdminHeaders(),
        params: this.getCommonParams(),
      }).pipe(
        tap(users => {
          this.usersCache$.next(users);
          this.usersCache$.next([...this.usersCache$.value]); 
        }),
        catchError(err => {
          console.error('Error fetching users:', err);
          return this.usersCache$.asObservable();
        })
      );
    }
    return this.usersCache$.asObservable();
  }

  //Get One User
  getOneUser(id: string): Observable<User> {
    return this.http.get<User>(`${environment.urlBackend}users/getone/` + id, {
      headers: this.getUserHeaders(),
      params: this.getCommonParams(),
    });
  }
  // Add a new user and update cache
  addUser(userData: any): Observable<any> {
    return this.http.post(`${environment.urlBackend}users/add`, userData, {
      headers: this.getAdminHeaders(),
      params: this.getCommonParams(),
    }).pipe(
      tap(() => {
        // Force refresh after adding a new user
        this.getAllUsers(true).subscribe();
      })
    );
  }
  // Delete user and update cache
  deleteUser(id: any): Observable<any> {
    return this.http.delete<any>(
      `${environment.urlBackend}users/delete/` + id,
      {
        headers: this.getAdminHeaders(),
        params: this.getCommonParams(),
      }
    ).pipe(
      tap(() => {
        // Remove from cache
        const updatedUsers = this.usersCache$.value.filter(u => u._id !== id);
        this.usersCache$.next(updatedUsers);
      })
    );
  }
 // Méthode admin pour mise à jour complète

  updateUserByAdmin(id: string, data: Partial<User>): Observable<User> {
    return this.http.put<User>(
      `${environment.urlBackend}users/update/` + id,
      data,
      {
        headers: this.getAdminHeaders(),
        params: this.getCommonParams()
      }
    ).pipe(
      tap(updatedUser => this.updateUserInCache(updatedUser))
    );
  }
  // Deactivate User and update cache

  deactivateUser(id: string): Observable<User> {  
    return this.http.put<User>(
      `${environment.urlBackend}users/update/${id}/deactivate`, 
      {},
      { 
        headers: this.getAdminHeaders(),
        params: this.getCommonParams()
      }
    ).pipe(
      tap(updatedUser => {
        const updatedUsers = this.usersCache$.value.map(u => 
          u._id === id ? {...u, isActive: false} : u
        );
        this.usersCache$.next(updatedUsers);
      })
    );
  }
  // Reactivate User and update cache
  reactivateUser(id: string): Observable<any> {
    return this.http.put(`${environment.urlBackend}users/update/${id}/reactivate`, {},
      { 
        headers: this.getAdminHeaders(),
        params: this.getCommonParams(),
      }
    ).pipe(
      tap(() => {
        // Update cache
        const updatedUsers = this.usersCache$.value.map(u => 
          u._id === id ? {...u, isActive: true} : u
        );
        this.usersCache$.next(updatedUsers);
      })
    );
  }
    // Nouvelle méthode pour mise à jour self
    updateSelf(id: string, data: { username?: string, email?: string, currentPassword?: string, newPassword?: string }): Observable<User> {
      return this.http.put<User>(
        `${environment.urlBackend}users/updateself/${id}`,
        data,
        { 
          headers: this.getUserHeaders(),
          params: this.getCommonParams() 
        }
      ).pipe(
        tap(updatedUser => this.updateUserInCache(updatedUser))
      );
    }
    // get currentUser
    get currentUser(): any {
      const token = localStorage.getItem('token');
      if (!token) return null;
      
      const helper = new JwtHelperService();
      return helper.decodeToken(token);
    }
    
    isAdmin(): boolean {
      return this.currentUser?.role === 'admin';
    }
    
    isCurrentUser(userId: string): boolean {
      return this.currentUser?.id === userId;
    }
  // Helper pour mettre à jour le cache
  private updateUserInCache(updatedUser: User): void {
    const updatedUsers = this.usersCache$.value.map(u => 
      u._id === updatedUser._id ? { ...u, ...updatedUser } : u
    );
    this.usersCache$.next(updatedUsers);
  }

}
