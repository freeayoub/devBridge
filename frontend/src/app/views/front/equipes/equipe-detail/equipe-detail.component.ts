import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { EquipeService } from 'src/app/services/equipe.service';
import { AuthService } from 'src/app/services/auth.service';
import { Equipe } from 'src/app/models/equipe.model';
import { Membre } from 'src/app/models/membre.model';
import { User } from 'src/app/models/user.model';
@Component({
  selector: 'app-equipe-detail',
  templateUrl: './equipe-detail.component.html',
  styleUrls: ['./equipe-detail.component.css'],
})
export class EquipeDetailComponent implements OnInit {
  equipe: Equipe | null = null;
  loading = false;
  error: string | null = null;
  equipeId: string | null = null;
  newMembre: any = { id: '', role: 'membre' };
  availableUsers: User[] = [];
  memberNames: { [key: string]: string } = {}; // Map pour stocker les noms des membres
  teamMembers: any[] = []; // Liste des membres de l'équipe avec leurs détails

  constructor(
    private equipeService: EquipeService,
    private userService: AuthService, // TODO: Will be used when implementing real user API calls
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.equipeId = this.route.snapshot.paramMap.get('id');

    // Charger tous les utilisateurs disponibles
    this.loadUsers();

    if (this.equipeId) {
      this.loadEquipe(this.equipeId);
    } else {
      this.error = "ID d'équipe non spécifié";
    }
  }

  // Méthode pour charger tous les utilisateurs
  loadUsers(): void {
    // TODO: Implémenter l'API pour récupérer les utilisateurs
    // Pour l'instant, utiliser des données mockées
    const mockUsers: User[] = [
      {
        _id: 'user1',
        username: 'john_doe',
        email: 'john@example.com',
        role: 'admin',
        isActive: true,
      },
      {
        _id: 'user2',
        username: 'jane_smith',
        email: 'jane@example.com',
        role: 'student',
        isActive: true,
      },
      {
        _id: 'user3',
        username: 'bob_wilson',
        email: 'bob@example.com',
        role: 'teacher',
        isActive: true,
      },
    ];

    // Simuler un délai d'API
    setTimeout(() => {
      // Stocker tous les utilisateurs pour la recherche de noms
      const allUsers = [...mockUsers];
      console.log('Tous les utilisateurs chargés (mock):', allUsers);

      // Filtrer les utilisateurs disponibles (non membres de l'équipe)
      if (this.teamMembers && this.teamMembers.length > 0) {
        const memberUserIds = this.teamMembers.map((m) => m.user);
        this.availableUsers = mockUsers.filter(
          (user) => !memberUserIds.includes(user._id || user.id || '')
        );
      } else {
        this.availableUsers = mockUsers;
      }

      console.log('Utilisateurs disponibles:', this.availableUsers);

      // Si l'équipe est déjà chargée, mettre à jour les noms des membres
      if (this.equipe && this.equipe.members) {
        this.updateMemberNames();
      }
    }, 500);
  }

  // Méthode pour mettre à jour les noms des membres
  updateMemberNames(): void {
    if (!this.equipe || !this.equipe.members) return;

    this.equipe.members.forEach((membreId) => {
      const user = this.availableUsers.find(
        (u) => u._id === membreId || u.id === membreId
      );
      if (user && user.name) {
        this.memberNames[membreId] = user.name;
      } else {
        // Si l'utilisateur n'est pas trouvé dans la liste, essayer de le récupérer individuellement
        // TODO: Implémenter getUser dans AuthuserService
        // Pour l'instant, utiliser l'ID comme nom par défaut
        this.memberNames[membreId] = membreId;
      }
    });
  }

  // Méthode pour obtenir le nom d'un membre
  getMembreName(membreId: string): string {
    return this.memberNames[membreId] || membreId;
  }

  // Méthode pour obtenir le nom d'un utilisateur à partir de son ID
  getUserName(userId: string | undefined): string {
    if (!userId) {
      return 'Non défini';
    }

    const user = this.availableUsers.find(
      (u) => u._id === userId || u.id === userId
    );
    if (user) {
      if (user.firstName && user.lastName) {
        return `${user.firstName} ${user.lastName}`;
      } else if (user.name) {
        return user.name;
      }
    }
    return userId;
  }

