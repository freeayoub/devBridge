import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ProjetService } from '@app/services/projets.service';
import { RendusService } from 'src/app/services/rendus.service';
import { AuthuserService } from 'src/app/services/authuser.service';

// Composant pour afficher les détails d'un projet
@Component({
  selector: 'app-project-detail',
  templateUrl: './project-detail.component.html',
  styleUrls: ['./project-detail.component.css']
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
        next: (exists: boolean) => {
          console.log(exists)
          this.hasSubmitted = exists;
        },
        error: (err: any) => {
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

  getFileName(filePath: string): string {
    if (!filePath) return 'Fichier';

    // Si le chemin contient des slashes ou backslashes, prendre la dernière partie
    if (filePath.includes('/') || filePath.includes('\\')) {
      const parts = filePath.split(/[\/\\]/);
      return parts[parts.length - 1];
    }

    return filePath;
  }

  getProjectStatus(): 'completed' | 'urgent' | 'expired' | 'active' {
    if (this.hasSubmitted) return 'completed';

    if (!this.projet?.dateLimite) return 'active';

    const now = new Date();
    const deadline = new Date(this.projet.dateLimite);

    if (deadline < now) return 'expired';

    const oneWeekFromNow = new Date();
    oneWeekFromNow.setDate(oneWeekFromNow.getDate() + 7);

    if (deadline <= oneWeekFromNow) return 'urgent';

    return 'active';
  }

  getStatusClass(): string {
    const status = this.getProjectStatus();

    switch (status) {
      case 'completed':
        return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 border border-green-200 dark:border-green-800/30';
      case 'urgent':
        return 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-400 border border-orange-200 dark:border-orange-800/30';
      case 'expired':
        return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400 border border-red-200 dark:border-red-800/30';
      default:
        return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400 border border-blue-200 dark:border-blue-800/30';
    }
  }

  getStatusText(): string {
    const status = this.getProjectStatus();

    switch (status) {
      case 'completed':
        return 'Projet soumis';
      case 'urgent':
        return 'Urgent';
      case 'expired':
        return 'Expiré';
      default:
        return 'Actif';
    }
  }

  getRemainingDays(): number {
    if (!this.projet?.dateLimite) return 0;

    const now = new Date();
    const deadline = new Date(this.projet.dateLimite);
    const diffTime = deadline.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return Math.max(0, diffDays);
  }
}
