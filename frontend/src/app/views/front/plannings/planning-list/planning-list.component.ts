import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { PlanningService } from 'src/app/services/planning.service';
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
    private authService: AuthuserService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadPlannings();
  }

  loadPlannings(): void {
    const userId = this.authService.getCurrentUserId();
    if (!userId) return;

    this.planningService.getPlanningsByUser(userId).subscribe({
      next: (response: any) => {
        this.plannings = response.plannings || [];
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Erreur:', error);
        this.error = error;
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }
}