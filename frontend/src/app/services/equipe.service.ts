import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap, map } from 'rxjs/operators';
import { Equipe } from '../models/equipe.model';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root',
})
export class EquipeService {
  private apiUrl = `${environment.urlBackend}teams`;

  constructor(private http: HttpClient) {
    console.log('API URL:', this.apiUrl);
  }

  getEquipes(): Observable<Equipe[]> {
    console.log('Fetching teams from:', this.apiUrl);
    return this.http.get<Equipe[]>(this.apiUrl).pipe(
      tap((data) => console.log('Teams received:', data)),
      catchError(this.handleError)
    );
  }

  getEquipe(id: string): Observable<Equipe> {
    console.log(`Fetching team with id ${id} from: ${this.apiUrl}/${id}`);
    return this.http.get<Equipe>(`${this.apiUrl}/${id}`).pipe(
      tap((data) => console.log('Team received:', data)),
      catchError(this.handleError)
    );
  }

  addEquipe(equipe: Equipe): Observable<Equipe> {
    console.log('Adding team:', equipe);
    return this.http.post<Equipe>(this.apiUrl, equipe).pipe(
      tap((data) => console.log('Team added, response:', data)),
      catchError(this.handleError)
    );
  }

  updateEquipe(id: string, equipe: Equipe): Observable<Equipe> {
    console.log(`Updating team with id ${id}:`, equipe);
    return this.http.put<Equipe>(`${this.apiUrl}/${id}`, equipe).pipe(
      tap((data) => console.log('Team updated, response:', data)),
      catchError(this.handleError)
    );
  }

  deleteEquipe(id: string): Observable<any> {
    console.log(`Deleting team with id ${id}`);
    console.log(`API URL: ${this.apiUrl}/${id}`);

    return this.http.delete(`${this.apiUrl}/${id}`).pipe(
      tap((data) => console.log('Team deleted, response:', data)),
      catchError((error) => {
        console.error('Error deleting team:', error);
        console.error('Request URL:', `${this.apiUrl}/${id}`);
        return this.handleError(error);
      })
    );
  }

  addMembreToEquipe(teamId: string, membre: any): Observable<any> {
    console.log(`Adding member to team ${teamId}:`, membre);

    // Créer l'objet attendu par le backend
    const memberData = {
      userId: membre.id,
      role: membre.role || 'membre', // Utiliser le rôle spécifié ou "membre" par défaut
    };

    console.log('Sending to backend:', memberData);
    console.log('Team ID type:', typeof teamId, 'value:', teamId);
    console.log('User ID type:', typeof membre.id, 'value:', membre.id);

    // Utiliser la route directe pour ajouter un membre à une équipe
    return this.http
      .post<any>(`${this.apiUrl}/${teamId}/members`, memberData)
      .pipe(
        tap((data) => console.log('Member added, response:', data)),
        catchError(this.handleError)
      );
  }

  removeMembreFromEquipe(teamId: string, membreId: string): Observable<any> {
    console.log(`Removing member ${membreId} from team ${teamId}`);
    console.log(`API URL: ${this.apiUrl}/${teamId}/members/${membreId}`);

    // Utiliser la route directe pour supprimer un membre d'une équipe
    return this.http
      .delete<any>(`${this.apiUrl}/${teamId}/members/${membreId}`)
      .pipe(
        tap((data) => console.log('Member removed, response:', data)),
        catchError((error) => {
          console.error('Error removing member:', error);
          console.error(
            'Request URL:',
            `${this.apiUrl}/${teamId}/members/${membreId}`
          );
          return this.handleError(error);
        })
      );
  }

  /**
   * Récupère les détails des membres d'une équipe
   * @param teamId ID de l'équipe
   * @returns Observable contenant la liste des membres avec leurs détails
   */
  getTeamMembers(teamId: string): Observable<any[]> {
    console.log(`Fetching team members for team ${teamId}`);
    // Utiliser la route de l'équipe pour récupérer les détails de l'équipe, qui contient les membres
    return this.http.get<any>(`${this.apiUrl}/${teamId}`).pipe(
      map((team) => {
        console.log('Team data received:', team);
        // Transformer les IDs des membres en objets avec l'ID et le rôle
        if (team && team.members) {
          return team.members.map((memberId: string) => ({
            user: memberId,
            role: 'membre', // Par défaut, tous les membres ont le rôle "membre"
            _id: memberId, // Utiliser l'ID du membre comme ID du TeamMember
          }));
        }
        return [];
      }),
      tap((data) => console.log('Team members processed:', data)),
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
