import {
  Component,
  OnInit,
  OnDestroy,
  Input,
  Output,
  EventEmitter,
  ViewChild,
  ElementRef,
  ChangeDetectorRef,
} from '@angular/core';
import { Subscription } from 'rxjs';
import { MessageService } from '../../../../services/message.service';
import { ToastService } from '../../../../services/toast.service';
import { Call, CallType, User } from '../../../../models/message.model';

@Component({
  selector: 'app-call-interface',
  templateUrl: './call-interface.component.html',
  styleUrls: ['./call-interface.component.css'],
})
export class CallInterfaceComponent implements OnInit, OnDestroy {
  @Input() activeCall: Call | null = null;
  @Input() isVisible: boolean = false;
  @Input() callType: 'VIDEO' | 'AUDIO' | null = null;
  @Input() otherParticipant: User | null = null;

  @Output() callEnded = new EventEmitter<void>();
  @Output() callAccepted = new EventEmitter<Call>();
  @Output() callRejected = new EventEmitter<void>();

  // Références aux éléments vidéo
  @ViewChild('localVideo', { static: false })
  localVideoRef!: ElementRef<HTMLVideoElement>;
  @ViewChild('remoteVideo', { static: false })
  remoteVideoRef!: ElementRef<HTMLVideoElement>;

  // État de l'appel
  isConnected = false;
  isIncoming = false;
  isOutgoing = false;
  callDuration = 0;
  callStatus = 'Connexion...';

  // Contrôles
  isMuted = false;
  isVideoEnabled = true;
  isSpeakerOn = false;
  isFullscreen = false;

  // Streams
  localStream: MediaStream | null = null;
  remoteStream: MediaStream | null = null;

  // Timer
  private callTimer: any = null;
  private subscriptions = new Subscription();

  // Types pour le template
  CallType = CallType;

  constructor(
    private messageService: MessageService,
    private toastService: ToastService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.setupCallSubscriptions();
    this.initializeMediaDevices();
  }

  ngOnDestroy(): void {
    this.cleanup();
  }

  private setupCallSubscriptions(): void {
    // S'abonner aux changements d'état d'appel
    this.subscriptions.add(
      this.messageService.activeCall$.subscribe({
        next: (call) => {
          if (call) {
            this.activeCall = call;
            this.updateCallStatus();
            this.cdr.detectChanges();
          }
        },
        error: (error) => {
          console.error('❌ Error in active call subscription:', error);
        },
      })
    );

    // S'abonner aux streams
    this.subscriptions.add(
      this.messageService.localStream$.subscribe({
        next: (stream) => {
          this.localStream = stream;
          this.attachLocalStream();
        },
      })
    );

    this.subscriptions.add(
      this.messageService.remoteStream$.subscribe({
        next: (stream) => {
          this.remoteStream = stream;
          this.attachRemoteStream();
        },
      })
    );
  }

  private async initializeMediaDevices(): Promise<void> {
    if (!this.activeCall) return;

    try {
      const constraints = {
        audio: true,
        video: this.callType === 'VIDEO',
      };

      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      this.attachLocalStream();

      console.log('✅ Media devices initialized');
    } catch (error) {
      console.error('❌ Error accessing media devices:', error);
      this.toastService.showError("Erreur d'accès à la caméra/micro");
    }
  }

  private attachLocalStream(): void {
    if (this.localStream && this.localVideoRef?.nativeElement) {
      this.localVideoRef.nativeElement.srcObject = this.localStream;
      this.localVideoRef.nativeElement.muted = true; // Éviter l'écho
    }
  }

  private attachRemoteStream(): void {
    if (this.remoteStream && this.remoteVideoRef?.nativeElement) {
      this.remoteVideoRef.nativeElement.srcObject = this.remoteStream;
    }
  }

  private updateCallStatus(): void {
    if (!this.activeCall) return;

    switch (this.activeCall.status as string) {
      case 'ringing':
        this.callStatus = this.isIncoming
          ? 'Appel entrant...'
          : 'Appel en cours...';
        break;
      case 'accepted':
        this.callStatus = 'Connexion...';
        break;
      case 'connected':
        this.callStatus = 'Connecté';
        this.isConnected = true;
        this.startCallTimer();
        break;
      case 'ended':
        this.callStatus = 'Appel terminé';
        this.endCall();
        break;
      case 'rejected':
        this.callStatus = 'Appel rejeté';
        this.endCall();
        break;
      default:
        this.callStatus = 'En cours...';
    }
  }

