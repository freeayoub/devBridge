export interface Planning {
    _id: string;
    id?: string;
    titre: string;
    description?: string;
    dateDebut: string | Date; 
    dateFin: string | Date;
    lieu?: string;
    createur: {
      _id: string;
      username: string;
      email: string;
      image?: string;
    };
    participants: {
      _id: string;
      username: string;
      email: string;
      image?: string;
    }[];
    reunions?: any[]; 
  }


