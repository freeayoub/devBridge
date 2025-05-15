import { Injectable, NgZone, OnDestroy } from '@angular/core';
import { Apollo } from 'apollo-angular';
import {
  BehaviorSubject,
  Observable,
  Subscription,
  throwError,
  of,
  from,
} from 'rxjs';
import { map, catchError, tap, filter, switchMap } from 'rxjs/operators';
import {
  CALL_HISTORY_QUERY,
  CALL_DETAILS_QUERY,
  CALL_STATS_QUERY,
  INITIATE_CALL_MUTATION,
  SEND_CALL_SIGNAL_MUTATION,
  ACCEPT_CALL_MUTATION,
  REJECT_CALL_MUTATION,
  END_CALL_MUTATION,
  TOGGLE_CALL_MEDIA_MUTATION,
  CALL_SIGNAL_SUBSCRIPTION,
  INCOMING_CALL_SUBSCRIPTION,
  CALL_STATUS_CHANGED_SUBSCRIPTION,
} from '../graphql/call.graphql';
import { LoggerService } from './logger.service';
import { SoundService } from './sound.service';

// Interfaces pour les appels
export enum CallType {
  AUDIO = 'AUDIO',
  VIDEO = 'VIDEO',
  VIDEO_ONLY = 'VIDEO_ONLY',
}

export enum CallStatus {
  RINGING = 'RINGING',
  CONNECTED = 'CONNECTED',
  ENDED = 'ENDED',
  MISSED = 'MISSED',
  REJECTED = 'REJECTED',
  FAILED = 'FAILED',
}

export interface User {
  id: string;
  username: string;
  email?: string;
  image?: string;
  isOnline?: boolean;
}

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

export interface CallSignal {
  callId: string;
  senderId: string;
  type: string;
  data: string;
  timestamp: string;
}

export interface IncomingCall {
  id: string;
  caller: User;
  type: CallType;
  conversationId?: string;
  offer: string;
  timestamp: string;
}

export interface CallOptions {
  enableVideo?: boolean;
  enableAudio?: boolean;
  quality?: string;
}

export interface CallFeedback {
  quality?: number;
  issues?: string[];
  comment?: string;
}

export interface CallSuccess {
  success: boolean;
  message?: string;
}

@Injectable({
  providedIn: 'root',
})
export class CallService implements OnDestroy {
  // État des appels
  private activeCall = new BehaviorSubject<Call | null>(null);
  private incomingCall = new BehaviorSubject<IncomingCall | null>(null);
  private callSignals = new BehaviorSubject<CallSignal | null>(null);
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private peerConnection: RTCPeerConnection | null = null;
  private subscriptions: Subscription[] = [];

  // Observables publics
  public activeCall$ = this.activeCall.asObservable();
  public incomingCall$ = this.incomingCall.asObservable();
  public callSignals$ = this.callSignals.asObservable();
  public localStream$ = new BehaviorSubject<MediaStream | null>(null);
  public remoteStream$ = new BehaviorSubject<MediaStream | null>(null);

