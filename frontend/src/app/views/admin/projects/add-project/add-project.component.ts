import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ProjetService } from '@app/services/projets.service';
import { AuthuserService } from '@app/services/authuser.service';

@Component({
  selector: 'app-add-project',
  templateUrl: './add-project.component.html',
  styleUrls: ['./add-project.component.css'],
})
export class AddProjectComponent {
  projetForm: FormGroup;
  selectedFiles: File[] = [];
  isSubmitting = false;

  constructor(
    private fb: FormBuilder,
    private projetService: ProjetService,
    private router: Router,
    private authService: AuthuserService
  ) {
    this.projetForm = this.fb.group({
      titre: ['', Validators.required],
      description: [''],
      dateLimite: ['', Validators.required],
      fichiers: [null],
      groupe: ['', Validators.required], // ← champ pour l'ID du groupe
    });
  }

  onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      this.selectedFiles = Array.from(input.files);
    }
  }

  onSubmit(): void {
    if (this.projetForm.invalid) return;

    this.isSubmitting = true;
    console.log('Soumission du formulaire de projet');

    const formData = new FormData();
    formData.append('titre', this.projetForm.value.titre);
    formData.append('description', this.projetForm.value.description || '');
    formData.append('dateLimite', this.projetForm.value.dateLimite);
    formData.append('groupe', this.projetForm.value.groupe);

    // Méthode 1: Via le service d'authentification (recommandée)
    const userIdFromService = this.authService.getCurrentUserId();
    // Méthode 2: Via le currentUser du service
    const currentUser = this.authService.getCurrentUser();

    // Méthode 3: Vérification localStorage
    const user = localStorage.getItem('user');
    // Utiliser l'ID du service d'authentification en priorité
    let userId = userIdFromService;
    if (!userId && currentUser) {
      userId = currentUser._id || currentUser.id;
    }
    if (!userId && user) {
      userId = JSON.parse(user).id;
    }

    if (userId) {
      formData.append('professeur', userId);
    } else {
      alert(
        "Erreur: Impossible de récupérer l'ID utilisateur. Veuillez vous reconnecter."
      );
      return;
    }

    this.selectedFiles.forEach((file) => {
      formData.append('fichiers', file);
    });

    console.log('Données du formulaire:', {
      titre: this.projetForm.value.titre,
      description: this.projetForm.value.description,
      dateLimite: this.projetForm.value.dateLimite,
      groupe: this.projetForm.value.groupe,
      fichiers: this.selectedFiles.map((f) => f.name),
    });

    this.projetService.addProjet(formData).subscribe({
      next: () => {
        console.log('Projet ajouté avec succès');
        alert('Projet ajouté avec succès');
        this.router.navigate(['/admin/projects']);
      },
      error: (err) => {
        console.error("Erreur lors de l'ajout du projet:", err);
        alert(
          "Erreur lors de l'ajout du projet: " +
            (err.error?.message || err.message || 'Erreur inconnue')
        );
        this.isSubmitting = false;
      },
      complete: () => {
        this.isSubmitting = false;
      },
    });
  }
}
