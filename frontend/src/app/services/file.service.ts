import { Injectable } from '@angular/core';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root',
})
export class FileService {
  
  constructor() { }
  
  /**
   * Génère une URL de téléchargement pour un fichier
   * @param filePath Chemin du fichier
   * @returns URL de téléchargement
   */
  getDownloadUrl(filePath: string): string {
    // Si le chemin est vide ou null, retourner une chaîne vide
    if (!filePath) return '';
    
    // Extraire uniquement le nom du fichier, peu importe le format du chemin
    let fileName = filePath;
    
    // Si c'est un chemin complet (contient C:/ ou autre)
    if (filePath.includes('C:') || filePath.includes('/') || filePath.includes('\\')) {
      // Prendre uniquement le nom du fichier (dernière partie après / ou \)
      const parts = filePath.split(/[\/\\]/);
      fileName = parts[parts.length - 1];
    }
    
    // Utiliser l'endpoint API spécifique pour le téléchargement
    return `${environment.urlBackend}projets/telecharger/${fileName}`;
  }
  
  /**
   * Extrait le nom du fichier à partir d'un chemin
   * @param filePath Chemin du fichier
   * @returns Nom du fichier
   */
  getFileName(filePath: string): string {
    if (!filePath) return 'fichier';
    
    // Si c'est un chemin complet (contient / ou \)
    if (filePath.includes('/') || filePath.includes('\\')) {
      const parts = filePath.split(/[\/\\]/);
      return parts[parts.length - 1];
    }
    
    return filePath;
  }
}



