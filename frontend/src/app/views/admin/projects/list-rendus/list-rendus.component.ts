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
  providers: [DatePipe],
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
  ) {}

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
        this.error =
          'Impossible de charger les rendus. Veuillez réessayer plus tard.';
        this.isLoading = false;
      },
    });
  }

  loadProjets(): void {
    this.projetService.getProjets().subscribe({
      next: (data) => {
        this.projets = data;
      },
      error: (err) => {
        console.error('Erreur lors du chargement des projets', err);
      },
    });
  }

  extractGroupes(): void {
    // Extraire les groupes uniques des rendus
    if (this.rendus && this.rendus.length > 0) {
      const groupesSet = new Set<string>();
      this.rendus.forEach((rendu) => {
        if (rendu.etudiant) {
          const groupeName = this.getGroupName(rendu.etudiant);
          if (groupeName && groupeName !== 'Non spécifié') {
            groupesSet.add(groupeName);
          }
        }
      });
      this.groupes = Array.from(groupesSet);
    }
  }

  applyFilters(): void {
    let results = this.rendus;

    // Filtre par statut d'évaluation
    if (this.filterStatus === 'evaluated') {
      results = results.filter(
        (rendu) => rendu.evaluation && rendu.evaluation.scores
      );
    } else if (this.filterStatus === 'pending') {
      results = results.filter(
        (rendu) => !rendu.evaluation || !rendu.evaluation.scores
      );
    }

    // Filtre par terme de recherche
    if (this.searchTerm.trim() !== '') {
      const term = this.searchTerm.toLowerCase().trim();
      results = results.filter((rendu) => {
        const etudiant = rendu.etudiant;
        if (!etudiant) return false;

        const firstName = (etudiant.firstName || etudiant.prenom || '').toLowerCase();
        const lastName = (etudiant.lastName || etudiant.nom || '').toLowerCase();
        const fullName = (etudiant.fullName || etudiant.name || etudiant.username || '').toLowerCase();
        const email = (etudiant.email || '').toLowerCase();
        const projet = (rendu.projet?.titre || '').toLowerCase();

        return firstName.includes(term) ||
               lastName.includes(term) ||
               fullName.includes(term) ||
               email.includes(term) ||
               projet.includes(term);
      });
    }

    // Filtre par groupe
    if (this.filtreGroupe) {
      results = results.filter((rendu) => {
        const groupeName = this.getGroupName(rendu.etudiant);
        return groupeName === this.filtreGroupe;
      });
    }

    // Filtre par projet
    if (this.filtreProjet) {
      results = results.filter(
        (rendu) => rendu.projet?._id === this.filtreProjet
      );
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
      queryParams: { mode: mode },
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
    return (
      scores.structure +
      scores.pratiques +
      scores.fonctionnalite +
      scores.originalite
    );
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

  // Nouvelles méthodes pour le design moderne
  getInitials(etudiant: any): string {
    if (!etudiant) return '??';

    // Priorité 1: firstName + lastName (si lastName existe et n'est pas vide)
    const firstName = etudiant.firstName || '';
    const lastName = etudiant.lastName || '';

    if (firstName && lastName && lastName.trim()) {
      return (firstName.charAt(0) + lastName.charAt(0)).toUpperCase();
    }

    // Priorité 2: fullName (diviser en mots)
    const fullName = etudiant.fullName || etudiant.name || etudiant.username || '';
    if (fullName && fullName.trim()) {
      const parts = fullName.trim().split(' ');
      if (parts.length >= 2) {
        return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
      } else {
        // Si un seul mot, prendre les 2 premières lettres
        return fullName.substring(0, 2).toUpperCase();
      }
    }

    // Priorité 3: firstName seul (prendre les 2 premières lettres)
    if (firstName && firstName.trim()) {
      return firstName.substring(0, 2).toUpperCase();
    }

    return '??';
  }

  getGroupName(etudiant: any): string {
    if (!etudiant) return 'Non spécifié';

    // Si group est un objet (référence populée avec le modèle Group)
    if (etudiant.group && typeof etudiant.group === 'object' && etudiant.group.name) {
      return etudiant.group.name;
    }

    // Si group est une chaîne directe (valeur ajoutée manuellement)
    if (etudiant.group && typeof etudiant.group === 'string' && etudiant.group.trim()) {
      return etudiant.group.trim();
    }

    // Fallback vers d'autres champs possibles
    if (etudiant.groupe && typeof etudiant.groupe === 'string' && etudiant.groupe.trim()) {
      return etudiant.groupe.trim();
    }

    if (etudiant.groupName && typeof etudiant.groupName === 'string' && etudiant.groupName.trim()) {
      return etudiant.groupName.trim();
    }

    if (etudiant.department && typeof etudiant.department === 'string' && etudiant.department.trim()) {
      return etudiant.department.trim();
    }

    return 'Non spécifié';
  }

  getStudentName(etudiant: any): string {
    if (!etudiant) return 'Utilisateur inconnu';

    // Priorité 1: firstName + lastName (si lastName existe et n'est pas vide)
    const firstName = etudiant.firstName || '';
    const lastName = etudiant.lastName || '';

    if (firstName && lastName && lastName.trim()) {
      return `${firstName} ${lastName}`.trim();
    }

    // Priorité 2: fullName
    const fullName = etudiant.fullName || etudiant.name || etudiant.username || '';
    if (fullName && fullName.trim()) {
      return fullName.trim();
    }

    // Priorité 3: firstName seul
    if (firstName && firstName.trim()) {
      return firstName.trim();
    }

    // Priorité 4: email comme fallback
    if (etudiant.email) {
      return etudiant.email;
    }

    return 'Utilisateur inconnu';
  }

  getEvaluatedCount(): number {
    return this.rendus.filter(rendu => rendu.evaluation && rendu.evaluation._id).length;
  }

  getStatusIconClass(rendu: any): string {
    if (rendu.evaluation && rendu.evaluation._id) {
      return 'bg-success/10 dark:bg-dark-accent-secondary/10 text-success dark:text-dark-accent-secondary';
    }
    return 'bg-warning/10 dark:bg-warning/20 text-warning dark:text-warning';
  }

  getStatusBadgeClass(rendu: any): string {
    if (rendu.evaluation && rendu.evaluation._id) {
      return 'bg-gradient-to-r from-success/20 to-success-dark/20 dark:from-dark-accent-secondary/30 dark:to-dark-accent-secondary/20 text-success-dark dark:text-dark-accent-secondary border border-success/30 dark:border-dark-accent-secondary/40';
    }
    return 'bg-gradient-to-r from-warning/20 to-warning/30 dark:from-warning/30 dark:to-warning/20 text-warning-dark dark:text-warning border border-warning/40 dark:border-warning/50';
  }

  getScoreColorClass(score: number): string {
    if (score >= 16) return 'text-success dark:text-dark-accent-secondary';
    if (score >= 12) return 'text-info dark:text-dark-accent-primary';
    if (score >= 8) return 'text-warning dark:text-warning';
    return 'text-danger dark:text-danger-dark';
  }

  resetFilters(): void {
    this.filtreGroupe = '';
    this.filtreProjet = '';
    this.filterStatus = 'all';
    this.searchTerm = '';
    this.applyFilters();
  }
}
