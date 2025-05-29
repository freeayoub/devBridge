import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { trigger, state, style, transition, animate } from '@angular/animations';
import { GeminiChatService, ChatMessage } from '../../../services/gemini-chat.service';

@Component({
  selector: 'app-ai-chatbot',
  templateUrl: './ai-chatbot.component.html',
  styleUrls: ['./ai-chatbot.component.css'],
  animations: [
    trigger('slideInOut', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(20px) scale(0.95)' }),
        animate('300ms ease-out', style({ opacity: 1, transform: 'translateY(0) scale(1)' }))
      ]),
      transition(':leave', [
        animate('200ms ease-in', style({ opacity: 0, transform: 'translateY(20px) scale(0.95)' }))
      ])
    ])
  ]
})
export class AiChatbotComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('messagesContainer') private messagesContainer!: ElementRef;
  @ViewChild('messageInput') private messageInput!: ElementRef;

  chatForm: FormGroup;
  messages: ChatMessage[] = [];
  isOpen = false;
  isLoading = false;
  isFullscreen = false;
  private destroy$ = new Subject<void>();
  private shouldScrollToBottom = false;

  constructor(
    private fb: FormBuilder,
    private geminiService: GeminiChatService
  ) {
    this.chatForm = this.fb.group({
      message: ['', [Validators.required, Validators.minLength(1)]]
    });
  }

  ngOnInit(): void {
    // S'abonner aux messages
    this.geminiService.messages$
      .pipe(takeUntil(this.destroy$))
      .subscribe(messages => {
        this.messages = messages;
        this.shouldScrollToBottom = true;
      });

    // S'abonner à l'état d'ouverture
    this.geminiService.isOpen$
      .pipe(takeUntil(this.destroy$))
      .subscribe(isOpen => {
        this.isOpen = isOpen;
        if (isOpen) {
          setTimeout(() => {
            this.focusInput();
            this.scrollToBottom();
          }, 100);
        }
      });
  }

  ngAfterViewChecked(): void {
    if (this.shouldScrollToBottom) {
      this.scrollToBottom();
      this.shouldScrollToBottom = false;
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  toggleChat(): void {
    this.geminiService.toggleChat();
  }

  closeChat(): void {
    this.geminiService.closeChat();
    this.isFullscreen = false; // Reset fullscreen when closing
  }

  toggleFullscreen(): void {
    this.isFullscreen = !this.isFullscreen;
    // Scroll to bottom after fullscreen toggle
    setTimeout(() => {
      this.scrollToBottom();
    }, 100);
  }

  sendMessage(): void {
    if (this.chatForm.valid && !this.isLoading) {
      const message = this.chatForm.get('message')?.value?.trim();
      if (message) {
        this.isLoading = true;
        this.geminiService.sendMessage(message)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: () => {
              this.isLoading = false;
              this.chatForm.reset();
              this.focusInput();
            },
            error: () => {
              this.isLoading = false;
            }
          });
      }
    }
  }

  onKeyPress(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  clearChat(): void {
    this.geminiService.clearChat();
  }

  private scrollToBottom(): void {
    try {
      if (this.messagesContainer) {
        const element = this.messagesContainer.nativeElement;
        element.scrollTop = element.scrollHeight;
      }
    } catch (err) {
      console.error('Erreur lors du scroll:', err);
    }
  }

  private focusInput(): void {
    try {
      if (this.messageInput) {
        this.messageInput.nativeElement.focus();
      }
    } catch (err) {
      console.error('Erreur lors du focus:', err);
    }
  }

  formatTime(date: Date): string {
    return new Intl.DateTimeFormat('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  }

  // Suggestions de messages rapides
  quickMessages = [
    "Comment soumettre un projet ?",
    "Comment voir mes notes ?",
    "Problème de connexion",
    "Aide pour l'interface"
  ];

  sendQuickMessage(message: string): void {
    this.chatForm.patchValue({ message });
    this.sendMessage();
  }

  trackByMessageId(index: number, message: ChatMessage): string {
    return message.id;
  }
}
