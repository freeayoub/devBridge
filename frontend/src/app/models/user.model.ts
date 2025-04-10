export interface User {
  _id: string;       
  username: string;
  email: string;
  role: string;
  isActive: boolean; 
  password?: string;  
  isOnline?: boolean;
  createdAt?: string | Date;
  __v?: number;
}