  // Méthode pour obtenir la profession d'un utilisateur à partir de son ID
  getUserProfession(userId: string | undefined): string {
    if (!userId) {
      return '';
    }

    const user = this.availableUsers.find(
      (u) => u._id === userId || u.id === userId
    );
    if (user) {
      return user.profession || user.role || '';
    }
    return '';
  }

  loadEquipe(id: string): void {
    this.loading = true;
    this.error = null;

    this.equipeService.getEquipe(id).subscribe({
      next: (data) => {
        console.log("Détails de l'équipe chargés:", data);
        this.equipe = data;

        // Charger les détails des membres de l'équipe
        this.loadTeamMembers(id);

        // Mettre à jour les noms des membres
        if (
          this.equipe &&
          this.equipe.members &&
          this.equipe.members.length > 0
        ) {
          this.updateMemberNames();
        }

        this.loading = false;
      },
      error: (error) => {
        console.error(
          "Erreur lors du chargement des détails de l'équipe:",
          error
        );
        this.error =
          "Impossible de charger les détails de l'équipe. Veuillez réessayer plus tard.";
        this.loading = false;
      },
    });
  }

  // Méthode pour charger les détails des membres de l'équipe
  loadTeamMembers(teamId: string): void {
    this.equipeService.getTeamMembers(teamId).subscribe({
      next: (members) => {
        console.log('Détails des membres chargés:', members);
        this.teamMembers = members;
      },
      error: (error) => {
        console.error(
          'Erreur lors du chargement des détails des membres:',
          error
        );
      },
    });
  }

  navigateToEditEquipe(): void {
    if (this.equipeId) {
      this.router.navigate(['/equipes/modifier', this.equipeId]);
    }
  }

  navigateToEquipeList(): void {
    this.router.navigate(['/equipes/liste']);
  }

  navigateToTasks(): void {
    if (this.equipeId) {
      this.router.navigate(['/equipes/tasks', this.equipeId]);
    }
  }

