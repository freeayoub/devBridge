export interface Evaluation {
  _id: string;
  rendu: string;
  projet: string;
  scores: {
    structure: number;
    pratiques: number;
    fonctionnalite: number;
    originalite: number;
  };
  commentaires: string;
  dateEvaluation: Date;
  utiliserIA?: boolean;
  
  // Propriétés supplémentaires pour les détails
  projetDetails?: any;
  renduDetails?: any;
  etudiant?: any;
}








