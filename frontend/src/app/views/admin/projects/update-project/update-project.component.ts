import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ProjetService } from '@app/services/projets.service';

@Component({
  selector: 'app-update-project',
  templateUrl: './update-project.component.html',
  styleUrls: ['./update-project.component.css'],
})
export class UpdateProjectComponent implements OnInit {
  updateForm!: FormGroup;
  projectId!: string;
  projetId!: string; // Pour le template

  constructor(
    private route: ActivatedRoute,
    private fb: FormBuilder,
    private projetService: ProjetService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.projectId = this.route.snapshot.paramMap.get('id') || '';
    this.projetId = this.projectId; // Pour le template

    this.updateForm = this.fb.group({
      titre: ['', Validators.required],
      description: ['', Validators.required],
      groupe: ['', Validators.required],
      dateLimite: ['', Validators.required],
    });

    this.projetService.getProjetById(this.projectId).subscribe({
      next: (projet) => {
        // Formater la date pour l'input date
        let formattedDate = '';
        if (projet.dateLimite) {
          const date = new Date(projet.dateLimite);
          formattedDate = date.toISOString().split('T')[0];
        }

        this.updateForm.patchValue({
          titre: projet.titre,
          description: projet.description,
          groupe: projet.groupe,
          dateLimite: formattedDate,
        });
      },
      error: (err) => {
        console.error('Erreur lors du chargement du projet:', err);
        alert('Erreur lors du chargement du projet');
      }
    });
  }

  onSubmit(): void {
    if (this.updateForm.valid) {
      this.projetService
        .updateProjet(this.projectId, this.updateForm.value)
        .subscribe({
          next: () => {
            alert('Projet mis à jour avec succès');
            this.router.navigate(['/admin/projects/details', this.projectId]);
          },
          error: (err) => {
            console.error('Erreur lors de la mise à jour:', err);
            alert('Erreur lors de la mise à jour du projet');
          }
        });
    }
  }
}
