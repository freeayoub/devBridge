import { Component, OnInit } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { PlanningService } from '@app/services/planning.service';
import { DataService } from '@app/services/data.service';
import { ToastService } from '@app/services/toast.service';

@Component({
  selector: 'app-planning-edit',
  templateUrl: './planning-edit.component.html',
  styleUrls: ['./planning-edit.component.css'],
})
export class PlanningEditComponent implements OnInit {
  planningForm!: FormGroup;
  users$ = this.userService.getAllUsers();
  planningId!: string;
  error: string = '';
  isLoading: boolean = false;

  constructor(
    private fb: FormBuilder,
    private planningService: PlanningService,
    private userService: DataService,
    private route: ActivatedRoute,
    private router: Router,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.planningId = this.route.snapshot.paramMap.get('id')!;
    this.initForm();
    this.loadPlanning();
  }

  initForm(): void {
    this.planningForm = this.fb.group({
      titre: ['', [Validators.required, Validators.minLength(3)]],
      description: [''],
      dateDebut: ['', Validators.required],
      dateFin: ['', Validators.required],
      lieu: [''],
      participants: [[], Validators.required], // FormArray for multiple participants
    });
  }

  loadPlanning(): void {
    this.planningService.getPlanningById(this.planningId).subscribe({
      next: (response: any) => {
        const planning = response.planning;

        this.planningForm.patchValue({
          titre: planning.titre,
          description: planning.description,
          dateDebut: planning.dateDebut,
          dateFin: planning.dateFin,
          lieu: planning.lieu,
        });

        const participantsArray = this.planningForm.get(
          'participants'
        ) as FormArray;
        participantsArray.clear();

        planning.participants.forEach((p: any) => {
          participantsArray.push(this.fb.control(p._id));
        });
      },
      error: (err) => {
        console.error('Erreur lors du chargement du planning:', err);
        if (err.status === 403) {
          this.toastService.showError(
            "Accès refusé : vous n'avez pas les droits pour accéder à ce planning"
          );
        } else if (err.status === 404) {
          this.toastService.showError(
            "Le planning demandé n'existe pas ou a été supprimé"
          );
        } else {
          const errorMessage =
            err.error?.message || 'Erreur lors du chargement du planning';
          this.toastService.showError(errorMessage);
        }
      },
    });
  }

  onSubmit(): void {
    if (this.planningForm.invalid) {
      console.log('Formulaire invalide, soumission annulée');

      // Marquer tous les champs comme "touched" pour afficher les erreurs
      this.markFormGroupTouched();

      this.toastService.showWarning(
        'Veuillez corriger les erreurs avant de soumettre le formulaire'
      );
      return;
    }
    this.isLoading = true;
    const formValue = this.planningForm.value;
    console.log('Données du formulaire à soumettre:', formValue);

    // Vérifier que les dates sont au bon format
    let dateDebut = formValue.dateDebut;
    let dateFin = formValue.dateFin;

    // S'assurer que les dates sont des objets Date
    if (typeof dateDebut === 'string') {
      dateDebut = new Date(dateDebut);
    }

    if (typeof dateFin === 'string') {
      dateFin = new Date(dateFin);
    }

    // Créer un objet avec seulement les propriétés à mettre à jour
    // sans utiliser le type Planning complet pour éviter les erreurs de typage
    const updatedPlanning = {
      titre: formValue.titre,
      description: formValue.description || '',
      lieu: formValue.lieu || '',
      dateDebut: dateDebut,
      dateFin: dateFin,
      participants: formValue.participants || [],
    };

    console.log('Mise à jour du planning avec ID:', this.planningId);
    console.log('Données formatées:', updatedPlanning);

    try {
      this.planningService
        .updatePlanning(this.planningId, updatedPlanning)
        .subscribe({
          next: (response: any) => {
            console.log('Planning mis à jour avec succès:', response);
            this.isLoading = false;

            // Afficher un toast de succès
            this.toastService.showSuccess(
              'Le planning a été modifié avec succès'
            );

            // Redirection vers la page de détail du planning
            console.log(
              'Redirection vers la page de détail du planning:',
              this.planningId
            );

            // Utiliser setTimeout pour s'assurer que la redirection se produit après le traitement
            setTimeout(() => {
              this.router.navigate(['/plannings', this.planningId]).then(
                (navigated) => console.log('Redirection réussie:', navigated),
                (err) => console.error('Erreur de redirection:', err)
              );
            }, 100);
          },
          error: (err: any) => {
            this.isLoading = false;
            console.error('Erreur lors de la mise à jour du planning:', err);

            // Gestion spécifique des erreurs d'autorisation
            if (err.status === 403) {
              this.toastService.showError(
                "Accès refusé : vous n'avez pas les droits pour modifier ce planning"
              );
            } else if (err.status === 401) {
              this.toastService.showError(
                'Vous devez être connecté pour effectuer cette action'
              );
            } else {
              // Autres erreurs
              const errorMessage =
                err.error?.message ||
                'Erreur lors de la mise à jour du planning';
              this.toastService.showError(errorMessage, 8000);
            }

            // Afficher plus de détails sur l'erreur dans la console
            if (err.error) {
              console.error("Détails de l'erreur:", err.error);
            }
          },
        });
    } catch (e) {
      this.isLoading = false;
      const errorMessage = e instanceof Error ? e.message : String(e);
      this.toastService.showError(
        `Exception lors de la mise à jour: ${errorMessage}`
      );
      console.error('Exception lors de la mise à jour:', e);
    }
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
