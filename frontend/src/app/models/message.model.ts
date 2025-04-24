import { User } from "./user.model";

export interface Participant {
  id: string;
  username: string;
  email: string;
  image: string;
  isOnline: boolean;
}

export interface Message {
  id: string;
  content: string;
  timestamp: string | Date;
  isRead: boolean;
  senderId: string;
  receiverId: string;
}

export interface GetConversationsResponse {
  getConversations: Conversation[];
}
export interface GetConversationResponse {
  getConversation: {
    id: string;
    participants: Participant[];
    messages: Message[];
    updatedAt: string;
  };
}

export interface MessageSentResponse {
  messageSent: Message;
}

export interface UserStatusResponse {
  userStatusChanged: User;
}

export interface StatusUser {
  id: string; 
  isOnline: boolean;
}
export interface SendMessageResponse {
  sendMessage: Message;
}
export interface MarkMessageAsReadResponse {
  markMessageAsRead: {
    id: string;
    isRead: boolean;
  };
}
export interface AppMessage {
  id: string;
  content: string;
  timestamp: Date | string;
  isRead: boolean;
  senderId: {
    id: string;
    username: string;
    image?: string;
  };
  receiverId: {
    id: string;
  };
  conversationId?: string;
}

export interface Conversation {
  id: string;
  participants: User[];
  messages: AppMessage[];
  lastMessage?: AppMessage;
  unreadCount: number;
  createdAt: Date | string;
  updatedAt: Date | string;
}
export interface AppMessage {
  id: string;
  content: string;
  timestamp: Date | string;
  isRead: boolean;
  sender: {  
    id: string;
    username: string;
    image?: string;
  };
  receiver: { 
    id: string;
  };
  conversationId?: string;
}