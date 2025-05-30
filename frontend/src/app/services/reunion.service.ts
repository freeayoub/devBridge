import { Injectable } from '@angular/core';
import {HttpHeaders,HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { Reunion, CreateReunionRequest } from '../models/reunion.model';
import { JwtHelperService } from '@auth0/angular-jwt';

@Injectable({
  providedIn: 'root'
})
export class ReunionService {
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

 getAllReunions(): Observable<Reunion[]> {
   return this.http.get<Reunion[]>(`${environment.urlBackend}reunions/getall`);
 }
 getReunionById(id: string): Observable<Reunion> {
   return this.http.get<Reunion>(`${environment.urlBackend}reunions/getone/${id}`);
 }

 createReunion(reunion: CreateReunionRequest): Observable<Reunion> {
   return this.http.post<Reunion>(`${environment.urlBackend}reunions/add`,reunion,{headers: this.getUserHeaders()});
 }

 updateReunion(id: string, reunion: Reunion): Observable<Reunion> {
   return this.http.put<Reunion>(`${environment.urlBackend}reunions/update/${id}`,reunion,{headers: this.getUserHeaders()});
 }
 deleteReunion(id: string): Observable<void> {
   return this.http.delete<void>(`${environment.urlBackend}reunions/delete/${id}`,{headers: this.getUserHeaders()});
 }

 /**
  * Vérifie l'unicité d'un lien de visioconférence
  * @param lienVisio Le lien à vérifier
  * @param excludeReunionId ID de la réunion à exclure (pour la modification)
  */
 checkLienVisioUniqueness(lienVisio: string, excludeReunionId?: string): Observable<any> {
   const body = { lienVisio, excludeReunionId };
   return this.http.post(`${environment.urlBackend}reunions/check-lien-visio`, body, {headers: this.getUserHeaders()});
 }

 getReunionsByPlanning(planningId: string): Observable<Reunion[]> {
   return this.http.get<Reunion[]>(`${environment.urlBackend}reunions/planning/${planningId}`);
 }

 getProchainesReunions(userId: string): Observable<Reunion[]> {
   return this.http.get<Reunion[]>(`${environment.urlBackend}reunions/user/${userId}`);
 }

 // Méthode pour les admins - récupère toutes les réunions
 getAllReunionsAdmin(): Observable<any> {
   return this.http.get<any>(`${environment.urlBackend}reunions/admin/all`, {headers: this.getUserHeaders()});
 }

 // Méthode pour les admins - suppression forcée
 forceDeleteReunion(id: string): Observable<any> {
   return this.http.delete<any>(`${environment.urlBackend}reunions/admin/force-delete/${id}`, {headers: this.getUserHeaders()});
 }

}