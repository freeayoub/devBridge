import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ReunionService } from 'src/app/services/reunion.service';
import { PlanningService } from 'src/app/services/planning.service';
import { ActivatedRoute, Router } from '@angular/router';
import { Reunion } from 'src/app/models/reunion.model';
import { Planning } from 'src/app/models/planning.model';
import { AuthuserService } from 'src/app/services/authuser.service';
import {Observable} from "rxjs";
import {User} from "@app/models/user.model";
import {DataService} from "@app/services/data.service";
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { ToastService } from 'src/app/services/toast.service';

@Component({
  selector: 'app-reunion-form',
  templateUrl: './reunion-form.component.html',
  styleUrls: ['./reunion-form.component.css']
})
export class ReunionFormComponent implements OnInit {
  reunionForm: FormGroup;
  plannings: Planning[] = [];
  users$: Observable<User[]>;
  loading = true;
  isSubmitting = false;
  error: any = null;
  successMessage: string | null = null;
  isEditMode = false;
  currentReunionId: string | null = null;
  planningIdFromUrl: string | null = null;
  selectedPlanning: Planning | null = null;
  lienVisioError: string | null = null;
  isCheckingLienVisio = false;

  constructor(
    private fb: FormBuilder,
    private reunionService: ReunionService,
    private planningService: PlanningService,
    private userService: DataService,
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthuserService,
    private toastService: ToastService
  ) {
    this.reunionForm = this.fb.group({
      titre: ['', Validators.required],
      description: [''],
      date: ['', Validators.required],
      heureDebut: ['', Validators.required],
      heureFin: ['', Validators.required],
      lieu: [''],
      lienVisio: [''],
      planning: ['', Validators.required],
      participants: [[]]
    });


    this.users$ = this.userService.getAllUsers();
  }

  ngOnInit(): void {
    this.loadPlannings();
    this.checkEditMode();
    this.checkPlanningParam();
    this.setupLienVisioValidation();
  }

  checkEditMode(): void {
    const reunionId = this.route.snapshot.paramMap.get('id');
    if (reunionId) {
      this.isEditMode = true;
      this.currentReunionId = reunionId;
      this.loadReunion(reunionId);
    }
  }

  loadPlannings(): void {
    const userId = this.authService.getCurrentUserId();
    if (!userId) return;

    this.planningService.getPlanningsByUser(userId).subscribe({
      next: (response:any) => {
        this.plannings = response.plannings || [];
        console.log('🔍 Plannings chargés:', this.plannings);
        console.log('🔍 Premier planning:', this.plannings[0]);
      },
      error: (err) => {
        this.error = err;
        console.error('❌ Erreur chargement plannings:', err);
      }
    });
  }

  loadReunion(id: string): void {
    this.reunionService.getReunionById(id).subscribe({
      next: (reunion) => {
        this.reunionForm.patchValue({
          titre: reunion.titre,
          description: reunion.description,
          dateDebut: this.formatDateForInput(reunion.dateDebut),
          dateFin: this.formatDateForInput(reunion.dateFin),
          lieu: reunion.lieu,
          lienVisio: reunion.lienVisio,
          planningId: reunion.planningId,
          participants: reunion.participants
        });
        this.loading = false;
      },
      error: (err) => {
        this.error = err;
        this.loading = false;
      }
    });
  }

  formatDateForInput(date: Date | string): string {
    return new Date(date).toISOString().slice(0, 16); // yyyy-MM-ddTHH:mm
  }

  checkPlanningParam(): void {
    const planningId = this.route.snapshot.queryParamMap.get('planningId');
    if (planningId) {
      this.planningIdFromUrl = planningId;

      // Si un ID de planning est fourni dans les paramètres de requête, le sélectionner automatiquement
      this.reunionForm.patchValue({
        planning: planningId
      });

      // Récupérer les détails du planning pour l'affichage
      this.planningService.getPlanningById(planningId).subscribe({
        next: (response: any) => {
          this.selectedPlanning = response.planning;
          // Ajouter le planning à la liste locale pour la validation
          if (this.selectedPlanning && !this.plannings.find(p => p._id === planningId)) {
            this.plannings.push(this.selectedPlanning);
            console.log('✅ Planning ajouté à la liste locale pour validation:', this.selectedPlanning);
          }
        },
        error: (err) => {
          console.error('Erreur lors de la récupération du planning:', err);
          this.toastService.error(
            'Planning introuvable',
            'Le planning sélectionné n\'existe pas ou vous n\'avez pas les permissions pour y accéder'
          );
        }
      });
    }
  }

