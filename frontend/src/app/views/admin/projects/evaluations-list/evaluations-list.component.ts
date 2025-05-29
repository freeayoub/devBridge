import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { RendusService } from '../../../../services/rendus.service';
import { EvaluationService } from '../../../../services/evaluation.service';
import { catchError, finalize, takeUntil } from 'rxjs/operators';
import { Subject, of } from 'rxjs';
import { Evaluation } from '../../../../models/evaluation';
import { Rendu } from '../../../../models/rendu';

// Interface pour les évaluations avec détails
interface EvaluationWithDetails extends Evaluation {
  renduDetails?: Rendu;
  etudiant?: any;
  projetDetails?: any;
}

@Component({
  selector: 'app-evaluations-list',
  templateUrl: './evaluations-list.component.html',
  styleUrls: ['./evaluations-list.component.css']
})
export class EvaluationsListComponent implements OnInit, OnDestroy {
  evaluations: EvaluationWithDetails[] = [];
  filteredEvaluations: EvaluationWithDetails[] = [];
  isLoading: boolean = true;
  error: string = '';
  searchTerm: string = '';
  filterGroupe: string = '';
  filterProjet: string = '';
  groupes: string[] = [];
  projets: any[] = [];

  private destroy$ = new Subject<void>();

  constructor(
    private rendusService: RendusService,
    private evaluationService: EvaluationService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.loadEvaluations();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadEvaluations(): void {
    this.isLoading = true;
    this.error = '';

    console.log('Début du chargement des évaluations...');

    this.evaluationService.getAllEvaluations()
      .pipe(
        takeUntil(this.destroy$),
        catchError(err => {
          console.error('Erreur lors du chargement des évaluations:', err);
          this.error = 'Impossible de charger les évaluations. Veuillez réessayer plus tard.';
          this.isLoading = false;
          return of([]);
        }),
        finalize(() => {
          console.log('Finalisation du chargement des évaluations');
          this.isLoading = false;
        })
      )
      .subscribe({
        next: (evaluations) => {
          console.log('Évaluations reçues:', evaluations);

          if (!Array.isArray(evaluations)) {
            console.error('Les données reçues ne sont pas un tableau:', evaluations);
            this.error = 'Format de données incorrect. Veuillez réessayer plus tard.';
            return;
          }

          // Vérifier et compléter les données manquantes
          this.evaluations = evaluations.map(evaluation => {
            const evalWithDetails = evaluation as EvaluationWithDetails;

            // Vérifier si les détails du projet sont disponibles
            if (!evalWithDetails.projetDetails || !evalWithDetails.projetDetails.titre) {
              console.warn('Détails du projet manquants pour l\'évaluation:', evalWithDetails._id);

              // Si le rendu contient des détails de projet, les utiliser
              if (evalWithDetails.renduDetails && evalWithDetails.renduDetails.projet) {
                evalWithDetails.projetDetails = evalWithDetails.renduDetails.projet;
              }
            }

            return evalWithDetails;
          });

          this.extractGroupesAndProjets();
          this.applyFilters();
        }
      });
  }

  extractGroupesAndProjets(): void {
    // Extraire les groupes uniques
    const groupesSet = new Set<string>();

    this.evaluations.forEach(evaluation => {
      if (evaluation.etudiant) {
        const groupeName = this.getStudentGroup(evaluation.etudiant);
        if (groupeName && groupeName !== 'Non spécifié') {
          groupesSet.add(groupeName);
        }
      }
    });

    this.groupes = Array.from(groupesSet).sort();

    // Extraire les projets uniques
    const projetsMap = new Map<string, any>();
    this.evaluations.forEach(evaluation => {
      if (evaluation.projetDetails && evaluation.projetDetails._id) {
        projetsMap.set(evaluation.projetDetails._id, evaluation.projetDetails);
      }
    });
    this.projets = Array.from(projetsMap.values());
  }

  applyFilters(): void {
    let results = this.evaluations;

    // Filtre par terme de recherche
    if (this.searchTerm.trim() !== '') {
      const term = this.searchTerm.toLowerCase().trim();
      results = results.filter(evaluation => {
        if (!evaluation.etudiant) return false;

        const studentName = this.getStudentName(evaluation.etudiant).toLowerCase();
        const email = (evaluation.etudiant.email || '').toLowerCase();
        const projectTitle = this.getProjectTitle(evaluation).toLowerCase();
        const groupName = this.getStudentGroup(evaluation.etudiant).toLowerCase();

        return studentName.includes(term) ||
               email.includes(term) ||
               projectTitle.includes(term) ||
               groupName.includes(term);
      });
    }

    // Filtre par groupe
    if (this.filterGroupe) {
      results = results.filter(evaluation => {
        const groupeName = this.getStudentGroup(evaluation.etudiant);
        return groupeName === this.filterGroupe;
      });
    }

    // Filtre par projet
    if (this.filterProjet) {
      results = results.filter(evaluation => evaluation.projetDetails?._id === this.filterProjet);
    }

    this.filteredEvaluations = results;
  }

  onSearchChange(): void {
    this.applyFilters();
  }

  clearSearch(): void {
    this.searchTerm = '';
    this.applyFilters();
  }

  refreshList(): void {
    console.log('Actualisation de la liste des évaluations...');

    // Réinitialiser tous les filtres
    this.searchTerm = '';
    this.filterGroupe = '';
    this.filterProjet = '';

    // Recharger complètement les données depuis le serveur
    this.loadEvaluations();

    console.log('Liste actualisée et filtres réinitialisés');
  }

  resetFilters(): void {
    console.log('Réinitialisation des filtres...');

    // Réinitialiser tous les filtres
    this.searchTerm = '';
    this.filterGroupe = '';
    this.filterProjet = '';

    // Appliquer les filtres (qui vont maintenant montrer toutes les évaluations)
    this.applyFilters();

    console.log('Filtres réinitialisés');
  }

  editEvaluation(renduId: string): void {
    this.router.navigate(['/admin/projects/edit-evaluation', renduId]);
  }

  viewEvaluationDetails(renduId: string): void {
    this.router.navigate(['/admin/projects/evaluation-details', renduId]);
  }

  getScoreTotal(evaluation: EvaluationWithDetails): number {
    if (!evaluation.scores) return 0;

    const scores = evaluation.scores;
    return scores.structure + scores.pratiques + scores.fonctionnalite + scores.originalite;
  }

  getScoreClass(score: number): string {
    if (score >= 16) return 'text-green-600 bg-green-100';
    if (score >= 12) return 'text-blue-600 bg-blue-100';
    if (score >= 8) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  }

  formatDate(date: string | Date | undefined): string {
    if (!date) return 'Non disponible';
    return new Date(date).toLocaleDateString();
  }





  // Nouvelles méthodes pour le design moderne
  getStudentInitials(etudiant: any): string {
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

  getStudentGroup(etudiant: any): string {
    if (!etudiant) return 'Non spécifié';

    // Debug: afficher les données de l'étudiant
    console.log('Données étudiant pour groupe:', {
      email: etudiant.email,
      group: etudiant.group,
      groupe: etudiant.groupe,
      groupName: etudiant.groupName,
      department: etudiant.department,
      allData: etudiant
    });

    // Si group est un objet (référence populée avec le modèle Group)
    if (etudiant.group && typeof etudiant.group === 'object' && etudiant.group.name) {
      console.log(`Groupe objet trouvé pour ${etudiant.email}: ${etudiant.group.name}`);
      return etudiant.group.name;
    }

    // Si group est une chaîne directe (valeur ajoutée manuellement)
    if (etudiant.group && typeof etudiant.group === 'string' && etudiant.group.trim()) {
      console.log(`Groupe string trouvé pour ${etudiant.email}: ${etudiant.group}`);
      return etudiant.group.trim();
    }

    // Fallback vers d'autres champs possibles
    if (etudiant.groupe && typeof etudiant.groupe === 'string' && etudiant.groupe.trim()) {
      console.log(`Groupe (ancien champ) trouvé pour ${etudiant.email}: ${etudiant.groupe}`);
      return etudiant.groupe.trim();
    }

    if (etudiant.groupName && typeof etudiant.groupName === 'string' && etudiant.groupName.trim()) {
      console.log(`GroupName trouvé pour ${etudiant.email}: ${etudiant.groupName}`);
      return etudiant.groupName.trim();
    }

    if (etudiant.department && typeof etudiant.department === 'string' && etudiant.department.trim()) {
      console.log(`Department trouvé pour ${etudiant.email}: ${etudiant.department}`);
      return etudiant.department.trim();
    }

    console.log(`Aucun groupe trouvé pour ${etudiant.email}`);
    return 'Non spécifié';
  }

  getProjectTitle(evaluation: EvaluationWithDetails): string {
    return evaluation.projetDetails?.titre ||
           evaluation.renduDetails?.projet?.titre ||
           'Projet inconnu';
  }

  getAverageScore(): string {
    if (this.evaluations.length === 0) return '0';

    const totalScore = this.evaluations.reduce((sum, evaluation) => {
      return sum + this.getScoreTotal(evaluation);
    }, 0);

    const average = totalScore / this.evaluations.length;
    return average.toFixed(1);
  }

  getScoreIconClass(score: number): string {
    if (score >= 16) return 'bg-success/10 dark:bg-dark-accent-secondary/10 text-success dark:text-dark-accent-secondary';
    if (score >= 12) return 'bg-info/10 dark:bg-dark-accent-primary/10 text-info dark:text-dark-accent-primary';
    if (score >= 8) return 'bg-warning/10 dark:bg-warning/20 text-warning dark:text-warning';
    return 'bg-danger/10 dark:bg-danger-dark/20 text-danger dark:text-danger-dark';
  }

  getScoreColorClass(score: number): string {
    if (score >= 16) return 'text-success dark:text-dark-accent-secondary';
    if (score >= 12) return 'text-info dark:text-dark-accent-primary';
    if (score >= 8) return 'text-warning dark:text-warning';
    return 'text-danger dark:text-danger-dark';
  }

  // Méthode pour supprimer une évaluation
  deleteEvaluation(evaluationId: string): void {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette évaluation ? Cette action est irréversible.')) {
      return;
    }

    this.evaluationService.deleteEvaluation(evaluationId).subscribe({
      next: () => {
        alert('Évaluation supprimée avec succès !');
        this.loadEvaluations(); // Recharger la liste
      },
      error: (err: any) => {
        console.error('Erreur lors de la suppression:', err);
        alert('Erreur lors de la suppression de l\'évaluation.');
      }
    });
  }
}




















