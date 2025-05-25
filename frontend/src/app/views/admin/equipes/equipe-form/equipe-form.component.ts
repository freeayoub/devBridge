import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { EquipeService } from 'src/app/services/equipe.service';
import { MembreService } from 'src/app/services/membre.service';
import { AuthService } from 'src/app/services/auth.service';
import { NotificationService } from 'src/app/services/notification.service';
import { Equipe } from 'src/app/models/equipe.model';
import { Membre } from 'src/app/models/membre.model';
import { User } from 'src/app/models/user.model';

@Component({
  selector: 'app-equipe-form',
  template: `
    <div
      class="min-h-screen bg-[#f0f4f8] dark:bg-[#0a0a0a] relative overflow-hidden"
    >
      <!-- Background decorative elements -->
      <div class="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          class="absolute top-[15%] left-[10%] w-64 h-64 rounded-full bg-gradient-to-br from-[#dac4ea]/5 to-transparent dark:from-[#00f7ff]/3 dark:to-transparent blur-3xl"
        ></div>
        <div
          class="absolute bottom-[20%] right-[10%] w-80 h-80 rounded-full bg-gradient-to-tl from-[#dac4ea]/5 to-transparent dark:from-[#00f7ff]/3 dark:to-transparent blur-3xl"
        ></div>

        <!-- Grid pattern -->
        <div class="absolute inset-0 opacity-5 dark:opacity-[0.03]">
          <div class="h-full grid grid-cols-12">
            <div class="border-r border-[#dac4ea] dark:border-[#00f7ff]"></div>
            <div class="border-r border-[#dac4ea] dark:border-[#00f7ff]"></div>
            <div class="border-r border-[#dac4ea] dark:border-[#00f7ff]"></div>
            <div class="border-r border-[#dac4ea] dark:border-[#00f7ff]"></div>
            <div class="border-r border-[#dac4ea] dark:border-[#00f7ff]"></div>
            <div class="border-r border-[#dac4ea] dark:border-[#00f7ff]"></div>
            <div class="border-r border-[#dac4ea] dark:border-[#00f7ff]"></div>
            <div class="border-r border-[#dac4ea] dark:border-[#00f7ff]"></div>
            <div class="border-r border-[#dac4ea] dark:border-[#00f7ff]"></div>
            <div class="border-r border-[#dac4ea] dark:border-[#00f7ff]"></div>
            <div class="border-r border-[#dac4ea] dark:border-[#00f7ff]"></div>
          </div>
        </div>
      </div>

      <div class="max-w-4xl mx-auto p-6 relative z-10">
        <!-- Header -->
        <div class="mb-8 relative">
          <div
            class="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#dac4ea] to-[#8b5a9f] dark:from-[#00f7ff] dark:to-[#dac4ea]"
          ></div>
          <div
            class="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#dac4ea] to-[#8b5a9f] dark:from-[#00f7ff] dark:to-[#dac4ea] blur-md"
          ></div>

          <div
            class="bg-white dark:bg-[#1a1a1a] rounded-xl shadow-lg dark:shadow-[0_8px_30px_rgba(0,0,0,0.3)] p-6 backdrop-blur-sm border border-[#dac4ea]/20 dark:border-[#00f7ff]/20"
          >
            <div
              class="flex flex-col lg:flex-row lg:items-center lg:justify-between"
            >
              <div class="mb-4 lg:mb-0">
                <h1
                  class="text-3xl font-bold text-[#dac4ea] dark:text-[#00f7ff] mb-2 tracking-wide"
                >
                  {{ isEditMode ? "Modifier l'équipe" : 'Nouvelle équipe' }}
                </h1>
                <p class="text-[#6d6870] dark:text-[#e0e0e0] text-sm">
                  {{
                    isEditMode
                      ? 'Modifiez les informations et les membres de votre équipe'
                      : 'Créez une nouvelle équipe pour organiser vos projets et membres'
                  }}
                </p>
              </div>

              <button
                (click)="cancel()"
                class="bg-[#dac4ea]/20 dark:bg-[#00f7ff]/20 text-[#dac4ea] dark:text-[#00f7ff] px-6 py-3 rounded-xl font-medium transition-all duration-300 hover:scale-105 hover:bg-[#dac4ea]/30 dark:hover:bg-[#00f7ff]/30"
              >
                <i class="fas fa-arrow-left mr-2"></i>
                Retour à la liste
              </button>
            </div>
          </div>
        </div>

        <!-- Loading Indicator -->
        <div
          *ngIf="loading"
          class="flex flex-col items-center justify-center py-16"
        >
          <div class="relative">
            <div
              class="w-12 h-12 border-3 border-[#dac4ea]/20 dark:border-[#00f7ff]/20 border-t-[#dac4ea] dark:border-t-[#00f7ff] rounded-full animate-spin"
            ></div>
            <div
              class="absolute inset-0 bg-[#dac4ea]/20 dark:bg-[#00f7ff]/20 blur-xl rounded-full transform scale-150 -z-10"
            ></div>
          </div>
          <p
            class="mt-4 text-[#dac4ea] dark:text-[#00f7ff] text-sm font-medium tracking-wide"
          >
            Chargement des données...
          </p>
        </div>

        <!-- Error Alert -->
        <div *ngIf="error" class="mb-6">
          <div
            class="bg-[#ff6b69]/10 dark:bg-[#ff3b30]/10 border-l-4 border-[#ff6b69] dark:border-[#ff3b30] rounded-lg p-4 backdrop-blur-sm"
          >
            <div class="flex items-start">
              <div class="text-[#ff6b69] dark:text-[#ff3b30] mr-3 text-xl">
                <i class="fas fa-exclamation-triangle"></i>
              </div>
              <div class="flex-1">
                <h3
                  class="font-semibold text-[#ff6b69] dark:text-[#ff3b30] mb-1"
                >
                  Erreur
                </h3>
                <p class="text-sm text-[#6d6870] dark:text-[#e0e0e0]">
                  {{ error }}
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- Formulaire principal -->
        <div *ngIf="!loading" class="mb-8 relative">
          <div
            class="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#dac4ea] to-[#8b5a9f] dark:from-[#00f7ff] dark:to-[#dac4ea]"
          ></div>
          <div
            class="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#dac4ea] to-[#8b5a9f] dark:from-[#00f7ff] dark:to-[#dac4ea] blur-md"
          ></div>

          <div
            class="bg-white dark:bg-[#1a1a1a] rounded-xl shadow-lg dark:shadow-[0_8px_30px_rgba(0,0,0,0.3)] overflow-hidden border border-[#dac4ea]/20 dark:border-[#00f7ff]/20"
          >
            <!-- Header -->
            <div
              class="bg-gradient-to-r from-[#dac4ea] to-[#8b5a9f] dark:from-[#00f7ff] dark:to-[#dac4ea] p-6"
            >
              <h3 class="text-xl font-bold text-white mb-1 flex items-center">
                <i
                  class="fas mr-2"
                  [ngClass]="{
                    'fa-edit': isEditMode,
                    'fa-plus-circle': !isEditMode
                  }"
                ></i>
                {{
                  isEditMode
                    ? "Informations de l'équipe"
                    : 'Détails de la nouvelle équipe'
                }}
              </h3>
              <p class="text-white/80 text-sm">
                Remplissez les informations de base de l'équipe
              </p>
            </div>

            <!-- Form -->
            <div class="p-6">
              <form (ngSubmit)="onSubmit()" class="space-y-6">
                <!-- Nom de l'équipe -->
                <div>
                  <label
                    class="block text-sm font-medium text-[#dac4ea] dark:text-[#00f7ff] mb-2"
                  >
                    Nom de l'équipe
                    <span class="text-[#ff6b69] dark:text-[#ff3b30]">*</span>
                  </label>
                  <div class="relative">
                    <div
                      class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"
                    >
                      <i
                        class="fas fa-users text-[#dac4ea] dark:text-[#00f7ff]"
                      ></i>
                    </div>
                    <input
                      #nameInput
                      type="text"
                      [value]="equipe.name || ''"
                      (input)="updateName(nameInput.value)"
                      class="w-full pl-10 pr-4 py-3 bg-[#f0f4f8] dark:bg-[#0a0a0a] border border-[#dac4ea]/20 dark:border-[#00f7ff]/20 rounded-lg text-[#6d6870] dark:text-[#e0e0e0] placeholder-[#6d6870]/50 dark:placeholder-[#a0a0a0] focus:outline-none focus:ring-2 focus:ring-[#dac4ea] dark:focus:ring-[#00f7ff] focus:border-transparent transition-all"
                      placeholder="Entrez le nom de l'équipe"
                      required
                      minlength="3"
                    />
                  </div>
                  <div
                    *ngIf="nameExists"
                    class="mt-1 text-sm text-[#ff6b69] dark:text-[#ff3b30] flex items-center"
                  >
                    <i class="fas fa-exclamation-triangle mr-1"></i>
                    Ce nom d'équipe existe déjà. Veuillez en choisir un autre.
                  </div>
                </div>

                <!-- Description -->
                <div>
                  <label
                    class="block text-sm font-medium text-[#dac4ea] dark:text-[#00f7ff] mb-2"
                  >
                    Description
                    <span class="text-[#ff6b69] dark:text-[#ff3b30]">*</span>
                  </label>
                  <div class="relative">
                    <div class="absolute top-3 left-3 pointer-events-none">
                      <i
                        class="fas fa-file-alt text-[#dac4ea] dark:text-[#00f7ff]"
                      ></i>
                    </div>
                    <textarea
                      #descInput
                      [value]="equipe.description || ''"
                      (input)="updateDescription(descInput.value)"
                      rows="4"
                      class="w-full pl-10 pr-4 py-3 bg-[#f0f4f8] dark:bg-[#0a0a0a] border border-[#dac4ea]/20 dark:border-[#00f7ff]/20 rounded-lg text-[#6d6870] dark:text-[#e0e0e0] placeholder-[#6d6870]/50 dark:placeholder-[#a0a0a0] focus:outline-none focus:ring-2 focus:ring-[#dac4ea] dark:focus:ring-[#00f7ff] focus:border-transparent transition-all resize-none"
                      placeholder="Décrivez l'objectif et les activités de cette équipe"
                      required
                      minlength="10"
                    ></textarea>
                  </div>
                </div>

                <!-- Admin info -->
                <input type="hidden" [value]="equipe.admin" />
                <div
                  class="bg-[#dac4ea]/10 dark:bg-[#00f7ff]/10 border-l-4 border-[#dac4ea] dark:border-[#00f7ff] rounded-lg p-4"
                >
                  <div class="flex items-center">
                    <div
                      class="text-[#dac4ea] dark:text-[#00f7ff] mr-3 text-lg"
                    >
                      <i class="fas fa-info-circle"></i>
                    </div>
                    <div class="text-sm text-[#6d6870] dark:text-[#e0e0e0]">
                      Un administrateur par défaut sera assigné à cette équipe.
                    </div>
                  </div>
                </div>

                <!-- Buttons -->
                <div class="flex items-center justify-between pt-4">
                  <div class="flex items-center space-x-4">
                    <button
                      type="button"
                      (click)="cancel()"
                      class="bg-[#6d6870]/20 dark:bg-[#a0a0a0]/20 text-[#6d6870] dark:text-[#e0e0e0] px-6 py-3 rounded-xl font-medium transition-all duration-300 hover:scale-105 hover:bg-[#6d6870]/30 dark:hover:bg-[#a0a0a0]/30"
                    >
                      <i class="fas fa-arrow-left mr-2"></i>
                      Retour
                    </button>

                    <button
                      *ngIf="isEditMode && equipeId"
                      type="button"
                      (click)="deleteEquipe()"
                      class="bg-[#ff6b69]/20 dark:bg-[#ff3b30]/20 text-[#ff6b69] dark:text-[#ff3b30] px-6 py-3 rounded-xl font-medium transition-all duration-300 hover:scale-105 hover:bg-[#ff6b69]/30 dark:hover:bg-[#ff3b30]/30"
                    >
                      <i class="fas fa-trash mr-2"></i>
                      Supprimer
                    </button>
                  </div>

                  <button
                    type="submit"
                    [disabled]="
                      submitting ||
                      !equipe.name ||
                      !equipe.description ||
                      nameExists ||
                      nameError ||
                      descriptionError
                    "
                    class="relative overflow-hidden group bg-gradient-to-r from-[#dac4ea] to-[#8b5a9f] dark:from-[#00f7ff] dark:to-[#dac4ea] text-white px-6 py-3 rounded-xl font-medium transition-all duration-300 hover:scale-105 shadow-lg hover:shadow-[0_0_25px_rgba(218,196,234,0.4)] dark:hover:shadow-[0_0_25px_rgba(0,247,255,0.4)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                  >
                    <span
                      *ngIf="submitting"
                      class="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"
                    ></span>
                    <i
                      *ngIf="!submitting"
                      class="fas mr-2"
                      [ngClass]="{
                        'fa-save': isEditMode,
                        'fa-plus-circle': !isEditMode
                      }"
                    ></i>
                    {{ isEditMode ? 'Mettre à jour' : "Créer l'équipe" }}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./equipe-form.component.css'],
})
export class EquipeFormComponent implements OnInit {
  equipe: Equipe = {
    name: '',
    description: '',
    admin: '', // Sera défini avec l'ID de l'utilisateur connecté
  };
  isEditMode = false;
  loading = false;
  submitting = false;
  error: string | null = null;
  equipeId: string | null = null;
  nameExists = false;
  nameError = false;
  descriptionError = false;
  checkingName = false;
  existingEquipes: Equipe[] = [];
  availableMembers: Membre[] = []; // Liste des membres disponibles
  availableUsers: User[] = []; // Liste des utilisateurs disponibles
  currentUserId: string | null = null; // ID de l'utilisateur connecté

  constructor(
    private equipeService: EquipeService,
    private membreService: MembreService,
    private userService: AuthService,
    private route: ActivatedRoute,
    private router: Router,
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    console.log('EquipeFormComponent initialized');

    // Récupérer l'ID de l'utilisateur connecté
    this.getCurrentUser();

    // Charger toutes les équipes pour vérifier les noms existants
    this.loadAllEquipes();

    // Charger tous les membres disponibles
    this.loadAllMembers();

    // Charger tous les utilisateurs disponibles
    this.loadAllUsers();

    try {
      // Vérifier si nous sommes en mode édition (si un ID est présent dans l'URL)
      this.equipeId = this.route.snapshot.paramMap.get('id');
      this.isEditMode = !!this.equipeId;
      console.log('Edit mode:', this.isEditMode, 'ID:', this.equipeId);

      if (this.isEditMode && this.equipeId) {
        this.loadEquipe(this.equipeId);

        // Ajouter un délai pour s'assurer que l'équipe est chargée
        setTimeout(() => {
          console.log('Après délai - this.equipeId:', this.equipeId);
          console.log('Après délai - this.equipe:', this.equipe);
        }, 1000);
      }
    } catch (error) {
      console.error('Error in ngOnInit:', error);
      this.error = "Erreur d'initialisation";
    }

    // Ajouter un gestionnaire d'événements pour le bouton d'ajout de membre
    setTimeout(() => {
      const addButton = document.getElementById('addMembreButton');
      if (addButton) {
        console.log("Bouton d'ajout de membre trouvé");
        addButton.addEventListener('click', () => {
          console.log("Bouton d'ajout de membre cliqué");
        });
      } else {
        console.log("Bouton d'ajout de membre non trouvé");
      }
    }, 2000);
  }

  getCurrentUser(): void {
    const token = localStorage.getItem('token');
    if (token) {
      this.userService.getProfile(token).subscribe({
        next: (user: any) => {
          console.log('Utilisateur connecté:', user);
          this.currentUserId = user._id || user.id;

          // Définir l'admin de l'équipe avec l'ID de l'utilisateur connecté
          if (!this.isEditMode && this.currentUserId) {
            this.equipe.admin = this.currentUserId;
            console.log(
              'Admin défini pour nouvelle équipe:',
              this.equipe.admin
            );
          }
        },
        error: (error) => {
          console.error(
            'Erreur lors de la récupération du profil utilisateur:',
            error
          );
          this.error =
            "Impossible de récupérer les informations de l'utilisateur connecté.";
        },
      });
    } else {
      this.error =
        "Aucun token d'authentification trouvé. Veuillez vous reconnecter.";
    }
  }

  loadAllMembers(): void {
    this.membreService.getMembres().subscribe({
      next: (membres) => {
        this.availableMembers = membres;
        console.log('Membres disponibles chargés:', membres);
      },
      error: (error) => {
        console.error('Erreur lors du chargement des membres:', error);
        this.error =
          'Impossible de charger la liste des membres. Veuillez réessayer plus tard.';
      },
    });
  }

  loadAllUsers(): void {
    const token = localStorage.getItem('token');
    if (token) {
      this.userService.getAllUsers(token).subscribe({
        next: (users: any) => {
          this.availableUsers = users;
          console.log('Utilisateurs disponibles chargés:', users);
        },
        error: (error) => {
          console.error('Erreur lors du chargement des utilisateurs:', error);
          this.error =
            'Impossible de charger la liste des utilisateurs. Veuillez réessayer plus tard.';
        },
      });
    }
  }

  loadAllEquipes(): void {
    this.equipeService.getEquipes().subscribe({
      next: (equipes) => {
        this.existingEquipes = equipes;
        console.log('Équipes existantes chargées:', equipes);
      },
      error: (error) => {
        console.error('Erreur lors du chargement des équipes:', error);
      },
    });
  }

  loadEquipe(id: string): void {
    console.log('Loading equipe with ID:', id);
    this.loading = true;
    this.error = null;

    this.equipeService.getEquipe(id).subscribe({
      next: (data) => {
        console.log('Équipe chargée:', data);
        this.equipe = data;

        // Vérifier que l'ID est correctement défini
        console.log("ID de l'équipe après chargement:", this.equipe._id);
        console.log('this.equipeId:', this.equipeId);

        // Si l'équipe a des membres, récupérer les informations de chaque membre
        if (this.equipe.members && this.equipe.members.length > 0) {
          this.loadMembersDetails();
        }

        this.loading = false;
      },
      error: (error) => {
        console.error("Erreur lors du chargement de l'équipe:", error);
        this.error =
          "Impossible de charger les détails de l'équipe. Veuillez réessayer plus tard.";
        this.loading = false;
      },
    });
  }

  // Méthode pour récupérer les détails des membres de l'équipe
  loadMembersDetails(): void {
    if (!this.equipe.members || this.equipe.members.length === 0) {
      return;
    }

    console.log("Chargement des détails des membres de l'équipe...");

    // Pour chaque membre de l'équipe, essayer de trouver ses informations dans la liste des utilisateurs
    this.equipe.members.forEach((membreId) => {
      // Chercher d'abord dans la liste des utilisateurs
      const user = this.availableUsers.find(
        (u) => u._id === membreId || u.id === membreId
      );
      if (user) {
        console.log(
          `Membre ${membreId} trouvé dans la liste des utilisateurs:`,
          user
        );

        // Vérifier si toutes les informations nécessaires sont présentes
        if (!user.email || (!user.profession && !user.role)) {
          // Si des informations manquent, essayer de les récupérer depuis l'API
          const token = localStorage.getItem('token');
          if (token) {
            this.userService.getUserById(membreId, token).subscribe({
              next: (userData: any) => {
                console.log(
                  `Détails supplémentaires de l'utilisateur ${membreId} récupérés:`,
                  userData
                );

                // Mettre à jour l'utilisateur dans la liste avec les nouvelles informations
                const index = this.availableUsers.findIndex(
                  (u) => u._id === membreId || u.id === membreId
                );
                if (index !== -1) {
                  this.availableUsers[index] = {
                    ...this.availableUsers[index],
                    ...userData,
                  };
                }
              },
              error: (error) => {
                console.error(
                  `Erreur lors de la récupération des détails supplémentaires de l'utilisateur ${membreId}:`,
                  error
                );
              },
            });
          }
        }
      } else {
        // Si non trouvé, essayer de récupérer l'utilisateur depuis l'API
        const token = localStorage.getItem('token');
        if (token) {
          this.userService.getUserById(membreId, token).subscribe({
            next: (userData: any) => {
              console.log(
                `Détails de l'utilisateur ${membreId} récupérés:`,
                userData
              );
              // Ajouter l'utilisateur à la liste des utilisateurs disponibles s'il n'y est pas déjà
              if (
                !this.availableUsers.some(
                  (u) => u._id === userData._id || u.id === userData.id
                )
              ) {
                this.availableUsers.push(userData);
              }
            },
            error: (error) => {
              console.error(
                `Erreur lors de la récupération des détails de l'utilisateur ${membreId}:`,
                error
              );
            },
          });
        }
      }
    });
  }

  checkNameExists(name: string): boolean {
    // En mode édition, ignorer l'équipe actuelle
    if (this.isEditMode && this.equipeId) {
      return this.existingEquipes.some(
        (e) => e.name === name && e._id !== this.equipeId
      );
    }
    // En mode création, vérifier tous les noms
    return this.existingEquipes.some((e) => e.name === name);
  }

  updateName(value: string): void {
    console.log('Name updated:', value);
    this.equipe.name = value;

    // Vérifier si le nom existe déjà
    this.nameExists = this.checkNameExists(value);
    if (this.nameExists) {
      console.warn("Ce nom d'équipe existe déjà");
    }

    // Vérifier si le nom a au moins 3 caractères
    this.nameError = value.length > 0 && value.length < 3;
    if (this.nameError) {
      console.warn('Le nom doit contenir au moins 3 caractères');
    }
  }

  updateDescription(value: string): void {
    console.log('Description updated:', value);
    this.equipe.description = value;

    // Vérifier si la description a au moins 10 caractères
    this.descriptionError = value.length > 0 && value.length < 10;
    if (this.descriptionError) {
      console.warn('La description doit contenir au moins 10 caractères');
    }
  }

  onSubmit(): void {
    console.log('Form submitted with:', this.equipe);

    // Vérifier si le nom est présent et valide
    if (!this.equipe.name) {
      this.error = "Le nom de l'équipe est requis.";
      return;
    }

    if (this.equipe.name.length < 3) {
      this.nameError = true;
      this.error = "Le nom de l'équipe doit contenir au moins 3 caractères.";
      return;
    }

    // Vérifier si la description est présente et valide
    if (!this.equipe.description) {
      this.error = "La description de l'équipe est requise.";
      return;
    }

    if (this.equipe.description.length < 10) {
      this.descriptionError = true;
      this.error =
        "La description de l'équipe doit contenir au moins 10 caractères.";
      return;
    }

    // Vérifier si le nom existe déjà avant de soumettre
    if (this.checkNameExists(this.equipe.name)) {
      this.nameExists = true;
      this.error =
        'Une équipe avec ce nom existe déjà. Veuillez choisir un autre nom.';
      return;
    }

    this.submitting = true;
    this.error = null;

    // S'assurer que l'admin est défini
    if (!this.equipe.admin && this.currentUserId) {
      this.equipe.admin = this.currentUserId;
    }

    if (!this.equipe.admin) {
      this.error =
        "Impossible de déterminer l'administrateur de l'équipe. Veuillez vous reconnecter.";
      return;
    }

    // Créer une copie de l'objet équipe pour éviter les problèmes de référence
    const equipeToSave: Equipe = {
      name: this.equipe.name,
      description: this.equipe.description || '',
      admin: this.equipe.admin,
    };

    // Ajouter l'ID si nous sommes en mode édition
    if (this.isEditMode && this.equipeId) {
      equipeToSave._id = this.equipeId;
    }

    console.log('Données à envoyer:', equipeToSave);

    if (this.isEditMode && this.equipeId) {
      // Mode édition
      this.equipeService.updateEquipe(this.equipeId, equipeToSave).subscribe({
        next: (response) => {
          console.log('Équipe mise à jour avec succès:', response);
          this.submitting = false;
          this.notificationService.showSuccess(
            `L'équipe "${response.name}" a été mise à jour avec succès.`
          );
          this.router.navigate(['/equipes/liste']);
        },
        error: (error) => {
          console.error("Erreur lors de la mise à jour de l'équipe:", error);
          this.error = `Impossible de mettre à jour l'équipe: ${error.message}`;
          this.submitting = false;
          this.notificationService.showError(`Erreur: ${error.message}`);
        },
      });
    } else {
      // Mode ajout
      this.equipeService.addEquipe(equipeToSave).subscribe({
        next: (response) => {
          console.log('Équipe ajoutée avec succès:', response);
          this.submitting = false;
          this.notificationService.showSuccess(
            `L'équipe "${response.name}" a été créée avec succès.`
          );
          this.router.navigate(['/equipes/liste']);
        },
        error: (error) => {
          console.error("Erreur lors de l'ajout de l'équipe:", error);
          this.error = `Impossible d'ajouter l'équipe: ${error.message}`;
          this.submitting = false;
          this.notificationService.showError(`Erreur: ${error.message}`);
        },
      });
    }
  }

  cancel(): void {
    console.log('Form cancelled');
    this.router.navigate(['/admin/equipes']);
  }

  // Méthodes pour gérer les membres
  addMembreToEquipe(membreId: string, role: string = 'membre'): void {
    console.log(
      'Début de addMembreToEquipe avec membreId:',
      membreId,
      'et rôle:',
      role
    );
    console.log('État actuel - this.equipeId:', this.equipeId);
    console.log('État actuel - this.equipe:', this.equipe);

    // Utiliser this.equipe._id si this.equipeId n'est pas défini
    const equipeId = this.equipeId || (this.equipe && this.equipe._id);

    console.log('equipeId calculé:', equipeId);

    if (!equipeId || !membreId) {
      console.error("ID d'équipe ou ID de membre manquant");
      this.error = "ID d'équipe ou ID de membre manquant";
      console.log('equipeId:', equipeId, 'membreId:', membreId);

      // Afficher un message à l'utilisateur
      this.notificationService.showError(
        "Impossible d'ajouter le membre: ID d'équipe ou ID de membre manquant"
      );
      return;
    }

    // Vérifier si le membre est déjà dans l'équipe
    if (this.equipe.members && this.equipe.members.includes(membreId)) {
      this.notificationService.showError(
        "Ce membre fait déjà partie de l'équipe"
      );
      return;
    }

    // Récupérer les informations de l'utilisateur pour afficher un message plus informatif
    const user = this.availableUsers.find(
      (u) => u._id === membreId || u.id === membreId
    );
    const userName = user
      ? user.firstName && user.lastName
        ? `${user.firstName} ${user.lastName}`
        : user.name || membreId
      : membreId;

    // Créer l'objet membre avec le rôle spécifié
    const membre: Membre = {
      id: membreId,
      role: role,
    };

    this.loading = true;

    console.log(
      `Ajout de l'utilisateur "${userName}" comme ${role} à l'équipe ${equipeId}`
    );

    this.equipeService.addMembreToEquipe(equipeId, membre).subscribe({
      next: (response) => {
        console.log('Membre ajouté avec succès:', response);
        this.notificationService.showSuccess(
          `${userName} a été ajouté comme ${
            role === 'admin' ? 'administrateur' : 'membre'
          } à l'équipe`
        );
        // Recharger l'équipe pour mettre à jour la liste des membres
        this.loadEquipe(equipeId);
        this.loading = false;
      },
      error: (error) => {
        console.error("Erreur lors de l'ajout du membre:", error);
        this.error =
          "Impossible d'ajouter le membre. Veuillez réessayer plus tard.";
        this.notificationService.showError(
          "Erreur lors de l'ajout du membre: " + error.message
        );
        this.loading = false;
      },
    });
  }

  // Méthode pour obtenir le nom complet d'un membre à partir de son ID
  getMembreName(membreId: string): string {
    // Chercher d'abord dans la liste des utilisateurs
    const user = this.availableUsers.find(
      (u) => u._id === membreId || u.id === membreId
    );
    if (user) {
      if (user.firstName && user.lastName) {
        return `${user.firstName} ${user.lastName}`;
      } else if (user.name) {
        return user.name;
      }
    }

    // Chercher ensuite dans la liste des membres
    const membre = this.availableMembers.find(
      (m) => m._id === membreId || m.id === membreId
    );
    if (membre && membre.name) {
      return membre.name;
    }

    // Si aucun nom n'est trouvé, retourner l'ID
    return membreId;
  }

  // Méthode pour obtenir l'email d'un membre
  getMembreEmail(membreId: string): string {
    const user = this.availableUsers.find(
      (u) => u._id === membreId || u.id === membreId
    );
    if (user && user.email) {
      return user.email;
    }
    return 'Non renseigné';
  }

  // Méthode pour obtenir la profession d'un membre
  getMembreProfession(membreId: string): string {
    const user = this.availableUsers.find(
      (u) => u._id === membreId || u.id === membreId
    );
    if (user) {
      if (user.profession) {
        return user.profession === 'etudiant' ? 'Étudiant' : 'Professeur';
      } else if (user.role) {
        return user.role === 'etudiant' ? 'Étudiant' : 'Professeur';
      }
    }
    return 'Non spécifié';
  }

  // Méthode pour obtenir le rôle d'un membre dans l'équipe
  getMembreRole(_membreId: string): string {
    // Cette méthode nécessiterait d'avoir accès aux rôles des membres dans l'équipe
    // Pour l'instant, nous retournons une valeur par défaut
    return 'Membre';
  }

  removeMembreFromEquipe(membreId: string): void {
    console.log('Méthode removeMembreFromEquipe appelée avec ID:', membreId);
    console.log('État actuel - this.equipeId:', this.equipeId);
    console.log('État actuel - this.equipe:', this.equipe);

    // Utiliser this.equipe._id si this.equipeId n'est pas défini
    const equipeId = this.equipeId || (this.equipe && this.equipe._id);

    if (!equipeId) {
      console.error("ID d'équipe manquant");
      this.error = "ID d'équipe manquant. Impossible de retirer le membre.";
      this.notificationService.showError(
        "ID d'équipe manquant. Impossible de retirer le membre."
      );
      return;
    }

    if (!membreId) {
      console.error('ID de membre manquant');
      this.error = 'ID de membre manquant. Impossible de retirer le membre.';
      this.notificationService.showError(
        'ID de membre manquant. Impossible de retirer le membre.'
      );
      return;
    }

    // Obtenir le nom du membre pour l'afficher dans le message de confirmation
    const membreName = this.getMembreName(membreId);

    console.log(
      `Tentative de retrait de l'utilisateur ${membreId} (${membreName}) de l'équipe ${equipeId}`
    );

    try {
      if (
        confirm(`Êtes-vous sûr de vouloir retirer ${membreName} de l'équipe?`)
      ) {
        console.log('Confirmation acceptée, suppression en cours...');

        this.loading = true;
        this.error = null;

        // Ajouter un délai pour s'assurer que l'utilisateur voit le chargement
        setTimeout(() => {
          this.equipeService
            .removeMembreFromEquipe(equipeId, membreId)
            .subscribe({
              next: (response) => {
                console.log(
                  `Utilisateur "${membreName}" retiré avec succès de l'équipe:`,
                  response
                );
                this.loading = false;
                this.notificationService.showSuccess(
                  `${membreName} a été retiré avec succès de l'équipe`
                );

                // Recharger l'équipe pour mettre à jour la liste des membres
                this.loadEquipe(equipeId);
              },
              error: (error) => {
                console.error(
                  `Erreur lors du retrait de l'utilisateur "${membreName}":`,
                  error
                );
                console.error("Détails de l'erreur:", {
                  status: error.status,
                  message: error.message,
                  error: error,
                });

                this.loading = false;
                this.error = `Impossible de retirer l'utilisateur "${membreName}" de l'équipe: ${
                  error.message || 'Erreur inconnue'
                }`;
                this.notificationService.showError(
                  `Erreur lors du retrait du membre: ${this.error}`
                );
              },
            });
        }, 500);
      } else {
        console.log("Suppression annulée par l'utilisateur");
      }
    } catch (error: any) {
      console.error('Exception lors du retrait du membre:', error);
      this.error = `Exception: ${error?.message || 'Erreur inconnue'}`;
      this.notificationService.showError(`Exception: ${this.error}`);
    }
  }

  // Méthode pour supprimer l'équipe
  deleteEquipe(): void {
    console.log('Méthode deleteEquipe appelée dans equipe-form.component.ts');
    console.log('État actuel - this.equipeId:', this.equipeId);
    console.log('État actuel - this.equipe:', this.equipe);

    // Utiliser this.equipe._id si this.equipeId n'est pas défini
    const equipeId = this.equipeId || (this.equipe && this.equipe._id);

    if (!equipeId) {
      console.error("ID d'équipe manquant");
      this.error = "ID d'équipe manquant. Impossible de supprimer l'équipe.";
      this.notificationService.showError(
        "ID d'équipe manquant. Impossible de supprimer l'équipe."
      );
      return;
    }

    console.log("ID de l'équipe à supprimer (final):", equipeId);

    try {
      if (
        confirm(
          `Êtes-vous sûr de vouloir supprimer l'équipe "${this.equipe.name}"? Cette action est irréversible.`
        )
      ) {
        console.log('Confirmation acceptée, suppression en cours...');

        this.loading = true;
        this.error = null;

        // Ajouter un délai pour s'assurer que l'utilisateur voit le chargement
        setTimeout(() => {
          this.equipeService.deleteEquipe(equipeId).subscribe({
            next: (response) => {
              console.log('Équipe supprimée avec succès, réponse:', response);
              this.loading = false;
              this.notificationService.showSuccess(
                `L'équipe "${this.equipe.name}" a été supprimée avec succès.`
              );

              // Ajouter un délai avant la redirection
              setTimeout(() => {
                this.router.navigate(['/admin/equipes']);
              }, 500);
            },
            error: (error) => {
              console.error(
                "Erreur lors de la suppression de l'équipe:",
                error
              );
              console.error("Détails de l'erreur:", {
                status: error.status,
                message: error.message,
                error: error,
              });

              this.loading = false;
              this.error = `Impossible de supprimer l'équipe: ${
                error.message || 'Erreur inconnue'
              }`;
              this.notificationService.showError(
                `Erreur lors de la suppression: ${this.error}`
              );
            },
          });
        }, 500);
      } else {
        console.log("Suppression annulée par l'utilisateur");
      }
    } catch (error: any) {
      console.error('Exception lors de la suppression:', error);
      this.error = `Exception: ${error?.message || 'Erreur inconnue'}`;
      this.notificationService.showError(`Exception: ${this.error}`);
    }
  }
}
