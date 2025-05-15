import { Injectable } from '@angular/core';
import { environment } from '@env/environment';

@Injectable({
  providedIn: 'root',
})
export class LoggerService {
  // Configuration des logs
  private enableLogs = false; // Désactiver les logs par défaut
  private enabledComponents: string[] = [
    // Liste des composants pour lesquels les logs sont activés
    // Exemple: 'MessageService', 'MessageChat'
  ];

  constructor() {}

  /**
   * Active ou désactive les logs
   */
  setLogsEnabled(enabled: boolean): void {
    this.enableLogs = enabled;
  }

  /**
   * Ajoute un composant à la liste des composants pour lesquels les logs sont activés
   */
  enableComponentLogs(component: string): void {
    if (!this.enabledComponents.includes(component)) {
      this.enabledComponents.push(component);
    }
  }

  /**
   * Supprime un composant de la liste des composants pour lesquels les logs sont activés
   */
  disableComponentLogs(component: string): void {
    const index = this.enabledComponents.indexOf(component);
    if (index !== -1) {
      this.enabledComponents.splice(index, 1);
    }
  }

  /**
   * Supprime tous les composants de la liste des composants pour lesquels les logs sont activés
   */
  clearEnabledComponents(): void {
    this.enabledComponents = [];
  }

  /**
   * Log a message at the 'log' level
   */
  log(message: any, context?: any) {
    if (!environment.production) {
      console.log(message, context);
    }
  }

  /**
   * Log a message at the 'debug' level
   * Supports multiple formats:
   * - debug(message)
   * - debug(message, context)
   * - debug(component, message)
   * - debug(component, message, context)
   */
  /**
   * Vérifie si les logs sont activés pour un composant donné
   */
  private shouldLog(component?: string): boolean {
    if (environment.production) return false;
    if (!this.enableLogs) return false;
    if (!component) return true;
    if (this.enabledComponents.length === 0) return true;
    return this.enabledComponents.includes(component);
  }

  debug(messageOrComponent: any, contextOrMessage?: any, context?: any) {
    if (
      typeof messageOrComponent === 'string' &&
      typeof contextOrMessage === 'string'
    ) {
      // Format: debug(component, message, context)
      if (!this.shouldLog(messageOrComponent)) return;

      if (context !== undefined) {
        console.debug(`[${messageOrComponent}] ${contextOrMessage}`, context);
      } else {
        console.debug(`[${messageOrComponent}] ${contextOrMessage}`);
      }
    } else if (
      typeof messageOrComponent === 'string' &&
      contextOrMessage !== undefined
    ) {
      // Format: debug(message, context)
      if (!this.shouldLog()) return;
      console.debug(messageOrComponent, contextOrMessage);
    } else {
      // Format: debug(message)
      if (!this.shouldLog()) return;
      console.debug(messageOrComponent);
    }
  }

  /**
   * Log a message at the 'error' level
   * Supports multiple formats:
   * - error(message)
   * - error(error)
   * - error(message, error)
   * - error(message, context)
   * - error(component, message)
   * - error(component, error)
   * - error(component, message, error)
   * - error(component, message, context)
   */
  error(
    messageOrComponentOrError: any,
    errorOrMessageOrContext?: any,
    contextOrError?: any
  ) {
    // Les erreurs sont toujours affichées, même en production
    if (
      typeof messageOrComponentOrError === 'string' &&
      typeof errorOrMessageOrContext === 'string'
    ) {
      // Format: error(component, message, context/error)
      // Pour les erreurs, on vérifie quand même si le composant est activé
      if (!this.shouldLog(messageOrComponentOrError) && !environment.production)
        return;

      if (contextOrError !== undefined) {
        console.error(
          `[${messageOrComponentOrError}] ${errorOrMessageOrContext}`,
          contextOrError
        );
      } else {
        console.error(
          `[${messageOrComponentOrError}] ${errorOrMessageOrContext}`
        );
      }
    } else if (
      typeof messageOrComponentOrError === 'string' &&
      errorOrMessageOrContext instanceof Error
    ) {
      // Format: error(component/message, error)
      console.error(
        messageOrComponentOrError,
        errorOrMessageOrContext,
        contextOrError
      );
    } else if (typeof messageOrComponentOrError === 'string') {
      // Format: error(message, context)
      console.error(messageOrComponentOrError, errorOrMessageOrContext);
    } else if (messageOrComponentOrError instanceof Error) {
      // Format: error(error, context)
      console.error(messageOrComponentOrError, errorOrMessageOrContext);
    } else {
      // Fallback
      console.error(
        messageOrComponentOrError,
        errorOrMessageOrContext,
        contextOrError
      );
    }
  }

  /**
   * Log a message at the 'warn' level
   * Supports multiple formats:
   * - warn(message)
   * - warn(message, context)
   * - warn(component, message)
   * - warn(component, message, context)
   */
  warn(messageOrComponent: any, contextOrMessage?: any, context?: any) {
    if (
      typeof messageOrComponent === 'string' &&
      typeof contextOrMessage === 'string'
    ) {
      // Format: warn(component, message, context)
      if (!this.shouldLog(messageOrComponent)) return;

      if (context !== undefined) {
        console.warn(`[${messageOrComponent}] ${contextOrMessage}`, context);
      } else {
        console.warn(`[${messageOrComponent}] ${contextOrMessage}`);
      }
    } else if (
      typeof messageOrComponent === 'string' &&
      contextOrMessage !== undefined
    ) {
      // Format: warn(message, context)
      if (!this.shouldLog()) return;
      console.warn(messageOrComponent, contextOrMessage);
    } else {
      // Format: warn(message)
      if (!this.shouldLog()) return;
      console.warn(messageOrComponent);
    }
  }

  /**
   * Log a message at the 'info' level
   * Supports multiple formats:
   * - info(message)
   * - info(message, context)
   * - info(component, message)
   * - info(component, message, context)
   */
  info(messageOrComponent: any, contextOrMessage?: any, context?: any) {
    if (
      typeof messageOrComponent === 'string' &&
      typeof contextOrMessage === 'string'
    ) {
      // Format: info(component, message, context)
      if (!this.shouldLog(messageOrComponent)) return;

      if (context !== undefined) {
        console.info(`[${messageOrComponent}] ${contextOrMessage}`, context);
      } else {
        console.info(`[${messageOrComponent}] ${contextOrMessage}`);
      }
    } else if (
      typeof messageOrComponent === 'string' &&
      contextOrMessage !== undefined
    ) {
      // Format: info(message, context)
      if (!this.shouldLog()) return;
      console.info(messageOrComponent, contextOrMessage);
    } else {
      // Format: info(message)
      if (!this.shouldLog()) return;
      console.info(messageOrComponent);
    }
  }
}
