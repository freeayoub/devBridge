import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ReunionService } from '@app/services/reunion.service';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ToastService } from '@app/services/toast.service';

@Component({
  selector: 'app-reunion-detail',
  templateUrl: './reunion-detail.component.html',
  styleUrls: ['./reunion-detail.component.css']
})
export class ReunionDetailComponent implements OnInit {
  reunion: any = null;
  loading = true;
  error: string | null = null;

  constructor(
    private route: ActivatedRoute,
    public router: Router,
    private reunionService: ReunionService,
    private sanitizer: DomSanitizer,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.loadReunionDetails();
  }

  loadReunionDetails(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.error = 'ID de réunion non fourni';
      this.loading = false;
      return;
    }

    this.reunionService.getReunionById(id).subscribe({
      next: (response: any) => {
        this.reunion = response.reunion;
        this.loading = false;
      },
      error: (err: any) => {
        this.error = err.error?.message || 'Erreur lors du chargement';
        this.loading = false;
        console.error('Erreur:', err);
      }
    });
  }

  formatDescription(description: string): SafeHtml {
    if (!description) return this.sanitizer.bypassSecurityTrustHtml('');

    // Recherche la chaîne "(presence obligatoire)" (insensible à la casse) et la remplace par une version en rouge
    const formattedText = description.replace(
      /\(presence obligatoire\)/gi,
      '<span class="text-red-600 font-semibold">(presence obligatoire)</span>'
    );

    // Sanitize le HTML pour éviter les problèmes de sécurité
    return this.sanitizer.bypassSecurityTrustHtml(formattedText);
  }

  editReunion(): void {
    if (this.reunion) {
      this.router.navigate(['/reunions/edit', this.reunion._id]);
    }
  }

  /**
   * Supprime la réunion après confirmation
   */
  deleteReunion(): void {
    if (!this.reunion) return;

    if (confirm('Êtes-vous sûr de vouloir supprimer cette réunion ? Cette action est irréversible.')) {
      this.reunionService.deleteReunion(this.reunion._id).subscribe({
        next: (response) => {
          console.log('Réunion supprimée avec succès:', response);

          // Afficher le toast de succès
          this.toastService.success(
            'Réunion supprimée',
            'La réunion a été supprimée avec succès'
          );

          // Rediriger vers la liste des réunions
          this.router.navigate(['/reunions']);
        },
        error: (error) => {
          console.error('Erreur lors de la suppression:', error);

          // Gestion spécifique des erreurs d'autorisation
          if (error.status === 403) {
            this.toastService.accessDenied('supprimer cette réunion', error.status);
          } else if (error.status === 401) {
            this.toastService.error(
              'Non autorisé',
              'Vous devez être connecté pour supprimer une réunion'
            );
          } else {
            const errorMessage = error.error?.message || 'Erreur lors de la suppression de la réunion';
            this.toastService.error(
              'Erreur de suppression',
              errorMessage,
              8000
            );
          }
        }
      });
    }
  }
}