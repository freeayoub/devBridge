import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Observable } from 'rxjs';
import { User } from '@app/models/user.model';
import { DataService } from '@app/services/data.service';

import { PlanningService } from '@app/services/planning.service';
import { Router } from '@angular/router';
import { ToastService } from '@app/services/toast.service';

@Component({
  selector: 'app-planning-form',
  templateUrl: './planning-form.component.html',
  styleUrls: ['./planning-form.component.css'],
})
export class PlanningFormComponent implements OnInit {
  planningForm!: FormGroup;
  isLoading = false;
  errorMessage: string | null = null;
  users$: Observable<User[]> = this.userService.getAllUsers();

  constructor(
    private fb: FormBuilder,
    private userService: DataService,
    private planningService: PlanningService,
    private router: Router,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.planningForm = this.fb.group({
      titre: ['', [Validators.required, Validators.minLength(3)]],
      description: [''],
      lieu: [''],
      dateDebut: ['', Validators.required],
      dateFin: ['', Validators.required],
      participants: [[], Validators.required],
    });
  }

  submit(): void {
    console.log('Submit method called');
    console.log('Form valid:', this.planningForm.valid);
    console.log('Form values:', this.planningForm.value);

    if (this.planningForm.valid) {
      this.isLoading = true;
      this.errorMessage = null;

      // Extract form values
      const formValues = this.planningForm.value;

      // Create a simplified planning object with just the fields the API expects
      const planningData = {
        titre: formValues.titre,
        description: formValues.description || '',
        dateDebut: formValues.dateDebut,
        dateFin: formValues.dateFin,
        lieu: formValues.lieu || '',
        participants: formValues.participants || [],
      };

      console.log('Planning data to submit:', planningData);

      // Call the createPlanning method to add the new planning
      this.planningService.createPlanning(planningData as any).subscribe({
        next: (newPlanning: any) => {
          console.log('Planning created successfully:', newPlanning);
          this.isLoading = false;

          // Afficher un toast de succès
          this.toastService.showSuccess('Le planning a été créé avec succès');

          // Navigate to plannings list page after successful creation
          this.router.navigate(['/plannings']);
        },
        error: (error: any) => {
          console.error('Error creating planning:', error);
          console.error(
            'Error details:',
            error.error || error.message || error
          );
          this.isLoading = false;

          // Gestion spécifique des erreurs d'autorisation
          if (error.status === 403) {
            this.toastService.showError(
              "Accès refusé : vous n'avez pas les droits pour créer un planning"
            );
          } else if (error.status === 401) {
            this.toastService.showError(
              'Vous devez être connecté pour créer un planning'
            );
          } else {
            // Autres erreurs
            const errorMessage =
              error.error?.message ||
              'Une erreur est survenue lors de la création du planning';
            this.toastService.showError(errorMessage, 8000);
          }
        },
      });
    } else {
      console.log('Form validation errors:', this.getFormValidationErrors());

      // Marquer tous les champs comme "touched" pour afficher les erreurs
      this.markFormGroupTouched();

      this.toastService.showWarning(
        'Veuillez corriger les erreurs avant de soumettre le formulaire'
      );
    }
  }

  // Helper method to get form validation errors
  getFormValidationErrors() {
    const errors: any = {};
    Object.keys(this.planningForm.controls).forEach((key) => {
      const control = this.planningForm.get(key);
      if (control && control.errors) {
        errors[key] = control.errors;
      }
    });
    return errors;
  }

  // Marquer tous les champs comme "touched" pour déclencher l'affichage des erreurs
  markFormGroupTouched() {
    Object.keys(this.planningForm.controls).forEach((key) => {
      const control = this.planningForm.get(key);
      if (control) {
        control.markAsTouched();
      }
    });
  }
}
