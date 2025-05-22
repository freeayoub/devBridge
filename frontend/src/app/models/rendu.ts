export interface Rendu {
  _id: string;
  projet: string | any;
  etudiant: string | any;
  fichiers: string[];
  statut: 'soumis' | 'en évaluation' | 'évalué';
  description?: string;
  dateSoumission: Date;
  createdAt: Date;
  updatedAt: Date;
  evaluation?: any;
}