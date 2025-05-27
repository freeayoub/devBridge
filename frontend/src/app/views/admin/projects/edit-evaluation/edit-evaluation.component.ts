import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { RendusService } from 'src/app/services/rendus.service';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-edit-evaluation',
  templateUrl: './edit-evaluation.component.html',
  styleUrls: ['./edit-evaluation.component.css']
})
export class EditEvaluationComponent implements OnInit {
  renduId: string = '';
  rendu: any = null;
  evaluationForm: FormGroup;
  isLoading: boolean = true;
  isSubmitting: boolean = false;
  error: string = '';

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

      commentaires: ['', Validators.required]
    });
  }

  ngOnInit(): void {
    this.renduId = this.route.snapshot.paramMap.get('renduId') || '';

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

        // Remplir le formulaire avec les données existantes
        if (this.rendu.evaluation && this.rendu.evaluation.scores) {
          this.evaluationForm.patchValue({
            scores: {
              structure: this.rendu.evaluation.scores.structure || 0,
              pratiques: this.rendu.evaluation.scores.pratiques || 0,
              fonctionnalite: this.rendu.evaluation.scores.fonctionnalite || 0,
              originalite: this.rendu.evaluation.scores.originalite || 0
            },
            commentaires: this.rendu.evaluation.commentaires || ''
          });
        }

        this.isLoading = false;
      },
      error: (err: any) => {
        this.error = 'Erreur lors du chargement du rendu';
        this.isLoading = false;
        console.error(err);
      }
    });
  }

  onSubmit(): void {
    if (this.evaluationForm.invalid) {
      return;
    }

    this.isSubmitting = true;
    const evaluationData = this.evaluationForm.value;

    // Assurez-vous que renduId est disponible
    if (!this.renduId) {
      this.error = "ID du rendu manquant";
      this.isSubmitting = false;
      return;
    }

    this.rendusService.updateEvaluation(this.renduId, evaluationData).subscribe({
      next: (response: any) => {
        this.isSubmitting = false;
        // Redirection vers la page de liste des rendus après succès
        this.router.navigate(['/admin/projects/list-rendus']);
      },
      error: (err: any) => {
        this.error = `Erreur lors de la mise à jour de l'évaluation: ${err.message || 'Erreur inconnue'}`;
        this.isSubmitting = false;
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
    this.router.navigate(['/admin/projects/list-rendus']);
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

