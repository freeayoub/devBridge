import { Component, OnInit } from '@angular/core';
import { ReunionService }  from 'src/app/services/reunion.service';
import { Reunion } from 'src/app/models/reunion.model';
import { AuthuserService } from 'src/app/services/authuser.service';
import {Router} from "@angular/router";
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Component({
  selector: 'app-reunion-list',
  templateUrl: './reunion-list.component.html',
  styleUrls: ['./reunion-list.component.css']
})
export class ReunionListComponent implements OnInit {
  reunions: any[] = [];
  loading = true;
  error: any;

  constructor(
    private reunionService: ReunionService,
    private router:Router,
    private authService: AuthuserService,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit(): void {
    this.loadReunions();
  }

  loadReunions(): void {
    const userId = this.authService.getCurrentUserId();
    if (!userId) return;

    this.reunionService.getProchainesReunions(userId).subscribe({
      next: (reunions:any) => {
        console.log(reunions)
        this.reunions = reunions.reunions;
        this.loading = false;
      },
      error: (error:any) => {
        // Afficher plus de détails sur l'erreur pour le débogage
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
}