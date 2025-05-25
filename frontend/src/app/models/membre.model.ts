import { User } from './user.model';

/**
 * Interface Membre - représente un utilisateur qui est membre d'une équipe
 * Un membre est essentiellement un utilisateur avec des propriétés spécifiques à son appartenance à une équipe
 */
export interface Membre {
  _id?: string;
  id?: string;
  name?: string;
  role?: string;
  userType?: string;

  // Référence à l'utilisateur associé (si disponible)
  user?: User;
}