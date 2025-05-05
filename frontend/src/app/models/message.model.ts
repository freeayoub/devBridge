import {User} from './user.model';

export enum MessageType {
  TEXT = 'TEXT',
  IMAGE = 'IMAGE',
  FILE = 'FILE',
  AUDIO = 'AUDIO',
  VIDEO = 'VIDEO',
  SYSTEM = 'SYSTEM'
}
export enum MessageStatus {
  SENDING = 'SENDING',
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  READ = 'READ',
  FAILED = 'FAILED'
}

export interface Attachment {
  url: string;
  type: MessageType;
  name?: string;
  size?: number;
  mimeType?: string;
  thumbnailUrl?: string;
  duration?: number;
}

export interface Reaction {
  userId: string;
  user: Partial<User>;
  emoji: string;
  createdAt: Date | string;
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
  status: MessageStatus;
  isEdited?: boolean;
  isDeleted?: boolean;
  deletedAt?: Date | string;
  pinned?: boolean;
  pinnedAt?: Date | string;
  pinnedBy?: Partial<User>;
  forwardedFrom?: Partial<Message>;
  replyTo?: Partial<Message>;
  reactions?: Reaction[];
  metadata?: any;
}

// Conversation Interface

export interface Conversation {
  id: string;
  participants: User[];
  messages: Message[];
  lastMessage: Message | null; 
  lastMessageId?: string;
  unreadCount: number;
  messageCount: number;
  isGroup: boolean;
  groupName?: string;
  groupPhoto?: string;
  groupDescription?: string;
  groupAdmins?: User[];
  pinnedMessages?: Message[];
  typingUsers?: User[];
  lastRead?: UserReadStatus[];
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface UserReadStatus {
  userId: string;
  user: User;
  readAt: Date | string;
}
// conversations reponse 
export interface GetConversationsResponse {
  getConversations: Conversation[];
}
//conversation reponse 
export interface GetConversationResponse {
  getConversation: Conversation;
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
export interface GetGroupResponse {
  getGroup: Group;
}

export interface GetUserGroupsResponse {
  getUserGroups: Group[];
}
export interface GetAllUsersResponse {
  getAllUsers: User[];
}
export interface GetOneUserResponse {
   getOneUser: User ;
}
export interface getCurrentUserResponse {
  getCurrentUser: User  ;
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
  dateFrom?: Date | string;
  dateTo?: Date | string;
}
export interface SearchMessagesResponse {
  searchMessages: Message[];
}

export interface GetUnreadMessagesResponse {
  getUnreadMessages: Message[];
}

export interface TypingIndicatorEvents {
  typingIndicator: TypingIndicatorEvent 
}
export interface TypingIndicatorEvent {
  conversationId: string;
  userId: string;
  isTyping: boolean;
}

export interface MessageReadEvent {
  messageId: string;
  readerId: string;
  readAt: Date | string;
}

export interface MessageReactionEvent {
  messageId: string;
  reactions: Reaction[];
}

export interface Notification {
  id: string;
  type: 'NEW_MESSAGE' | 'FRIEND_REQUEST' | 'GROUP_INVITE' | 'MESSAGE_REACTION';
  message?: Message;
  sender?: User;
  content: string;
  timestamp: Date | string;
  isRead: boolean;
  createdAt: Date | string;
  reciver: User;
  relatedEntityId?: string;
}

export interface GetNotificationsResponse {
  getUserNotifications: Notification[];
}

export interface Toast {
  id?: number;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
}

// Responses for mutations
export interface SendMessageResponse {
  sendMessage: Message;
}

export interface MarkAsReadResponse {
  markMessageAsRead: Message;
}

export interface ReactToMessageResponse {
  reactToMessage: Message;
}

export interface ForwardMessageResponse {
  forwardMessage: Message[];
}

export interface PinMessageResponse {
  pinMessage: Message;
}

export interface CreateGroupResponse {
  createGroup: Group;
}

export interface UpdateGroupResponse {
  updateGroup: Group;
}

export interface SetUserOnlineResponse {
  setUserOnline: User;
}

export interface SetUserOfflineResponse {
  setUserOffline: User;
}
export interface StopTypingResponse {
  stopTyping: boolean ;
}
export interface StartTupingResponse {
  startTyping: boolean ;
}
export interface conversationUpdatedResponse {
  conversationUpdated: Conversation 
}



