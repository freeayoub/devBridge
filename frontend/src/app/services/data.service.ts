import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, Observable, throwError } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class DataService {
  private apiUrl = 'http://localhost:3000/user';

  constructor(private http: HttpClient) {}

  // Get all users
  getAllUser(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/allusers`).pipe(
      catchError(this.handleError)
    );
  }

  // Add a new user
  addUser(userData: any): Observable<any> {
    // Optional: if you need headers for the request
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });

    return this.http.post<any>(`${this.apiUrl}/newuser`, userData, { headers }).pipe(
      catchError(this.handleError)
    );
  }

  // Centralized error handling method
  private handleError(error: any): Observable<never> {
    console.error('API Error:', error);
    let errorMessage = 'An unknown error occurred!';
    if (error.error instanceof ErrorEvent) {
      errorMessage = `Error: ${error.error.message}`;
    } else {
      errorMessage = `Server returned code: ${error.status}, error message is: ${error.message}`;
    }
    return throwError(errorMessage);
  }
}
