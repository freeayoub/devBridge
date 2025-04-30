import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ReunionService } from 'src/app/services/reunion.service';
import { PlanningService } from 'src/app/services/planning.service';
import { ActivatedRoute, Router } from '@angular/router';
import { Reunion } from 'src/app/models/reunion.model';
import { Planning } from 'src/app/models/planning.model';
import { AuthuserService } from 'src/app/services/authuser.service';

@Component({
  selector: 'app-reunion-form',
  templateUrl: './reunion-form.component.html',
  styleUrls: ['./reunion-form.component.css']
})
export class ReunionFormComponent implements OnInit {
  reunionForm: FormGroup;
  plannings: Planning[] = [];
  loading = true;
  isSubmitting = false;
  error: any;
  isEditMode = false;
  currentReunionId: string | null = null;

  constructor(
    private fb: FormBuilder,
    private reunionService: ReunionService,
    private planningService: PlanningService,
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthuserService
  ) {
    this.reunionForm = this.fb.group({
      titre: ['', Validators.required],
      description: [''],
      dateDebut: ['', Validators.required],
      dateFin: ['', Validators.required],
      lieu: [''],
      lienVisio: [''],
      planningId: ['', Validators.required],
      participants: [[]]
    });
  }

  ngOnInit(): void {
    this.loadPlannings();
    this.checkEditMode();
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
      next: (plannings) => {
        this.plannings = plannings;
      },
      error: (error) => {
        this.error = error;
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
      error: (error) => {
        this.error = error;
        this.loading = false;
      }
    });
  }

  formatDateForInput(date: Date | string): string {
    const d = new Date(date);
    return d.toISOString().slice(0, 16);
  }

  onSubmit(): void {
    if (this.reunionForm.invalid) return;

    this.isSubmitting = true;
    const reunionData = this.reunionForm.value;

    if (this.isEditMode && this.currentReunionId) {
      this.reunionService.updateReunion(this.currentReunionId, reunionData).subscribe({
        next: () => {
          this.router.navigate(['/reunions', this.currentReunionId]);
        },
        error: (error) => {
          this.error = error;
          this.isSubmitting = false;
        }
      });
    } else {
      reunionData.createur = this.authService.getCurrentUserId();
      this.reunionService.createReunion(reunionData).subscribe({
        next: (reunion) => {
          this.router.navigate(['/reunions', reunion.id]);
        },
        error: (error:any) => {
          this.error = error;
          this.isSubmitting = false;
        }
      });
    }
  }
  goReunion(){
    this.router.navigate(['/reunions'])
  }
}