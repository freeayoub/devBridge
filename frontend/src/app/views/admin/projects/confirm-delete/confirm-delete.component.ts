import { Component, EventEmitter, Inject, OnInit, Output } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ActivatedRoute, Router } from '@angular/router';
import { ProjetService } from '@app/services/projets.service';

@Component({
  selector: 'app-confirm-delete',
  templateUrl: './confirm-delete.component.html',
  styleUrls: ['./confirm-delete.component.css']
})
export class ConfirmDeleteComponent implements OnInit {

  constructor(
    private projetService: ProjetService,
    private dialogRef: MatDialogRef<ConfirmDeleteComponent>,  
    @Inject(MAT_DIALOG_DATA) public data: { id: string }
  ) {}

  ngOnInit(): void {
    // Optionnel : log pour debug
    console.log('ID à supprimer :', this.data.id);
  }

  onCancel(): void {
    this.dialogRef.close();  // Rien ne sera retourné
  }

  onConfirm(): void {
    this.projetService.deleteProjet(this.data.id).subscribe({
      next: () => {
        alert('Projet supprimé avec succès');
        this.dialogRef.close('deleted'); // On informe le parent que la suppression est faite
      },
      error: (err) => {
        console.error('Erreur lors de la suppression', err);
        alert("Une erreur est survenue.");
      }
    });
  }
}