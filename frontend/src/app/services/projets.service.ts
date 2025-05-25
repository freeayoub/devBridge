import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { Projet } from '../models/projet.model';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ProjetService {
  // Correction de l'URL pour éviter la duplication de /api
  private apiUrl = `${environment.urlBackend}projets`;

  constructor(private http: HttpClient) { }

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  getProjets(): Observable<Projet[]> {
    console.log('Appel API pour récupérer les projets:', this.apiUrl);
    return this.http.get<Projet[]>(this.apiUrl, { headers: this.getHeaders() })
      .pipe(
        tap(projets => console.log('Projets récupérés:', projets)),
        catchError(error => {
          console.error('Erreur lors de la récupération des projets:', error);
          return throwError(() => error);
        })
      );
  }

  getProjetById(id: string): Observable<Projet> {
    return this.http.get<Projet>(`${this.apiUrl}/${id}`, { headers: this.getHeaders() })
      .pipe(
        catchError(error => throwError(() => error))
      );
  }

  addProjet(formData: FormData): Observable<any> {
    // Pour les requêtes multipart/form-data, ne pas définir Content-Type
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    });
    
    return this.http.post(`${this.apiUrl}/create`, formData, { headers })
      .pipe(
        tap(response => console.log('Projet ajouté:', response)),
        catchError(error => {
          console.error('Erreur lors de l\'ajout du projet:', error);
          return throwError(() => error);
        })
      );
  }

  updateProjet(id: string, projet: Projet): Observable<Projet> {
    return this.http.put<Projet>(`${this.apiUrl}/update/${id}`, projet, { headers: this.getHeaders() })
      .pipe(
        catchError(error => throwError(() => error))
      );
  }

  deleteProjet(id: string): Observable<any> {
    // Assurez-vous que l'URL est correcte
    return this.http.delete(`${this.apiUrl}/delete/${id}`, { headers: this.getHeaders() })
      .pipe(
        tap(response => console.log('Projet supprimé:', response)),
        catchError(error => {
          console.error('Erreur lors de la suppression du projet:', error);
          return throwError(() => error);
        })
      );
  }

  uploadFile(file: File): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    
    // Utiliser les headers sans Content-Type pour permettre au navigateur de définir le boundary correct
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    });
    
    return this.http.post(`${this.apiUrl}/uploads`, formData, { headers })
      .pipe(
        catchError(error => throwError(() => error))
      );
  }
}








