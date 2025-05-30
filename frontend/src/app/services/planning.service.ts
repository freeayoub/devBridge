import { Injectable } from '@angular/core';
import { HttpHeaders, HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { Planning } from '../models/planning.model';
import { JwtHelperService } from '@auth0/angular-jwt';

@Injectable({
  providedIn: 'root',
})
export class PlanningService {
  constructor(private http: HttpClient, private jwtHelper: JwtHelperService) {}
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

  getAllPlannings(): Observable<Planning[]> {
    return this.http.get<Planning[]>(
      `${environment.urlBackend}plannings/getall`,
      { headers: this.getUserHeaders() }
    );
  }

  getPlanningById(id: string): Observable<Planning> {
    return this.http.get<Planning>(
      `${environment.urlBackend}plannings/getone/${id}`,
      { headers: this.getUserHeaders() }
    );
  }

  createPlanning(planning: Planning): Observable<Planning> {
    return this.http.post<Planning>(
      `${environment.urlBackend}plannings/add`,
      planning,
      { headers: this.getUserHeaders() }
    );
  }

  updatePlanning(id: string, planning: Planning): Observable<Planning> {
    return this.http.put<Planning>(
      `${environment.urlBackend}plannings/update/${id}`,
      planning,
      { headers: this.getUserHeaders() }
    );
  }

  deletePlanning(id: string): Observable<void> {
    return this.http.delete<void>(
      `${environment.urlBackend}plannings/delete/${id}`,
      { headers: this.getUserHeaders() }
    );
  }

  getPlanningsByUser(userId: string): Observable<Planning[]> {
    return this.http.get<Planning[]>(
      `${environment.urlBackend}plannings/user/${userId}`,
      {
        headers: this.getUserHeaders(),
      }
    );
  }
  getPlanningsWithDetails(): Observable<Planning[]> {
    return this.http.get<Planning[]>(
      `${environment.urlBackend}plannings/with-details`,
      { headers: this.getUserHeaders() }
    );
  }

  getPlanningWithReunions(id: string): Observable<Planning> {
    return this.http.get<Planning>(
      `${environment.urlBackend}plannings/with-reunions/${id}`,
      { headers: this.getUserHeaders() }
    );
  }
}