  // Configuration WebRTC
  private readonly rtcConfig: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ],
  };

  constructor(
    private apollo: Apollo,
    private logger: LoggerService,
    private soundService: SoundService,
    private ngZone: NgZone
  ) {
    this.initSubscriptions();
  }

  // Initialisation des abonnements GraphQL
  private initSubscriptions(): void {
    // Abonnement aux appels entrants
    const incomingCallSub = this.apollo
      .subscribe<{ incomingCall: IncomingCall }>({
        query: INCOMING_CALL_SUBSCRIPTION,
      })
      .subscribe({
        next: ({ data }) => {
          if (data?.incomingCall) {
            this.ngZone.run(() => {
              this.handleIncomingCall(data.incomingCall);
            });
          }
        },
        error: (error) => {
          this.logger.error('Error in incoming call subscription', error);
        },
      });

    this.subscriptions.push(incomingCallSub);
  }

  // Gestion des appels entrants
  private handleIncomingCall(call: IncomingCall): void {
    this.logger.debug('Incoming call received', call);
    this.incomingCall.next(call);
    this.soundService.play('ringtone', true);
  }

  // Abonnement aux signaux d'appel
  subscribeToCallSignals(callId: string): Observable<CallSignal> {
    return this.apollo
      .subscribe<{ callSignal: CallSignal }>({
        query: CALL_SIGNAL_SUBSCRIPTION,
        variables: { callId },
      })
      .pipe(
        map(({ data }) => {
          if (!data?.callSignal) {
            throw new Error('No call signal received');
          }
          return data.callSignal;
        }),
        tap((signal) => {
          this.callSignals.next(signal);
          this.handleCallSignal(signal);
        }),
        catchError((error) => {
          this.logger.error('Error in call signal subscription', error);
          return throwError(() => new Error('Call signal subscription failed'));
        })
      );
  }

  // Gestion des signaux d'appel
  private handleCallSignal(signal: CallSignal): void {
    switch (signal.type) {
      case 'ice-candidate':
        this.handleIceCandidate(signal);
        break;
      case 'answer':
        this.handleAnswer(signal);
        break;
      case 'end-call':
        this.handleEndCall(signal);
        break;
      case 'reject':
        this.handleRejectCall(signal);
        break;
      default:
        this.logger.debug(`Unhandled signal type: ${signal.type}`, signal);
    }
  }

  // Gestion des candidats ICE
  private handleIceCandidate(signal: CallSignal): void {
    if (!this.peerConnection) {
      this.logger.error('No peer connection available for ICE candidate');
      return;
    }

    try {
      const candidate = JSON.parse(signal.data);
      this.peerConnection
        .addIceCandidate(new RTCIceCandidate(candidate))
        .catch((error) => {
          this.logger.error('Error adding ICE candidate', error as Error);
        });
    } catch (error) {
      this.logger.error('Error parsing ICE candidate', error as Error);
    }
  }

  // Gestion des réponses SDP
  private handleAnswer(signal: CallSignal): void {
    if (!this.peerConnection) {
      this.logger.error('No peer connection available for answer');
      return;
    }

    try {
      const answer = JSON.parse(signal.data);
      this.peerConnection
        .setRemoteDescription(new RTCSessionDescription(answer))
        .catch((error) => {
          this.logger.error('Error setting remote description', error as Error);
        });
    } catch (error) {
      this.logger.error('Error parsing answer', error as Error);
    }
  }

  // Gestion de la fin d'appel
  private handleEndCall(signal: CallSignal): void {
    this.soundService.stop('ringtone');
    this.cleanupCall();

    // Mettre à jour l'état de l'appel actif
    const currentCall = this.activeCall.value;
    if (currentCall && currentCall.id === signal.callId) {
      this.activeCall.next({
        ...currentCall,
        status: CallStatus.ENDED,
        endTime: new Date().toISOString(),
      });
    }
  }

  // Gestion du rejet d'appel
  private handleRejectCall(signal: CallSignal): void {
    this.soundService.stop('ringtone');
    this.cleanupCall();

    // Mettre à jour l'état de l'appel actif
    const currentCall = this.activeCall.value;
    if (currentCall && currentCall.id === signal.callId) {
      this.activeCall.next({
        ...currentCall,
        status: CallStatus.REJECTED,
        endTime: new Date().toISOString(),
      });
    }
  }

  // Nettoyage des ressources d'appel
  private cleanupCall(): void {
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
      this.localStream$.next(null);
    }

    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    this.remoteStream = null;
    this.remoteStream$.next(null);
  }

  // Méthodes publiques pour les appels
  // Initier un appel
  initiateCall(
    recipientId: string,
    callType: CallType,
    conversationId?: string,
    options?: CallOptions
  ): Observable<Call> {
    return this.setupMediaDevices(callType).pipe(
      switchMap((stream) => {
        this.localStream = stream;
        this.localStream$.next(stream);

        // Créer une connexion peer
        this.peerConnection = new RTCPeerConnection(this.rtcConfig);

        // Ajouter les pistes audio/vidéo
        stream.getTracks().forEach((track) => {
          this.peerConnection!.addTrack(track, stream);
        });

        // Écouter les candidats ICE
        this.peerConnection.onicecandidate = (event) => {
          if (event.candidate) {
            this.sendCallSignal(
              this.generateCallId(),
              'ice-candidate',
              JSON.stringify(event.candidate)
            );
          }
        };

        // Écouter les pistes distantes
        this.peerConnection.ontrack = (event) => {
          if (!this.remoteStream) {
            this.remoteStream = new MediaStream();
            this.remoteStream$.next(this.remoteStream);
          }
          event.streams[0].getTracks().forEach((track) => {
            this.remoteStream!.addTrack(track);
          });
        };

        // Créer l'offre SDP
        return from(this.peerConnection.createOffer()).pipe(
          switchMap((offer) => {
            return from(this.peerConnection!.setLocalDescription(offer)).pipe(
              map(() => offer)
            );
          })
        );
      }),
      switchMap((offer) => {
        // Générer un ID d'appel unique
        const callId = this.generateCallId();

        // Envoyer l'offre au serveur
        return this.apollo
          .mutate<{ initiateCall: Call }>({
            mutation: INITIATE_CALL_MUTATION,
            variables: {
              recipientId,
              callType,
              callId,
              offer: JSON.stringify(offer),
              conversationId,
              options,
            },
          })
          .pipe(
            map((result) => {
              const call = result.data?.initiateCall;
              if (!call) {
                throw new Error('Failed to initiate call');
              }

              // Mettre à jour l'état de l'appel actif
              this.activeCall.next(call);

              // S'abonner aux signaux d'appel
              const signalSub = this.subscribeToCallSignals(
                call.id
              ).subscribe();
              this.subscriptions.push(signalSub);

              return call;
            })
          );
      }),
      catchError((error) => {
        this.logger.error('Error initiating call', error);
        this.cleanupCall();
        return throwError(() => new Error('Failed to initiate call'));
      })
    );
  }

  // Accepter un appel entrant
  acceptCall(incomingCall: IncomingCall): Observable<Call> {
    this.soundService.stop('ringtone');

    return this.setupMediaDevices(incomingCall.type).pipe(
      switchMap((stream) => {
        this.localStream = stream;
        this.localStream$.next(stream);

        // Créer une connexion peer
        this.peerConnection = new RTCPeerConnection(this.rtcConfig);

        // Ajouter les pistes audio/vidéo
        stream.getTracks().forEach((track) => {
          this.peerConnection!.addTrack(track, stream);
        });

        // Écouter les candidats ICE
        this.peerConnection.onicecandidate = (event) => {
          if (event.candidate) {
            this.sendCallSignal(
              incomingCall.id,
              'ice-candidate',
              JSON.stringify(event.candidate)
            );
          }
        };

        // Écouter les pistes distantes
        this.peerConnection.ontrack = (event) => {
          if (!this.remoteStream) {
            this.remoteStream = new MediaStream();
            this.remoteStream$.next(this.remoteStream);
          }
          event.streams[0].getTracks().forEach((track) => {
            this.remoteStream!.addTrack(track);
          });
        };

        // Définir l'offre distante
        const offer = JSON.parse(incomingCall.offer);
        return from(
          this.peerConnection.setRemoteDescription(
            new RTCSessionDescription(offer)
          )
        ).pipe(
          switchMap(() => from(this.peerConnection!.createAnswer())),
          switchMap((answer) => {
            return from(this.peerConnection!.setLocalDescription(answer)).pipe(
              map(() => answer)
            );
          })
        );
      }),
      switchMap((answer) => {
        // Envoyer la réponse au serveur
        return this.apollo
          .mutate<{ acceptCall: Call }>({
            mutation: ACCEPT_CALL_MUTATION,
            variables: {
              callId: incomingCall.id,
              answer: JSON.stringify(answer),
            },
          })
          .pipe(
            map((result) => {
              const call = result.data?.acceptCall;
              if (!call) {
                throw new Error('Failed to accept call');
              }

              // Mettre à jour l'état de l'appel actif
              this.activeCall.next({
                ...call,
                caller: incomingCall.caller,
                type: incomingCall.type,
                conversationId: incomingCall.conversationId,
              });

              // S'abonner aux signaux d'appel
              const signalSub = this.subscribeToCallSignals(
                incomingCall.id
              ).subscribe();
              this.subscriptions.push(signalSub);

              // Effacer l'appel entrant
              this.incomingCall.next(null);

              return call;
            })
          );
      }),
      catchError((error) => {
        this.logger.error('Error accepting call', error);
        this.cleanupCall();
        return throwError(() => new Error('Failed to accept call'));
      })
    );
  }

  // Rejeter un appel entrant
  rejectCall(callId: string, reason?: string): Observable<Call> {
    this.soundService.stop('ringtone');

    return this.apollo
      .mutate<{ rejectCall: Call }>({
        mutation: REJECT_CALL_MUTATION,
        variables: {
          callId,
          reason,
        },
      })
      .pipe(
        map((result) => {
          const call = result.data?.rejectCall;
          if (!call) {
            throw new Error('Failed to reject call');
          }

          // Effacer l'appel entrant
          this.incomingCall.next(null);

          return call;
        }),
        catchError((error) => {
          this.logger.error('Error rejecting call', error);
          return throwError(() => new Error('Failed to reject call'));
        })
      );
  }

  // Terminer un appel en cours
  endCall(callId: string, feedback?: CallFeedback): Observable<Call> {
    this.soundService.stop('ringtone');

    return this.apollo
      .mutate<{ endCall: Call }>({
        mutation: END_CALL_MUTATION,
        variables: {
          callId,
          feedback,
        },
      })
      .pipe(
        map((result) => {
          const call = result.data?.endCall;
          if (!call) {
            throw new Error('Failed to end call');
          }

          // Nettoyer les ressources
          this.cleanupCall();

          // Mettre à jour l'état de l'appel actif
          this.activeCall.next(null);

          return call;
        }),
        catchError((error) => {
          this.logger.error('Error ending call', error);
          this.cleanupCall();
          return throwError(() => new Error('Failed to end call'));
        })
      );
  }

  // Basculer la caméra ou le micro
  toggleMedia(
    callId: string,
    video?: boolean,
    audio?: boolean
  ): Observable<CallSuccess> {
    if (this.localStream) {
      // Mettre à jour les pistes locales
      if (video !== undefined) {
        this.localStream.getVideoTracks().forEach((track) => {
          track.enabled = video;
        });
      }

      if (audio !== undefined) {
        this.localStream.getAudioTracks().forEach((track) => {
          track.enabled = audio;
        });
      }
    }

    return this.apollo
      .mutate<{ toggleCallMedia: CallSuccess }>({
        mutation: TOGGLE_CALL_MEDIA_MUTATION,
        variables: {
          callId,
          video,
          audio,
        },
      })
      .pipe(
        map((result) => {
          const success = result.data?.toggleCallMedia;
          if (!success) {
            throw new Error('Failed to toggle media');
          }
          return success;
        }),
        catchError((error) => {
          this.logger.error('Error toggling media', error);
          return throwError(() => new Error('Failed to toggle media'));
        })
      );
  }

  // Envoyer un signal d'appel
  sendCallSignal(
    callId: string,
    signalType: string,
    signalData: string
  ): Observable<CallSuccess> {
    return this.apollo
      .mutate<{ sendCallSignal: CallSuccess }>({
        mutation: SEND_CALL_SIGNAL_MUTATION,
        variables: {
          callId,
          signalType,
          signalData,
        },
      })
      .pipe(
        map((result) => {
          const success = result.data?.sendCallSignal;
          if (!success) {
            throw new Error('Failed to send call signal');
          }
          return success;
        }),
        catchError((error) => {
          this.logger.error('Error sending call signal', error);
          return throwError(() => new Error('Failed to send call signal'));
        })
      );
  }

  // Récupérer l'historique des appels
  getCallHistory(options?: {
    limit?: number;
    offset?: number;
    status?: CallStatus[];
    type?: CallType[];
    startDate?: string;
    endDate?: string;
  }): Observable<Call[]> {
    return this.apollo
      .watchQuery<{ callHistory: Call[] }>({
        query: CALL_HISTORY_QUERY,
        variables: options,
        fetchPolicy: 'network-only',
      })
      .valueChanges.pipe(
        map((result) => result.data.callHistory || []),
        catchError((error) => {
          this.logger.error('Error fetching call history', error);
          return throwError(() => new Error('Failed to fetch call history'));
        })
      );
  }

  // Récupérer les détails d'un appel
  getCallDetails(callId: string): Observable<Call> {
    return this.apollo
      .watchQuery<{ callDetails: Call }>({
        query: CALL_DETAILS_QUERY,
        variables: { callId },
        fetchPolicy: 'network-only',
      })
      .valueChanges.pipe(
        map((result) => {
          const call = result.data.callDetails;
          if (!call) {
            throw new Error('Call not found');
          }
          return call;
        }),
        catchError((error) => {
          this.logger.error('Error fetching call details', error);
          return throwError(() => new Error('Failed to fetch call details'));
        })
      );
  }

  // Configurer les périphériques média
  private setupMediaDevices(callType: CallType): Observable<MediaStream> {
    const constraints: MediaStreamConstraints = {
      audio: true,
      video:
        callType !== CallType.AUDIO
          ? {
              width: { ideal: 1280 },
              height: { ideal: 720 },
            }
          : false,
    };

    return new Observable<MediaStream>((observer) => {
      navigator.mediaDevices
        .getUserMedia(constraints)
        .then((stream) => {
          observer.next(stream);
          observer.complete();
        })
        .catch((error) => {
          this.logger.error('Error accessing media devices', error);
          observer.error(new Error('Failed to access media devices'));
        });
    });
  }

  // Générer un ID d'appel unique
  private generateCallId(): string {
    return Date.now().toString() + Math.random().toString(36).substring(2, 9);
  }

  // Nettoyage lors de la destruction du service
  ngOnDestroy(): void {
    this.cleanupCall();
    this.subscriptions.forEach((sub) => sub.unsubscribe());
    this.subscriptions = [];
  }
}
