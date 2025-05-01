import { Component, OnInit } from '@angular/core';
import { ReunionService }  from 'src/app/services/reunion.service';
import { Reunion } from 'src/app/models/reunion.model';
import { AuthuserService } from 'src/app/services/authuser.service';

@Component({
  selector: 'app-reunion-list',
  templateUrl: './reunion-list.component.html',
  styleUrls: ['./reunion-list.component.css']
})
export class ReunionListComponent implements OnInit {
  reunions: Reunion[] = [];
  loading = true;
  error: any;

  constructor(
    private reunionService: ReunionService,
    private authService: AuthuserService
  ) {}

  ngOnInit(): void {
    this.loadReunions();
  }

  loadReunions(): void {
    const userId = this.authService.getCurrentUserId();
    if (!userId) return;

    // this.reunionService.getProchainesReunions(userId).subscribe({
    this.reunionService. getAllReunions().subscribe({
      next: (reunions) => {
        this.reunions = reunions;
        console.log(this.reunions)
        this.loading = false;
      },
      error: (error:any) => {
        this.error = error;
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
}