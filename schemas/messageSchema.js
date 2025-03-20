const { gql } = require("graphql-tag");

const typeDefs = gql`
  scalar Upload
  type User {
    id: ID!
    username: String!
    email: String!
    role: String!
    createdAt: String!
    isOnline: Boolean!
  }

  type Message {
    id: ID!
    senderId: ID!
    receiverId: ID!
    content: String!
    timestamp: String!
    fileUrl: String
    isRead: Boolean!
  }
  type Conversation {
    id: ID!
    participants: [User!]!
    messages: [Message!]!
    createdAt: String!
    updatedAt: String!
  }
  type Query {
    getMessages(
      senderId: ID!
      receiverId: ID!
      page: Int
      limit: Int
    ): [Message]
    getConversation(conversationId: ID!): Conversation
    getUnreadMessages(userId: ID!): [Message!]!
  }

  type Mutation {
    sendMessage(
      senderId: ID!
      receiverId: ID!
      content: String!
      file: Upload
    ): Message
    markMessageAsRead(messageId: ID!): Message
    
    setUserOnline(userId: ID!): User
    setUserOffline(userId: ID!): User
  }
    
  type Subscription {
    messageSent(senderId: ID!, receiverId: ID!): Message
    
    unreadMessages(receiverId: ID!): [Message]

    userStatusChanged: User
  }
`;

module.exports = typeDefs;
