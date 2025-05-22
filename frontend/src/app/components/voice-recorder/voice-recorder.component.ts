import {
  Component,
  OnInit,
  OnDestroy,
  Output,
  EventEmitter,
  Input,
} from '@angular/core';
import { LoggerService } from '../../services/logger.service';

@Component({
  selector: 'app-voice-recorder',
  templateUrl: './voice-recorder.component.html',
  styleUrls: ['./voice-recorder.component.css'],
})
export class VoiceRecorderComponent implements OnInit, OnDestroy {
  @Output() recordingComplete = new EventEmitter<Blob>();
  @Output() recordingCancelled = new EventEmitter<void>();
  @Input() maxDuration = 60; // Durée maximale en secondes

  isRecording = false;
  recordingTime = 0;
  timerInterval: any;
  mediaRecorder: MediaRecorder | null = null;
  audioChunks: Blob[] = [];
  audioStream: MediaStream | null = null;

  // Exposer Math pour l'utiliser dans le template
  Math = Math;

  constructor(private logger: LoggerService) {}

  ngOnInit(): void {}

  ngOnDestroy(): void {
    this.stopRecording();
    this.stopMediaTracks();
  }

  /**
   * Démarre l'enregistrement vocal
   */
  async startRecording(): Promise<void> {
    try {
      this.audioChunks = [];
      this.recordingTime = 0;

      // Demander l'accès au microphone
      this.audioStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });

      // Créer un MediaRecorder
      this.mediaRecorder = new MediaRecorder(this.audioStream);

      // Configurer les gestionnaires d'événements
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        // Créer un blob à partir des chunks audio
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        this.recordingComplete.emit(audioBlob);
        this.stopMediaTracks();
      };

      // Démarrer l'enregistrement
      this.mediaRecorder.start();
      this.isRecording = true;

      // Démarrer le timer
      this.startTimer();

      // Arrêter automatiquement après la durée maximale
      setTimeout(() => {
        if (this.isRecording) {
          this.stopRecording();
        }
      }, this.maxDuration * 1000);
    } catch (error) {
      this.logger.error('Error starting voice recording:', error);
      this.isRecording = false;
    }
  }

  /**
   * Arrête l'enregistrement vocal
   */
  stopRecording(): void {
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop();
      this.isRecording = false;
      this.stopTimer();
    }
  }

  /**
   * Annule l'enregistrement vocal
   */
  cancelRecording(): void {
    this.stopRecording();
    this.stopMediaTracks();
    this.recordingCancelled.emit();
  }

  /**
   * Démarre le timer pour afficher la durée d'enregistrement
   */
  private startTimer(): void {
    this.stopTimer();
    this.timerInterval = setInterval(() => {
      this.recordingTime++;

      // Arrêter si on atteint la durée maximale
      if (this.recordingTime >= this.maxDuration) {
        this.stopRecording();
      }
    }, 1000);
  }

  /**
   * Arrête le timer
   */
  private stopTimer(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  /**
   * Arrête les pistes média pour libérer le microphone
   */
  private stopMediaTracks(): void {
    if (this.audioStream) {
      this.audioStream.getTracks().forEach((track) => track.stop());
      this.audioStream = null;
    }
  }

  /**
   * Formate le temps d'enregistrement en MM:SS
   */
  get formattedTime(): string {
    const minutes = Math.floor(this.recordingTime / 60);
    const seconds = this.recordingTime % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds
      .toString()
      .padStart(2, '0')}`;
  }
}
