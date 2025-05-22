export interface Projet {
  _id?: string;
  titre: string;
  description?: string;
  dateLimite: Date | string;
  fichiers?: string[];
  professeur?: string;
  groupe?: string;
  statut?: string;
  derniereModification?: Date;
  createdAt?: Date;
}
