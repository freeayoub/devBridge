import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { RendusService } from '@app/services/rendus.service';
import { ProjetService } from '@app/services/projets.service';
import { DatePipe } from '@angular/common';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-list-rendus',
  templateUrl: './list-rendus.component.html',
  styleUrls: ['./list-rendus.component.css'],
  providers: [DatePipe]
})
export class ListRendusComponent implements OnInit {
  rendus: any[] = [];
  filteredRendus: any[] = [];
  isLoading = true;
  error = '';
  searchTerm = '';
  filterStatus: 'all' | 'evaluated' | 'pending' = 'all';
  
  // Nouvelles propriétés pour les filtres
  filtreGroupe: string = '';
  filtreProjet: string = '';
  groupes: string[] = [];
  projets: any[] = [];

  constructor(
    private rendusService: RendusService,
    private projetService: ProjetService,
    private router: Router,
    private datePipe: DatePipe
  ) { }

  ngOnInit(): void {
    this.loadRendus();
    this.loadProjets();
    this.extractGroupes();
  }

  loadRendus(): void {
    this.isLoading = true;
    this.rendusService.getAllRendus().subscribe({
      next: (data) => {
        this.rendus = data;
        this.extractGroupes();
        this.applyFilters();
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Erreur lors du chargement des rendus', err);
        this.error = 'Impossible de charger les rendus. Veuillez réessayer plus tard.';
        this.isLoading = false;
      }
    });
  }

  loadProjets(): void {
    this.projetService.getProjets().subscribe({
      next: (data) => {
        this.projets = data;
      },
      error: (err) => {
        console.error('Erreur lors du chargement des projets', err);
      }
    });
  }

  extractGroupes(): void {
    // Extraire les groupes uniques des rendus
    if (this.rendus && this.rendus.length > 0) {
      const groupesSet = new Set<string>();
      this.rendus.forEach(rendu => {
        if (rendu.etudiant?.groupe) {
          groupesSet.add(rendu.etudiant.groupe);
        }
      });
      this.groupes = Array.from(groupesSet);
    }
  }

  applyFilters(): void {
    let results = this.rendus;
    
    // Filtre par statut d'évaluation
    if (this.filterStatus === 'evaluated') {
      results = results.filter(rendu => rendu.evaluation && rendu.evaluation.scores);
    } else if (this.filterStatus === 'pending') {
      results = results.filter(rendu => !rendu.evaluation || !rendu.evaluation.scores);
    }
    
    // Filtre par terme de recherche
    if (this.searchTerm.trim() !== '') {
      const term = this.searchTerm.toLowerCase().trim();
      results = results.filter(rendu => 
        (rendu.etudiant?.nom?.toLowerCase().includes(term) || 
         rendu.etudiant?.prenom?.toLowerCase().includes(term) ||
         rendu.projet?.titre?.toLowerCase().includes(term))
      );
    }

    // Filtre par groupe
    if (this.filtreGroupe) {
      results = results.filter(rendu => rendu.etudiant?.groupe === this.filtreGroupe);
    }

    // Filtre par projet
    if (this.filtreProjet) {
      results = results.filter(rendu => rendu.projet?._id === this.filtreProjet);
    }
    
    this.filteredRendus = results;
  }

  // Méthode pour la compatibilité avec le template
  filtrerRendus(): any[] {
    return this.filteredRendus;
  }

  onSearchChange(): void {
    this.applyFilters();
  }

  setFilterStatus(status: 'all' | 'evaluated' | 'pending'): void {
    this.filterStatus = status;
    this.applyFilters();
  }

  evaluateRendu(renduId: string): void {
    this.router.navigate(['/admin/projects/evaluate', renduId]);
  }

  // Méthode pour la compatibilité avec le template
  evaluerRendu(renduId: string, mode: 'manual' | 'ai'): void {
    // Rediriger vers la page d'évaluation avec le mode approprié
    this.router.navigate(['/admin/projects/evaluate', renduId], { 
      queryParams: { mode: mode } 
    });
  }

  viewEvaluationDetails(renduId: string): void {
    this.router.navigate(['/admin/projects/evaluation-details', renduId]);
  }

  getStatusClass(rendu: any): string {
    if (rendu.evaluation && rendu.evaluation.scores) {
      return 'bg-green-100 text-green-800';
    }
    return 'bg-yellow-100 text-yellow-800';
  }

  // Méthode pour la compatibilité avec le template
  getClasseStatut(rendu: any): string {
    return this.getStatusClass(rendu);
  }

  getStatusText(rendu: any): string {
    // Vérifier si l'évaluation existe de plusieurs façons
    if (rendu.evaluation && rendu.evaluation._id) {
      return 'Évalué';
    }
    if (rendu.statut === 'évalué') {
      return 'Évalué';
    }
    return 'En attente';
  }

  // Méthode pour la compatibilité avec le template
  getStatutEvaluation(rendu: any): string {
    return this.getStatusText(rendu);
  }

  getScoreTotal(rendu: any): number {
    if (!rendu.evaluation || !rendu.evaluation.scores) return 0;
    
    const scores = rendu.evaluation.scores;
    return scores.structure + scores.pratiques + scores.fonctionnalite + scores.originalite;
  }

  getScoreClass(score: number): string {
    if (score >= 16) return 'text-green-600';
    if (score >= 12) return 'text-blue-600';
    if (score >= 8) return 'text-yellow-600';
    return 'text-red-600';
  }

  formatDate(date: string): string {
    if (!date) return '';
    return this.datePipe.transform(date, 'dd/MM/yyyy') || '';
  }

  navigateToEditEvaluation(renduId: string): void {
    this.router.navigate(['/admin/projects/edit-evaluation', renduId]);
  }

  // Méthodes pour gérer les fichiers
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


