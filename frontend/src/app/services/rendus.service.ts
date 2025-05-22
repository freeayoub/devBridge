import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class RendusService {
  private apiUrl = `${environment.urlBackend}rendus`;

  constructor(private http: HttpClient) { }

  // Soumettre un nouveau rendu
  submitRendu(renduData: FormData): Observable<any> {
    return this.http.post(`${this.apiUrl}/submit`, renduData);
  }

  // Vérifier si un étudiant a déjà soumis un rendu pour un projet
  checkRenduExists(projetId: string, etudiantId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/check/${projetId}/${etudiantId}`);
  }

  // Récupérer tous les rendus
  getAllRendus(): Observable<any> {
    return this.http.get(this.apiUrl);
  }

  // Récupérer un rendu par son ID
  getRenduById(id: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/${id}`);
  }

  // Évaluer un rendu (manuellement ou via IA)
  evaluateRendu(renduId: string, evaluationData: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/evaluations/${renduId}`, evaluationData);
  }

  // Mettre à jour une évaluation existante
  updateEvaluation(renduId: string, evaluationData: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/evaluations/${renduId}`, evaluationData);
  }
}



