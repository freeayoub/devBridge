import { Component, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { Projet } from 'src/app/models/projet.model';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { ProjetService } from '@app/services/projets.service';
import { DataService } from 'src/app/services/data.service';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-list-project',
  templateUrl: './list-project.component.html',
  styleUrls: ['./list-project.component.css'],
})
export class ListProjectComponent implements OnInit {
  projets: Projet[] = [];
  isLoading = true;
  isAdmin = false;
  showDeleteDialog = false;
  projectIdToDelete: string | null = null;

  // For the confirmation dialog
  dialogRef?: MatDialogRef<any>;
  dialogData = {
    title: 'Confirmer la suppression',
    message: 'Êtes-vous sûr de vouloir supprimer ce projet?',
  };

  @ViewChild('confirmDialog') confirmDialog!: TemplateRef<any>;

  constructor(
    private projetService: ProjetService,
    private router: Router,
    private dialog: MatDialog,
    private authService: DataService
  ) {}

  ngOnInit(): void {
    this.loadProjets();
    this.checkAdminStatus();
  }

  loadProjets(): void {
    this.isLoading = true;
    this.projetService.getProjets().subscribe({
      next: (projets) => {
        this.projets = projets;
        this.isLoading = false;
      },
      error: (err) => {
        this.isLoading = false;
        alert(
          'Erreur lors du chargement des projets: ' +
            (err.error?.message || err.message || 'Erreur inconnue')
        );
      },
    });
  }

  // Alias pour loadProjets pour assurer la compatibilité avec les méthodes existantes
  loadProjects(): void {
    this.loadProjets();
  }

  checkAdminStatus(): void {
    this.isAdmin = this.authService.isAdmin();
  }

  editProjet(projetId: string | undefined): void {
    if (!projetId) {
      return;
    }
    this.router.navigate(['/admin/projects/edit', projetId]);
  }

  viewProjetDetails(projetId: string | undefined): void {
    if (!projetId) {
      return;
    }
    this.router.navigate(['/admin/projects/detail', projetId]);
  }

  deleteProjet(projetId: string | undefined): void {
    if (!projetId) {
      return;
    }

    if (confirm('Êtes-vous sûr de vouloir supprimer ce projet ?')) {
      this.projetService.deleteProjet(projetId).subscribe({
        next: () => {
          alert('Projet supprimé avec succès');
          this.loadProjets();
        },
        error: (err) => {
          alert(
            'Erreur lors de la suppression du projet: ' +
              (err.error?.message || err.message || 'Erreur inconnue')
          );
        },
      });
    }
  }

  openDeleteDialog(id: string): void {
    if (!id) {
      return;
    }
    this.showDeleteDialog = true;
    this.projectIdToDelete = id;
  }

  onDeleteConfirm(): void {
    if (this.projectIdToDelete) {
      this.projetService.deleteProjet(this.projectIdToDelete).subscribe({
        next: () => {
          alert('Projet supprimé avec succès');
          this.loadProjets();
          this.showDeleteDialog = false;
        },
        error: (err) => {
          alert(
            'Erreur lors de la suppression du projet: ' +
              (err.error?.message || err.message || 'Erreur inconnue')
          );
          this.showDeleteDialog = false;
        },
      });
    }
  }

  onDeleteCancel(): void {
    this.showDeleteDialog = false;
  }

  getFileUrl(filePath: string): string {
    if (!filePath) return '';

    // Extraire uniquement le nom du fichier
    let fileName = filePath;

    // Si le chemin contient des slashes ou backslashes, prendre la dernière partie
    if (filePath.includes('/') || filePath.includes('\\')) {
      const parts = filePath.split(/[\/\\]/);
      fileName = parts[parts.length - 1];
    }

    // Utiliser la route spécifique pour le téléchargement
    return `${environment.urlBackend}projets/telecharger/${fileName}`;
  }

  getFileName(filePath: string): string {
    if (!filePath) return 'Fichier';

    // Si le chemin contient des slashes ou backslashes, prendre la dernière partie
    if (filePath.includes('/') || filePath.includes('\\')) {
      const parts = filePath.split(/[\/\\]/);
      return parts[parts.length - 1];
    }

    return filePath;
  }

  getActiveProjectsCount(): number {
    if (!this.projets) return 0;

    const now = new Date();
    return this.projets.filter(projet => {
      if (!projet.dateLimite) return true; // Considérer comme actif si pas de date limite
      const dateLimit = new Date(projet.dateLimite);
      return dateLimit >= now; // Actif si la date limite n'est pas dépassée
    }).length;
  }

  getExpiredProjectsCount(): number {
    if (!this.projets) return 0;

    const now = new Date();
    return this.projets.filter(projet => {
      if (!projet.dateLimite) return false; // Pas expiré si pas de date limite
      const dateLimit = new Date(projet.dateLimite);
      return dateLimit < now; // Expiré si la date limite est dépassée
    }).length;
  }

  getUniqueGroupsCount(): number {
    if (!this.projets) return 0;

    const uniqueGroups = new Set(
      this.projets
        .map(projet => projet.groupe)
        .filter(groupe => groupe && groupe.trim() !== '')
    );

    return uniqueGroups.size;
  }

  getCompletionPercentage(): number {
    if (!this.projets || this.projets.length === 0) return 0;

    const expiredCount = this.getExpiredProjectsCount();
    const totalCount = this.projets.length;

    return Math.round((expiredCount / totalCount) * 100);
  }

  getProjectsByGroup(): { [key: string]: number } {
    if (!this.projets) return {};

    const groupCounts: { [key: string]: number } = {};

    this.projets.forEach(projet => {
      const groupe = projet.groupe || 'Non spécifié';
      groupCounts[groupe] = (groupCounts[groupe] || 0) + 1;
    });

    return groupCounts;
  }

  getRecentProjects(): Projet[] {
    if (!this.projets) return [];

    // Comme nous n'avons pas de dateCreation, on retourne les projets récents basés sur la date limite
    const now = new Date();
    const oneMonthFromNow = new Date();
    oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1);

    return this.projets.filter(projet => {
      if (!projet.dateLimite) return false;
      const deadline = new Date(projet.dateLimite);
      return deadline >= now && deadline <= oneMonthFromNow;
    });
  }

  getUpcomingDeadlines(): Projet[] {
    if (!this.projets) return [];

    const now = new Date();
    const oneWeekFromNow = new Date();
    oneWeekFromNow.setDate(oneWeekFromNow.getDate() + 7);

    return this.projets.filter(projet => {
      if (!projet.dateLimite) return false;
      const deadline = new Date(projet.dateLimite);
      return deadline >= now && deadline <= oneWeekFromNow;
    }).sort((a, b) => {
      const dateA = new Date(a.dateLimite!);
      const dateB = new Date(b.dateLimite!);
      return dateA.getTime() - dateB.getTime();
    });
  }
}
