export interface Reunion {
    id: string;
    titre: string;
    description: string;
    dateDebut: Date;
    dateFin: Date;
    lieu: string;
    lienVisio?: string;
    createur: string;
    participants: string[];
    planningId: string;
    statut: 'planifiee' | 'en_cours' | 'terminee' | 'annulee';
    createdAt: Date;
    updatedAt: Date;
  }

  // Interface pour la création d'une réunion
  export interface CreateReunionRequest {
    titre: string;
    description?: string;
    date: string;
    heureDebut: string;
    heureFin: string;
    planning: string;
    participants?: string[];
    lieu?: string;
    lienVisio?: string;
  }