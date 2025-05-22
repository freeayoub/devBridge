import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { RendusService } from '@app/services/rendus.service';

@Component({
  selector: 'app-project-evaluation',
  templateUrl: './project-evaluation.component.html',
  styleUrls: ['./project-evaluation.component.css']
})
export class ProjectEvaluationComponent implements OnInit {
  renduId: string = '';
  rendu: any = null;
  evaluationForm: FormGroup;
  isLoading: boolean = true;
  isSubmitting: boolean = false;
  error: string = '';
  evaluationMode: 'manual' | 'ai' = 'manual';
  aiProcessing: boolean = false;

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private rendusService: RendusService
  ) {
    this.evaluationForm = this.fb.group({
      scores: this.fb.group({
        structure: [0, [Validators.required, Validators.min(0), Validators.max(5)]],
        pratiques: [0, [Validators.required, Validators.min(0), Validators.max(5)]],
        fonctionnalite: [0, [Validators.required, Validators.min(0), Validators.max(5)]],
        originalite: [0, [Validators.required, Validators.min(0), Validators.max(5)]]
      }),
      commentaires: ['', Validators.required],
      utiliserIA: [false]
    });
  }

  ngOnInit(): void {
    this.renduId = this.route.snapshot.paramMap.get('renduId') || '';
    
    // Récupérer le mode d'évaluation des query params
    const mode = this.route.snapshot.queryParamMap.get('mode');
    if (mode === 'ai' || mode === 'manual') {
      this.evaluationMode = mode;
      this.evaluationForm.patchValue({ utiliserIA: mode === 'ai' });
      // Sauvegarder le mode dans localStorage pour les futures évaluations
      localStorage.setItem('evaluationMode', mode);
    } else {
      // Récupérer le mode d'évaluation du localStorage
      const storedMode = localStorage.getItem('evaluationMode');
      if (storedMode === 'ai' || storedMode === 'manual') {
        this.evaluationMode = storedMode;
        this.evaluationForm.patchValue({ utiliserIA: storedMode === 'ai' });
      }
    }
    
    if (this.renduId) {
      this.loadRendu();
    } else {
      this.error = 'ID de rendu manquant';
      this.isLoading = false;
    }
  }

  loadRendu(): void {
    this.isLoading = true;
    this.rendusService.getRenduById(this.renduId).subscribe({
      next: (data: any) => {
        this.rendu = data;
        this.isLoading = false;
      },
      error: (err: any) => {
        this.error = 'Erreur lors du chargement du rendu';
        this.isLoading = false;
        console.error(err);
      }
    });
  }

  toggleEvaluationMode(): void {
    this.evaluationMode = this.evaluationMode === 'manual' ? 'ai' : 'manual';
    this.evaluationForm.patchValue({ utiliserIA: this.evaluationMode === 'ai' });
    localStorage.setItem('evaluationMode', this.evaluationMode);
  }

  onSubmit(): void {
    if (this.evaluationMode === 'manual' && this.evaluationForm.invalid) {
      return;
    }

    this.isSubmitting = true;
    
    // Si mode IA, mettre à jour le formulaire pour indiquer l'utilisation de l'IA
    if (this.evaluationMode === 'ai') {
      this.evaluationForm.patchValue({ utiliserIA: true });
      this.aiProcessing = true;
    }
    
    const evaluationData = this.evaluationForm.value;

    this.rendusService.evaluateRendu(this.renduId, evaluationData).subscribe({
      next: (response: any) => {
        // Si l'évaluation a été faite par l'IA, mettre à jour le formulaire avec les résultats
        if (this.evaluationMode === 'ai' && response.evaluation) {
          const aiScores = response.evaluation.scores;
          const aiCommentaires = response.evaluation.commentaires;
          
          this.evaluationForm.patchValue({
            scores: {
              structure: aiScores.structure || 0,
              pratiques: aiScores.pratiques || 0,
              fonctionnalite: aiScores.fonctionnalite || 0,
              originalite: aiScores.originalite || 0
            },
            commentaires: aiCommentaires || 'Évaluation générée par IA'
          });
          
          this.aiProcessing = false;
          this.isSubmitting = false;
          
          // Afficher un message de succès
          this.error = ''; // Effacer les erreurs précédentes
          alert('Évaluation par IA réussie! Vous pouvez modifier les résultats avant de confirmer.');
        } else {
          // Si évaluation manuelle ou confirmation après IA, rediriger vers la liste des rendus
          this.router.navigate(['/admin/projects/rendus']);
        }
      },
      error: (err: any) => {
        this.error = 'Erreur lors de l\'évaluation du rendu: ' + (err.error?.message || err.message || 'Erreur inconnue');
        this.isSubmitting = false;
        this.aiProcessing = false;
        console.error(err);
      }
    });
  }

  getScoreTotal(): number {
    const scores = this.evaluationForm.get('scores')?.value;
    if (!scores) return 0;
    
    return scores.structure + scores.pratiques + scores.fonctionnalite + scores.originalite;
  }

  getScoreMaximum(): number {
    return 20; // 4 critères x 5 points maximum
  }

  annuler(): void {
    this.router.navigate(['/admin/projects/rendus']);
  }
}





