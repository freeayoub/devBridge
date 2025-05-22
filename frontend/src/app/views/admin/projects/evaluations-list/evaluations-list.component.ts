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
          
          // Ajouter cette ligne pour déboguer
          this.debugEtudiantData();
        }
      });
  }

  extractGroupesAndProjets(): void {
    // Extraire les groupes uniques
    const groupesSet = new Set<string>();
    
    this.evaluations.forEach(evaluation => {
      const groupe = evaluation.etudiant?.groupe;
      if (groupe && groupe.trim() !== '') {
        groupesSet.add(groupe);
        console.log(`Groupe trouvé: ${groupe}`);
      } else {
        console.log(`Évaluation sans groupe: ${evaluation._id}`);
      }
    });
    
    this.groupes = Array.from(groupesSet).sort();
    console.log('Groupes extraits:', this.groupes);
    
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
      results = results.filter(evaluation => 
        (evaluation.etudiant?.nom?.toLowerCase().includes(term) || 
         evaluation.etudiant?.prenom?.toLowerCase().includes(term) ||
         evaluation.projetDetails?.titre?.toLowerCase().includes(term))
      );
    }

    // Filtre par groupe
    if (this.filterGroupe) {
      results = results.filter(evaluation => evaluation.etudiant?.groupe === this.filterGroupe);
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

  resetFilters(): void {
    this.searchTerm = '';
    this.filterGroupe = '';
    this.filterProjet = '';
    this.applyFilters();
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

  // Ajouter cette fonction pour déboguer les données d'étudiant
  debugEtudiantData(): void {
    console.group('Débogage données étudiants');
    
    this.evaluations.forEach(evaluation => {
      console.log(`Évaluation ${evaluation._id}:`);
      console.log('- Étudiant:', evaluation.etudiant);
      if (evaluation.etudiant) {
        console.log('- Nom:', evaluation.etudiant.nom);
        console.log('- Prénom:', evaluation.etudiant.prenom);
        console.log('- Groupe:', evaluation.etudiant.groupe);
      }
      console.log('- Rendu:', evaluation.renduDetails);
    });
    
    console.groupEnd();
  }

  // Ajouter cette méthode pour mettre à jour les groupes manquants
  updateMissingGroups(): void {
    if (!confirm('Voulez-vous mettre à jour les groupes manquants des étudiants?')) {
      return;
    }
    
    this.isLoading = true;
    
    this.evaluationService.updateMissingGroups().subscribe({
      next: (response) => {
        console.log('Mise à jour des groupes:', response);
        alert(`${response.updatedCount} étudiants mis à jour avec leur groupe.`);
        this.loadEvaluations(); // Recharger les données
      },
      error: (err) => {
        console.error('Erreur lors de la mise à jour des groupes:', err);
        alert('Erreur lors de la mise à jour des groupes.');
        this.isLoading = false;
      }
    });
  }
}




















