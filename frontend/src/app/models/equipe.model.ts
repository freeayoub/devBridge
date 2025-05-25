export interface Equipe {
  _id?: string;
  name: string;
  description?: string;
  admin?: string; // Champ obligatoire mais peut être undefined dans certains contextes
  members?: string[];
  createdAt?: Date;
  updatedAt?: Date;
}
