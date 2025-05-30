import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import { Evaluation } from '../models/evaluation';

// Interface pour les évaluations avec détails
interface EvaluationWithDetails extends Evaluation {
  renduDetails?: any;
  etudiant?: any;
  projetDetails?: any;
}

@Injectable({
  providedIn: 'root'
})
export class EvaluationService {
  constructor(private http: HttpClient) { }

  getAllEvaluations(): Observable<EvaluationWithDetails[]> {
    const url = `${environment.urlBackend}evaluations/getev`;

    return this.http.get<EvaluationWithDetails[]>(url).pipe(
      catchError(error => {
        console.error('Erreur HTTP lors de la récupération des évaluations:', error);
        return throwError(() => new Error('Erreur lors de la récupération des évaluations'));
      })
    );
  }

  getEvaluationById(id: string): Observable<Evaluation> {
    const url = `${environment.urlBackend}evaluations/${id}`;

    return this.http.get<Evaluation>(url).pipe(
      catchError(error => {
        console.error('Erreur HTTP lors de la récupération de l\'évaluation:', error);
        return throwError(() => new Error('Erreur lors de la récupération de l\'évaluation'));
      })
    );
  }

  // Autres méthodes du service...

  // Ajouter cette méthode pour mettre à jour les groupes manquants
  updateMissingGroups(): Observable<any> {
    const url = `${environment.urlBackend}evaluations/update-missing-groups`;

    return this.http.post<any>(url, {}).pipe(
      catchError(error => {
        console.error('Erreur HTTP lors de la mise à jour des groupes:', error);
        return throwError(() => new Error('Erreur lors de la mise à jour des groupes'));
      })
    );
  }

  // Méthode pour supprimer une évaluation
  deleteEvaluation(evaluationId: string): Observable<any> {
    const url = `${environment.urlBackend}evaluations/${evaluationId}`;

    return this.http.delete<any>(url).pipe(
      catchError(error => {
        console.error('Erreur HTTP lors de la suppression de l\'évaluation:', error);
        return throwError(() => new Error('Erreur lors de la suppression de l\'évaluation'));
      })
    );
  }
}














