import { Component, OnInit } from '@angular/core';
import { ReunionService } from 'src/app/services/reunion.service';
import { PlanningService } from 'src/app/services/planning.service';
import { Reunion } from 'src/app/models/reunion.model';
import { Planning } from 'src/app/models/planning.model';
import { AuthuserService } from 'src/app/services/authuser.service';
import {ActivatedRoute, Router} from "@angular/router";

@Component({
  selector: 'app-planning-list',
  templateUrl: './planning-list.component.html',
  styleUrls: ['./planning-list.component.css']
})
export class PlanningListComponent implements OnInit {
  plannings: Planning[] = [];
  loading = true;
  error: string | null = null;

  constructor(
    private planningService: PlanningService,
    public authService: AuthuserService,
    private router: Router, private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.loadPlannings();
  }

  loadPlannings(): void {
    const userId = this.authService.getCurrentUserId();
    if (!userId) {
      this.error = 'Utilisateur non connecté';
      this.loading = false;
      return;
    }

    this.planningService.getPlanningsByUser(userId).subscribe({
      next: (response: any) => {
        if (response.success) {
          this.plannings = response.plannings;
          console.log(this.plannings)
        } else {
          this.error = 'Erreur lors du chargement';
        }
        this.loading = false;
      },
      error: (err) => {
        this.error = err.error?.message || 'Erreur serveur';
        this.loading = false;
        console.error('Erreur:', err);
      }
    });
  }

  deletePlanning(id: string): void {
    if (confirm('Supprimer ce planning ?')) {
      this.planningService.deletePlanning(id).subscribe({
        next: () => {
          this.plannings = this.plannings.filter(p => p._id !== id);
        },
        error: (err) => {
          this.error = err.error?.message || 'Erreur lors de la suppression';
        }
      });
    }
  }

  GotoDetail(id: string | undefined) {
    if (id) {
      this.router.navigate([id], { relativeTo: this.route });
    }
  }

}