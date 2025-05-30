import { Injectable } from '@angular/core';
import { HttpHeaders, HttpClient, HttpResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import { Planning, CreatePlanningRequest } from '../models/planning.model';
import { JwtHelperService } from '@auth0/angular-jwt';

@Injectable({
  providedIn: 'root'
})
export class PlanningService {

  constructor(private http: HttpClient, private jwtHelper: JwtHelperService)
  {}
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

  getAllPlannings(): Observable<any> {
    console.log('Service - Récupération de tous les plannings');
    // Utiliser l'endpoint getall qui existe dans l'API
    return this.http.get<any>(
      `${environment.urlBackend}plannings/getall`,
      { headers: this.getUserHeaders() }
    ).pipe(
      tap(response => {
        console.log('Service - Plannings récupérés:', response);
      }),
      catchError(error => {
        console.error('Service - Erreur lors de la récupération des plannings:', error);
        return throwError(() => error);
      })
    );
  }

  getPlanningById(id: string): Observable<Planning> {
    return this.http.get<Planning>(`${environment.urlBackend}plannings/getone/${id}`);
  }

  createPlanning(planning: CreatePlanningRequest): Observable<Planning> {
    return this.http.post<Planning>(`${environment.urlBackend}plannings/add`,planning,{headers: this.getUserHeaders()});
  }

  updatePlanning(id: string, planning: any): Observable<any> {
    console.log('Service - Mise à jour du planning:', id);
    console.log('Service - Données envoyées:', planning);
    console.log('Service - URL:', `${environment.urlBackend}plannings/update/${id}`);

    // Vérifier le token avant d'envoyer la requête
    try {
      const headers = this.getUserHeaders();
      console.log('Service - Headers:', headers);

      return this.http.put<any>(
        `${environment.urlBackend}plannings/update/${id}`,
        planning,
        {headers: headers}
      ).pipe(
        tap(response => {
          console.log('Service - Réponse du serveur:', response);
        }),
        catchError(error => {
          console.error('Service - Erreur lors de la mise à jour:', error);
          return throwError(() => error);
        })
      );
    } catch (error) {
      console.error('Service - Erreur lors de la préparation de la requête:', error);
      return throwError(() => new Error('Erreur d\'authentification: ' + (error instanceof Error ? error.message : String(error))));
    }
  }

  deletePlanning(id: string): Observable<void> {
    return this.http.delete<void>(`${environment.urlBackend}plannings/delete/${id}`,{headers: this.getUserHeaders()});
  }


getPlanningsByUser(userId: string): Observable<any> {
  return this.http.get<any>(
    `${environment.urlBackend}plannings/user/${userId}`,
    {
      headers: this.getUserHeaders()
    }
  ).pipe(
    tap(response => {
      console.log('Service - Plannings par utilisateur récupérés:', response);
    }),
    catchError(error => {
      console.error('Service - Erreur lors de la récupération des plannings par utilisateur:', error);
      return throwError(() => error);
    })
  );
}
// Cette méthode est remplacée par getAllPlannings qui inclut maintenant les réunions

getPlanningWithReunions(id: string): Observable<Planning> {
  return this.http.get<Planning>(
    `${environment.urlBackend}plannings/with-reunions/${id}`,
    { headers: this.getUserHeaders() }
  );
}

// Méthode pour récupérer tous les plannings (admin seulement)
getAllPlanningsAdmin(): Observable<any> {
  return this.http.get<any>(
    `${environment.urlBackend}plannings/admin/all`,
    { headers: this.getAdminHeaders() }
  ).pipe(
    tap(response => {
      console.log('Service - Tous les plannings (admin) récupérés:', response);
    }),
    catchError(error => {
      console.error('Service - Erreur lors de la récupération des plannings admin:', error);
      return throwError(() => error);
    })
  );
}
}