import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {ReunionService} from "@app/services/reunion.service";
import {DataService} from "@app/services/data.service";
import {PlanningService} from "@app/services/planning.service";
import {Planning} from "@app/models/planning.model";
import {User} from "@app/models/user.model";

@Component({
  selector: 'app-reunion-edit',
  templateUrl: './reunion-edit.component.html',
  styleUrls: ['./reunion-edit.component.css']
})
export class ReunionEditComponent implements OnInit {
  reunionForm!: FormGroup;
  reunionId!: string;
  error: any = null;
  isSubmitting = false;
  users: User[] = [];
  plannings: Planning[] = [];

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private reunionService: ReunionService,
    private userService: DataService,
    private planningService: PlanningService
  ) {}

  ngOnInit(): void {
    this.reunionId = this.route.snapshot.paramMap.get('id')!;
    this.initForm();
    this.fetchUsers();
    this.fetchPlannings();
    this.loadReunion();
  }

  initForm(): void {
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
  }

  fetchUsers(): void {
    this.userService.getAllUsers().subscribe((users:any) => {
      this.users = users;
    });
  }

  fetchPlannings(): void {
    this.planningService.getAllPlannings().subscribe((plannings:any) => {
      this.plannings = plannings.plannings;
    });
  }

  loadReunion(): void {
    this.reunionService.getReunionById(this.reunionId).subscribe({
      next: (reunion: any) => {
        this.reunionForm.patchValue({
          titre: reunion.reunion.titre,
          description: reunion.reunion.description,
          date: reunion.reunion.date?.split('T')[0],
          heureDebut: reunion.reunion.heureDebut,
          heureFin: reunion.reunion.heureFin,
          lieu: reunion.reunion.lieu,
          lienVisio: reunion.reunion.lienVisio,
          planning: reunion.reunion.planning?.id,
          participants: reunion.reunion.participants?.map((p:any) => p._id)
        });
      },
      error: (err) => {
        this.error = err;
      }
    });
  }

  onSubmit(): void {
    if (this.reunionForm.invalid) return;

    this.isSubmitting = true;
    const reunion: any = this.reunionForm.value;

    this.reunionService.updateReunion(this.reunionId, reunion).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.router.navigate(['/reunions']);
      },
      error: (err) => {
        this.error = err;
        this.isSubmitting = false;
      }
    });
  }

  goReunion(): void {
    this.router.navigate(['/reunions']);
  }
}