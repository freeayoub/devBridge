const { gql } = require("graphql-tag");

const typeDefs = gql`
  scalar Upload
  scalar Date
  scalar JSON
  scalar DateTime
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
    type: NotificationType!
    message: Message
    sender: User
    content: String!
    timestamp: Date!
    isRead: Boolean!
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
    IMAGE
    FILE
    AUDIO
    VIDEO
    SYSTEM
  }

  enum AttachmentType {
    IMAGE
    FILE
    AUDIO
    VIDEO
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
      page: Int = 1
      limit: Int = 10
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

    getAllUsers(search: String): [User!]!

    getOneUser(id: ID!): User!

    getCurrentUser: User!

    getGroup(id: ID!): Group!

    getUserGroups: [Group!]!

    getUserNotifications: [Notification!]!
  }

  type Mutation {
    sendMessage(receiverId: ID!, content: String, file: Upload): Message!

    markNotificationsAsRead(notificationIds: [ID!]!): Boolean!

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
    notificationsRead(userId: ID!): [ID!]!
  }
`;

module.exports = typeDefs;
