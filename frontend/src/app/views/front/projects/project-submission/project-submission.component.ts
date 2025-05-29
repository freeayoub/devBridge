import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ProjetService } from '@app/services/projets.service';
import { RendusService } from 'src/app/services/rendus.service';
import { AuthuserService } from 'src/app/services/authuser.service';

// Composant pour soumettre un projet
@Component({
  selector: 'app-project-submission',
  templateUrl: './project-submission.component.html',
  styleUrls: ['./project-submission.component.css'],
})
export class ProjectSubmissionComponent implements OnInit {
  projetId: string = '';
  projet: any;
  submissionForm: FormGroup;
  selectedFiles: File[] = [];
  isLoading = true;
  isSubmitting = false;

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private projetService: ProjetService,
    private rendusService: RendusService,
    private authService: AuthuserService
  ) {
    this.submissionForm = this.fb.group({
      description: ['', [Validators.required, Validators.minLength(10)]],
    });
  }

  ngOnInit(): void {
    this.projetId = this.route.snapshot.paramMap.get('id') || '';
    this.loadProjetDetails();
  }

  loadProjetDetails(): void {
    this.isLoading = true;
    this.projetService.getProjetById(this.projetId).subscribe({
      next: (projet: any) => {
        this.projet = projet;
        this.isLoading = false;
      },
      error: (err: Error) => {
        console.error('Erreur lors du chargement du projet', err);
        this.isLoading = false;
        this.router.navigate(['/projects']);
      },
    });
  }

  onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      this.selectedFiles = Array.from(input.files);
    }
  }

  onSubmit(): void {
    if (this.submissionForm.invalid || this.selectedFiles.length === 0) {
      return;
    }

    this.isSubmitting = true;
    const formData = new FormData();
    formData.append('projet', this.projetId);
    formData.append('etudiant', this.authService.getCurrentUserId() || '');
    formData.append('description', this.submissionForm.value.description);

    this.selectedFiles.forEach((file) => {
      formData.append('fichiers', file);
    });

    this.rendusService.submitRendu(formData).subscribe({
      next: (response: any) => {
        alert('Votre projet a été soumis avec succès');
        this.router.navigate(['/projects']);
      },
      error: (err: Error) => {
        console.error('Erreur lors de la soumission du projet', err);
        alert('Une erreur est survenue lors de la soumission du projet');
        this.isSubmitting = false;
      },
    });
  }

  // Méthode pour supprimer un fichier de la sélection
  removeFile(index: number): void {
    this.selectedFiles.splice(index, 1);
  }

  // Méthode pour formater la taille des fichiers
  getFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Méthode pour calculer les jours restants
  getRemainingDays(): number {
    if (!this.projet?.dateLimite) return 0;

    const now = new Date();
    const deadline = new Date(this.projet.dateLimite);
    const diffTime = deadline.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return Math.max(0, diffDays);
  }
}
