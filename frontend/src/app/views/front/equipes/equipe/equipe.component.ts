import { Component, OnInit } from '@angular/core';
import { EquipeService } from 'src/app/services/equipe.service';
import { MembreService } from 'src/app/services/membre.service';
import { Equipe } from 'src/app/models/equipe.model';
import { Membre } from 'src/app/models/membre.model';
import { forkJoin } from 'rxjs';

// Add Bootstrap type declaration
declare global {
  interface Window {
    bootstrap: any;
  }
}

@Component({
  selector: 'app-equipe',
  templateUrl: './equipe.component.html',
  styleUrls: ['./equipe.component.css'],
})
export class EquipeComponent implements OnInit {
  equipes: Equipe[] = [];
  newEquipe: Equipe = { name: '', description: '' };
  selectedEquipe: Equipe | null = null;
  isEditing = false;
  membres: Membre[] = [];
  loading = false;
  error = '';

  constructor(
    private equipeService: EquipeService,
    private membreService: MembreService
  ) {}

  ngOnInit(): void {
    this.loadEquipes();
    this.loadMembres();
  }

  loadEquipes() {
    this.loading = true;
    this.equipeService.getEquipes().subscribe({
      next: (data) => {
        console.log('Loaded equipes:', data);
        this.equipes = data;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading equipes:', error);
        this.error = 'Erreur lors du chargement des équipes: ' + error.message;
        this.loading = false;
      }
    });
  }

  loadMembres() {
    this.loading = true;
    this.membreService.getMembres().subscribe({
      next: (data) => {
        console.log('Loaded membres:', data);
        this.membres = data;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading membres:', error);
        this.error = 'Erreur lors du chargement des membres: ' + error.message;
        this.loading = false;
      }
    });
  }

  addEquipe() {
    console.log('Adding equipe:', this.newEquipe);

    if (!this.newEquipe.name) {
      console.error('Team name is required');
      this.error = 'Le nom de l\'équipe est requis';
      return;
    }

    this.loading = true;
    this.error = '';

    this.equipeService.addEquipe(this.newEquipe).subscribe({
      next: (response) => {
        console.log('Equipe added successfully:', response);
        this.loadEquipes();
        this.newEquipe = { name: '', description: '' }; // Clear input
        this.loading = false;

        // Afficher un message de succès temporaire
        const successMessage = 'Équipe créée avec succès!';
        this.error = ''; // Effacer les erreurs précédentes
        alert(successMessage);
      },
      error: (error) => {
        console.error('Error adding equipe:', error);
        this.error = 'Erreur lors de la création de l\'équipe: ' + (error.error?.message || error.message || 'Unknown error');
        this.loading = false;
      }
    });
  }

  editEquipe(equipe: Equipe) {
    this.isEditing = true;
    // Créer une copie profonde pour éviter de modifier l'objet original
    this.newEquipe = {
      _id: equipe._id,
      name: equipe.name || '',
      description: equipe.description || '',
      admin: equipe.admin,
      members: equipe.members ? [...equipe.members] : []
    };
  }

  cancelEdit() {
    this.isEditing = false;
    this.newEquipe = { name: '', description: '' };
    this.error = ''; // Effacer les erreurs
  }

  updateSelectedEquipe() {
    if (!this.newEquipe.name) {
      console.error('Team name is required');
      this.error = 'Le nom de l\'équipe est requis';
      return;
    }

    if (this.newEquipe._id) {
      this.loading = true;
      this.error = '';

      this.equipeService.updateEquipe(this.newEquipe._id, this.newEquipe).subscribe({
        next: (updatedEquipe) => {
          console.log('Team updated successfully:', updatedEquipe);
          this.loadEquipes();
          this.isEditing = false;
          this.newEquipe = { name: '', description: '' };
          this.loading = false;

          // Afficher un message de succès temporaire
          const successMessage = 'Équipe mise à jour avec succès!';
          alert(successMessage);
        },
        error: (error) => {
          console.error('Error updating team:', error);
          this.error = 'Erreur lors de la mise à jour de l\'équipe: ' + (error.error?.message || error.message || 'Unknown error');
          this.loading = false;
        }
      });
    } else {
      this.error = 'ID de l\'équipe manquant pour la mise à jour';
    }
  }

