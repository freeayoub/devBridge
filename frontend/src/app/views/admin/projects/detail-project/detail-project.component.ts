import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ProjetService } from '@app/services/projets.service';
import { FileService } from 'src/app/services/file.service';
import { RendusService } from '@app/services/rendus.service';

@Component({
  selector: 'app-detail-project',
  templateUrl: './detail-project.component.html',
  styleUrls: ['./detail-project.component.css'],
})
export class DetailProjectComponent implements OnInit {
  projet: any = null;
  rendus: any[] = [];
  totalEtudiants: number = 0;
  etudiantsRendus: any[] = [];
  derniersRendus: any[] = [];
  isLoading: boolean = true;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private projectService: ProjetService,
    private fileService: FileService,
    private rendusService: RendusService
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadProjectData(id);
    }
  }

  loadProjectData(id: string): void {
    this.isLoading = true;

    // Charger les données du projet
    this.projectService.getProjetById(id).subscribe({
      next: (data: any) => {
        this.projet = data;
        this.loadProjectStatistics(id);
      },
      error: (err: any) => {
        console.error('Erreur lors du chargement du projet:', err);
        this.isLoading = false;
      }
    });
  }

  loadProjectStatistics(projetId: string): void {
    // Charger les rendus pour ce projet
    this.rendusService.getRendusByProjet(projetId).subscribe({
      next: (rendus: any[]) => {
        this.rendus = rendus;
        this.etudiantsRendus = rendus.filter(rendu => rendu.etudiant);

        // Trier par date pour avoir les derniers rendus
        this.derniersRendus = [...this.etudiantsRendus]
          .sort((a, b) => new Date(b.dateRendu).getTime() - new Date(a.dateRendu).getTime())
          .slice(0, 5); // Prendre les 5 derniers

        // Pour le total d'étudiants, on peut estimer ou récupérer depuis le backend
        // Pour l'instant, on utilise le nombre d'étudiants uniques qui ont rendu + estimation
        const etudiantsUniques = new Set(this.etudiantsRendus.map(r => r.etudiant._id || r.etudiant));
        this.totalEtudiants = Math.max(etudiantsUniques.size, this.estimateStudentCount());

        this.isLoading = false;
      },
      error: (err: any) => {
        console.error('Erreur lors du chargement des statistiques:', err);
        this.isLoading = false;
      }
    });
  }

  estimateStudentCount(): number {
    // Estimation basée sur le groupe du projet
    const groupe = this.projet?.groupe?.toLowerCase();
    if (groupe?.includes('1c')) return 25; // Première année
    if (groupe?.includes('2c')) return 20; // Deuxième année
    if (groupe?.includes('3c')) return 15; // Troisième année
    return 20; // Valeur par défaut
  }

  getFileUrl(filePath: string): string {
    return this.fileService.getDownloadUrl(filePath);
  }

  deleteProjet(id: string | undefined): void {
    if (!id) return;

    if (confirm('Êtes-vous sûr de vouloir supprimer ce projet ?')) {
      this.projectService.deleteProjet(id).subscribe({
        next: () => {
          alert('Projet supprimé avec succès');
          this.router.navigate(['/admin/projects']);
        },
        error: (err) => {
          console.error('Erreur lors de la suppression du projet', err);
          alert('Erreur lors de la suppression du projet');
        },
      });
    }
  }

  formatDate(date: string | Date): string {
    const d = new Date(date);
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1)
      .toString()
      .padStart(2, '0')}/${d.getFullYear()}`;
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

  getProjectStatus(): string {
    if (!this.projet?.dateLimite) return 'En cours';

    const now = new Date();
    const deadline = new Date(this.projet.dateLimite);

    if (deadline < now) {
      return 'Expiré';
    } else if (deadline.getTime() - now.getTime() < 7 * 24 * 60 * 60 * 1000) {
      return 'Urgent';
    } else {
      return 'Actif';
    }
  }

  getStatusClass(): string {
    const status = this.getProjectStatus();

    switch (status) {
      case 'Actif':
        return 'bg-success/10 dark:bg-dark-accent-secondary/20 text-success dark:text-dark-accent-secondary border border-success/20 dark:border-dark-accent-secondary/30';
      case 'Urgent':
        return 'bg-warning/10 dark:bg-warning/20 text-warning dark:text-warning border border-warning/20 dark:border-warning/30';
      case 'Expiré':
        return 'bg-danger/10 dark:bg-danger-dark/20 text-danger dark:text-danger-dark border border-danger/20 dark:border-danger-dark/30';
      default:
        return 'bg-info/10 dark:bg-dark-accent-primary/20 text-info dark:text-dark-accent-primary border border-info/20 dark:border-dark-accent-primary/30';
    }
  }

  getProgressPercentage(): number {
    if (this.totalEtudiants === 0) return 0;
    return Math.round((this.etudiantsRendus.length / this.totalEtudiants) * 100);
  }

  getRemainingDays(): number {
    if (!this.projet?.dateLimite) return 0;

    const now = new Date();
    const deadline = new Date(this.projet.dateLimite);
    const diffTime = deadline.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return Math.max(0, diffDays);
  }

  getStudentInitials(etudiant: any): string {
    if (!etudiant) return '??';

    // Priorité 1: firstName + lastName
    const firstName = etudiant.firstName || etudiant.prenom || '';
    const lastName = etudiant.lastName || etudiant.nom || '';

    if (firstName && lastName) {
      return (firstName.charAt(0) + lastName.charAt(0)).toUpperCase();
    }

    // Priorité 2: fullName
    const fullName = etudiant.fullName || etudiant.name || '';
    if (fullName) {
      const parts = fullName.trim().split(' ');
      if (parts.length >= 2) {
        return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
      } else {
        return fullName.substring(0, 2).toUpperCase();
      }
    }

    // Priorité 3: firstName seul
    if (firstName) {
      return firstName.substring(0, 2).toUpperCase();
    }

    return '??';
  }

  getStudentName(etudiant: any): string {
    if (!etudiant) return 'Utilisateur inconnu';

    // Priorité 1: firstName + lastName
    const firstName = etudiant.firstName || etudiant.prenom || '';
    const lastName = etudiant.lastName || etudiant.nom || '';

    if (firstName && lastName) {
      return `${firstName} ${lastName}`.trim();
    }

    // Priorité 2: fullName
    const fullName = etudiant.fullName || etudiant.name || '';
    if (fullName) {
      return fullName.trim();
    }

    // Priorité 3: firstName seul
    if (firstName) {
      return firstName.trim();
    }

    // Priorité 4: email comme fallback
    if (etudiant.email) {
      return etudiant.email;
    }

    return 'Utilisateur inconnu';
  }
}
