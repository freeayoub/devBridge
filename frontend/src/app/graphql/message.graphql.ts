import { gql } from 'apollo-angular';

// Définir les types GraphQL
export const typeDefs = gql`
  enum MessageType {
    TEXT
    IMAGE
    FILE
    AUDIO
    VIDEO
    SYSTEM
    VOICE_MESSAGE
  }
`;

// Message Mutations
export const SEND_MESSAGE_MUTATION = gql`
  mutation SendMessage(
    $receiverId: ID!
    $content: String
    $file: Upload
    $type: MessageType
    $metadata: JSON
  ) {
    sendMessage(
      receiverId: $receiverId
      content: $content
      file: $file
      type: $type
      metadata: $metadata
    ) {
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
      attachments {
        url
        type
        duration
      }
      metadata
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
export const EDIT_MESSAGE_MUTATION = gql`
  mutation EditMessage($messageId: ID!, $newContent: String!) {
    editMessage(messageId: $messageId, newContent: $newContent) {
      id
      content
      isEdited
      updatedAt
    }
  }
`;
export const DELETE_MESSAGE_MUTATION = gql`
  mutation DeleteMessage($messageId: ID!) {
    deleteMessage(messageId: $messageId) {
      id
      isDeleted
      deletedAt
    }
  }
`;
export const GET_MESSAGES_QUERY = gql`
  query GetMessages(
    $senderId: ID!
    $receiverId: ID!
    $conversationId: ID!
    $page: Int
    $limit: Int
  ) {
    getMessages(
      senderId: $senderId
      receiverId: $receiverId
      conversationId: $conversationId
      page: $page
      limit: $limit
    ) {
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
      replyTo {
        id
        content
      }
    }
  }
