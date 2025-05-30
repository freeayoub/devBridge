import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ReunionService } from '@app/services/reunion.service';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Component({
  selector: 'app-reunion-detail',
  templateUrl: './reunion-detail.component.html',
  styleUrls: ['./reunion-detail.component.css']
})
export class ReunionDetailComponent implements OnInit {
  reunion: any = null;
  loading = true;
  error: string | null = null;

  constructor(
    private route: ActivatedRoute,
    public router: Router,
    private reunionService: ReunionService,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit(): void {
    this.loadReunionDetails();
  }

  loadReunionDetails(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.error = 'ID de réunion non fourni';
      this.loading = false;
      return;
    }

    this.reunionService.getReunionById(id).subscribe({
      next: (response: any) => {
        this.reunion = response.reunion;
        this.loading = false;
      },
      error: (err: any) => {
        this.error = err.error?.message || 'Erreur lors du chargement';
        this.loading = false;
        console.error('Erreur:', err);
      }
    });
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

  editReunion(): void {
    if (this.reunion) {
      this.router.navigate(['/reunions/edit', this.reunion._id]);
    }
  }
}