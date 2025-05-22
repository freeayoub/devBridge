import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ProjetService } from 'src/app/services/projets.service';
import { RendusService } from 'src/app/services/rendus.service';
import { AuthuserService } from 'src/app/services/authuser.service';

// Composant pour afficher les détails d'un projet
@Component({
  selector: 'app-project-detail',
  templateUrl: './project-detail.component.html',
  styleUrls: ['./project-detail.component.css'],
})
export class ProjectDetailComponent implements OnInit {
  projetId: string = '';
  projet: any;
  rendu: any;
  isLoading = true;
  hasSubmitted = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private projetService: ProjetService,
    private rendusService: RendusService,
    private authService: AuthuserService
  ) {}

  ngOnInit(): void {
    this.projetId = this.route.snapshot.paramMap.get('id') || '';
    this.loadProjetDetails();
    this.checkRenduStatus();
  }

  loadProjetDetails(): void {
    this.isLoading = true;
    this.projetService.getProjetById(this.projetId).subscribe({
      next: (projet: any) => {
        this.projet = projet;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Erreur lors du chargement du projet', err);
        this.isLoading = false;
        this.router.navigate(['/projects']);
      },
    });
  }

  checkRenduStatus(): void {
    const etudiantId = this.authService.getCurrentUserId();
    if (etudiantId) {
      this.rendusService.checkRenduExists(this.projetId, etudiantId).subscribe({
        next: (exists) => {
          this.hasSubmitted = exists;
        },
        error: (err) => {
          console.error('Erreur lors de la vérification du rendu', err);
        },
      });
    }
  }

  getFileUrl(filePath: string): string {
    // Extraire uniquement le nom du fichier
    let fileName = filePath;

    // Si le chemin contient des slashes ou backslashes, prendre la dernière partie
    if (filePath.includes('/') || filePath.includes('\\')) {
      const parts = filePath.split(/[\/\\]/);
      fileName = parts[parts.length - 1];
    }

    // Utiliser l'endpoint API spécifique pour le téléchargement
    return `http://localhost:3000/api/projets/download/${fileName}`;
  }
}

