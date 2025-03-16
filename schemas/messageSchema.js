const { gql } = require('graphql-tag'); 

const typeDefs = gql`
 scalar Upload
 type User {
    id: ID!
    username: String!
    email: String!
    role: String!
    createdAt: String!
  }

  type Message {
    id: ID!
    senderId: ID!
    receiverId: ID!
    content: String!
    timestamp: String!
    fileUrl: String
  }
  type Conversation {
    id: ID!
    participants: [User!]!
    messages: [Message!]!
    createdAt: String!
  }
  type Query {
    getMessages(senderId: ID!, receiverId: ID!, page: Int ,limit: Int): [Message] 
    getConversation(conversationId: ID!): Conversation
  }

  type Mutation {
    sendMessage(senderId: ID!, receiverId: ID!, content: String!, file: Upload): Message
  }
      type Subscription {
    messageSent(senderId: ID!, receiverId: ID!): Message
  }
`;

module.exports = typeDefs;