  onSubmit(): void {
    if (this.reunionForm.invalid || !this.canSubmit()) {
      this.toastService.warning(
        'Formulaire invalide',
        'Veuillez corriger les erreurs avant de soumettre le formulaire'
      );
      return;
    }

    // Validation de la date par rapport au planning
    if (!this.validateDateInPlanningRange()) {
      return;
    }

    this.isSubmitting = true;
    this.error = null;
    this.successMessage = null;
    const formValue = this.reunionForm.value;

    const date = formValue.date; // already in yyyy-MM-dd format from input[type=date]
    const heureDebut = formValue.heureDebut; // already in HH:mm format from input[type=time]
    const heureFin = formValue.heureFin;

    const reunionData: any = {
      titre: formValue.titre,
      description: formValue.description,
      date: date,
      heureDebut: heureDebut,
      heureFin: heureFin,
      lieu: formValue.lieu,
      lienVisio: formValue.lienVisio,
      planning: formValue.planning,
      participants: formValue.participants || []
    };

    console.log('🔍 Données de la réunion à envoyer:', reunionData);
    console.log('🔍 Planning ID sélectionné:', formValue.planning);
    console.log('🔍 Type du planning ID:', typeof formValue.planning);
    console.log('🔍 Plannings disponibles:', this.plannings);

    this.reunionService.createReunion(reunionData).subscribe({
      next: () => {
        this.isSubmitting = false;

        this.toastService.success(
          'Réunion créée',
          'La réunion a été créée avec succès'
        );

        // Réinitialiser le formulaire pour permettre la création d'une nouvelle réunion
        this.resetForm();

        // Redirection immédiate
        this.router.navigate(['/reunions']);
      },
      error: (err) => {
        this.isSubmitting = false;
        console.error('Erreur lors de la création de la réunion:', err);

        if (err.status === 403) {
          this.toastService.accessDenied('créer une réunion', err.status);
        } else if (err.status === 401) {
          this.toastService.error(
            'Non autorisé',
            'Vous devez être connecté pour créer une réunion'
          );
        } else {
          const errorMessage = err.error?.message || 'Erreur lors de la création de la réunion';
          this.toastService.error(
            'Erreur de création',
            errorMessage,
            8000
          );
        }
      }
    });
  }

  resetForm(): void {
    // Reset the form to its initial state
    this.reunionForm.reset({
      titre: '',
      description: '',
      date: '',
      heureDebut: '',
      heureFin: '',
      lieu: '',
      lienVisio: '',
      planning: '',
      participants: []
    });

    // Mark the form as pristine and untouched to reset validation states
    this.reunionForm.markAsPristine();
    this.reunionForm.markAsUntouched();
  }


  goReunion(): void {
    this.router.navigate(['/reunions']);
  }

  /**
   * Configure la validation en temps réel du lien visio avec debounce
   */
  setupLienVisioValidation(): void {
    this.reunionForm.get('lienVisio')?.valueChanges
      .pipe(
        debounceTime(500), // Attendre 500ms après la dernière saisie
        distinctUntilChanged() // Ne déclencher que si la valeur a changé
      )
      .subscribe(value => {
        if (value && value.trim() !== '') {
          this.checkLienVisioUniqueness(value.trim());
        } else {
          this.lienVisioError = null;
        }
      });
  }

  /**
   * Vérifie l'unicité du lien visio
   * @param lienVisio Le lien à vérifier
   */
  checkLienVisioUniqueness(lienVisio: string): void {
    if (!lienVisio || lienVisio.trim() === '') {
      this.lienVisioError = null;
      return;
    }

    this.isCheckingLienVisio = true;
    this.lienVisioError = null;

    // Utiliser la nouvelle route dédiée pour vérifier l'unicité
    this.reunionService.checkLienVisioUniqueness(lienVisio, this.currentReunionId || undefined).subscribe({
      next: (response) => {
        this.isCheckingLienVisio = false;

        if (response.success && !response.isUnique) {
          this.lienVisioError = `Ce lien est déjà utilisé par la réunion "${response.conflictWith?.titre}"`;
        } else {
          this.lienVisioError = null;
        }
      },
      error: (error) => {
        this.isCheckingLienVisio = false;
        console.error('Erreur lors de la vérification du lien visio:', error);
        this.lienVisioError = 'Erreur lors de la vérification du lien';
      }
    });
  }

  /**
   * Vérifie si le formulaire peut être soumis
   */
  canSubmit(): boolean {
    return this.reunionForm.valid && !this.lienVisioError && !this.isCheckingLienVisio;
  }

  /**
   * Valide que la date de la réunion est dans l'intervalle du planning sélectionné
   */
  validateDateInPlanningRange(): boolean {
    const formValue = this.reunionForm.value;
    const reunionDate = formValue.date;
    const planningId = formValue.planning;

    if (!reunionDate || !planningId) {
      return true; // Si pas de date ou planning, laisser la validation backend gérer
    }

    // Chercher d'abord dans la liste locale, puis dans selectedPlanning
    let selectedPlanning = this.plannings.find(p => p._id === planningId);

    if (!selectedPlanning && this.selectedPlanning && this.selectedPlanning._id === planningId) {
      selectedPlanning = this.selectedPlanning;
    }

    if (!selectedPlanning) {
      console.warn('⚠️ Planning non trouvé pour validation:', planningId);
      console.log('📋 Plannings disponibles:', this.plannings.map(p => ({ id: p._id, titre: p.titre })));
      console.log('🎯 Selected planning:', this.selectedPlanning);

      // Ne pas bloquer si le planning n'est pas trouvé - laisser le backend valider
      return true;
    }

    // Convertir les dates pour comparaison
    const reunionDateObj = new Date(reunionDate);
    const planningDateDebut = new Date(selectedPlanning.dateDebut);
    const planningDateFin = new Date(selectedPlanning.dateFin);

    // Comparer seulement les dates (sans les heures)
    reunionDateObj.setHours(0, 0, 0, 0);
    planningDateDebut.setHours(0, 0, 0, 0);
    planningDateFin.setHours(0, 0, 0, 0);

    if (reunionDateObj < planningDateDebut || reunionDateObj > planningDateFin) {
      this.toastService.error(
        'Date invalide',
        `La date de la réunion doit être comprise entre le ${planningDateDebut.toLocaleDateString('fr-FR')} et le ${planningDateFin.toLocaleDateString('fr-FR')} (période du planning "${selectedPlanning.titre}")`,
        10000
      );
      return false;
    }

    return true;
  }
}