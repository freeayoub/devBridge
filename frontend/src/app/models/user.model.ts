export interface User {
    _id: string;       
    username: string;
    email: string;
    role: string;
    password?: string;  
    isOnline?: boolean;
    createdAt?: string | Date;
    __v?: number;     
  }