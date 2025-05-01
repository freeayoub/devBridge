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
  