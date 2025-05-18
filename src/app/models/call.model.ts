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
 * Interface pour un utilisateur dans le contexte d'un appel
 */
export interface User {
  id: string;
  username: string;
  email?: string;
  image?: string;
  isOnline?: boolean;
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
