import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Toast } from 'src/app/models/message.model';

@Injectable({
  providedIn: 'root',
})
export class ToastService {
  private toastsSubject = new BehaviorSubject<Toast[]>([]);
  toasts$ = this.toastsSubject.asObservable();
  private currentId = 0;

  constructor() {}
  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  private addToast(toast: Omit<Toast, 'id'>): void {
    const newToast: Toast = {
      ...toast,
      id: this.generateId(),
      duration: toast.duration || 5000,
    };

    const currentToasts = this.toastsSubject.value;
    this.toastsSubject.next([...currentToasts, newToast]);

    // Auto-remove toast after duration
    if (newToast.duration && newToast.duration > 0) {
      setTimeout(() => {
        this.removeToast(newToast.id);
      }, newToast.duration);
    }
  }
  show(
    message: string,
    type: 'success' | 'error' | 'warning' | 'info' = 'info',
    duration = 5000
  ) {
    const id = this.generateId();
    const toast: Toast = { id, type, title: '', message, duration };
    const currentToasts = this.toastsSubject.value;
    this.toastsSubject.next([...currentToasts, toast]);

    if (duration > 0) {
      setTimeout(() => this.dismiss(id), duration);
    }
  }

  showSuccess(message: string, duration = 3000) {
    this.show(message, 'success', duration);
  }

  showError(message: string, duration = 5000) {
    this.show(message, 'error', duration);
  }

  showWarning(message: string, duration = 4000) {
    this.show(message, 'warning', duration);
  }

  showInfo(message: string, duration = 3000) {
    this.show(message, 'info', duration);
  }

  dismiss(id: string) {
    const currentToasts = this.toastsSubject.value.filter((t) => t.id !== id);
    this.toastsSubject.next(currentToasts);
  }
  success(title: string, message: string, duration?: number): void {
    this.addToast({
      type: 'success',
      title,
      message,
      duration,
      icon: 'check-circle',
    });
  }
  error(
    title: string,
    message: string,
    duration?: number,
    action?: Toast['action']
  ): void {
    this.addToast({
      type: 'error',
      title,
      message,
      duration: duration || 8000, // Longer duration for errors
      icon: 'x-circle',
      action,
    });
  }

  warning(title: string, message: string, duration?: number): void {
    this.addToast({
      type: 'warning',
      title,
      message,
      duration,
      icon: 'exclamation-triangle',
    });
  }
  // Méthodes spécifiques pour les erreurs d'autorisation
  accessDenied(action: string = 'effectuer cette action', code?: number): void {
    const codeText = code ? ` (Code: ${code})` : '';
    this.error(
      'Accès refusé',
      `Vous n'avez pas les permissions nécessaires pour ${action}${codeText}`,
      8000,
      {
        label: 'Comprendre les rôles',
        handler: () => {
          // Optionnel: rediriger vers une page d'aide
          console.log("Redirection vers l'aide sur les rôles");
        },
      }
    );
  }

  ownershipRequired(resource: string = 'cette ressource'): void {
    this.error(
      'Propriétaire requis',
      `Seul le propriétaire ou un administrateur peut modifier ${resource}`,
      8000
    );
  }

  removeToast(id: string): void {
    const currentToasts = this.toastsSubject.value;
    this.toastsSubject.next(currentToasts.filter((toast) => toast.id !== id));
  }
  clear() {
    this.toastsSubject.next([]);
  }
}
