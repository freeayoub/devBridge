import {
  Component,
  OnInit,
  OnDestroy,
  ViewChild,
  ElementRef,
  AfterViewInit,
} from '@angular/core';
import { Subscription } from 'rxjs';
import { Call, CallType, CallStatus } from '../../models/message.model';
import { MessageService } from '../../services/message.service';
import { LoggerService } from '../../services/logger.service';

@Component({
  selector: 'app-active-call',
  templateUrl: './active-call.component.html',
  styleUrls: ['./active-call.component.css'],
})
export class ActiveCallComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('localVideo') localVideo!: ElementRef<HTMLVideoElement>;
  @ViewChild('remoteVideo') remoteVideo!: ElementRef<HTMLVideoElement>;

  activeCall: Call | null = null;
  callDuration: string = '00:00';
  isAudioMuted: boolean = false;
  isVideoMuted: boolean = false;
  isSpeakerOn: boolean = true;

  private durationInterval: any;
  private callStartTime: Date | null = null;
  private subscriptions: Subscription[] = [];

  // Exposer les énums au template
  CallType = CallType;
  CallStatus = CallStatus;

  constructor(
    private messageService: MessageService,
    private logger: LoggerService
  ) {}

  ngOnInit(): void {
    // S'abonner à l'appel actif
    const activeCallSub = this.messageService.activeCall$.subscribe((call) => {
      const previousCall = this.activeCall;
      this.activeCall = call;

      if (call && call.status === CallStatus.CONNECTED) {
        if (!previousCall || previousCall.id !== call.id) {
          // Nouvel appel connecté
          this.startCallTimer();
        }
      } else if (!call || call.status !== CallStatus.CONNECTED) {
        // Appel terminé ou non connecté
        this.stopCallTimer();
      }
    });

    this.subscriptions.push(activeCallSub);

    // S'abonner au flux local
    const localStreamSub = this.messageService.localStream$.subscribe(
      (stream) => {
        if (stream && this.localVideo?.nativeElement) {
          this.localVideo.nativeElement.srcObject = stream;
        }
      }
    );

    this.subscriptions.push(localStreamSub);

    // S'abonner au flux distant
    const remoteStreamSub = this.messageService.remoteStream$.subscribe(
      (stream) => {
        if (stream && this.remoteVideo?.nativeElement) {
          this.remoteVideo.nativeElement.srcObject = stream;
        }
      }
    );

    this.subscriptions.push(remoteStreamSub);
  }

  ngAfterViewInit(): void {
    // Configurer les éléments vidéo après le rendu du composant
    const localStream = this.messageService.localStream$.getValue();
    if (localStream && this.localVideo?.nativeElement) {
      this.localVideo.nativeElement.srcObject = localStream;
    }

    const remoteStream = this.messageService.remoteStream$.getValue();
    if (remoteStream && this.remoteVideo?.nativeElement) {
      this.remoteVideo.nativeElement.srcObject = remoteStream;
    }
  }

  // Démarrer le minuteur d'appel
  private startCallTimer(): void {
    this.callStartTime = new Date();
    this.stopCallTimer(); // Arrêter tout minuteur existant

    this.durationInterval = setInterval(() => {
      if (!this.callStartTime) return;

      const now = new Date();
      const diff = Math.floor(
        (now.getTime() - this.callStartTime.getTime()) / 1000
      );

      const minutes = Math.floor(diff / 60)
        .toString()
        .padStart(2, '0');
      const seconds = (diff % 60).toString().padStart(2, '0');

      this.callDuration = `${minutes}:${seconds}`;
    }, 1000);
  }

  // Arrêter le minuteur d'appel
  private stopCallTimer(): void {
    if (this.durationInterval) {
      clearInterval(this.durationInterval);
      this.durationInterval = null;
    }
  }

  // Terminer l'appel
  endCall(): void {
    if (!this.activeCall) {
      return;
    }

    this.logger.debug('Ending call', { callId: this.activeCall.id });

    this.messageService.endCall(this.activeCall.id).subscribe({
      next: (call) => {
        this.logger.debug('Call ended successfully', {
          callId: call.id,
          duration: call.duration,
        });
      },
      error: (error) => {
        this.logger.error('Error ending call', error);
      },
    });
  }

  // Basculer le micro
  toggleMicrophone(): void {
    if (!this.activeCall) {
      return;
    }

    this.isAudioMuted = !this.isAudioMuted;

    this.messageService
      .toggleMedia(this.activeCall.id, undefined, !this.isAudioMuted)
      .subscribe({
        next: (result) => {
          this.logger.debug('Microphone toggled', { muted: this.isAudioMuted });
        },
        error: (error) => {
          this.logger.error('Error toggling microphone', error);
          // Revenir à l'état précédent en cas d'erreur
          this.isAudioMuted = !this.isAudioMuted;
        },
      });
  }

  // Basculer la caméra
  toggleCamera(): void {
    if (!this.activeCall || this.activeCall.type === CallType.AUDIO) {
      return;
    }

    this.isVideoMuted = !this.isVideoMuted;

    this.messageService
      .toggleMedia(this.activeCall.id, !this.isVideoMuted, undefined)
      .subscribe({
        next: (result) => {
          this.logger.debug('Camera toggled', { muted: this.isVideoMuted });
        },
        error: (error) => {
          this.logger.error('Error toggling camera', error);
          // Revenir à l'état précédent en cas d'erreur
          this.isVideoMuted = !this.isVideoMuted;
        },
      });
  }

  // Basculer le haut-parleur
  toggleSpeaker(): void {
    this.isSpeakerOn = !this.isSpeakerOn;

    if (this.remoteVideo?.nativeElement) {
      this.remoteVideo.nativeElement.volume = this.isSpeakerOn ? 1 : 0;
    }

    this.logger.debug('Speaker toggled', { on: this.isSpeakerOn });
  }

  // Obtenir le nom de l'autre participant
  getOtherParticipantName(): string {
    if (!this.activeCall) {
      return '';
    }

    // Déterminer si l'utilisateur actuel est l'appelant ou le destinataire
    const currentUserId = localStorage.getItem('userId');
    const isCurrentUserCaller = this.activeCall.caller.id === currentUserId;

    return isCurrentUserCaller
      ? this.activeCall.recipient.username
      : this.activeCall.caller.username;
  }

  // Obtenir l'avatar de l'autre participant
  getOtherParticipantAvatar(): string {
    if (!this.activeCall) {
      return 'assets/images/default-avatar.png';
    }

    // Déterminer si l'utilisateur actuel est l'appelant ou le destinataire
    const currentUserId = localStorage.getItem('userId');
    const isCurrentUserCaller = this.activeCall.caller.id === currentUserId;

    const avatar = isCurrentUserCaller
      ? this.activeCall.recipient.image
      : this.activeCall.caller.image;

    return avatar || 'assets/images/default-avatar.png';
  }

  // Obtenir le statut de l'appel sous forme de texte
  getCallStatusText(): string {
    if (!this.activeCall) {
      return '';
    }

    switch (this.activeCall.status) {
      case CallStatus.RINGING:
        return 'Appel en cours...';
      case CallStatus.CONNECTED:
        return this.callDuration;
      case CallStatus.ENDED:
        return 'Appel terminé';
      case CallStatus.MISSED:
        return 'Appel manqué';
      case CallStatus.REJECTED:
        return 'Appel rejeté';
      case CallStatus.FAILED:
        return "Échec de l'appel";
      default:
        return '';
    }
  }

  // Vérifier si l'appel est connecté
  isCallConnected(): boolean {
    return this.activeCall?.status === CallStatus.CONNECTED;
  }

  // Vérifier si l'appel est en cours de sonnerie
  isCallRinging(): boolean {
    return this.activeCall?.status === CallStatus.RINGING;
  }

  // Vérifier si l'appel est un appel vidéo
  isVideoCall(): boolean {
    return (
      this.activeCall?.type === CallType.VIDEO ||
      this.activeCall?.type === CallType.VIDEO_ONLY
    );
  }

  ngOnDestroy(): void {
    // Nettoyer les abonnements et le minuteur
    this.stopCallTimer();
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }
}
