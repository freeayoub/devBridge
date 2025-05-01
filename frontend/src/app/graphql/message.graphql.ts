import { gql } from 'apollo-angular';

export const SEND_MESSAGE_MUTATION = gql`
mutation SendMessage($receiverId: ID!, $content: String, $file: Upload) {
  sendMessage(receiverId: $receiverId, content: $content, file: $file) {
    id
    content
    type
    timestamp
    isRead
    sender {
      id
      username
      image
    }
    receiver {
      id
    }
    conversation {
      id
    }
  }
}
`;
export const MARK_AS_READ_MUTATION = gql`
  mutation MarkMessageAsRead($messageId: ID!) {
    markMessageAsRead(messageId: $messageId) {
      id
      isRead
      readAt
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
      sender {
        id
        username
      }
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
      type
      timestamp
      isRead
      sender {
        id
        username
        image
      }
      attachments {
        url
        type
      }
    }
  }
}
`;

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
export const GET_CURRENT_USER_QUERY = gql`
  query GetCurrentUser {
    getCurrentUser {
      id
      username
      email
      image
      isOnline
      lastActive
      notificationCount
    }
  }
`;
export const MESSAGE_SENT_SUBSCRIPTION = gql`
  subscription MessageSent($conversationId: ID) {
    messageSent(conversationId: $conversationId) {
      id
      content
      type
      timestamp
      isRead
      sender {
        id
        username
        image
      }
      conversation {
        id
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
export const CONVERSATION_UPDATED_SUBSCRIPTION = gql`
  subscription ConversationUpdated($conversationId: ID!) {
    conversationUpdated(conversationId: $conversationId) {
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
        sender {
          id
          username
        }
      }
      unreadCount
      updatedAt
    }
  }
`;

export const SEARCH_MESSAGES_QUERY = gql`
  query SearchMessages($query: String!, $conversationId: ID) {
    searchMessages(query: $query, conversationId: $conversationId) {
      id
      content
      timestamp
      sender {
        id
        username
      }
    }
  }
`;
export const GET_UNREAD_MESSAGES_QUERY = gql`
  query GetUnreadMessages {
    getUnreadMessages {
      id
      content
      timestamp
      sender {
        id
        username
        image
      }
      conversation {
        id
      }
    }
  }
`;
export const SET_USER_ONLINE_MUTATION = gql`
  mutation SetUserOnline($userId: ID!) {
    setUserOnline(userId: $userId) {
      id
      isOnline
      lastActive
    }
  }
`;
export const SET_USER_OFFLINE_MUTATION = gql`
  mutation SetUserOffline($userId: ID!) {
    setUserOffline(userId: $userId) {
      id
      isOnline
      lastActive
    }
  }
`;

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
      sender {
        id
        username
        image
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
      sender {
        id
        username
        image
      }
    }
  }
`;