`;
// Conversation Queries
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
  query GetConversation(
    $conversationId: ID!
    $limit: Int = 10
    $offset: Int = 0
  ) {
    getConversation(conversationId: $conversationId) {
      id
      participants {
        id
        username
        image
        isOnline
      }
      messages(limit: $limit, offset: $offset) {
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
          username
          image
        }
        attachments {
          url
          type
          duration
        }
        metadata
        conversationId
      }
    }
  }
`;
// User Queries
export const GET_USER_QUERY = gql`
  query GetOneUser($id: ID!) {
    getOneUser(id: $id) {
      id
      username
      email
      image
      isOnline
      lastActive
    }
  }
`;
export const GET_ALL_USER_QUERY = gql`
  query GetAllUsers(
    $search: String
    $page: Int
    $limit: Int
    $sortBy: String
    $sortOrder: String
    $isOnline: Boolean
  ) {
    getAllUsers(
      search: $search
      page: $page
      limit: $limit
      sortBy: $sortBy
      sortOrder: $sortOrder
      isOnline: $isOnline
    ) {
      users {
        id
        username
        email
        image
        isOnline
        lastActive
      }
      totalCount
      totalPages
      currentPage
      hasNextPage
      hasPreviousPage
    }
  }
`;
// Status Mutations
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
// Search Query
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
// Unread Messages Query
export const GET_UNREAD_MESSAGES_QUERY = gql`
  query GetUnreadMessages($userId: ID!) {
    getUnreadMessages(userId: $userId) {
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
// Subscriptions
export const MESSAGE_SENT_SUBSCRIPTION = gql`
  subscription MessageSent($conversationId: ID!) {
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
      attachments {
        url
        type
        duration
      }
      metadata
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
// Notification Queries
export const GET_NOTIFICATIONS_QUERY = gql`
  query GetUserNotifications {
    getUserNotifications {
      id
      type
      content
      timestamp
      isRead
      senderId {
        id
        username
        image
      }
      message {
        id
        content
      }
      readAt
      relatedEntity
      metadata
    }
  }
`;
export const GET_NOTIFICATIONS_ATTACHAMENTS = gql`
  query GetNotificationAttachments($id: ID!) {
    getNotificationAttachments(notificationId: $id) {
      url
      type
      name
      size
    }
  }
`;
export const MARK_NOTIFICATION_READ_MUTATION = gql`
  mutation MarkNotificationsAsRead($notificationIds: [ID!]!) {
    markNotificationsAsRead(notificationIds: $notificationIds) {
      success
      readCount
      remainingCount
    }
  }
`;
export const NOTIFICATION_SUBSCRIPTION = gql`
  subscription NotificationReceived {
    notificationReceived {
      id
      type
      content
      timestamp
      isRead
      senderId {
        id
        username
        image
      }
      message {
        id
        content
      }
      readAt
      relatedEntity
      metadata
    }
  }
`;
export const NOTIFICATIONS_READ_SUBSCRIPTION = gql`
  subscription NotificationsRead {
    notificationsRead
  }
`;
// group Queries
export const GET_GROUP_QUERY = gql`
  query GetGroup($id: ID!) {
    getGroup(id: $id) {
      id
      name
      photo
      description
      participants {
        id
        username
        email
        image
        isOnline
      }
      admins {
        id
        username
        email
        image
        isOnline
      }
      messageCount
      createdAt
      updatedAt
    }
  }
`;
export const GET_USER_GROUPS_QUERY = gql`
  query GetUserGroups($userId: ID!) {
    getUserGroups(userId: $userId) {
      id
      name
      photo
      description
      participants {
        id
        username
        image
        isOnline
      }
      admins {
        id
        username
        image
        isOnline
      }
      messageCount
      createdAt
      updatedAt
    }
  }
`;
export const CREATE_GROUP_MUTATION = gql`
  mutation CreateGroup(
    $name: String!
    $participantIds: [ID!]!
    $photo: Upload
    $description: String
  ) {
    createGroup(
      name: $name
      participantIds: $participantIds
      photo: $photo
      description: $description
    ) {
      id
      name
      photo
      description
      participants {
        id
        username
        image
      }
      admins {
        id
        username
        image
      }
    }
  }
`;
export const UPDATE_GROUP_MUTATION = gql`
  mutation UpdateGroup($id: ID!, $input: UpdateGroupInput!) {
    updateGroup(id: $id, input: $input) {
      id
      name
      photo
      description
      participants {
        id
        username
        image
      }
      admins {
        id
        username
        image
      }
    }
  }
`;
// Add to exports
export const TYPING_INDICATOR_SUBSCRIPTION = gql`
  subscription TypingIndicator($conversationId: ID!) {
    typingIndicator(conversationId: $conversationId) {
      conversationId
      userId
      isTyping
    }
  }
`;
export const START_TYPING_MUTATION = gql`
  mutation StartTyping($input: TypingInput!) {
    startTyping(input: $input)
  }
`;
export const STOP_TYPING_MUTATION = gql`
  mutation StopTyping($input: TypingInput!) {
    stopTyping(input: $input)
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
      createdAt
      updatedAt
    }
  }
`;
export const REACT_TO_MESSAGE_MUTATION = gql`
  mutation ReactToMessage($messageId: ID!, $emoji: String!) {
    reactToMessage(messageId: $messageId, emoji: $emoji) {
      id
      reactions {
        userId
        emoji
        createdAt
      }
    }
  }
`;
export const FORWARD_MESSAGE_MUTATION = gql`
  mutation ForwardMessage($messageId: ID!, $conversationIds: [ID!]!) {
    forwardMessage(messageId: $messageId, conversationIds: $conversationIds) {
      id
      content
      timestamp
      sender {
        id
        username
      }
      conversation {
        id
      }
    }
  }
`;
export const PIN_MESSAGE_MUTATION = gql`
  mutation PinMessage($messageId: ID!, $conversationId: ID!) {
    pinMessage(messageId: $messageId, conversationId: $conversationId) {
      id
      pinned
      pinnedAt
      pinnedBy {
        id
        username
      }
    }
  }
`;

export const CREATE_CONVERSATION_MUTATION = gql`
  mutation CreateConversation($userId: ID!) {
    createConversation(userId: $userId) {
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
      }
      unreadCount
      updatedAt
    }
  }
`;

// Call Queries
export const CALL_HISTORY_QUERY = gql`
  query CallHistory(
    $limit: Int
    $offset: Int
    $status: [CallStatus]
    $type: [CallType]
    $startDate: String
    $endDate: String
  ) {
    callHistory(
      limit: $limit
      offset: $offset
      status: $status
      type: $type
      startDate: $startDate
      endDate: $endDate
    ) {
      id
      caller {
        id
        username
        image
      }
      recipient {
        id
        username
        image
      }
      type
      status
      startTime
      endTime
      duration
      conversationId
    }
  }
`;

export const CALL_DETAILS_QUERY = gql`
  query CallDetails($callId: ID!) {
    callDetails(callId: $callId) {
      id
      caller {
        id
        username
        image
      }
      recipient {
        id
        username
        image
      }
      type
      status
      startTime
      endTime
      duration
      conversationId
      metadata
    }
  }
`;

export const CALL_STATS_QUERY = gql`
  query CallStats {
    callStats {
      totalCalls
      totalDuration
      missedCalls
      callsByType {
        type
        count
      }
      averageCallDuration
      mostCalledUser {
        id
        username
        image
      }
    }
  }
`;

// Call Mutations
export const INITIATE_CALL_MUTATION = gql`
  mutation InitiateCall(
    $recipientId: ID!
    $callType: CallType!
    $callId: String!
    $offer: String!
    $conversationId: ID
    $options: CallOptions
  ) {
    initiateCall(
      recipientId: $recipientId
      callType: $callType
      callId: $callId
      offer: $offer
      conversationId: $conversationId
      options: $options
    ) {
      id
      caller {
        id
        username
        image
      }
      recipient {
        id
        username
        image
      }
      type
      status
      startTime
      conversationId
    }
  }
`;

export const SEND_CALL_SIGNAL_MUTATION = gql`
  mutation SendCallSignal(
    $callId: ID!
    $signalType: String!
    $signalData: String!
  ) {
    sendCallSignal(
      callId: $callId
      signalType: $signalType
      signalData: $signalData
    ) {
      success
      message
    }
  }
`;

export const ACCEPT_CALL_MUTATION = gql`
  mutation AcceptCall($callId: ID!, $answer: String!) {
    acceptCall(callId: $callId, answer: $answer) {
      id
      status
    }
  }
`;

export const REJECT_CALL_MUTATION = gql`
  mutation RejectCall($callId: ID!, $reason: String) {
    rejectCall(callId: $callId, reason: $reason) {
      id
      status
    }
  }
`;

export const END_CALL_MUTATION = gql`
  mutation EndCall($callId: ID!, $feedback: CallFeedbackInput) {
    endCall(callId: $callId, feedback: $feedback) {
      id
      status
      endTime
      duration
    }
  }
`;

export const TOGGLE_CALL_MEDIA_MUTATION = gql`
  mutation ToggleCallMedia($callId: ID!, $video: Boolean, $audio: Boolean) {
    toggleCallMedia(callId: $callId, video: $video, audio: $audio) {
      success
      message
    }
  }
`;

// Call Subscriptions
export const CALL_SIGNAL_SUBSCRIPTION = gql`
  subscription CallSignal($callId: ID) {
    callSignal(callId: $callId) {
      callId
      senderId
      type
      data
      timestamp
    }
  }
`;

export const INCOMING_CALL_SUBSCRIPTION = gql`
  subscription IncomingCall {
    incomingCall {
      id
      caller {
        id
        username
        image
      }
      type
      conversationId
      offer
      timestamp
    }
  }
`;

export const CALL_STATUS_CHANGED_SUBSCRIPTION = gql`
  subscription CallStatusChanged($callId: ID) {
    callStatusChanged(callId: $callId) {
      id
      status
      endTime
      duration
    }
  }
`;

// Requête pour récupérer les messages vocaux
export const GET_VOICE_MESSAGES_QUERY = gql`
  query GetVoiceMessages {
    getVoiceMessages {
      id
      caller {
        id
        username
        image
      }
      recipient {
        id
        username
        image
      }
      type
      status
      startTime
      endTime
      duration
      conversationId
      metadata
    }
  }
`;
