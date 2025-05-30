import {ChangeDetectorRef, Component, OnInit} from '@angular/core';

import { ActivatedRoute, Router } from '@angular/router';
import { AuthuserService } from '@app/services/authuser.service';
import { PlanningService } from '@app/services/planning.service';
import {
  CalendarEvent, CalendarMonthViewDay,
  CalendarView,
} from 'angular-calendar';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';


@Component({
  selector: 'app-planning-detail',
  templateUrl: './planning-detail.component.html',
  styleUrls: ['./planning-detail.component.css']
})
export class PlanningDetailComponent implements OnInit {

  planning: any | null = null;
  loading = true;
  error: string | null = null;
  isCreator = false;
  selectedDayEvents: CalendarEvent[] = [];
  selectedDate: Date | null = null;

  // Calendar setup
  view: CalendarView = CalendarView.Month;
  viewDate: Date = new Date();
  events: CalendarEvent[] = [];

  constructor(
    public route: ActivatedRoute,
    public router: Router,
    private planningService: PlanningService,
    public authService: AuthuserService,
    private cdr: ChangeDetectorRef,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit(): void {
    this.loadPlanningDetails();
  }

  loadPlanningDetails(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.error = 'ID de planning non fourni';
      this.loading = false;
      return;
    }

    this.planningService.getPlanningById(id).subscribe({
      next: (planning: any) => {
        this.planning = planning.planning;
        this.isCreator = planning.planning.createur._id === this.authService.getCurrentUserId();
        this.loading = false;

        this.events = this.planning.reunions.map((reunion: any) => {
          const startStr = `${reunion.date.substring(0, 10)}T${reunion.heureDebut}:00`;
          const endStr = `${reunion.date.substring(0, 10)}T${reunion.heureFin}:00`;

          return {
            start: new Date(startStr),
            end: new Date(endStr),
            title: reunion.titre,
            allDay: false
          };
        });

        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.error = err.error?.message || 'Erreur lors du chargement';
        this.loading = false;
        console.error('Erreur:', err);
      }
    });
  }

  handleDayClick(day: CalendarMonthViewDay): void {
    this.selectedDate = day.date;
    this.selectedDayEvents = day.events; // These come from your `events` array
  }


  editPlanning(): void {
    if (this.planning) {
      this.router.navigate(['/plannings/edit', this.planning._id]);
    }
  }

  deletePlanning(): void {
    if (this.planning && confirm('Supprimer définitivement ce planning ?')) {
      this.planningService.deletePlanning(this.planning._id).subscribe({
        next: () => this.router.navigate(['/plannings']),
        error: (err) => this.error = err.error?.message || 'Erreur lors de la suppression'
      });
    }
  }

  nouvelleReunion(): void {
    if (this.planning) {
      // Rediriger vers le formulaire de création de réunion avec l'ID du planning préselectionné
      this.router.navigate(['/reunions/nouvelleReunion'], {
        queryParams: { planningId: this.planning._id }
      });
    }
  }

  formatDescription(description: string): SafeHtml {
    // Recherche la chaîne "(presence obligatoire)" (insensible à la casse) et la remplace par une version en rouge
    const formattedText = description.replace(
      /\(presence obligatoire\)/gi,
      '<span class="text-red-600 font-semibold">(presence obligatoire)</span>'
    );

    // Sanitize le HTML pour éviter les problèmes de sécurité
    return this.sanitizer.bypassSecurityTrustHtml(formattedText);
  }
}