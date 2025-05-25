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
  templateUrl: './equipe-form.component.html',
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
    this.router.navigate(['/equipes/liste']);
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
                this.router.navigate(['/equipes/liste']);
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
