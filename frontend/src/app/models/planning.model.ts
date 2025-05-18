import { Reunion } from "./reunion.model";
import { User } from "./user.model";
export interface Planning {
    _id: string; 
    titre: string;
    description?: string; 
    dateDebut: Date | string; 
    dateFin: Date | string;
    createur: User | string; 
    participants: User[] | string[];
    reunions?: Reunion[] | string[]; 
    createdAt?: Date | string; 
    updatedAt?: Date | string; 
  }