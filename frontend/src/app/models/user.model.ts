export interface User {
  _id: string;
  id?: string;
  username: string;
  email: string;
  image?: string | null;  
  role: string;
  isActive: boolean;
  isOnline?: boolean;   
  lastActive?: Date;   
  createdAt?: Date;     
  updatedAt?: Date;  
}
