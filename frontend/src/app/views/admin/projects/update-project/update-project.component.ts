import { Component,OnInit  } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ProjetService } from '@app/services/projets.service';

@Component({
  selector: 'app-update-project',
  templateUrl: './update-project.component.html',
  styleUrls: ['./update-project.component.css']
})
export class UpdateProjectComponent implements OnInit {
  
  updateForm!: FormGroup;
  projectId!: string;

  constructor(
    private route: ActivatedRoute,
    private fb: FormBuilder,
    private projetService: ProjetService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.projectId = this.route.snapshot.paramMap.get('id') || '';
    this.updateForm = this.fb.group({
      titre: ['', Validators.required],
      description: [''],
      groupe: [''],
      dateLimite: ['', Validators.required]
    });

    this.projetService.getProjetById(this.projectId).subscribe(projet => {
      this.updateForm.patchValue({
        titre: projet.titre,
        description: projet.description,
        groupe: projet.groupe,
        dateLimite: projet.dateLimite
      });
    });
  }

  onSubmit(): void {
    if (this.updateForm.valid) {
      this.projetService.updateProjet(this.projectId, this.updateForm.value)
        .subscribe(() => {
          alert('Projet mis à jour avec succès');
          this.router.navigate(['/projects']); // adapte selon ta route
        });
    }
  }
}