import { Component, OnInit } from '@angular/core';
import { ProjetService } from '@app/services/projets.service';
import { Projet } from 'src/app/models/projet.model';
import { AuthuserService } from 'src/app/services/authuser.service';
import { RendusService } from 'src/app/services/rendus.service';
import { FileService } from 'src/app/services/file.service';
import { environment } from 'src/environments/environment';

// Composant pour afficher la liste des projets
@Component({
  selector: 'app-project-list',
  templateUrl: './project-list.component.html',
  styleUrls: ['./project-list.component.css'],
})
export class ProjectListComponent implements OnInit {
  projets: Projet[] = [];
  rendusMap: Map<string, boolean> = new Map();
  isLoading = true;
  userGroup: string = '';

  constructor(
    private projetService: ProjetService,
    private authService: AuthuserService,
    private rendusService: RendusService,
    private fileService: FileService
  ) {}

  ngOnInit(): void {
    // On garde cette ligne pour une utilisation future
    this.userGroup = this.authService.getCurrentUser()?.groupe || '';
    this.loadProjets();
  }

  loadProjets(): void {
    this.isLoading = true;
    this.projetService.getProjets().subscribe({
      next: (projets: Projet[]) => {
        // Afficher tous les projets sans filtrage
        this.projets = projets;
        this.isLoading = false;

        // Vérifier quels projets ont déjà été rendus par l'étudiant
        this.projets.forEach((projet) => {
          if (projet._id) {
            this.checkRenduStatus(projet._id);
          }
        });
      },
      error: (error: any) => {
        console.error('Erreur lors du chargement des projets', error);
        this.isLoading = false;
      },
    });
  }

  checkRenduStatus(projetId: string): void {
    const etudiantId = this.authService.getCurrentUserId();
    if (!etudiantId) return;

    this.rendusService.checkRenduExists(projetId, etudiantId).subscribe({
      next: (exists: boolean) => {
        this.rendusMap.set(projetId, exists);
      },
      error: (error: any) => {
        console.error(
          `Erreur lors de la vérification du rendu pour le projet ${projetId}`,
          error
        );
      },
    });
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

    // Utiliser la route qui pointe vers le bon emplacement
    return `${environment.urlBackend}projets/telecharger/${fileName}`;
  }

  getFileName(filePath: string): string {
    if (!filePath) return 'fichier';

    // Extraire uniquement le nom du fichier
    if (filePath.includes('/') || filePath.includes('\\')) {
      const parts = filePath.split(/[\/\\]/);
      return parts[parts.length - 1];
    }

    return filePath;
  }

  // Méthode pour vérifier si un projet a été rendu
  isRendu(projetId: string | undefined): boolean {
    return projetId ? this.rendusMap.get(projetId) === true : false;
  }
}