  // Méthode pour formater les dates
  formatDate(date: Date | string | undefined): string {
    if (!date) {
      return 'N/A';
    }

    try {
      let dateObj: Date;

      if (typeof date === 'string') {
        dateObj = new Date(date);
      } else {
        dateObj = date;
      }

      if (isNaN(dateObj.getTime())) {
        return 'Date invalide';
      }

      // Format: JJ/MM/AAAA
      return dateObj.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch (error) {
      console.error('Erreur lors du formatage de la date:', error);
      return 'Erreur de date';
    }
  }

  // Méthode pour ajouter un membre à l'équipe
  addMembre(userId: string, role: string): void {
    console.log(`Ajout de l'utilisateur ${userId} avec le rôle ${role}`);

    if (!this.equipeId || !userId) {
      console.error("ID d'équipe ou ID d'utilisateur manquant");
      this.error = "ID d'équipe ou ID d'utilisateur manquant";
      return;
    }

    // Vérifier si l'utilisateur est déjà membre de l'équipe
    const isAlreadyMember = this.teamMembers.some((m) => m.user === userId);
    if (isAlreadyMember) {
      this.error = "Cet utilisateur est déjà membre de l'équipe";
      alert("Cet utilisateur est déjà membre de l'équipe");
      return;
    }

    // Créer l'objet membre avec le rôle spécifié
    const membre: Membre = {
      id: userId,
      role: role || 'membre',
    };

    // Récupérer les informations de l'utilisateur pour afficher un message plus informatif
    const userName = this.getUserName(userId);
    const roleName = role === 'admin' ? 'administrateur' : 'membre';

    this.equipeService.addMembreToEquipe(this.equipeId, membre).subscribe({
      next: (response) => {
        console.log(
          `Utilisateur "${userName}" ajouté comme ${roleName} avec succès:`,
          response
        );

        // Afficher un message de succès
        alert(`Utilisateur "${userName}" ajouté comme ${roleName} avec succès`);

        // Recharger les membres de l'équipe
        this.loadTeamMembers(this.equipeId!);

        // Recharger l'équipe pour mettre à jour la liste des membres
        this.loadEquipe(this.equipeId!);

        // Mettre à jour la liste des utilisateurs disponibles
        this.updateAvailableUsers();
      },
      error: (error) => {
        console.error(
          "Erreur lors de l'ajout de l'utilisateur comme membre:",
          error
        );
        this.error = `Impossible d'ajouter l'utilisateur "${userName}" comme ${roleName}. Veuillez réessayer plus tard.`;
        alert(this.error);
      },
    });
  }

  // Méthode pour mettre à jour la liste des utilisateurs disponibles
  updateAvailableUsers(): void {
    // TODO: Implémenter l'API pour récupérer les utilisateurs
    // Pour l'instant, utiliser les données mockées de loadUsers()
    this.loadUsers();
  }

  // Ancienne méthode maintenue pour compatibilité
  addMembreToEquipe(): void {
    if (!this.equipeId || !this.newMembre.id) {
      console.error("ID d'équipe ou ID de membre manquant");
      return;
    }

    this.addMembre(this.newMembre.id, this.newMembre.role || 'membre');
  }

  removeMembreFromEquipe(membreId: string): void {
    console.log('Méthode removeMembreFromEquipe appelée avec ID:', membreId);

    if (!this.equipeId) {
      console.error("ID d'équipe manquant");
      this.error = "ID d'équipe manquant. Impossible de retirer le membre.";
      return;
    }

    // Dans notre implémentation actuelle, membre._id est l'ID de l'utilisateur
    const userId = membreId;

    // Récupérer le nom de l'utilisateur pour un message plus informatif
    const userName = this.getUserName(userId);

    console.log(
      `Tentative de retrait de l'utilisateur ${userId} (${userName}) de l'équipe ${this.equipeId}`
    );

    if (
      confirm(
        `Êtes-vous sûr de vouloir retirer l'utilisateur "${userName}" de l'équipe?`
      )
    ) {
      console.log('Confirmation acceptée, suppression en cours...');

      this.loading = true;
      this.error = null;

      this.equipeService
        .removeMembreFromEquipe(this.equipeId, userId)
        .subscribe({
          next: (response) => {
            console.log(
              `Utilisateur "${userName}" retiré avec succès de l'équipe:`,
              response
            );
            this.loading = false;

            // Afficher un message de succès
            alert(`Utilisateur "${userName}" retiré avec succès de l'équipe`);

            // Recharger les membres de l'équipe
            this.loadTeamMembers(this.equipeId!);

            // Recharger l'équipe pour mettre à jour la liste des membres
            this.loadEquipe(this.equipeId!);

            // Mettre à jour la liste des utilisateurs disponibles
            this.updateAvailableUsers();
          },
          error: (error) => {
            console.error(
              `Erreur lors du retrait de l'utilisateur "${userName}":`,
              error
            );
            this.loading = false;
            this.error = `Impossible de retirer l'utilisateur "${userName}" de l'équipe: ${
              error.message || 'Erreur inconnue'
            }`;
          },
        });
    } else {
      console.log("Suppression annulée par l'utilisateur");
    }
  }

  deleteEquipe(): void {
    console.log('Méthode deleteEquipe appelée');

    if (!this.equipeId) {
      console.error("ID d'équipe manquant");
      this.error = "ID d'équipe manquant. Impossible de supprimer l'équipe.";
      return;
    }

    console.log("ID de l'équipe à supprimer:", this.equipeId);

    if (
      confirm(
        `Êtes-vous sûr de vouloir supprimer l'équipe "${this.equipe?.name}"? Cette action est irréversible.`
      )
    ) {
      console.log('Confirmation acceptée, suppression en cours...');

      this.loading = true;
      this.error = null;

      this.equipeService.deleteEquipe(this.equipeId).subscribe({
        next: () => {
          console.log('Équipe supprimée avec succès');
          this.loading = false;
          alert('Équipe supprimée avec succès');
          this.router.navigate(['/equipes/liste']);
        },
        error: (error) => {
          console.error("Erreur lors de la suppression de l'équipe:", error);
          this.loading = false;
          this.error = `Impossible de supprimer l'équipe: ${
            error.message || 'Erreur inconnue'
          }`;
          alert(`Erreur lors de la suppression: ${this.error}`);
        },
      });
    } else {
      console.log("Suppression annulée par l'utilisateur");
    }
  }
}
