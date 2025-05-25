import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { Task } from '../models/task.model';

@Injectable({
  providedIn: 'root',
})
export class TaskService {
  private apiUrl = `${environment.urlBackend}tasks`;

  constructor(private http: HttpClient) {
    console.log('Task API URL:', this.apiUrl);
  }

  // Récupérer toutes les tâches
  getTasks(): Observable<Task[]> {
    return this.http.get<Task[]>(this.apiUrl).pipe(
      tap((data) => console.log('Tasks received:', data)),
      catchError(this.handleError)
    );
  }

  // Récupérer les tâches d'une équipe spécifique
  getTasksByTeam(teamId: string): Observable<Task[]> {
    return this.http.get<Task[]>(`${this.apiUrl}/team/${teamId}`).pipe(
      tap((data) => console.log(`Tasks for team ${teamId} received:`, data)),
      catchError(this.handleError)
    );
  }

  // Récupérer une tâche par son ID
  getTask(id: string): Observable<Task> {
    return this.http.get<Task>(`${this.apiUrl}/${id}`).pipe(
      tap((data) => console.log('Task received:', data)),
      catchError(this.handleError)
    );
  }

  // Créer une nouvelle tâche
  createTask(task: Task): Observable<Task> {
    return this.http.post<Task>(this.apiUrl, task).pipe(
      tap((data) => console.log('Task created:', data)),
      catchError(this.handleError)
    );
  }

  // Mettre à jour une tâche existante
  updateTask(id: string, task: Task): Observable<Task> {
    return this.http.put<Task>(`${this.apiUrl}/${id}`, task).pipe(
      tap((data) => console.log('Task updated:', data)),
      catchError(this.handleError)
    );
  }

  // Supprimer une tâche
  deleteTask(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`).pipe(
      tap((data) => console.log('Task deleted:', data)),
      catchError(this.handleError)
    );
  }

  // Mettre à jour le statut d'une tâche
  updateTaskStatus(
    id: string,
    status: 'todo' | 'in-progress' | 'done'
  ): Observable<Task> {
    return this.http
      .patch<Task>(`${this.apiUrl}/${id}/status`, { status })
      .pipe(
        tap((data) => console.log('Task status updated:', data)),
        catchError(this.handleError)
      );
  }

  // Gérer les erreurs HTTP
  private handleError(error: HttpErrorResponse) {
    let errorMessage = '';
    if (error.error instanceof ErrorEvent) {
      // Erreur côté client
      errorMessage = `Error: ${error.error.message}`;
    } else {
      // Erreur côté serveur
      errorMessage = `Error Code: ${error.status}\nMessage: ${error.message}`;
    }
    console.error(errorMessage);
    return throwError(() => new Error(errorMessage));
  }
}
