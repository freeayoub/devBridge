import { Component, OnInit } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { Observable } from 'rxjs';
import { filter } from 'rxjs/operators';
import { EquipeService } from 'src/app/services/equipe.service';
import { Location } from '@angular/common';

@Component({
  selector: 'app-equipe-layout',
  templateUrl: './equipe-layout.component.html',
  styleUrls: ['./equipe-layout.component.css'],
})
export class EquipeLayoutComponent implements OnInit {
  sidebarVisible$: Observable<boolean> = new Observable<boolean>();

  // Page properties
  pageTitle: string = 'Gestion des Équipes';
  pageSubtitle: string = 'Organisez et gérez vos équipes de projet';

  // Statistics
  totalEquipes: number = 0;
  totalMembres: number = 0;
  totalProjets: number = 0;

  constructor(
    private router: Router,
    private location: Location,
    private equipeService: EquipeService
  ) {}

  ngOnInit(): void {
    this.loadStatistics();
    this.updatePageTitle();

    // Listen to route changes to update page title
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => {
        this.updatePageTitle();
      });
  }

  loadStatistics(): void {
    // Load teams statistics
    this.equipeService.getEquipes().subscribe({
      next: (equipes) => {
        this.totalEquipes = equipes.length;

        // Calculate total members across all teams
        this.totalMembres = equipes.reduce((total, equipe) => {
          return total + (equipe.members ? equipe.members.length : 0);
        }, 0);

        // For now, set projects to 0 (can be updated when project service is available)
        this.totalProjets = 0;
      },
      error: (error) => {
        console.error('Erreur lors du chargement des statistiques:', error);
      },
    });
  }

  updatePageTitle(): void {
    const url = this.router.url;

    if (url.includes('/equipes/liste')) {
      this.pageTitle = 'Liste des Équipes';
      this.pageSubtitle = 'Consultez et gérez toutes vos équipes';
    } else if (url.includes('/equipes/nouveau')) {
      this.pageTitle = 'Créer une Équipe';
      this.pageSubtitle = 'Créez une nouvelle équipe pour vos projets';
    } else if (url.includes('/equipes/mes-equipes')) {
      this.pageTitle = 'Mes Équipes';
      this.pageSubtitle = 'Équipes dont vous êtes membre ou administrateur';
    } else if (url.includes('/equipes/detail')) {
      this.pageTitle = "Détails de l'Équipe";
      this.pageSubtitle = 'Informations et gestion des membres';
    } else if (url.includes('/equipes/edit')) {
      this.pageTitle = "Modifier l'Équipe";
      this.pageSubtitle = 'Modifiez les informations de votre équipe';
    } else {
      this.pageTitle = 'Gestion des Équipes';
      this.pageSubtitle = 'Organisez et gérez vos équipes de projet';
    }
  }

  goBack(): void {
    this.location.back();
  }
}
