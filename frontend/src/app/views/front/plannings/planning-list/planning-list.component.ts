import { Component, OnInit } from '@angular/core';
import { PlanningService } from 'src/app/services/planning.service';
import { Planning } from 'src/app/models/planning.model';
import { AuthuserService } from 'src/app/services/authuser.service';
import { ActivatedRoute, Router, NavigationEnd } from '@angular/router';
import { ToastService } from 'src/app/services/toast.service';
import {
  trigger,
  style,
  animate,
  transition,
  query,
  stagger,
  keyframes,
  state,
} from '@angular/animations';

@Component({
  selector: 'app-planning-list',
  templateUrl: './planning-list.component.html',
  styleUrls: ['./planning-list.component.css'],
  animations: [
    // Animation pour l'entrée des cartes de planning (plus fluide)
    trigger('staggerAnimation', [
      transition('* => *', [
        query(
          ':enter',
          [
            style({ opacity: 0, transform: 'translateY(20px) scale(0.95)' }),
            stagger('100ms', [
              animate(
                '0.6s cubic-bezier(0.25, 0.8, 0.25, 1)',
                keyframes([
                  style({
                    opacity: 0,
                    transform: 'translateY(20px) scale(0.95)',
                    offset: 0,
                  }),
                  style({
                    opacity: 0.6,
                    transform: 'translateY(10px) scale(0.98)',
                    offset: 0.4,
                  }),
                  style({
                    opacity: 1,
                    transform: 'translateY(0) scale(1)',
                    offset: 1.0,
                  }),
                ])
              ),
            ]),
          ],
          { optional: true }
        ),
      ]),
    ]),

    // Animation pour le survol des cartes (plus douce)
    trigger('cardHover', [
      state(
        'default',
        style({
          transform: 'scale(1) translateY(0)',
          boxShadow:
            '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        })
      ),
      state(
        'hovered',
        style({
          transform: 'scale(1.02) translateY(-3px)',
          boxShadow:
            '0 15px 20px -5px rgba(0, 0, 0, 0.08), 0 8px 8px -5px rgba(0, 0, 0, 0.03)',
        })
      ),
      transition('default => hovered', [
        animate('0.4s cubic-bezier(0.25, 0.8, 0.25, 1)'),
      ]),
      transition('hovered => default', [
        animate('0.3s cubic-bezier(0.25, 0.8, 0.25, 1)'),
      ]),
    ]),

    // Animation pour l'en-tête
    trigger('fadeInDown', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(-20px)' }),
        animate(
          '0.5s ease-out',
          style({ opacity: 1, transform: 'translateY(0)' })
        ),
      ]),
    ]),
  ],
})
export class PlanningListComponent implements OnInit {
  plannings: Planning[] = [];
  loading = true;
  error: string | null = null;
  hoveredIndex: number | null = null;

  constructor(
    private planningService: PlanningService,
    public authService: AuthuserService,
    private router: Router,
    private route: ActivatedRoute,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    console.log('PlanningListComponent initialized');

    // S'abonner aux événements de navigation pour recharger les plannings
    this.router.events.subscribe((event) => {
      // NavigationEnd est émis lorsque la navigation est terminée
      if (event instanceof NavigationEnd) {
        console.log('Navigation terminée, rechargement des plannings');
        this.loadPlannings();
      }
    });

    // Chargement initial des plannings
    this.loadPlannings();
  }

  loadPlannings(): void {
    this.loading = true;
    console.log('Loading plannings...');

    // Utiliser getAllPlannings au lieu de getPlanningsByUser pour afficher tous les plannings
    this.planningService.getAllPlannings().subscribe({
      next: (response: any) => {
        console.log('Response received:', response);

        if (response.success) {
          // Récupérer les plannings
          let plannings = response.plannings;

          // Trier les plannings par nombre de réunions (ordre décroissant)
          plannings.sort((a: any, b: any) => {
            const reunionsA = a.reunions?.length || 0;
            const reunionsB = b.reunions?.length || 0;
            return reunionsB - reunionsA; // Ordre décroissant
          });

          this.plannings = plannings;
          console.log(
            'Plannings loaded and sorted by reunion count:',
            this.plannings.length
          );

          if (this.plannings.length > 0) {
            console.log('First planning:', this.plannings[0]);
            console.log(
              'Reunion counts:',
              this.plannings.map((p) => ({
                titre: p.titre,
                reunions: p.reunions?.length || 0,
              }))
            );
          }
        } else {
          console.error('Error in response:', response);
          this.toastService.showError(
            'Erreur lors du chargement des plannings'
          );
        }

        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading plannings:', err);
        this.loading = false;

        const errorMessage = err.message || err.statusText || 'Erreur inconnue';
        this.toastService.showError(
          `Erreur lors du chargement des plannings: ${errorMessage}`
        );
      },
    });
  }

  deletePlanning(id: string): void {
    if (confirm('Supprimer ce planning ?')) {
      this.planningService.deletePlanning(id).subscribe({
        next: () => {
          this.plannings = this.plannings.filter((p) => p._id !== id);
          this.toastService.showSuccess(
            'Le planning a été supprimé avec succès'
          );
        },
        error: (err) => {
          console.error('Erreur lors de la suppression du planning:', err);

          // Gestion spécifique des erreurs d'autorisation
          if (err.status === 403) {
            this.toastService.showError(
              "Accès refusé : vous n'avez pas les droits pour supprimer ce planning"
            );
          } else if (err.status === 401) {
            this.toastService.showError(
              'Vous devez être connecté pour supprimer un planning'
            );
          } else {
            const errorMessage =
              err.error?.message || 'Erreur lors de la suppression du planning';
            this.toastService.showError(errorMessage, 8000);
          }
        },
      });
    }
  }

  GotoDetail(id: string | undefined) {
    if (id) {
      this.router.navigate([id], { relativeTo: this.route });
    }
  }

  // Méthodes pour les animations de survol
  onMouseEnter(index: number): void {
    this.hoveredIndex = index;
  }

  onMouseLeave(): void {
    this.hoveredIndex = null;
  }

  getCardState(index: number): string {
    return this.hoveredIndex === index ? 'hovered' : 'default';
  }

  // Méthode pour le suivi des éléments dans ngFor
  trackByFn(index: number, planning: any): string {
    return planning._id || index.toString();
  }
}
