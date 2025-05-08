import { Injectable } from '@angular/core';
import { environment } from '@env/environment';

@Injectable({
  providedIn: 'root'
})
export class LoggerService {
  constructor() { }

  log(message: string, context?: any) {
    if (!environment.production) {
      console.log(message, context);
    }
  }

  debug(message: string, context?: any) {
    if (!environment.production) {
      console.debug(message, context);
    }
  }

  error(message: string, error?: Error, context?: any) {
    if (environment.production) {
      // Here you would typically send errors to a logging service
      console.error(message, error, context);
    } else {
      console.error(`[ERROR] ${message}`, error, context);
    }
  }

  warn(message: string, context?: any) {
    if (!environment.production) {
      console.warn(message, context);
    }
  }
}