  deleteEquipe(id: string) {
    if (!id) {
      console.error('ID is undefined');
      this.error = 'ID de l\'équipe non défini';
      return;
    }

    if (confirm('Êtes-vous sûr de vouloir supprimer cette équipe? Cette action est irréversible.')) {
      this.loading = true;
      this.error = '';

      this.equipeService.deleteEquipe(id).subscribe({
        next: (response) => {
          console.log('Team deleted successfully:', response);

          // Si l'équipe en cours d'édition est celle qui vient d'être supprimée, réinitialiser le formulaire
          if (this.isEditing && this.newEquipe._id === id) {
            this.isEditing = false;
            this.newEquipe = { name: '', description: '' };
          }

          this.loadEquipes();
          this.loading = false;

          // Afficher un message de succès
          alert('Équipe supprimée avec succès');
        },
        error: (error) => {
          console.error('Error deleting team:', error);
          this.error = 'Erreur lors de la suppression de l\'équipe: ' + (error.error?.message || error.message || 'Unknown error');
          this.loading = false;
        }
      });
    }
  }

  showMembreModal(equipe: Equipe) {
    this.selectedEquipe = equipe;
    // Ouvrir le modal avec Bootstrap 5
    const modalRef = document.getElementById('membreModal');
    if (modalRef) {
      try {
        // Ensure Bootstrap is properly loaded
        if (typeof window !== 'undefined' && window.bootstrap) {
          const modal = new window.bootstrap.Modal(modalRef);
          modal.show();
        } else {
          console.error('Bootstrap is not loaded properly');
          alert('Erreur: Bootstrap n\'est pas chargé correctement');
        }
      } catch (error) {
        console.error('Error showing modal:', error);
      }
    } else {
      console.error('Modal element not found');
    }
  }

  addMembreToEquipe(teamId: string | undefined, membreId: string) {
    if (!teamId) {
      console.error('Team ID is undefined');
      alert('ID de l\'équipe non défini');
      return;
    }

    if (!membreId || membreId.trim() === '') {
      console.error('Member ID is empty');
      alert('L\'ID du membre est requis');
      return;
    }

    this.loading = true;

    // Create a proper Membre object that matches what the API expects
    const membre: Membre = { id: membreId };

    this.equipeService.addMembreToEquipe(teamId, membre).subscribe({
      next: (response) => {
        console.log('Member added successfully:', response);
        this.loadEquipes();
        this.loading = false;

        // Afficher un message de succès
        alert('Membre ajouté avec succès à l\'équipe');
      },
      error: (error) => {
        console.error('Error adding member:', error);
        this.error = 'Erreur lors de l\'ajout du membre: ' + (error.error?.message || error.message || 'Unknown error');
        alert(this.error);
        this.loading = false;
      }
    });
  }

  removeMembreFromEquipe(teamId: string | undefined, membreId: string) {
    if (!teamId) {
      console.error('Team ID is undefined');
      alert('ID de l\'équipe non défini');
      return;
    }

    if (!membreId) {
      console.error('Member ID is undefined');
      alert('ID du membre non défini');
      return;
    }

    if (confirm('Êtes-vous sûr de vouloir retirer ce membre de l\'équipe?')) {
      this.loading = true;

      this.equipeService.removeMembreFromEquipe(teamId, membreId).subscribe({
        next: (response) => {
          console.log('Member removed successfully:', response);
          this.loadEquipes();
          this.loading = false;

          // Si l'équipe sélectionnée est celle dont on vient de retirer un membre, mettre à jour l'équipe sélectionnée
          if (this.selectedEquipe && this.selectedEquipe._id === teamId) {
            const updatedEquipe = this.equipes.find(e => e._id === teamId);
            if (updatedEquipe) {
              this.selectedEquipe = updatedEquipe;
            }
          }
        },
        error: (error) => {
          console.error('Error removing member:', error);
          this.error = 'Erreur lors de la suppression du membre: ' + (error.error?.message || error.message || 'Unknown error');
          alert(this.error);
          this.loading = false;
        }
      });
    }
  }
}
















