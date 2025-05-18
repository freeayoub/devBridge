import {
  Component,
  OnInit,
  OnDestroy,
  Input,
  ElementRef,
  ViewChild,
  HostBinding,
  Renderer2,
  ChangeDetectorRef,
  AfterViewInit,
} from '@angular/core';
import { LoggerService } from '../../services/logger.service';

@Component({
  selector: 'app-voice-message-player',
  templateUrl: './voice-message-player.component.html',
  styleUrls: ['./voice-message-player.component.css'],
})
export class VoiceMessagePlayerComponent
  implements OnInit, OnDestroy, AfterViewInit
{
  @Input() audioUrl: string = '';
  @Input() duration: number = 0;
  @ViewChild('audioPlayer') audioPlayerRef!: ElementRef<HTMLAudioElement>;

  // Ajouter une classe CSS lorsque l'audio est en lecture
  @HostBinding('class.is-playing') get playingClass() {
    return this.isPlaying;
  }

  isPlaying = false;
  currentTime = 0;
  progressInterval: any;

  // Tableau des indices pour les barres de l'onde sonore
  waveformBars: number[] = Array.from({ length: 27 }, (_, i) => i);

  // Hauteurs pré-calculées pour les barres de l'onde sonore (style Messenger)
  private barHeights: number[] = [];

  constructor(
    private logger: LoggerService,
    private renderer: Renderer2,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Générer des hauteurs aléatoires pour les barres de l'onde sonore
    this.generateWaveformPattern();

    // Appliquer les styles immédiatement
    this.applyMessengerStyles();

    // Forcer la détection des changements immédiatement
    this.cdr.detectChanges();
  }

  ngAfterViewInit(): void {
    // Forcer la détection des changements après le rendu initial
    setTimeout(() => {
      this.applyMessengerStyles();
      this.cdr.detectChanges();
    }, 0);

    // Vérifier si l'audio est chargé
    if (this.audioPlayerRef?.nativeElement) {
      this.audioPlayerRef.nativeElement.onloadedmetadata = () => {
        this.logger.debug('Audio metadata loaded');
        this.cdr.detectChanges();
      };
    }
  }

  ngOnDestroy(): void {
    this.stopProgressTracking();
  }

  /**
   * Applique les styles Messenger directement aux éléments DOM
   * pour s'assurer qu'ils sont appliqués immédiatement sans rechargement
   */
  private applyMessengerStyles(): void {
    try {
      // Appliquer les styles directement via le renderer pour contourner les problèmes de rafraîchissement
      if (this.audioPlayerRef?.nativeElement) {
        this.renderer.setStyle(
          this.audioPlayerRef.nativeElement,
          'outline',
          'none'
        );
        this.renderer.setStyle(
          this.audioPlayerRef.nativeElement,
          'border',
          'none'
        );
        this.renderer.setStyle(
          this.audioPlayerRef.nativeElement,
          'box-shadow',
          'none'
        );
      }

      // Forcer la détection des changements
      this.cdr.detectChanges();
    } catch (error) {
      this.logger.error('Error applying Messenger styles:', error);
    }
  }

  /**
   * Génère un motif d'onde sonore pseudo-aléatoire mais cohérent
   * similaire à celui de Messenger
   */
  private generateWaveformPattern(): void {
    // Réinitialiser les hauteurs
    this.barHeights = [];

    // Créer un motif avec des hauteurs variables (entre 4 et 20px)
    // Le motif est pseudo-aléatoire mais suit une courbe naturelle
    const basePattern = [
      8, 10, 14, 16, 18, 16, 12, 10, 8, 12, 16, 20, 18, 14, 10, 8, 10, 14, 18,
      16, 12, 8, 10, 14, 12, 8, 6,
    ];

    // Ajouter une légère variation aléatoire pour chaque barre
    for (let i = 0; i < 27; i++) {
      const baseHeight = basePattern[i] || 10;
      const variation = Math.floor(Math.random() * 5) - 2; // Variation de -2 à +2
      this.barHeights.push(Math.max(4, Math.min(20, baseHeight + variation)));
    }
  }

  /**
   * Retourne la hauteur d'une barre spécifique de l'onde sonore
   */
  getRandomBarHeight(index: number): number {
    return this.barHeights[index] || 10;
  }

  /**
   * Joue ou met en pause l'audio
   */
  togglePlay(): void {
    const audioPlayer = this.audioPlayerRef.nativeElement;

    if (this.isPlaying) {
      audioPlayer.pause();
      this.isPlaying = false;
      this.stopProgressTracking();
      this.cdr.detectChanges(); // Forcer la mise à jour de l'UI
    } else {
      // Réinitialiser l'audio si la lecture est terminée
      if (
        audioPlayer.ended ||
        audioPlayer.currentTime >= audioPlayer.duration
      ) {
        audioPlayer.currentTime = 0;
      }

      // Jouer l'audio avec gestion d'erreur améliorée
      audioPlayer
        .play()
        .then(() => {
          this.logger.debug('Audio playback started successfully');
          // Forcer la mise à jour de l'UI
          this.cdr.detectChanges();
        })
        .catch((error) => {
          this.logger.error('Error playing audio:', error);
          this.isPlaying = false;
          this.cdr.detectChanges();
        });

      this.isPlaying = true;
      this.startProgressTracking();
      this.cdr.detectChanges(); // Forcer la mise à jour de l'UI immédiatement
    }
  }

  /**
   * Démarre le suivi de la progression de la lecture
   */
  private startProgressTracking(): void {
    this.stopProgressTracking();

    // Utiliser requestAnimationFrame pour une animation plus fluide
    const updateProgress = () => {
      if (!this.isPlaying) return;

      const audioPlayer = this.audioPlayerRef.nativeElement;

      // Mettre à jour le temps actuel
      this.currentTime = audioPlayer.currentTime;

      // Si la lecture est terminée
      if (audioPlayer.ended) {
        this.isPlaying = false;
        this.currentTime = 0;
        this.cdr.detectChanges(); // Forcer la mise à jour de l'UI
        return;
      }

      // Forcer la détection des changements pour mettre à jour l'UI
      this.cdr.detectChanges();

      // Continuer la boucle d'animation
      this.progressInterval = requestAnimationFrame(updateProgress);
    };

    // Démarrer la boucle d'animation
    this.progressInterval = requestAnimationFrame(updateProgress);
  }

  /**
   * Arrête le suivi de la progression
   */
  private stopProgressTracking(): void {
    if (this.progressInterval) {
      cancelAnimationFrame(this.progressInterval);
      this.progressInterval = null;
    }
  }

  /**
   * Gère l'événement de fin de lecture
   */
  onAudioEnded(): void {
    this.isPlaying = false;
    this.currentTime = 0;
    this.stopProgressTracking();

    // Forcer la mise à jour de l'UI
    this.cdr.detectChanges();

    // Réinitialiser l'audio pour la prochaine lecture
    if (this.audioPlayerRef?.nativeElement) {
      this.audioPlayerRef.nativeElement.currentTime = 0;
    }
  }

  /**
   * Calcule la progression de la lecture en pourcentage
   */
  get progressPercentage(): number {
    if (!this.audioPlayerRef) return 0;
    const audioPlayer = this.audioPlayerRef.nativeElement;

    // Si la durée n'est pas disponible, utiliser la durée fournie en entrée
    const totalDuration = audioPlayer.duration || this.duration || 1;
    return (this.currentTime / totalDuration) * 100;
  }

  /**
   * Formate le temps de lecture en MM:SS
   */
  get formattedTime(): string {
    const totalSeconds = Math.floor(this.currentTime);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds
      .toString()
      .padStart(2, '0')}`;
  }

  /**
   * Formate la durée totale en MM:SS
   */
  get formattedDuration(): string {
    if (!this.audioPlayerRef || !this.audioPlayerRef.nativeElement.duration) {
      const totalSeconds = this.duration || 0;
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = Math.floor(totalSeconds % 60);
      return `${minutes.toString().padStart(2, '0')}:${seconds
        .toString()
        .padStart(2, '0')}`;
    }

    const totalSeconds = Math.floor(this.audioPlayerRef.nativeElement.duration);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds
      .toString()
      .padStart(2, '0')}`;
  }
}
