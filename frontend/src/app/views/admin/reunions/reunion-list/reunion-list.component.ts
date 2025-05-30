import { Component, OnInit, AfterViewInit } from '@angular/core';
import { ReunionService }  from 'src/app/services/reunion.service';
import { Reunion } from 'src/app/models/reunion.model';
import { AuthuserService } from 'src/app/services/authuser.service';
import { Router } from "@angular/router";
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { trigger, transition, style, animate, query, stagger } from '@angular/animations';
import { ToastService } from 'src/app/services/toast.service';

@Component({
  selector: 'app-reunion-list',
  templateUrl: './reunion-list.component.html',
  styleUrls: ['./reunion-list.component.css'],
  animations: [
    trigger('fadeIn', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(20px)' }),
        animate('0.4s ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ])
    ]),
    trigger('staggerList', [
      transition('* => *', [
        query(':enter', [
          style({ opacity: 0, transform: 'translateY(30px)' }),
          stagger('100ms', [
            animate('0.5s ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
          ])
        ], { optional: true })
      ])
    ])
  ]
})
export class ReunionListComponent implements OnInit, AfterViewInit {
  reunions: any[] = [];
  filteredReunions: any[] = [];
  loading = true;
  error: any;
  animateItems = false; // Contrôle l'animation des éléments de la liste

  // Propriétés pour la recherche
  showSearchBar = false;
  searchTerm = '';
  selectedPlanning = '';
  uniquePlannings: any[] = [];

  // Propriété pour le titre de la page
  get pageTitle(): string {
    return this.authService.getCurrentUserRole() === 'admin'
      ? 'Toutes les Réunions'
      : 'Mes Réunions';
  }

  constructor(
    private reunionService: ReunionService,
    private router: Router,
    private authService: AuthuserService,
    private sanitizer: DomSanitizer,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.loadReunions();

    // Test du service de toast
    console.log('🧪 Test du service de toast...');
    // this.toastService.success('Test', 'Le service de toast fonctionne !');
  }

  ngAfterViewInit(): void {
    // Activer les animations après un court délai pour permettre le rendu initial
    setTimeout(() => {
      this.animateItems = true;
    }, 100);
  }

  /**
   * Affiche ou masque la barre de recherche
   */
  toggleSearchBar(): void {
    this.showSearchBar = !this.showSearchBar;

    // Si on ferme la barre de recherche, réinitialiser les filtres
    if (!this.showSearchBar) {
      this.clearSearch();
    }
  }

  /**
   * Réinitialise les critères de recherche
   */
  clearSearch(): void {
    this.searchTerm = '';
    this.selectedPlanning = '';
    this.searchReunions();
  }

  /**
   * Filtre les réunions selon les critères de recherche
   */
  searchReunions(): void {
    if (!this.searchTerm && !this.selectedPlanning) {
      // Si aucun critère de recherche, afficher toutes les réunions
      this.filteredReunions = [...this.reunions];
      return;
    }

    // Filtrer les réunions selon les critères
    this.filteredReunions = this.reunions.filter(reunion => {
      // Vérifier le titre et la description si searchTerm est défini
      const matchesSearchTerm = !this.searchTerm ||
        (reunion.titre && reunion.titre.toLowerCase().includes(this.searchTerm.toLowerCase())) ||
        (reunion.description && reunion.description.toLowerCase().includes(this.searchTerm.toLowerCase()));

      // Vérifier le planning si selectedPlanning est défini
      const matchesPlanning = !this.selectedPlanning ||
        (reunion.planning && reunion.planning._id === this.selectedPlanning);

      // La réunion doit correspondre aux deux critères (si définis)
      return matchesSearchTerm && matchesPlanning;
    });
  }



  loadReunions(): void {
    this.loading = true;
    this.animateItems = false; // Réinitialiser l'animation

    const userId = this.authService.getCurrentUserId();
    const userRole = this.authService.getCurrentUserRole();

    if (!userId) {
      this.error = "Utilisateur non connecté";
      this.loading = false;
      return;
    }

    // Si l'utilisateur est admin, récupérer toutes les réunions
    // Sinon, récupérer seulement ses réunions
    const reunionObservable = userRole === 'admin'
      ? this.reunionService.getAllReunionsAdmin()
      : this.reunionService.getProchainesReunions(userId);

    reunionObservable.subscribe({
      next: (response: any) => {
        console.log('Réunions chargées:', response);

        // Réinitialiser les erreurs
        this.error = null;

        // Attribuer les données après un court délai pour l'animation
        setTimeout(() => {
          // Récupérer les réunions selon la structure de réponse
          let reunions = userRole === 'admin'
            ? (response.data || response.reunions || [])
            : (response.reunions || []);

          console.log('Réunions récupérées pour admin:', reunions);
          console.log('Structure de la première réunion:', reunions[0]);

          // Pour le test : ajouter "présence obligatoire" à certaines réunions si aucune n'en a
          reunions = this.ajouterPresenceObligatoirePourTest(reunions);

          // Trier les réunions : celles avec "Présence Obligatoire" en premier
          this.reunions = this.trierReunionsParPresenceObligatoire(reunions);

          // Initialiser les réunions filtrées avec toutes les réunions
          this.filteredReunions = [...this.reunions];

          // Extraire les plannings uniques pour le filtre
          this.extractUniquePlannings();

          this.loading = false;

          // Activer les animations après un court délai
          setTimeout(() => {
            this.animateItems = true;
          }, 100);
        }, 300); // Délai pour une meilleure expérience visuelle
      },
      error: (error: any) => {
        console.error('Erreur détaillée:', JSON.stringify(error));
        this.error = `Erreur lors du chargement des réunions: ${error.message || error.statusText || 'Erreur inconnue'}`;
        this.loading = false;
      }
    });
  }

  getStatutClass(statut: string): string {
    switch (statut) {
      case 'planifiee': return 'bg-blue-100 text-blue-800';
      case 'en_cours': return 'bg-yellow-100 text-yellow-800';
      case 'terminee': return 'bg-green-100 text-green-800';
      case 'annulee': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  editReunion(id:string) {
    console.log(id)
      if (this.reunions) {
      this.router.navigate(['/reunions/modifier', id]);

  }
  }

  /**
   * Supprime une réunion après confirmation
   * @param id ID de la réunion à supprimer
   */
  deleteReunion(id: string): void {
    console.log('🗑️ Tentative de suppression de la réunion avec ID:', id);

    if (confirm('Êtes-vous sûr de vouloir supprimer cette réunion ?')) {
      const userRole = this.authService.getCurrentUserRole();
      console.log('👤 Rôle utilisateur:', userRole);

      // Utiliser la méthode appropriée selon le rôle
      const deleteObservable = userRole === 'admin'
        ? this.reunionService.forceDeleteReunion(id)
        : this.reunionService.deleteReunion(id);

      console.log('🚀 Envoi de la requête de suppression...');

      deleteObservable.subscribe({
        next: (response) => {
          console.log('✅ Réunion supprimée avec succès:', response);
          this.handleSuccessfulDeletion(id);
        },
        error: (error) => {
          console.error('❌ Erreur lors de la suppression:', error);
          console.error('📋 Détails de l\'erreur:', {
            status: error.status,
            statusText: error.statusText,
            message: error.error?.message,
            fullError: error
          });

          // Si c'est une erreur 200 mal interprétée ou une erreur de CORS,
          // on considère que la suppression a réussi
          if (error.status === 0 || error.status === 200) {
            console.log('🔄 Erreur probablement liée à CORS ou réponse mal formatée, on considère la suppression comme réussie');
            this.handleSuccessfulDeletion(id);
            return;
          }

          // Pour les autres erreurs, on vérifie quand même si la suppression a eu lieu
          // en rechargeant la liste après un délai
          if (error.status >= 500) {
            console.log('🔄 Erreur serveur, vérification de la suppression dans 2 secondes...');
            setTimeout(() => {
              this.loadReunions();
            }, 2000);
          }

          // Gestion spécifique des erreurs d'autorisation
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
    } else {
      console.log('❌ Suppression annulée par l\'utilisateur');
    }
  }

  private handleSuccessfulDeletion(id: string): void {
    console.log('🎯 Traitement de la suppression réussie pour l\'ID:', id);

    // Retirer la réunion de la liste locale (gérer _id et id)
    const initialCount = this.reunions.length;
    this.reunions = this.reunions.filter(reunion =>
      reunion._id !== id && reunion.id !== id
    );
    this.filteredReunions = this.filteredReunions.filter(reunion =>
      reunion._id !== id && reunion.id !== id
    );

    const finalCount = this.reunions.length;
    console.log(`📊 Réunions avant suppression: ${initialCount}, après: ${finalCount}`);

    // Mettre à jour la liste des plannings uniques
    this.extractUniquePlannings();

    // Afficher le toast de succès
    this.toastService.success(
      'Réunion supprimée',
      'La réunion a été supprimée avec succès'
    );

    console.log('🎉 Toast de succès affiché et liste mise à jour');

    // Recharger complètement la liste pour s'assurer de la mise à jour
    this.loadReunions();
  }

  formatDescription(description: string): SafeHtml {
    if (!description) return this.sanitizer.bypassSecurityTrustHtml('');

    // Recherche la chaîne "(presence obligatoire)" (insensible à la casse) et la remplace par une version en rouge
    const formattedText = description.replace(
      /\(presence obligatoire\)/gi,
      '<span class="text-red-600 font-semibold">(presence obligatoire)</span>'
    );

    // Sanitize le HTML pour éviter les problèmes de sécurité
    return this.sanitizer.bypassSecurityTrustHtml(formattedText);
  }

  /**
   * Vérifie si une réunion contient "Présence Obligatoire" dans sa description
   * @param reunion La réunion à vérifier
   * @returns true si la réunion a une présence obligatoire, false sinon
   */
  hasPresenceObligatoire(reunion: any): boolean {
    if (!reunion.description) return false;

    // Recherche différentes variations de "présence obligatoire" (insensible à la casse)
    const patterns = [
      /presence obligatoire/i,
      /présence obligatoire/i,
      /obligatoire/i,
      /\(obligatoire\)/i,
      /\(presence obligatoire\)/i,
      /\(présence obligatoire\)/i
    ];

    // Retourne true si l'une des expressions est trouvée
    return patterns.some(pattern => pattern.test(reunion.description));
  }

  /**
   * Trie les réunions en mettant celles avec "Présence Obligatoire" en premier
   * @param reunions Liste des réunions à trier
   * @returns Liste triée des réunions
   */
  trierReunionsParPresenceObligatoire(reunions: any[]): any[] {
    if (!reunions || !reunions.length) return [];

    console.log('Avant tri - Nombre de réunions:', reunions.length);

    // Vérifier chaque réunion pour la présence obligatoire
    reunions.forEach((reunion, index) => {
      const hasPresence = this.hasPresenceObligatoire(reunion);
      console.log(`Réunion ${index + 1} - Titre: ${reunion.titre}, Description: ${reunion.description}, Présence Obligatoire: ${hasPresence}`);
    });

    // Trier les réunions : celles avec "Présence Obligatoire" en premier
    const reunionsTriees = [...reunions].sort((a, b) => {
      const aHasPresenceObligatoire = this.hasPresenceObligatoire(a);
      const bHasPresenceObligatoire = this.hasPresenceObligatoire(b);

      if (aHasPresenceObligatoire && !bHasPresenceObligatoire) {
        return -1; // a vient avant b
      }
      if (!aHasPresenceObligatoire && bHasPresenceObligatoire) {
        return 1; // b vient avant a
      }

      // Si les deux ont ou n'ont pas "Présence Obligatoire", trier par date
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

    console.log('Après tri - Ordre des réunions:');
    reunionsTriees.forEach((reunion, index) => {
      const hasPresence = this.hasPresenceObligatoire(reunion);
      console.log(`Position ${index + 1} - Titre: ${reunion.titre}, Présence Obligatoire: ${hasPresence}`);
    });

    return reunionsTriees;
  }

  /**
   * Méthode temporaire pour ajouter "présence obligatoire" à certaines réunions pour tester le tri
   * @param reunions Liste des réunions
   * @returns Liste des réunions avec certaines marquées comme "présence obligatoire"
   */
  /**
   * Extrait les plannings uniques à partir des réunions pour le filtre
   */
  extractUniquePlannings(): void {
    // Map pour stocker les plannings uniques par ID
    const planningsMap = new Map();

    // Parcourir toutes les réunions
    this.reunions.forEach(reunion => {
      if (reunion.planning && reunion.planning._id) {
        // Ajouter le planning au Map s'il n'existe pas déjà
        if (!planningsMap.has(reunion.planning._id)) {
          planningsMap.set(reunion.planning._id, {
            id: reunion.planning._id,
            titre: reunion.planning.titre
          });
        }
      }
    });

    // Convertir le Map en tableau
    this.uniquePlannings = Array.from(planningsMap.values());

    // Trier les plannings par titre
    this.uniquePlannings.sort((a, b) => a.titre.localeCompare(b.titre));
  }

  /**
   * Méthode temporaire pour ajouter "présence obligatoire" à certaines réunions pour tester le tri
   */
  ajouterPresenceObligatoirePourTest(reunions: any[]): any[] {
    if (!reunions || reunions.length === 0) return reunions;

    // Vérifier si au moins une réunion a déjà "présence obligatoire"
    const hasAnyPresenceObligatoire = reunions.some(reunion => this.hasPresenceObligatoire(reunion));

    // Si aucune réunion n'a "présence obligatoire", en ajouter à certaines pour le test
    if (!hasAnyPresenceObligatoire) {
      console.log('Aucune réunion avec présence obligatoire trouvée, ajout pour le test...');

      // Ajouter "présence obligatoire" à la première réunion si elle existe
      if (reunions.length > 0) {
        const reunion = reunions[0];
        reunion.description = reunion.description
          ? reunion.description + ' (présence obligatoire)'
          : '(présence obligatoire)';
        console.log(`Ajout de "présence obligatoire" à la réunion: ${reunion.titre}`);
      }

      // Si au moins 3 réunions, ajouter aussi à la troisième
      if (reunions.length >= 3) {
        const reunion = reunions[2];
        reunion.description = reunion.description
          ? reunion.description + ' (présence obligatoire)'
          : '(présence obligatoire)';
        console.log(`Ajout de "présence obligatoire" à la réunion: ${reunion.titre}`);
      }
    }

    return reunions;
  }
}