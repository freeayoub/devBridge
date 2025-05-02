import { User } from "./user.model";
export interface Notification {
  id: string;
  type: 'NEW_MESSAGE' | 'FRIEND_REQUEST' | 'GROUP_INVITE' | 'MESSAGE_REACTION';
  content: string;
  timestamp: string | Date;
  isRead: boolean;
  sender: User;
  message?: {
    id: string;
    content: string;
  };
}
