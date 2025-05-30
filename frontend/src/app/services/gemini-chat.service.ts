import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { of } from 'rxjs';

export interface ChatMessage {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
  isTyping?: boolean;
}

export interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        text: string;
      }>;
    };
  }>;
}

@Injectable({
  providedIn: 'root'
})
export class GeminiChatService {
  private readonly GEMINI_API_KEY = 'AIzaSyBL2R5ESS0q2DtZMbW6f-aMnk_y3bd4re8';
  private readonly GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

  private messagesSubject = new BehaviorSubject<ChatMessage[]>([]);
  public messages$ = this.messagesSubject.asObservable();

  private isOpenSubject = new BehaviorSubject<boolean>(false);
  public isOpen$ = this.isOpenSubject.asObservable();

  constructor(private http: HttpClient) {
    this.initializeChat();
  }

  private initializeChat(): void {
    const welcomeMessage: ChatMessage = {
      id: this.generateId(),
      content: "👋 Bonjour ! Je suis votre assistant IA. Je peux vous aider avec vos projets, répondre à vos questions sur la plateforme, ou vous donner des conseils académiques. Comment puis-je vous assister aujourd'hui ?",
      isUser: false,
      timestamp: new Date()
    };
    this.messagesSubject.next([welcomeMessage]);
  }

  toggleChat(): void {
    this.isOpenSubject.next(!this.isOpenSubject.value);
  }

  closeChat(): void {
    this.isOpenSubject.next(false);
  }

  openChat(): void {
    this.isOpenSubject.next(true);
  }

  sendMessage(content: string): Observable<ChatMessage> {
    const userMessage: ChatMessage = {
      id: this.generateId(),
      content: content.trim(),
      isUser: true,
      timestamp: new Date()
    };

    // Ajouter le message utilisateur
    const currentMessages = this.messagesSubject.value;
    this.messagesSubject.next([...currentMessages, userMessage]);

    // Ajouter un indicateur de frappe
    const typingMessage: ChatMessage = {
      id: 'typing',
      content: '',
      isUser: false,
      timestamp: new Date(),
      isTyping: true
    };
    this.messagesSubject.next([...this.messagesSubject.value, typingMessage]);

    // Préparer le contexte pour Gemini
    const contextualPrompt = this.buildContextualPrompt(content);

    return this.callGeminiAPI(contextualPrompt).pipe(
      map(response => {
        // Supprimer l'indicateur de frappe
        const messagesWithoutTyping = this.messagesSubject.value.filter(msg => msg.id !== 'typing');
        
        const aiMessage: ChatMessage = {
          id: this.generateId(),
          content: response,
          isUser: false,
          timestamp: new Date()
        };

        // Ajouter la réponse IA
        this.messagesSubject.next([...messagesWithoutTyping, aiMessage]);
        return aiMessage;
      }),
      catchError(error => {
        // Supprimer l'indicateur de frappe en cas d'erreur
        const messagesWithoutTyping = this.messagesSubject.value.filter(msg => msg.id !== 'typing');
        
        const errorMessage: ChatMessage = {
          id: this.generateId(),
          content: "Désolé, je rencontre des difficultés techniques. Veuillez réessayer dans quelques instants.",
          isUser: false,
          timestamp: new Date()
        };

        this.messagesSubject.next([...messagesWithoutTyping, errorMessage]);
        return of(errorMessage);
      })
    );
  }

  private buildContextualPrompt(userMessage: string): string {
    return `Tu es un assistant IA pour une plateforme de gestion de projets étudiants. Tu aides les professeurs, étudiants et administrateurs.

Contexte de la plateforme :
- Les professeurs peuvent créer des projets, voir les rendus des étudiants, et gérer les évaluations
- Les étudiants peuvent voir leurs projets assignés, soumettre leurs travaux, et suivre leurs notes
- Les administrateurs gèrent les utilisateurs et supervisent la plateforme

Ton rôle :
- Répondre aux questions sur l'utilisation de la plateforme
- Donner des conseils académiques et techniques
- Aider à résoudre les problèmes courants
- Être bienveillant, professionnel et pédagogique

Réponds en français, de manière claire et concise. Utilise des emojis appropriés pour rendre tes réponses plus engageantes.

Question de l'utilisateur : ${userMessage}`;
  }

  private callGeminiAPI(prompt: string): Observable<string> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });

    const body = {
      contents: [
        {
          parts: [
            {
              text: prompt
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 1024,
      }
    };

    return this.http.post<GeminiResponse>(
      `${this.GEMINI_API_URL}?key=${this.GEMINI_API_KEY}`,
      body,
      { headers }
    ).pipe(
      map(response => {
        if (response.candidates && response.candidates.length > 0) {
          return response.candidates[0].content.parts[0].text;
        }
        throw new Error('Réponse invalide de l\'API');
      })
    );
  }

  clearChat(): void {
    this.initializeChat();
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  getCurrentMessages(): ChatMessage[] {
    return this.messagesSubject.value;
  }
}