  private startCallTimer(): void {
    this.callDuration = 0;
    this.callTimer = setInterval(() => {
      this.callDuration++;
      this.cdr.detectChanges();
    }, 1000);
  }

  // === CONTRÔLES D'APPEL ===
  toggleMute(): void {
    if (!this.activeCall) return;

    this.isMuted = !this.isMuted;

    // Couper/activer le micro dans le stream local
    if (this.localStream) {
      const audioTracks = this.localStream.getAudioTracks();
      audioTracks.forEach((track) => {
        track.enabled = !this.isMuted;
      });
    }

    // Notifier via le service
    this.messageService
      .toggleMedia(this.activeCall.id, undefined, !this.isMuted)
      .subscribe({
        next: () => {
          this.toastService.showSuccess(
            this.isMuted ? 'Micro coupé' : 'Micro activé'
          );
        },
        error: (error) => {
          console.error('❌ Error toggling mute:', error);
          // Revert state on error
          this.isMuted = !this.isMuted;
          if (this.localStream) {
            const audioTracks = this.localStream.getAudioTracks();
            audioTracks.forEach((track) => {
              track.enabled = !this.isMuted;
            });
          }
        },
      });
  }

  toggleVideo(): void {
    if (!this.activeCall || this.callType !== 'VIDEO') return;

    this.isVideoEnabled = !this.isVideoEnabled;

    // Couper/activer la vidéo dans le stream local
    if (this.localStream) {
      const videoTracks = this.localStream.getVideoTracks();
      videoTracks.forEach((track) => {
        track.enabled = this.isVideoEnabled;
      });
    }

    // Notifier via le service
    this.messageService
      .toggleMedia(this.activeCall.id, this.isVideoEnabled, undefined)
      .subscribe({
        next: () => {
          this.toastService.showSuccess(
            this.isVideoEnabled ? 'Caméra activée' : 'Caméra désactivée'
          );
        },
        error: (error) => {
          console.error('❌ Error toggling video:', error);
          // Revert state on error
          this.isVideoEnabled = !this.isVideoEnabled;
          if (this.localStream) {
            const videoTracks = this.localStream.getVideoTracks();
            videoTracks.forEach((track) => {
              track.enabled = this.isVideoEnabled;
            });
          }
        },
      });
  }

  toggleSpeaker(): void {
    this.isSpeakerOn = !this.isSpeakerOn;

    if (this.remoteVideoRef?.nativeElement) {
      // Changer la sortie audio (si supporté par le navigateur)
      this.remoteVideoRef.nativeElement.volume = this.isSpeakerOn ? 1 : 0.7;
    }

    this.toastService.showSuccess(
      this.isSpeakerOn ? 'Haut-parleur activé' : 'Haut-parleur désactivé'
    );
  }

  toggleFullscreen(): void {
    this.isFullscreen = !this.isFullscreen;

    if (this.isFullscreen && this.remoteVideoRef?.nativeElement) {
      this.remoteVideoRef.nativeElement.requestFullscreen?.();
    } else if (document.fullscreenElement) {
      document.exitFullscreen?.();
    }
  }

  acceptCall(): void {
    if (!this.activeCall) return;

    this.callAccepted.emit(this.activeCall);
  }

  rejectCall(): void {
    this.callRejected.emit();
  }

  endCall(): void {
    this.cleanup();
    this.callEnded.emit();
  }

  private cleanup(): void {
    // Arrêter le timer
    if (this.callTimer) {
      clearInterval(this.callTimer);
      this.callTimer = null;
    }

    // Arrêter les streams
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }

    if (this.remoteStream) {
      this.remoteStream.getTracks().forEach((track) => track.stop());
      this.remoteStream = null;
    }

    // Nettoyer les subscriptions
    this.subscriptions.unsubscribe();

    // Réinitialiser l'état
    this.isConnected = false;
    this.callDuration = 0;
    this.isMuted = false;
    this.isVideoEnabled = true;
    this.isSpeakerOn = false;
    this.isFullscreen = false;
  }

  // === UTILITAIRES ===
  formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs
      .toString()
      .padStart(2, '0')}`;
  }

  getCallTypeIcon(): string {
    return this.callType === 'VIDEO' ? 'videocam' : 'call';
  }

  getCallTypeLabel(): string {
    return this.callType === 'VIDEO' ? 'Appel vidéo' : 'Appel audio';
  }
}
