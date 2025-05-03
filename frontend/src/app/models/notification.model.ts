import { User } from "./user.model";
export interface Notification {
createdAt: string|number|Date;
  id: string;
  type: 'NEW_MESSAGE' | 'FRIEND_REQUEST' | 'GROUP_INVITE' | 'MESSAGE_REACTION';
  content: string;
  timestamp: string | Date;
  isRead: boolean;
  sender:{
    username:string;
    image?: string; 
  };
  message?: {
    content: string;
    attachments?: {
      url: string;
      type: 'IMAGE' | 'DOCUMENT' | 'AUDIO' | 'VIDEO' | 'OTHER';
    }[];
  };
}
