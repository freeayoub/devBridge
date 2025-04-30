import { Component, OnInit } from '@angular/core';
import { ReunionService } from 'src/app/services/reunion.service';
import { PlanningService } from 'src/app/services/planning.service';
import { Reunion } from 'src/app/models/reunion.model';
import { Planning } from 'src/app/models/planning.model';
import { AuthuserService } from 'src/app/services/authuser.service';

@Component({
  selector: 'app-planning-list',
  templateUrl: './planning-list.component.html',
  styleUrls: ['./planning-list.component.css']
})
export class PlanningListComponent implements OnInit {
  plannings: Planning[] = [];
  loading = true;
  error: any;

  constructor(
    private planningService: PlanningService,
    private authService: AuthuserService
  ) {}

  ngOnInit(): void {
    this.loadPlannings();
  }

  loadPlannings(): void {
    const userId = this.authService.getCurrentUserId();
    if (!userId) return;

    this.planningService.getPlanningsByUser(userId).subscribe({
      next: (plannings) => {
        this.plannings = plannings;
        this.loading = false;
      },
      error: (error) => {
        this.error = error;
        this.loading = false;
      }
    });
  }
}