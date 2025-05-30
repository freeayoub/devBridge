import {ChangeDetectorRef, Component, OnInit, HostListener} from '@angular/core';

import { ActivatedRoute, Router } from '@angular/router';
import { AuthuserService } from '@app/services/authuser.service';
import { PlanningService } from '@app/services/planning.service';
import { ReunionService } from '@app/services/reunion.service';
import {
  CalendarEvent, CalendarMonthViewDay,
  CalendarView,
} from 'angular-calendar';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { trigger, state, style, animate, transition } from '@angular/animations';
import { ToastService } from '@app/services/toast.service';

@Component({
  selector: 'app-planning-detail',
  templateUrl: './planning-detail.component.html',
  styleUrls: ['./planning-detail.component.css'],
  animations: [
    // Animation pour l'entrée des sections
    trigger('fadeInUp', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(20px)' }),
        animate('0.5s ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ])
    ]),

    // Animation pour le survol des cartes
    trigger('cardHover', [
      state('default', style({
        transform: 'scale(1)',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
      })),
      state('hovered', style({
        transform: 'scale(1.02)',
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
      })),
      transition('default => hovered', [
        animate('0.2s ease-in-out')
      ]),
      transition('hovered => default', [
        animate('0.2s ease-in-out')
      ])
    ])
  ]
})
export class PlanningDetailComponent implements OnInit {

  planning: any | null = null;
  loading = true;
  error: string | null = null;
  isCreator = false;
  selectedDayEvents: CalendarEvent[] = [];
  selectedDate: Date | null = null;
  cardState = 'default';

  // Calendar setup
  view: CalendarView = CalendarView.Month;
  viewDate: Date = new Date();
  events: CalendarEvent[] = [];

  // Pour les animations
  sectionStates = {
    info: false,
    participants: false,
    reunions: false
  };

  constructor(
    public route: ActivatedRoute,
    public router: Router,
    private planningService: PlanningService,
    private reunionService: ReunionService,
    public authService: AuthuserService,
    private cdr: ChangeDetectorRef,
    private sanitizer: DomSanitizer,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.loadPlanningDetails();

    // Activer les animations des sections avec un délai
    setTimeout(() => {
      this.sectionStates.info = true;
    }, 300);

    setTimeout(() => {
      this.sectionStates.participants = true;
    }, 600);

    setTimeout(() => {
      this.sectionStates.reunions = true;
    }, 900);
  }

  loadPlanningDetails(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.loading = false;
      this.toastService.error(
        'Erreur de navigation',
        'ID de planning non fourni'
      );
      return;
    }

    this.planningService.getPlanningById(id).subscribe({
      next: (planning: any) => {
        this.planning = planning.planning;
        this.isCreator = planning.planning.createur._id === this.authService.getCurrentUserId();
        this.loading = false;

        // Créer les événements pour le calendrier avec des couleurs personnalisées
        this.events = this.planning.reunions.map((reunion: any, index: number) => {
          const startStr = `${reunion.date.substring(0, 10)}T${reunion.heureDebut}:00`;
          const endStr = `${reunion.date.substring(0, 10)}T${reunion.heureFin}:00`;

          // Générer une couleur basée sur l'index pour différencier les événements
          const hue = (index * 137) % 360; // Formule pour distribuer les couleurs

          return {
            start: new Date(startStr),
            end: new Date(endStr),
            title: reunion.titre,
            allDay: false,
            color: {
              primary: `hsl(${hue}, 70%, 50%)`,
              secondary: `hsl(${hue}, 70%, 90%)`
            },
            meta: {
              description: reunion.description || '',
              id: reunion._id
            }
          };
        });

        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.loading = false;
        console.error('Erreur:', err);

        if (err.status === 403) {
          this.toastService.accessDenied('accéder à ce planning', err.status);
        } else if (err.status === 404) {
          this.toastService.error(
            'Planning introuvable',
            'Le planning demandé n\'existe pas ou a été supprimé'
          );
        } else {
          const errorMessage = err.error?.message || 'Erreur lors du chargement du planning';
          this.toastService.error(
            'Erreur de chargement',
            errorMessage
          );
        }
      }
    });
  }

  handleDayClick(day: CalendarMonthViewDay): void {
    this.selectedDate = day.date;
    this.selectedDayEvents = day.events;

    // Animation pour l'affichage des événements
    if (day.events.length > 0) {
      // Effet de scroll doux vers les détails des événements
      setTimeout(() => {
        const dayEventsElement = document.querySelector('.day-events');
        if (dayEventsElement) {
          dayEventsElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }, 100);
    }
  }

  // Méthodes pour les animations
  onCardMouseEnter(): void {
    this.cardState = 'hovered';
  }

  onCardMouseLeave(): void {
    this.cardState = 'default';
  }


  editPlanning(): void {
    if (this.planning) {
      this.router.navigate(['/plannings/edit', this.planning._id]);
    }
  }

  deletePlanning(): void {
    if (this.planning && confirm('Supprimer définitivement ce planning ?')) {
      this.planningService.deletePlanning(this.planning._id).subscribe({
        next: () => {
          this.toastService.success(
            'Planning supprimé',
            'Le planning a été supprimé avec succès'
          );
          this.router.navigate(['/plannings']);
        },
        error: (err) => {
          console.error('Erreur lors de la suppression du planning:', err);

          if (err.status === 403) {
            this.toastService.accessDenied('supprimer ce planning', err.status);
          } else if (err.status === 401) {
            this.toastService.error(
              'Non autorisé',
              'Vous devez être connecté pour supprimer un planning'
            );
          } else {
            const errorMessage = err.error?.message || 'Erreur lors de la suppression du planning';
            this.toastService.error(
              'Erreur de suppression',
              errorMessage,
              8000
            );
          }
        }
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

  /**
   * Modifie une réunion
   * @param reunionId ID de la réunion à modifier
   */
  editReunion(reunionId: string): void {
    if (reunionId) {
      this.router.navigate(['/reunions/modifier', reunionId]);
    }
  }

  /**
   * Supprime une réunion après confirmation
   * @param reunionId ID de la réunion à supprimer
   */
  deleteReunion(reunionId: string): void {
    if (confirm('Êtes-vous sûr de vouloir supprimer cette réunion ?')) {
      this.reunionService.deleteReunion(reunionId).subscribe({
        next: (response) => {
          console.log('Réunion supprimée avec succès:', response);

          this.toastService.success(
            'Réunion supprimée',
            'La réunion a été supprimée avec succès'
          );

          // Recharger les détails du planning pour mettre à jour le calendrier
          this.loadPlanningDetails();

          // Vider les événements du jour sélectionné si la réunion supprimée était affichée
          this.selectedDayEvents = this.selectedDayEvents.filter(event => event.meta?.id !== reunionId);
        },
        error: (error) => {
          console.error('Erreur lors de la suppression:', error);

          if (error.status === 403) {
            this.toastService.accessDenied('supprimer cette réunion', error.status);
          } else if (error.status === 401) {
            this.toastService.error(
              'Non autorisé',
              'Vous devez être connecté pour supprimer une réunion'
            );
          } else {
            const errorMessage = error.error?.message || 'Erreur lors de la suppression de la réunion';
            this.toastService.error(
              'Erreur de suppression',
              errorMessage,
              8000
            );
          }
        }
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