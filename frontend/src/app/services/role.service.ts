import { Injectable } from '@angular/core';
import { JwtHelperService } from '@auth0/angular-jwt';
import { BehaviorSubject, Observable } from 'rxjs';
import { User } from '@app/models/user.model';

export interface UserPermissions {
  canCreatePlanning: boolean;
  canEditPlanning: boolean;
  canDeletePlanning: boolean;
  canCreateReunion: boolean;
  canEditReunion: boolean;
  canDeleteReunion: boolean;
  canViewAllUsers: boolean;
  canManageUsers: boolean;
  canAccessAdminPanel: boolean;
  canForceDelete: boolean;
  canViewDetailedReports: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class RoleService {
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  private permissionsSubject = new BehaviorSubject<UserPermissions | null>(null);
  public permissions$ = this.permissionsSubject.asObservable();

  constructor(private jwtHelper: JwtHelperService) {
    this.loadCurrentUser();
  }

  /**
   * Charge l'utilisateur actuel depuis le token
   */
  private loadCurrentUser(): void {
    const token = localStorage.getItem('token');
    if (token && !this.jwtHelper.isTokenExpired(token)) {
      const decodedToken = this.jwtHelper.decodeToken(token);
      const user: User = {
        _id: decodedToken.id,
        id: decodedToken.id,
        username: decodedToken.username,
        email: decodedToken.email,
        role: decodedToken.role,
        image: decodedToken.image,
        isActive: true
      };
      this.currentUserSubject.next(user);
      this.updatePermissions(user.role);
    }
  }

  /**
   * Met à jour les permissions basées sur le rôle
   */
  private updatePermissions(role: string): void {
    const permissions: UserPermissions = {
      canCreatePlanning: this.canCreatePlanning(role),
      canEditPlanning: this.canEditPlanning(role),
      canDeletePlanning: this.canDeletePlanning(role),
      canCreateReunion: this.canCreateReunion(role),
      canEditReunion: this.canEditReunion(role),
      canDeleteReunion: this.canDeleteReunion(role),
      canViewAllUsers: this.canViewAllUsers(role),
      canManageUsers: this.canManageUsers(role),
      canAccessAdminPanel: this.canAccessAdminPanel(role),
      canForceDelete: this.canForceDelete(role),
      canViewDetailedReports: this.canViewDetailedReports(role)
    };
    this.permissionsSubject.next(permissions);
  }

  /**
   * Obtient l'utilisateur actuel
   */
  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  /**
   * Obtient le rôle de l'utilisateur actuel
   */
  getCurrentUserRole(): string | null {
    const user = this.getCurrentUser();
    return user ? user.role : null;
  }

  /**
   * Vérifie si l'utilisateur actuel est admin
   */
  isAdmin(): boolean {
    return this.getCurrentUserRole() === 'admin';
  }

  /**
   * Vérifie si l'utilisateur actuel est tuteur
   */
  isTutor(): boolean {
    return this.getCurrentUserRole() === 'tutor';
  }

  /**
   * Vérifie si l'utilisateur actuel est étudiant
   */
  isStudent(): boolean {
    return this.getCurrentUserRole() === 'student';
  }

  /**
   * Vérifie si l'utilisateur actuel est alumni
   */
  isAlumni(): boolean {
    return this.getCurrentUserRole() === 'alumni';
  }

  /**
   * Vérifie si l'utilisateur peut créer des plannings
   */
  canCreatePlanning(role?: string): boolean {
    const userRole = role || this.getCurrentUserRole();
    return ['admin', 'tutor', 'alumni'].includes(userRole || '');
  }

  /**
   * Vérifie si l'utilisateur peut éditer des plannings
   */
  canEditPlanning(role?: string): boolean {
    const userRole = role || this.getCurrentUserRole();
    return ['admin', 'tutor', 'alumni'].includes(userRole || '');
  }

  /**
   * Vérifie si l'utilisateur peut supprimer des plannings
   */
  canDeletePlanning(role?: string): boolean {
    const userRole = role || this.getCurrentUserRole();
    return ['admin', 'tutor'].includes(userRole || '');
  }

  /**
   * Vérifie si l'utilisateur peut créer des réunions
   */
  canCreateReunion(role?: string): boolean {
    const userRole = role || this.getCurrentUserRole();
    return ['admin', 'tutor', 'alumni', 'student'].includes(userRole || '');
  }

  /**
   * Vérifie si l'utilisateur peut éditer des réunions
   */
  canEditReunion(role?: string): boolean {
    const userRole = role || this.getCurrentUserRole();
    return ['admin', 'tutor', 'alumni', 'student'].includes(userRole || '');
  }

  /**
   * Vérifie si l'utilisateur peut supprimer des réunions
   */
  canDeleteReunion(role?: string): boolean {
    const userRole = role || this.getCurrentUserRole();
    return ['admin', 'tutor', 'alumni'].includes(userRole || '');
  }

  /**
   * Vérifie si l'utilisateur peut voir tous les utilisateurs
   */
  canViewAllUsers(role?: string): boolean {
    const userRole = role || this.getCurrentUserRole();
    return ['admin', 'tutor'].includes(userRole || '');
  }

  /**
   * Vérifie si l'utilisateur peut gérer les utilisateurs
   */
  canManageUsers(role?: string): boolean {
    const userRole = role || this.getCurrentUserRole();
    return userRole === 'admin';
  }

  /**
   * Vérifie si l'utilisateur peut accéder au panel admin
   */
  canAccessAdminPanel(role?: string): boolean {
    const userRole = role || this.getCurrentUserRole();
    return userRole === 'admin';
  }

  /**
   * Vérifie si l'utilisateur peut forcer la suppression
   */
  canForceDelete(role?: string): boolean {
    const userRole = role || this.getCurrentUserRole();
    return userRole === 'admin';
  }

  /**
   * Vérifie si l'utilisateur peut voir les rapports détaillés
   */
  canViewDetailedReports(role?: string): boolean {
    const userRole = role || this.getCurrentUserRole();
    return ['admin', 'tutor'].includes(userRole || '');
  }

  /**
   * Vérifie si l'utilisateur est propriétaire d'une ressource
   */
  isOwner(resourceCreatorId: string): boolean {
    const currentUser = this.getCurrentUser();
    return currentUser ? currentUser._id === resourceCreatorId : false;
  }

  /**
   * Vérifie si l'utilisateur peut modifier une ressource (propriétaire ou admin)
   */
  canModifyResource(resourceCreatorId: string): boolean {
    return this.isAdmin() || this.isOwner(resourceCreatorId);
  }

  /**
   * Vérifie si l'utilisateur peut supprimer une ressource (propriétaire ou admin)
   */
  canDeleteResource(resourceCreatorId: string): boolean {
    return this.isAdmin() || this.isOwner(resourceCreatorId);
  }

  /**
   * Met à jour l'utilisateur actuel (appelé après login)
   */
  updateCurrentUser(user: User): void {
    this.currentUserSubject.next(user);
    this.updatePermissions(user.role);
  }

  /**
   * Nettoie les données utilisateur (appelé après logout)
   */
  clearUserData(): void {
    this.currentUserSubject.next(null);
    this.permissionsSubject.next(null);
  }

  /**
   * Obtient un message d'erreur personnalisé basé sur le rôle
   */
  getAccessDeniedMessage(action: string): string {
    const role = this.getCurrentUserRole();
    const roleNames = {
      'admin': 'Administrateur',
      'tutor': 'Tuteur',
      'alumni': 'Alumni',
      'student': 'Étudiant'
    };

    return `Accès refusé. Votre rôle (${roleNames[role as keyof typeof roleNames] || role}) ne vous permet pas de ${action}.`;
  }
}