import { gql } from 'apollo-angular';

// Call Queries
export const CALL_HISTORY_QUERY = gql`
  query CallHistory($limit: Int, $offset: Int, $status: [CallStatus], $type: [CallType], $startDate: String, $endDate: String) {
    callHistory(limit: $limit, offset: $offset, status: $status, type: $type, startDate: $startDate, endDate: $endDate) {
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
  mutation InitiateCall($recipientId: ID!, $callType: CallType!, $callId: String!, $offer: String!, $conversationId: ID, $options: CallOptions) {
    initiateCall(recipientId: $recipientId, callType: $callType, callId: $callId, offer: $offer, conversationId: $conversationId, options: $options) {
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
  mutation SendCallSignal($callId: ID!, $signalType: String!, $signalData: String!) {
    sendCallSignal(callId: $callId, signalType: $signalType, signalData: $signalData) {
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
