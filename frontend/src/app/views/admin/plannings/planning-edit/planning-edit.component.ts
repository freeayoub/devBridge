import {Component, OnInit} from '@angular/core';
import {FormArray, FormBuilder, FormGroup, Validators} from "@angular/forms";
import {ActivatedRoute, Router} from "@angular/router";
import {PlanningService} from "@app/services/planning.service";
import {Planning} from "@app/models/planning.model";
import {DataService} from "@app/services/data.service";
import {User} from "@app/models/user.model";

@Component({
  selector: 'app-planning-edit',
  templateUrl: './planning-edit.component.html',
  styleUrls: ['./planning-edit.component.css']
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
    private router: Router
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
      participants: [[], Validators.required]  // FormArray for multiple participants
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
          lieu: planning.lieu
        });

        const participantsArray = this.planningForm.get('participants') as FormArray;
        participantsArray.clear();

        planning.participants.forEach((p: any) => {
          participantsArray.push(this.fb.control(p._id));
        });
      },
      error: err => {
        this.error = err.error?.message || 'Erreur lors du chargement du planning';
      }
    });
  }

  onSubmit(): void {
    if (this.planningForm.invalid) return;

    this.isLoading = true;
    const formValue = this.planningForm.value;

    const updatedPlanning: Planning = {
      ...formValue,
      participants: formValue.participants
    };

    this.planningService.updatePlanning(this.planningId, updatedPlanning).subscribe({
      next: () => {
        this.isLoading = false;
        this.router.navigate(['/plannings']);
      },
      error: err => {
        this.isLoading = false;
        console.error('Erreur lors de la mise à jour du planning', err);
      }
    });
  }
}