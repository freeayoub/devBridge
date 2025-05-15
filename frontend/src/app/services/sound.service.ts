import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class SoundService {
  private sounds: { [key: string]: HTMLAudioElement } = {};
  private isPlaying: { [key: string]: boolean } = {};

  constructor() {
    // Précharger les sons
    this.preloadSounds();
  }

  /**
   * Précharge les sons utilisés dans l'application
   */
  private preloadSounds(): void {
    this.loadSound('ringtone', 'assets/sounds/ringtone.mp3');
    this.loadSound('call-end', 'assets/sounds/call-end.mp3');
    this.loadSound('call-connected', 'assets/sounds/call-connected.mp3');
    // Ajouter d'autres sons ici si nécessaire
  }

  /**
   * Charge un fichier audio
   * @param name Nom du son
   * @param path Chemin du fichier
   */
  private loadSound(name: string, path: string): void {
    try {
      const audio = new Audio(path);
      audio.load();
      this.sounds[name] = audio;
      this.isPlaying[name] = false;

      // Gérer la fin de la lecture
      audio.addEventListener('ended', () => {
        this.isPlaying[name] = false;
      });
    } catch (error) {
      console.error(`Error loading sound ${name}:`, error);
    }
  }

  /**
   * Joue un son
   * @param name Nom du son
   * @param loop Lecture en boucle
   */
  play(name: string, loop: boolean = false): void {
    try {
      const sound = this.sounds[name];
      if (!sound) {
        console.warn(`Sound ${name} not found`);
        return;
      }

      // Configurer la lecture en boucle
      sound.loop = loop;

      // Jouer le son s'il n'est pas déjà en cours de lecture
      if (!this.isPlaying[name]) {
        sound.currentTime = 0;
        sound.play().catch(error => {
          console.error(`Error playing sound ${name}:`, error);
        });
        this.isPlaying[name] = true;
      }
    } catch (error) {
      console.error(`Error playing sound ${name}:`, error);
    }
  }

  /**
   * Arrête un son
   * @param name Nom du son
   */
  stop(name: string): void {
    try {
      const sound = this.sounds[name];
      if (!sound) {
        console.warn(`Sound ${name} not found`);
        return;
      }

      // Arrêter le son s'il est en cours de lecture
      if (this.isPlaying[name]) {
        sound.pause();
        sound.currentTime = 0;
        this.isPlaying[name] = false;
      }
    } catch (error) {
      console.error(`Error stopping sound ${name}:`, error);
    }
  }

  /**
   * Arrête tous les sons
   */
  stopAll(): void {
    Object.keys(this.sounds).forEach(name => {
      this.stop(name);
    });
  }
}
