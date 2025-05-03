import {User} from './user.model';
// Attachment Interface
export interface Attachment {
  url: string;
  type:MessageType;
  name?: string;
  size?: number;
  mimeType?: string;
  thumbnailUrl?: string;
  duration?: number;
}
export enum MessageType {
  TEXT = 'TEXT',
  IMAGE = 'IMAGE',
  FILE = 'FILE',
  AUDIO = 'AUDIO',
  VIDEO = 'VIDEO',
  SYSTEM = 'SYSTEM'
}

// Message Interface
export interface Message {
  id: string;
  content?: string;
  type: MessageType;
  timestamp: Date | string;
  isRead: boolean;
  readAt?: Date | string;
  sender: Partial<User>; 
  receiver?: Partial<User>;
  group?: Partial<Group>;
  conversationId: string;
  attachments: Attachment[];
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  isEdited?: boolean;
  isDeleted?: boolean;
  deletedAt?: Date | string;
  pinned?: boolean;
  pinnedAt?: Date | string;
  pinnedBy?: Partial<User>;
  forwardedFrom?: Partial<Message>;
  replyTo?: Partial<Message>;
}

// Conversation Interface
export interface Conversation {
  id: string;
  participants: User[];
  messages: Message[];
  lastMessage?: Message;
  unreadCount: number;
  isGroup: boolean;
  groupName?: string;
  groupPhoto?: string;
  groupDescription?: string;
  groupAdmins?: User[];
  updatedAt: Date | string;
}

// Group Interface
export interface Group {
  id: string;
  name: string;
  photo?: string;
  description?: string;
  participants: User[];
  admins: User[];
  messageCount: number;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface MessageFilter {
  isRead?: boolean;
  isDeleted?: boolean;
  type?: MessageType;
  senderId?: string;
  receiverId?: string;
  groupId?: string;
  conversationId?: string;
  pinned?: boolean;
  dateFrom?: Date;
  dateTo?: Date;
}

export interface Toast {
  id?: number;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
}
export interface TypingIndicatorEvent {
  conversationId: string;
  userId: string;
  isTyping: boolean;
}

