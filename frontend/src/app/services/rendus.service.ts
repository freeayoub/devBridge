import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class RendusService {
  private apiUrl = `${environment.urlBackend}rendus`;

  constructor(private http: HttpClient) { }

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  // Soumettre un nouveau rendu
  submitRendu(renduData: FormData): Observable<any> {
    return this.http.post(`${this.apiUrl}/submit`, renduData);
  }

  // Vérifier si un étudiant a déjà soumis un rendu pour un projet
  checkRenduExists(projetId: string, etudiantId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/check/${projetId}/${etudiantId}`, { headers: this.getHeaders() });
  }

  // Récupérer tous les rendus
  getAllRendus(): Observable<any[]> {
    return this.http.get<any[]>(this.apiUrl, { headers: this.getHeaders() })
      .pipe(
        catchError(error => {
          console.error('Erreur lors de la récupération des rendus:', error);
          return of([]);
        })
      );
  }

  // Récupérer un rendu par son ID
  getRenduById(id: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${id}`, { headers: this.getHeaders() });
  }

  // Récupérer les rendus par projet
  getRendusByProjet(projetId: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/projet/${projetId}`, { headers: this.getHeaders() })
      .pipe(
        catchError(error => {
          console.error('Erreur lors de la récupération des rendus par projet:', error);
          return of([]);
        })
      );
  }

  // Évaluer un rendu (manuellement ou via IA)
  evaluateRendu(renduId: string, evaluationData: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/evaluations/${renduId}`, evaluationData, { headers: this.getHeaders() });
  }

  // Mettre à jour une évaluation existante
  updateEvaluation(renduId: string, evaluationData: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/evaluations/${renduId}`, evaluationData, { headers: this.getHeaders() });
  }
}



