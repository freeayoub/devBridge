import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { Membre } from '../models/membre.model';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class MembreService {
  private apiUrl = `${environment.urlBackend}teammembers`;

  constructor(private http: HttpClient) {
    console.log('Membre API URL:', this.apiUrl);
  }

  getMembres(): Observable<Membre[]> {
    console.log('Fetching members from:', this.apiUrl);
    return this.http.get<Membre[]>(this.apiUrl).pipe(
      tap((data) => console.log('Members received:', data)),
      catchError(this.handleError)
    );
  }

  getMembre(id: string): Observable<Membre> {
    console.log(`Fetching member with id ${id} from: ${this.apiUrl}/${id}`);
    return this.http.get<Membre>(`${this.apiUrl}/${id}`).pipe(
      tap((data) => console.log('Member received:', data)),
      catchError(this.handleError)
    );
  }

  addMembre(membre: Membre): Observable<Membre> {
    console.log('Adding member:', membre);
    return this.http.post<Membre>(this.apiUrl, membre).pipe(
      tap((data) => console.log('Member added, response:', data)),
      catchError(this.handleError)
    );
  }

  deleteMembre(id: string): Observable<any> {
    console.log(`Deleting member with id ${id}`);
    return this.http.delete(`${this.apiUrl}/${id}`).pipe(
      tap((data) => console.log('Member deleted, response:', data)),
      catchError(this.handleError)
    );
  }

  private handleError(error: HttpErrorResponse) {
    let errorMessage = '';

    if (error.error instanceof ErrorEvent) {
      // Erreur côté client
      errorMessage = `Erreur client: ${error.error.message}`;
    } else {
      // Erreur côté serveur
      const status = error.status;
      const message = error.error?.message || error.statusText;

      errorMessage = `Erreur serveur: Code ${status}, Message: ${message}`;

      // Log des détails supplémentaires pour le débogage
      console.error('Error details:', {
        status: error.status,
        statusText: error.statusText,
        url: error.url,
        error: error.error,
      });

      if (status === 0) {
        console.error(
          "Le serveur est-il en cours d'exécution? Vérifiez la connexion réseau."
        );
      }
    }

    console.error('API Error:', errorMessage);
    return throwError(() => new Error(errorMessage));
  }
}
