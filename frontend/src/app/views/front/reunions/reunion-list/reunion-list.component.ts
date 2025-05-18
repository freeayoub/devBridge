import { Component, OnInit } from '@angular/core';
import { ReunionService } from 'src/app/services/reunion.service';
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
  error: Error | null = null;

  constructor(
    private reunionService: ReunionService,
    private authService: AuthuserService
  ) {}

  ngOnInit(): void {
    this.loadReunions();
  }

  loadReunions(): void {
    try {
      const userId = this.authService.getCurrentUserId();
      if (!userId) {
        throw new Error('User not authenticated');
      }

      this.reunionService.getProchainesReunions(userId).subscribe({
        next: (reunions) => {
          this.reunions = reunions;
          this.loading = false;
        },
        error: (error: Error) => {
          this.error = error;
          this.loading = false;
          console.error('Error loading meetings:', error);
        }
      });
    } catch (error) {
      this.error = error instanceof Error ? error : new Error('Unknown error');
      this.loading = false;
    }
  }

  getStatutClass(statut: 'planifiee' | 'en_cours' | 'terminee' | 'annulee'): string {
    const classes = {
      planifiee: 'bg-blue-100 text-blue-800',
      en_cours: 'bg-yellow-100 text-yellow-800',
      terminee: 'bg-green-100 text-green-800',
      annulee: 'bg-red-100 text-red-800'
    };
    return classes[statut] || 'bg-gray-100 text-gray-800';
  }
}
