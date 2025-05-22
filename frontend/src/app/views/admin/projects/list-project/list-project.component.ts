import { Component, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { Projet } from 'src/app/models/projet.model';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { ProjetService } from 'src/app/services/projets.service';
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
    console.log('Initialisation du composant ListProjectComponent');
    this.loadProjets();
    this.checkAdminStatus();
  }

  loadProjets(): void {
    this.isLoading = true;
    console.log('Chargement des projets...');
    this.projetService.getProjets().subscribe({
      next: (projets) => {
        console.log('Projets reçus:', projets);
        this.projets = projets;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading projects', err);
        this.isLoading = false;
        // Afficher un message d'erreur à l'utilisateur
        alert('Erreur lors du chargement des projets: ' + (err.error?.message || err.message || 'Erreur inconnue'));
      },
    });
  }

  // Alias pour loadProjets pour assurer la compatibilité avec les méthodes existantes
  loadProjects(): void {
    this.loadProjets();
  }

  checkAdminStatus(): void {
    this.isAdmin = this.authService.isAdmin();
    console.log('Statut admin:', this.isAdmin);
  }


  editProjet(projetId: string | undefined): void {
    if (!projetId) {
      console.error('ID du projet non défini');
      return;
    }
    console.log('Édition du projet:', projetId);
    this.router.navigate(['/admin/projects/edit', projetId]);
  }

  viewProjetDetails(projetId: string | undefined): void {
    if (!projetId) {
      console.error('ID du projet non défini');
      return;
    }
    console.log('Affichage des détails du projet:', projetId);
    this.router.navigate(['/admin/projects/detail', projetId]);
  }

  deleteProjet(projetId: string | undefined): void {
    if (!projetId) {
      console.error('ID du projet non défini');
      return;
    }
    
    if (confirm('Êtes-vous sûr de vouloir supprimer ce projet ?')) {
      console.log('Suppression du projet confirmée:', projetId);
      this.projetService.deleteProjet(projetId).subscribe({
        next: () => {
          console.log('Projet supprimé avec succès');
          alert('Projet supprimé avec succès');
          this.loadProjets();  // Reload the projects after deletion
        },
        error: (err) => {
          console.error('Error deleting project', err);
          alert('Erreur lors de la suppression du projet: ' + (err.error?.message || err.message || 'Erreur inconnue'));
        },
      });
    }
  }

  openDeleteDialog(id: string): void {
    if (!id) {
      console.error('ID du projet non défini');
      return;
    }
    console.log('Ouverture de la boîte de dialogue de confirmation pour la suppression du projet:', id);
    this.showDeleteDialog = true;  // Show confirmation dialog
    this.projectIdToDelete = id;  // Store the ID of the project to be deleted
  }

  onDeleteConfirm(): void {
    if (this.projectIdToDelete) {
      console.log('Suppression du projet confirmée:', this.projectIdToDelete);
      this.projetService.deleteProjet(this.projectIdToDelete).subscribe({
        next: () => {
          console.log('Projet supprimé avec succès');
          alert('Projet supprimé avec succès');
          this.loadProjets();  // Reload the projects after deletion
          this.showDeleteDialog = false;  // Close the confirmation dialog
        },
        error: (err) => {
          console.error('Error deleting project', err);
          alert('Erreur lors de la suppression du projet: ' + (err.error?.message || err.message || 'Erreur inconnue'));
          this.showDeleteDialog = false;
        },
      });
    }
  }

  onDeleteCancel(): void {
    console.log('Suppression du projet annulée');
    this.showDeleteDialog = false;  // Close the confirmation dialog without deleting
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
}






