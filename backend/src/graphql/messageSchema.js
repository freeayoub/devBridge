const { gql } = require("graphql-tag");

const typeDefs = gql`
  scalar Upload
  scalar JSON
  scalar Date
  scalar DateTime

  """
  Représente un appel audio ou vidéo entre deux utilisateurs
  """
  type Call {
    id: ID!
    caller: User!
    recipient: User!
    type: CallType!
    status: CallStatus!
    startTime: String!
    endTime: String
    duration: Int
    conversationId: ID
    metadata: JSON
  }

  """
  Types d'appels possibles
  """
  enum CallType {
    AUDIO
    VIDEO
    VIDEO_ONLY
  }

  """
  États possibles d'un appel
  """
  enum CallStatus {
    RINGING
    CONNECTED
    ENDED
    MISSED
    REJECTED
    FAILED
  }

  """
  Signal échangé pendant un appel (offre, réponse, candidats ICE, etc.)
  """
  type CallSignal {
    callId: ID!
    senderId: ID!
    type: String!
    data: String!
    timestamp: String!
  }

  """
  Réponse simple indiquant le succès d'une opération liée aux appels
  """
  type CallSuccess {
    success: Boolean!
    message: String
  }

  """
  Information sur un appel entrant
  """
  type IncomingCall {
    id: ID!
    caller: User!
    type: CallType!
    conversationId: ID
    offer: String!
    timestamp: String!
  }

  """
  Entrée pour les options d'appel
  """
  input CallOptions {
    enableVideo: Boolean
    enableAudio: Boolean
    quality: String
  }

  """
  Statistiques d'appels pour l'utilisateur
  """
  type CallStatistics {
    totalCalls: Int!
    totalDuration: Int!
    missedCalls: Int!
    callsByType: [CallTypeCount!]!
    averageCallDuration: Float!
    mostCalledUser: User
  }

  """
  Nombre d'appels par type
  """
  type CallTypeCount {
    type: CallType!
    count: Int!
  }

  """
  Entrée pour le feedback d'un appel
  """
  input CallFeedbackInput {
    quality: Int
    issues: [String]
    comment: String
  }
  type Message {
    id: ID!
    content: String
    type: MessageType!
    timestamp: Date!
    isRead: Boolean!
    readAt: Date
    isEdited: Boolean!
    isDeleted: Boolean!
    deletedAt: Date
    sender: User!
    receiver: User
    group: Group
    conversation: Conversation
    conversationId: ID!
    reactions: [Reaction!]!
    attachments: [Attachment!]!
    status: MessageStatus!
    pinned: Boolean!
    pinnedAt: Date
    pinnedBy: User
    forwardedFrom: Message
    replyTo: Message
    metadata: JSON
  }

  type Reaction {
    userId: ID!
    user: User!
    emoji: String!
    createdAt: Date!
  }

  type Attachment {
    url: String!
    type: AttachmentType!
    name: String!
    size: Int!
    mimeType: String
    thumbnailUrl: String
    duration: Int
  }

  type User {
    id: ID!
    username: String!
    email: String!
    image: String
    isOnline: Boolean!
    isActive: Boolean!
    lastActive: Date
    role: String!
    notificationCount: Int!
    lastNotification: Date
    createdAt: Date!
    updatedAt: Date!
    notifications: [Notification!]!
  }

  type Conversation {
    id: ID!
    participants: [User!]!
    messages(limit: Int = 50, offset: Int = 0): [Message!]!
    lastMessage: Message
    lastMessageId: ID
    unreadCount: Int!
    messageCount: Int!
    isGroup: Boolean!
    groupName: String
    groupPhoto: String
    groupDescription: String
    groupAdmins: [User!]!
    pinnedMessages: [Message!]!
    typingUsers: [User!]!
    lastRead: [UserReadStatus!]!
    createdAt: Date!
    updatedAt: Date!
  }
  type UserReadStatus {
    userId: ID!
    user: User!
    readAt: Date!
  }

  type UserPaginatedResponse {
    users: [User!]!
    totalCount: Int!
    totalPages: Int!
    currentPage: Int!
    hasNextPage: Boolean!
    hasPreviousPage: Boolean!
  }

  type Group {
    id: ID!
    name: String!
    photo: String
    description: String
    participants: [User!]!
    admins: [User!]!
    messageCount: Int!
    createdAt: Date!
    updatedAt: Date!
  }

  type Notification {
    id: ID!
    type: String!
    message: Message
    senderId: User
    content: String!
    timestamp: Date!
    isRead: Boolean!
    readAt: Date
    relatedEntity: ID
    metadata: JSON
  }
  type MessageReadEvent {
    messageId: ID!
    readerId: ID!
    readAt: Date!
  }

  type MessageReactionEvent {
    messageId: ID!
    reactions: [Reaction!]!
  }

  type NotificationReadResponse {
    success: Boolean!
    readCount: Int!
    remainingCount: Int!
  }

  type NotificationDeleteResponse {
    success: Boolean!
    count: Int
    message: String
  }

  type TypingIndicatorEvent {
    conversationId: ID!
    userId: ID!
    isTyping: Boolean!
  }

  enum NotificationType {
    NEW_MESSAGE
    FRIEND_REQUEST
    GROUP_INVITE
    MESSAGE_REACTION
  }
  enum MessageType {
    TEXT
    text
    IMAGE
    image
    FILE
    file
    AUDIO
    audio
    VIDEO
    video
    SYSTEM
    system
    VOICE_MESSAGE
    voice_message
  }

  enum AttachmentType {
    IMAGE
    FILE
    AUDIO
    VIDEO
    VOICE_MESSAGE
    image
    file
    audio
    video
    voice_message
  }

  enum MessageStatus {
    SENDING
    SENT
    DELIVERED
    READ
    FAILED
  }

  input MessageFilter {
    isRead: Boolean
    isDeleted: Boolean
    type: MessageType
    senderId: ID
    receiverId: ID
    groupId: ID
    pinned: Boolean
    dateFrom: DateTime
    dateTo: DateTime
  }

  input ConversationFilter {
    isGroup: Boolean
    hasUnread: Boolean
    updatedAfter: Date
  }

  input SendMessageInput {
    receiverId: ID!
    content: String!
    file: Upload
    replyTo: ID
  }

  input SendGroupMessageInput {
    groupId: ID!
    content: String!
    file: Upload
    replyTo: ID
  }

  input CreateGroupInput {
    name: String!
    participantIds: [ID!]!
    photo: Upload
    description: String
  }

  input UpdateGroupInput {
    name: String
    photo: Upload
    description: String
    addParticipants: [ID!]
    removeParticipants: [ID!]
    addAdmins: [ID!]
    removeAdmins: [ID!]
  }

  input UpdateProfileInput {
    username: String
    email: String
    image: Upload
  }

  type Query {
    getMessages(
      senderId: ID
      receiverId: ID
      conversationId: ID
      page: Int
      limit: Int
    ): [Message!]!

    getUnreadMessages(userId: ID!): [Message!]!

    searchMessages(
      query: String!
      conversationId: ID
      limit: Int = 20
      offset: Int = 0
      isRead: Boolean
      isDeleted: Boolean
      type: MessageType
      senderId: ID
      receiverId: ID
      groupId: ID
      pinned: Boolean
      dateFrom: DateTime
      dateTo: DateTime
    ): [Message!]!

    getConversation(conversationId: ID!): Conversation

    getConversations(
      filter: ConversationFilter
      limit: Int
      offset: Int
    ): [Conversation!]!

    getAllUsers(
      search: String
      page: Int = 1
      limit: Int = 10
      sortBy: String = "username"
      sortOrder: String = "asc"
      isOnline: Boolean
    ): UserPaginatedResponse!

    getOneUser(id: ID!): User!

    getCurrentUser: User!

    getGroup(id: ID!): Group!

    getUserGroups: [Group!]!

    getUserNotifications: [Notification!]!

    """
    Récupère l'historique des appels de l'utilisateur connecté
    """
    callHistory(
      limit: Int = 20
      offset: Int = 0
      status: [CallStatus]
      type: [CallType]
      startDate: String
      endDate: String
    ): [Call!]!

    """
    Récupère les détails d'un appel spécifique
    """
    callDetails(callId: ID!): Call

    """
    Récupère les statistiques d'appels de l'utilisateur
    """
    callStats: CallStatistics!

    """
    Récupère tous les messages vocaux de l'utilisateur
    """
    getVoiceMessages: [Call!]!
  }

  type Mutation {
    sendMessage(
      receiverId: ID!
      content: String
      file: Upload
      type: MessageType = TEXT
      metadata: JSON
    ): Message!

    markNotificationsAsRead(notificationIds: [ID!]!): NotificationReadResponse!

    deleteNotification(notificationId: ID!): NotificationDeleteResponse!

    deleteMultipleNotifications(
      notificationIds: [ID!]!
    ): NotificationDeleteResponse!

    deleteAllNotifications: NotificationDeleteResponse!

    sendGroupMessage(input: SendGroupMessageInput!): Message!

    editMessage(messageId: ID!, newContent: String!): Message!

    deleteMessage(messageId: ID!): Message!

    markMessageAsRead(messageId: ID!): Message!

    reactToMessage(messageId: ID!, emoji: String!): Message!

    forwardMessage(messageId: ID!, conversationIds: [ID!]!): [Message!]!

    pinMessage(messageId: ID!, conversationId: ID!): Message!

    startTyping(conversationId: ID!): Boolean!

    stopTyping(conversationId: ID!): Boolean!

    createGroup(input: CreateGroupInput!): Group!

    updateGroup(id: ID!, input: UpdateGroupInput!): Group!

    setUserOnline(userId: ID!): User!

    setUserOffline(userId: ID!): User!

    updateUserProfile(input: UpdateProfileInput!): User!

    """
    Crée ou récupère une conversation avec un utilisateur
    """
    createConversation(userId: ID!): Conversation!

    """
    Initie un appel vers un autre utilisateur
    """
    initiateCall(
      recipientId: ID!
      callType: CallType!
      callId: String!
      offer: String!
      conversationId: ID
      options: CallOptions
    ): Call!

    """
    Envoie un signal pendant un appel (réponse, candidats ICE, etc.)
    """
    sendCallSignal(
      callId: ID!
      signalType: String!
      signalData: String!
    ): CallSuccess!

    """
    Accepte un appel entrant
    """
    acceptCall(callId: ID!, answer: String!): Call!

    """
    Rejette un appel entrant
    """
    rejectCall(callId: ID!, reason: String): Call!

    """
    Termine un appel en cours
    """
    endCall(callId: ID!, feedback: CallFeedbackInput): Call!

    """
    Bascule la caméra ou le micro pendant un appel
    """
    toggleCallMedia(callId: ID!, video: Boolean, audio: Boolean): CallSuccess!
  }

  type Subscription {
    messageSent(senderId: ID, receiverId: ID, conversationId: ID): Message!
    groupMessageSent(groupId: ID!): Message!
    messageUpdated(conversationId: ID!): Message!
    messageDeleted(conversationId: ID!): Message!
    messageRead(userId: ID!): MessageReadEvent!
    messageReaction(conversationId: ID!): MessageReactionEvent!
    conversationUpdated(conversationId: ID!): Conversation!
    typingIndicator(conversationId: ID!): TypingIndicatorEvent!
    notificationReceived: Notification!
    userStatusChanged: User!
    unreadMessages(receiverId: ID!): [Message!]!
    notificationsRead: [ID!]!

    """
    Signaux échangés pendant un appel
    """
    callSignal(callId: ID): CallSignal!

    """
    Notification d'appel entrant
    """
    incomingCall: IncomingCall!

    """
    Changements d'état d'un appel
    """
    callStatusChanged(callId: ID): Call!
  }
`;

module.exports = typeDefs;
