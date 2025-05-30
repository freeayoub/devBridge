import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {ReunionService} from "@app/services/reunion.service";
import {DataService} from "@app/services/data.service";
import {PlanningService} from "@app/services/planning.service";
import {Planning} from "@app/models/planning.model";
import {User} from "@app/models/user.model";
import {ToastService} from "@app/services/toast.service";
import {AuthuserService} from "@app/services/authuser.service";
import {RoleService} from "@app/services/role.service";

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
  currentReunionPlanning: Planning | null = null;
  isAdmin = false;

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private reunionService: ReunionService,
    private userService: DataService,
    private planningService: PlanningService,
    private toastService: ToastService,
    private authService: AuthuserService,
    private roleService: RoleService
  ) {}

  ngOnInit(): void {
    this.reunionId = this.route.snapshot.paramMap.get('id')!;
    this.checkUserRole();
    this.initForm();
    this.fetchUsers();
    this.fetchPlannings();
    this.loadReunion();
  }

  checkUserRole(): void {
    this.isAdmin = this.roleService.isAdmin();
    console.log('🔍 Utilisateur admin:', this.isAdmin);
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
    const userId = this.authService.getCurrentUserId();
    if (!userId) return;

    // Si admin, récupérer tous les plannings, sinon seulement ceux de l'utilisateur
    const planningsObservable = this.isAdmin
      ? this.planningService.getAllPlanningsAdmin()
      : this.planningService.getPlanningsByUser(userId);

    planningsObservable.subscribe({
      next: (response: any) => {
        // Adapter la réponse selon l'endpoint utilisé
        if (this.isAdmin) {
          this.plannings = response.data || [];
          console.log('🔍 Tous les plannings (admin) récupérés:', this.plannings);
        } else {
          this.plannings = response.plannings || [];
          console.log('🔍 Plannings utilisateur récupérés:', this.plannings);
        }
      },
      error: (err) => {
        console.error('❌ Erreur chargement plannings:', err);
        this.toastService.error(
          'Erreur',
          'Impossible de récupérer les plannings'
        );
      }
    });
  }

  loadReunion(): void {
    this.reunionService.getReunionById(this.reunionId).subscribe({
      next: (reunion: any) => {
        // Stocker le planning actuel de la réunion
        this.currentReunionPlanning = reunion.reunion.planning;

        this.reunionForm.patchValue({
          titre: reunion.reunion.titre,
          description: reunion.reunion.description,
          date: reunion.reunion.date?.split('T')[0],
          heureDebut: reunion.reunion.heureDebut,
          heureFin: reunion.reunion.heureFin,
          lieu: reunion.reunion.lieu,
          lienVisio: reunion.reunion.lienVisio,
          planning: reunion.reunion.planning?.id || reunion.reunion.planning?._id,
          participants: reunion.reunion.participants?.map((p:any) => p._id)
        });

        // Désactiver le champ planning en mode édition
        this.reunionForm.get('planning')?.disable();

        console.log('🔍 Réunion chargée:', reunion.reunion);
        console.log('🔍 Planning actuel:', this.currentReunionPlanning);
      },
      error: (err) => {
        console.error('Erreur lors du chargement de la réunion:', err);
        if (err.status === 403) {
          this.toastService.accessDenied('accéder à cette réunion', err.status);
        } else if (err.status === 404) {
          this.toastService.error(
            'Réunion introuvable',
            'La réunion demandée n\'existe pas ou a été supprimée'
          );
        } else {
          const errorMessage = err.error?.message || 'Erreur lors du chargement de la réunion';
          this.toastService.error(
            'Erreur de chargement',
            errorMessage
          );
        }
      }
    });
  }

  onSubmit(): void {
    if (this.reunionForm.invalid) {
      this.toastService.warning(
        'Formulaire invalide',
        'Veuillez corriger les erreurs avant de soumettre le formulaire'
      );
      return;
    }

    // Validation de la date par rapport au planning
    if (!this.validateDateInPlanningRange()) {
      return;
    }

    this.isSubmitting = true;
    const reunion: any = this.reunionForm.value;

    // Inclure le planning même s'il est désactivé
    if (this.currentReunionPlanning) {
      reunion.planning = this.currentReunionPlanning._id || this.currentReunionPlanning.id;
    }

    console.log('🔍 Données de la réunion à mettre à jour:', reunion);

    this.reunionService.updateReunion(this.reunionId, reunion).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.toastService.success(
          'Réunion mise à jour',
          'La réunion a été modifiée avec succès'
        );
        this.router.navigate(['/reunions']);
      },
      error: (err) => {
        this.isSubmitting = false;
        console.error('Erreur lors de la mise à jour de la réunion:', err);

        if (err.status === 403) {
          this.toastService.accessDenied('modifier cette réunion', err.status);
        } else if (err.status === 401) {
          this.toastService.error(
            'Non autorisé',
            'Vous devez être connecté pour effectuer cette action'
          );
        } else {
          const errorMessage = err.error?.message || 'Erreur lors de la mise à jour de la réunion';
          this.toastService.error(
            'Erreur de mise à jour',
            errorMessage,
            8000
          );
        }
      }
    });
  }

  goReunion(): void {
    this.router.navigate(['/reunions']);
  }

  /**
   * Valide que la date de la réunion est dans l'intervalle du planning sélectionné
   */
  validateDateInPlanningRange(): boolean {
    const formValue = this.reunionForm.value;
    const reunionDate = formValue.date;
    const planningId = formValue.planning;

    if (!reunionDate || !planningId) {
      return true; // Si pas de date ou planning, laisser la validation backend gérer
    }

    // Trouver le planning sélectionné
    const selectedPlanning = this.plannings.find(p => p._id === planningId);
    if (!selectedPlanning) {
      console.warn('⚠️ Planning non trouvé dans la liste locale, tentative de récupération depuis le serveur');
      // Si le planning n'est pas trouvé dans la liste locale, essayer de le récupérer
      // Cela peut arriver si l'utilisateur modifie une réunion d'un planning dont il n'est que participant
      this.planningService.getPlanningById(planningId).subscribe({
        next: (response: any) => {
          const planning = response.planning;
          if (planning) {
            // Ajouter le planning à la liste locale pour éviter de futures requêtes
            this.plannings.push(planning);
            console.log('✅ Planning récupéré et ajouté à la liste locale:', planning);
          }
        },
        error: (err) => {
          console.error('❌ Erreur lors de la récupération du planning:', err);
          this.toastService.error(
            'Planning introuvable',
            'Le planning sélectionné n\'existe pas ou vous n\'avez pas les permissions pour y accéder'
          );
        }
      });
      // Pour cette validation, on retourne true et on laisse le backend gérer
      return true;
    }

    // Convertir les dates pour comparaison
    const reunionDateObj = new Date(reunionDate);
    const planningDateDebut = new Date(selectedPlanning.dateDebut);
    const planningDateFin = new Date(selectedPlanning.dateFin);

    // Comparer seulement les dates (sans les heures)
    reunionDateObj.setHours(0, 0, 0, 0);
    planningDateDebut.setHours(0, 0, 0, 0);
    planningDateFin.setHours(0, 0, 0, 0);

    if (reunionDateObj < planningDateDebut || reunionDateObj > planningDateFin) {
      this.toastService.error(
        'Date invalide',
        `La date de la réunion doit être comprise entre le ${planningDateDebut.toLocaleDateString('fr-FR')} et le ${planningDateFin.toLocaleDateString('fr-FR')} (période du planning "${selectedPlanning.titre}")`,
        10000
      );
      return false;
    }

    return true;
  }
}