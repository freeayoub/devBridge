import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { CallService, IncomingCall, CallType } from '../../services/call.service';
import { LoggerService } from '../../services/logger.service';

@Component({
  selector: 'app-incoming-call',
  templateUrl: './incoming-call.component.html',
  styleUrls: ['./incoming-call.component.css']
})
export class IncomingCallComponent implements OnInit, OnDestroy {
  incomingCall: IncomingCall | null = null;
  private subscriptions: Subscription[] = [];

  constructor(
    private callService: CallService,
    private logger: LoggerService
  ) { }

  ngOnInit(): void {
    // S'abonner aux appels entrants
    const incomingCallSub = this.callService.incomingCall$.subscribe(call => {
      this.incomingCall = call;
      if (call) {
        this.logger.debug('Displaying incoming call UI', { callId: call.id, caller: call.caller.username });
      }
    });
    
    this.subscriptions.push(incomingCallSub);
  }

  // Accepter l'appel
  acceptCall(): void {
    if (!this.incomingCall) {
      return;
    }
    
    this.logger.debug('Accepting call', { callId: this.incomingCall.id });
    
    this.callService.acceptCall(this.incomingCall).subscribe({
      next: (call) => {
        this.logger.debug('Call accepted successfully', { callId: call.id });
      },
      error: (error) => {
        this.logger.error('Error accepting call', error);
      }
    });
  }

  // Rejeter l'appel
  rejectCall(): void {
    if (!this.incomingCall) {
      return;
    }
    
    this.logger.debug('Rejecting call', { callId: this.incomingCall.id });
    
    this.callService.rejectCall(this.incomingCall.id).subscribe({
      next: (call) => {
        this.logger.debug('Call rejected successfully', { callId: call.id });
      },
      error: (error) => {
        this.logger.error('Error rejecting call', error);
      }
    });
  }

  // Obtenir le type d'appel sous forme de texte
  getCallTypeText(): string {
    if (!this.incomingCall) {
      return '';
    }
    
    switch (this.incomingCall.type) {
      case CallType.AUDIO:
        return 'Appel audio';
      case CallType.VIDEO:
        return 'Appel vidéo';
      case CallType.VIDEO_ONLY:
        return 'Appel vidéo (sans audio)';
      default:
        return 'Appel';
    }
  }

  // Obtenir l'icône du type d'appel
  getCallTypeIcon(): string {
    if (!this.incomingCall) {
      return 'phone';
    }
    
    switch (this.incomingCall.type) {
      case CallType.AUDIO:
        return 'phone';
      case CallType.VIDEO:
      case CallType.VIDEO_ONLY:
        return 'video';
      default:
        return 'phone';
    }
  }

  ngOnDestroy(): void {
    // Nettoyer les abonnements
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }
}
