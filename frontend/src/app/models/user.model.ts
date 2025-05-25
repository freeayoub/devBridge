export interface User {
  // Champs principaux (premier système)
  _id: string;
  id?: string;
  username: string;
  email: string;
  fullName?: string;
  profileImage?: string;
  image?: string | null;
  role: string;
  bio?: string;
  isActive: boolean;
  isOnline?: boolean;
  lastActive?: Date;
  createdAt?: Date;
  updatedAt?: Date;
  followingCount?: number;
  followersCount?: number;
  postCount?: number;
  group?: any;
  verified?: boolean;
  __v?: number;

  // Nouveaux champs (second système)
  firstName?: string; // Prénom
  lastName?: string; // Nom
  profession?: string; // Étudiant ou Professeur
  dateOfBirth?: Date | string; // Date de naissance

  // Champs supplémentaires pour la compatibilité
  name?: string;
  password?: string;
  department?: string;
  position?: string;
  phoneNumber?: string;
  address?: string;
  profilePicture?: string;
  skills?: string[];
  joinDate?: Date;
}
