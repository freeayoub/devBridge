import { Injectable } from '@angular/core';
import { HttpHeaders, HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { Reunion } from '../models/reunion.model';
import { JwtHelperService } from '@auth0/angular-jwt';

@Injectable({
  providedIn: 'root',
})
export class ReunionService {
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

  getAllReunions(): Observable<Reunion[]> {
    return this.http.get<Reunion[]>(
      `${environment.urlBackend}reunions/getall`,
      { headers: this.getUserHeaders() }
    );
  }
  getReunionById(id: string): Observable<Reunion> {
    return this.http.get<Reunion>(
      `${environment.urlBackend}reunions/getone/${id}`,
      { headers: this.getUserHeaders() }
    );
  }

  createReunion(reunion: Reunion): Observable<Reunion> {
    return this.http.post<Reunion>(
      `${environment.urlBackend}reunions/add`,
      reunion,
      { headers: this.getUserHeaders() }
    );
  }

  updateReunion(id: string, reunion: Reunion): Observable<Reunion> {
    return this.http.put<Reunion>(
      `${environment.urlBackend}reunions/update/${id}`,
      reunion,
      { headers: this.getUserHeaders() }
    );
  }
  deleteReunion(id: string): Observable<void> {
    return this.http.delete<void>(
      `${environment.urlBackend}reunions/delete/${id}`,
      { headers: this.getUserHeaders() }
    );
  }

  getReunionsByPlanning(planningId: string): Observable<Reunion[]> {
    return this.http.get<Reunion[]>(
      `${environment.urlBackend}reunions/planning/${planningId}`,
      { headers: this.getUserHeaders() }
    );
  }

  getProchainesReunions(userId: string): Observable<Reunion[]> {
    return this.http.get<Reunion[]>(
      `${environment.urlBackend}reunions/user/${userId}`,
      { headers: this.getUserHeaders() }
    );
  }
}
