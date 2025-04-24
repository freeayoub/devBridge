const { gql } = require("graphql-tag");

const typeDefs = gql`
  scalar Upload
  scalar Date

  type Message {
    id: ID!
    content: String
    type: MessageType!
    timestamp: Date!
    isRead: Boolean!
    readAt: Date
    isDeleted: Boolean!
    sender: User!
    receiver: User
    group: Group
    conversation: Conversation!
    reactions: [Reaction!]!
    attachments: [Attachment!]!
    status: MessageStatus!
    pinned: Boolean!
    forwardedFrom: Message
    isEphemeral: Boolean
    expiresAt: Date
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
  }
  interface MessageEvent {
    eventType: MessageEventType!
    message: Message!
    timestamp: Date!
  }
  type Conversation {
    id: ID!
    participants: [User!]!
    messages(limit: Int, offset: Int): [Message!]!
    lastMessage: Message
    unreadCount: Int!
    isGroup: Boolean!
    groupName: String
    groupPhoto: String
    groupAdmins: [User!]!
    pinnedMessages: [Message!]!
    typingUsers: [User!]!
    createdAt: Date!
    updatedAt: Date!
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
    createdAt: Date
    updatedAt: Date
  }

  type Group {
    id: ID!
    name: String!
    photo: String
    participants: [User!]!
    admins: [User!]!
    createdAt: Date!
    updatedAt: Date!
  }
  enum MessageEventType {
    SENT
    EDITED
    DELETED
    READ
    REACTION
  }
  enum MessageType {
    TEXT
    IMAGE
    FILE
    AUDIO
    VIDEO
  }

  enum AttachmentType {
    IMAGE
    FILE
    AUDIO
    VIDEO
  }

  enum MessageStatus {
    SENT
    DELIVERED
    READ
  }
  input MessageFilter {
    isRead: Boolean
    isDeleted: Boolean
    type: MessageType
    senderId: ID
    receiverId: ID
    groupId: ID
    conversationId: ID
    pinned: Boolean
  }
  type Query {
    # Message-related queries
    getMessages(
      senderId: ID!
      receiverId: ID!
      page: Int
      limit: Int
    ): [Message!]!
    getUnreadMessages(userId: ID!): [Message!]!
    searchMessages(
      query: String!
      conversationId: ID
      limit: Int
      offset: Int
    ): [Message!]!

    # Conversation-related queries
    getConversation(conversationId: ID!): Conversation!
    getConversations: [Conversation!]!

    # User-related queries (ADD THESE)
    getAllUsers(search: String): [User!]!
    getOneUser(id: ID!): User!
  }

  type Mutation {
    sendMessage(
      senderId: ID!
      receiverId: ID!
      content: String!
      file: Upload
    ): Message!
    sendGroupMessage(content: String!, groupId: ID!, file: Upload): Message!
    editMessage(messageId: ID!, newContent: String!): Message!
    deleteMessage(messageId: ID!): Message!
    markMessageAsRead(messageId: ID!): Message!
    reactToMessage(messageId: ID!, emoji: String!): Message!
    forwardMessage(messageId: ID!, conversationIds: [ID!]!): [Message!]!
    pinMessage(messageId: ID!, conversationId: ID!): Message!
    startTyping(conversationId: ID!): Conversation!
    stopTyping(conversationId: ID!): Conversation!
    createGroup(
      name: String!
      participantIds: [ID!]!
      photo: Upload
    ): Conversation!
    setUserOnline(userId: ID!): User!
    setUserOffline(userId: ID!): User!
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
    unreadMessages(receiverId: ID!): [Message]!
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

  type Notification {
    id: ID!
    type: String!
    messageId: ID
    sender: User
    content: String!
    timestamp: Date!
    isRead: Boolean!
  }
`;

module.exports = typeDefs;
