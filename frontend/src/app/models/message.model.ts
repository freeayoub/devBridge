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
export interface PaginatedResponse<T> {
  items: T[];
  totalCount: number;
  pageInfo: {
    currentPage: number;
    perPage: number;
    hasNextPage: boolean;
  };
}
export interface Toast {
  id?: number;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
}
export enum MessageType {
  TEXT = 'TEXT',
  IMAGE = 'IMAGE',
  FILE = 'FILE',
  AUDIO = 'AUDIO',
  VIDEO = 'VIDEO',
  SYSTEM = 'SYSTEM',
  VOICE_MESSAGE = 'VOICE_MESSAGE',
  TEXT_LOWER = 'text',
  IMAGE_LOWER = 'image',
  FILE_LOWER = 'file',
  AUDIO_LOWER = 'audio',
  VIDEO_LOWER = 'video',
  SYSTEM_LOWER = 'system',
  VOICE_MESSAGE_LOWER = 'voice_message',
}
export enum MessageStatus {
  SENDING = 'SENDING',
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  READ = 'READ',
  FAILED = 'FAILED',
}
export interface Attachment {
  url: string;
  id?: string;
  _id?: string; // Pour compatibilité avec MongoDB
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
export interface Message {
  id?: string;
  _id?: string; // Pour compatibilité avec MongoDB
  content?: string;
  type?: MessageType;
  timestamp?: Date | string;
  isRead?: boolean;
  readAt?: Date | string;
  sender?: Partial<User>;
  senderId?: string; // Pour compatibilité avec MongoDB
  receiver?: Partial<User>;
  receiverId?: string; // Pour compatibilité avec MongoDB
  group?: Partial<Group>;
  conversationId?: string;
  attachments?: Attachment[];
  status?: MessageStatus;
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
  // Propriétés pour l'état d'envoi du message
  isPending?: boolean;
  isError?: boolean;
  isDelivered?: boolean; // Indique si le message a été livré
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
export interface Conversation {
  id?: string;
  _id?: string; // Pour compatibilité avec MongoDB
  participants?: User[];
  messages?: Message[];
  lastMessage?: Message | null;
  lastMessageId?: string;
  unreadCount?: number;
  messageCount?: number;
  isGroup?: boolean;
  groupName?: string;
  groupPhoto?: string;
  groupDescription?: string;
  groupAdmins?: User[];
  pinnedMessages?: Message[];
  typingUsers?: User[];
  lastRead?: UserReadStatus[];
  createdAt?: Date | string;
  updatedAt?: Date | string;
}
export interface UserReadStatus {
  userId: string;
  user: User;
  readAt: Date | string;
}
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
export interface GetConversationsResponse {
  getConversations: Conversation[];
}
export interface GetConversationResponse {
  getConversation: Conversation;
}
export interface GetGroupResponse {
  getGroup: Group;
}
export interface GetUserGroupsResponse {
  getUserGroups: Group[];
}
export interface UserPaginatedResponse {
  users: User[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface GetAllUsersResponse {
  getAllUsers: UserPaginatedResponse;
}
export interface GetOneUserResponse {
  getOneUser: User;
}
export interface getCurrentUserResponse {
  getCurrentUser: User;
}
export interface SearchMessagesResponse {
  searchMessages: Message[];
}
export interface GetUnreadMessagesResponse {
  getUnreadMessages: Message[];
}
export interface TypingIndicatorEvents {
  typingIndicator: TypingIndicatorEvent;
}
export interface TypingIndicatorEvent {
  conversationId: string;
  userId: string;
  isTyping: boolean;
}
export interface MessageDeleteResponse {
  deleteMessage: {
    id: string;
    isDeleted: boolean;
    deletedAt?: string | Date;
  };
}
export interface MessageEditResponse {
  editMessage: {
    id: string;
    content: string;
    isEdited: boolean;
    updatedAt: string | Date;
  };
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
export interface MessageSentEvent {
  messageSent: Message;
}
export interface UserStatusChangedEvent {
  userStatusChanged: User;
}
export interface ConversationUpdatedEvent {
  conversationUpdated: Conversation;
}
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
  stopTyping: boolean;
}
export interface StartTupingResponse {
  startTyping: boolean;
}
export interface conversationUpdatedResponse {
  conversationUpdated: Conversation;
}
export interface getNotificationAttachmentsEvent {
  getNotificationAttachments: Attachment[];
}

export interface NotificationAttachment {
  url: string;
  type: AttachmentType;
  name?: string;
  size?: number;
  mimeType?: string;
}
export interface NotificationMessage {
  id?: string;
  content: string;
  attachments?: NotificationAttachment[];
}
export interface NotificationSender {
  id: string;
  username: string;
  image?: string | null;
}
export interface Notification {
  id: string;
  type: NotificationType;
  content: string;
  timestamp: Date | string;
  isRead: boolean;
  senderId?: NotificationSender;
  message?: NotificationMessage;
  readAt?: Date | string;
  relatedEntity?: string;
  metadata?: Record<string, any>;
  conversationId?: string;
  groupId?: string;
  isDeleting?: boolean; // Indique si la notification est en cours de suppression
}
export interface GetNotificationsResponse {
  getUserNotifications: Notification[];
}
export interface NotificationReceivedEvent {
  notificationReceived: Notification;
}
export interface NotificationsReadEvent {
  notificationsRead: string[];
}
export interface MarkNotificationsAsReadResponse {
  markNotificationsAsRead: {
    success: boolean;
    readCount: number;
    remainingCount: number;
  };
}
export interface getUserNotificationsResponse {
  getUserNotifications: Notification[];
}
export type NotificationType =
  | 'NEW_MESSAGE'
  | 'FRIEND_REQUEST'
  | 'GROUP_INVITE'
  | 'MESSAGE_REACTION'
  | 'SYSTEM_ALERT';

export type AttachmentType =
  | 'IMAGE'
  | 'FILE'
  | 'AUDIO'
  | 'VIDEO'
  | 'OTHER'
  | 'image'
  | 'file'
  | 'audio'
  | 'video'
  | 'other';

// --------------------------------------------------------------------------
// Types et interfaces pour les appels
// --------------------------------------------------------------------------

/**
 * Types d'appels possibles
 */
export enum CallType {
  AUDIO = 'AUDIO',
  VIDEO = 'VIDEO',
  VIDEO_ONLY = 'VIDEO_ONLY',
}

/**
 * États possibles d'un appel
 */
export enum CallStatus {
  RINGING = 'RINGING',
  CONNECTED = 'CONNECTED',
  ENDED = 'ENDED',
  MISSED = 'MISSED',
  REJECTED = 'REJECTED',
  FAILED = 'FAILED',
}

/**
 * Interface pour un appel
 */
export interface Call {
  id: string;
  caller: User;
  recipient: User;
  type: CallType;
  status: CallStatus;
  startTime: string;
  endTime?: string;
  duration?: number;
  conversationId?: string;
  metadata?: any;
}

/**
 * Interface pour un signal d'appel
 */
export interface CallSignal {
  callId: string;
  senderId: string;
  type: string;
  data: string;
  timestamp: string;
}

/**
 * Interface pour un appel entrant
 */
export interface IncomingCall {
  id: string;
  caller: User;
  type: CallType;
  conversationId?: string;
  offer: string;
  timestamp: string;
}

/**
 * Interface pour les options d'appel
 */
export interface CallOptions {
  enableVideo?: boolean;
  enableAudio?: boolean;
  quality?: string;
}

/**
 * Interface pour les commentaires sur un appel
 */
export interface CallFeedback {
  quality?: number;
  issues?: string[];
  comment?: string;
}

/**
 * Interface pour le résultat d'une opération d'appel
 */
export interface CallSuccess {
  success: boolean;
  message?: string;
}
