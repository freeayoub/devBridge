import { gql } from 'apollo-angular';

export const GET_USER_QUERY = gql`
  query GetOneUser($id: ID!) {
    getOneUser(id: $id) {
      id
      username
      email
      role
      image
      isActive
      isOnline
      lastActive
      createdAt
      updatedAt
    }
  }
`;
export const GET_ALL_USER_QUERY = gql`
  query GetAllUsers($search: String) {
    getAllUsers(search: $search) {
      id
      username
      email
      role
      image
      isActive
      isOnline
      lastActive
      createdAt
      updatedAt
    }
  }
`;
export const GET_CONVERSATIONS_QUERY = gql`
  query GetConversations {
    getConversations {
      id
      participants {
        id
        username
        image
        isOnline
      }
      lastMessage {
        id
        content
        timestamp
        isRead
      }
      unreadCount
      updatedAt
    }
  }
`;
export const GET_CONVERSATION_QUERY = gql`
  query GetConversation($conversationId: ID!) {
    getConversation(conversationId: $conversationId) {
      id
      participants {
        id
        username
        image
        isOnline
      }
      messages {
        id
        content
        timestamp
        isRead
        sender {
          id
          username
          image
        }
      }
    }
  }
`;

export const SEND_MESSAGE_MUTATION = gql`
  mutation SendMessage($senderId: ID!, $receiverId: ID!, $content: String!) {
    sendMessage(
      senderId: $senderId
      receiverId: $receiverId
      content: $content
    ) {
      id
      content
      timestamp
      isRead
      sender {
        id
        username
        image
      }
    }
  }
`;
export const MARK_AS_READ_MUTATION = gql`
  mutation MarkMessageAsRead($messageId: ID!) {
    markMessageAsRead(messageId: $messageId) {
      id
      isRead
    }
  }
`;
export const MESSAGE_SENT_SUBSCRIPTION = gql`
  subscription MessageSent($senderId: ID!, $receiverId: ID!) {
    messageSent(senderId: $senderId, receiverId: $receiverId) {
      id
      content
      timestamp
      isRead
      sender {
        id
        username
        image
      }
    }
  }
`;
export const USER_STATUS_SUBSCRIPTION = gql`
  subscription UserStatusChanged {
    userStatusChanged {
      id
      username
      isOnline
      lastActive
    }
  }
`;
//notification query
export const GET_NOTIFICATIONS_QUERY = gql`
  query GetNotifications($userId: ID!) {
    getNotifications(userId: $userId) {
      id
      type
      message
      isRead
      createdAt
      relatedEntity {
        id
        type
      }
    }
  }
`;
export const MARK_NOTIFICATION_READ_MUTATION = gql`
  mutation MarkNotificationsAsRead($notificationIds: [ID!]!) {
    markNotificationsAsRead(notificationIds: $notificationIds) {
      id
      isRead
    }
  }
`;
export const NOTIFICATION_SUBSCRIPTION = gql`
  subscription NotificationReceived($userId: ID!) {
    notificationReceived(userId: $userId) {
      id
      type
      message
      isRead
      createdAt
      relatedEntity {
        id
        type
      }
    }
  }
`;
