import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ReunionService } from '../../../../services/reunion.service';

interface Participant {
  _id: string;
  username: string;
  image?: string;
}

interface Planning {
  _id: string;
  titre: string;
}

interface Reunion {
  _id: string;
  titre: string;
  description: string;
  dateDebut: Date;
  dateFin: Date;
  lieu?: string;
  lienVisio?: string;
  planningId?: Planning;
  participants?: Participant[];
}

@Component({
  selector: 'app-reunion-detail',
  templateUrl: './reunion-detail.component.html',
  styleUrls: ['./reunion-detail.component.css'],
})
export class ReunionDetailComponent implements OnInit {
  reunion: Reunion | null = null;
  loading = true;
  error: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private reunionService: ReunionService
  ) {}

  ngOnInit(): void {
    this.loadReunion();
  }

  loadReunion(): void {
    this.loading = true;
    this.error = null;

    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.error = 'ID de réunion manquant';
      this.loading = false;
      return;
    }

    // Simulation de chargement (à remplacer par un appel au service)
    setTimeout(() => {
      // Données fictives pour la démonstration
      this.reunion = {
        _id: id,
        titre: 'Réunion de projet',
        description:
          "Discussion sur l'avancement du projet et les prochaines étapes",
        dateDebut: new Date('2023-06-15T10:00:00'),
        dateFin: new Date('2023-06-15T11:30:00'),
        lieu: 'Salle de conférence A',
        lienVisio: 'https://meet.google.com/abc-defg-hij',
        planningId: {
          _id: 'planning123',
          titre: 'Planning du projet X',
        },
        participants: [
          {
            _id: 'user1',
            username: 'Jean Dupont',
            image: 'assets/images/default-avatar.png',
          },
          {
            _id: 'user2',
            username: 'Marie Martin',
            image: 'assets/images/default-avatar.png',
          },
        ],
      };

      this.loading = false;
    }, 1000);
  }
}
