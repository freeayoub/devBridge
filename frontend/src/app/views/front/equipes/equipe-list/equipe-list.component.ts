import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { EquipeService } from 'src/app/services/equipe.service';
import { NotificationService } from 'src/app/services/notification.service';
import { Equipe } from 'src/app/models/equipe.model';
import { finalize } from 'rxjs/operators';

@Component({
  selector: 'app-equipe-list',
  templateUrl: './equipe-list.component.html',
  styleUrls: ['./equipe-list.component.css']
})
export class EquipeListComponent implements OnInit {
  equipes: Equipe[] = [];
  loading = false;
  error: string | null = null;

  constructor(
    private equipeService: EquipeService,
    private router: Router,
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    this.loadEquipes();
  }

  loadEquipes(): void {
    this.loading = true;
    this.error = null;

    this.equipeService.getEquipes().pipe(
      finalize(() => this.loading = false)
    ).subscribe({
      next: (data) => {
        console.log('Équipes chargées:', data);
        this.equipes = data;

        // Trier les équipes par nom
        this.equipes.sort((a, b) => {
          if (a.name && b.name) {
            return a.name.localeCompare(b.name);
          }
          return 0;
        });
      },
      error: (error) => {
        console.error('Erreur lors du chargement des équipes:', error);
        this.error = 'Impossible de charger les équipes. Veuillez réessayer plus tard.';
        this.notificationService.showError('Erreur lors du chargement des équipes');
      }
    });
  }

  navigateToAddEquipe(): void {
    this.router.navigate(['/equipes/ajouter']);
  }

  navigateToEditEquipe(id: string): void {
    this.router.navigate(['/equipes/modifier', id]);
  }

  navigateToEquipeDetail(id: string): void {
    this.router.navigate(['/equipes/detail', id]);
  }

  deleteEquipe(id: string): void {
    if (!id) {
      console.error('ID est indéfini');
      this.notificationService.showError('ID d\'équipe invalide');
      return;
    }

    // Trouver le nom de l'équipe pour l'afficher dans le message de confirmation
    const equipe = this.equipes.find(e => e._id === id);
    const equipeName = equipe?.name || 'cette équipe';

    if (confirm(`Êtes-vous sûr de vouloir supprimer l'équipe "${equipeName}" ?`)) {
      this.loading = true;

      this.equipeService.deleteEquipe(id).pipe(
        finalize(() => this.loading = false)
      ).subscribe({
        next: () => {
          console.log('Équipe supprimée avec succès');
          this.notificationService.showSuccess(`L'équipe "${equipeName}" a été supprimée avec succès`);
          this.loadEquipes();
        },
        error: (error) => {
          console.error('Erreur lors de la suppression de l\'équipe:', error);
          this.error = 'Impossible de supprimer l\'équipe. Veuillez réessayer plus tard.';
          this.notificationService.showError(`Erreur lors de la suppression de l'équipe "${equipeName}"`);
        }
      });
    }
  }

  navigateToTasks(id: string): void {
    if (!id) {
      console.error('ID est indéfini');
      this.notificationService.showError('ID d\'équipe invalide');
      return;
    }

    const equipe = this.equipes.find(e => e._id === id);
    const equipeName = equipe?.name || 'cette équipe';

    // Naviguer vers la page des tâches de l'équipe
    this.router.navigate(['/tasks', id]);    }
}

