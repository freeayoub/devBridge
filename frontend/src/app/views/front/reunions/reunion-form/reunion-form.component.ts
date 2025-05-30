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

  constructor(
    private fb: FormBuilder,
    private reunionService: ReunionService,
    private planningService: PlanningService,
    private userService: DataService,
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthuserService
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
      },
      error: (err) => {
        this.error = err;
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
        },
        error: (err) => {
          console.error('Erreur lors de la récupération du planning:', err);
        }
      });
    }
  }

  onSubmit(): void {
    if (this.reunionForm.invalid) return;

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

    console.log(reunionData);

    this.reunionService.createReunion(reunionData).subscribe({
      next: () => {
        this.successMessage = 'Réunion créée avec succès!';
        this.isSubmitting = false;
        // Redirect to reunions list page
        this.router.navigate(['/reunions']);
      },
      error: (err) => {
        this.error = err;
        this.isSubmitting = false;
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
}