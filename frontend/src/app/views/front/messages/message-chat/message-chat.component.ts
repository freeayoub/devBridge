import {
  Component,
  OnInit,
  OnDestroy,
  ViewChild,
  ElementRef,
  AfterViewChecked,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthuserService } from 'src/app/services/authuser.service';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { GraphqlDataService } from 'src/app/services/graphql-data.service';
import { Subscription, combineLatest } from 'rxjs';
import { User } from '@app/models/user.model';
import { UserStatusService } from 'src/app/services/user-status.service';
import { Message , Conversation, Attachment, MessageType  } from 'src/app/models/message.model';
import { ToastService } from 'src/app/services/toast.service';
import { switchMap, distinctUntilChanged, filter } from 'rxjs/operators';
@Component({
  selector: 'app-message-chat',
  templateUrl: './message-chat.component.html',
  styleUrls: ['./message-chat.component.css'],
})
export class MessageChatComponent
  implements OnInit, OnDestroy, AfterViewChecked
{
  @ViewChild('messagesContainer') private messagesContainer!: ElementRef;
  @ViewChild('fileInput', { static: false }) fileInput!: ElementRef<HTMLInputElement>;

  messages: Message[] = [];
  messageForm: FormGroup;
  conversation: Conversation | null = null;
  loading = true;
  error: any;
  currentUserId: string | null = null;
  otherParticipant: User | null = null;
  selectedFile: File | null = null;
  previewUrl: string | ArrayBuffer | null = null;
  isUploading = false;
  isTyping = false;
  typingTimeout: any;
  private subscriptions: Subscription = new Subscription();

  constructor(
    private graphqlService: GraphqlDataService,
    public route: ActivatedRoute,
    private authService: AuthuserService,
    private fb: FormBuilder,
    public statusService: UserStatusService,
    public router: Router,
    private toastService: ToastService
  ) {
    this.messageForm = this.fb.group({
      content: ['', [Validators.maxLength(1000)]],
    });
  }
  ngOnInit(): void {
    this.currentUserId = this.authService.getCurrentUserId();
    
    const routeSub = this.route.params.pipe(
      filter(params => params['conversationId']),
      distinctUntilChanged(),
      switchMap(params => {
        this.loading = true;
        this.messages = [];
        return this.graphqlService.getConversation(params['conversationId']);
      })
    ).subscribe({
      next: (conversation) => {
        this.handleConversationLoaded(conversation);
      },
      error: (error) => {
        this.handleError('Failed to load conversation', error);
      }
    });
    this.subscriptions.add(routeSub);
  }
  private handleConversationLoaded(conversation: Conversation): void {
    this.conversation = conversation;
    this.messages = [...(conversation?.messages || [])];
    this.otherParticipant = conversation?.participants?.find(
      p => p.id !== this.currentUserId && p._id !== this.currentUserId
    ) || null;
    
    this.loading = false;
    setTimeout(() => this.scrollToBottom(), 100);
    this.markMessagesAsRead();
    
    if (this.conversation?.id) {
      this.subscribeToConversationUpdates(this.conversation.id);
      this.subscribeToNewMessages(this.conversation.id);
      this.subscribeToTypingIndicators(this.conversation.id);
    }
  }

  private subscribeToConversationUpdates(conversationId: string): void {
    const sub = this.graphqlService.subscribeToConversationUpdates(conversationId).subscribe({
      next: (updatedConversation) => {
        this.conversation = updatedConversation;
        this.messages = [...updatedConversation.messages];
        this.scrollToBottom();
      },
      error: (error) => {
        this.toastService.showError('Connection to conversation updates lost');
      }
    });
    this.subscriptions.add(sub);
  }

  private subscribeToNewMessages(conversationId: string): void {
    const sub = this.graphqlService.subscribeToNewMessages(conversationId).subscribe({
      next: (newMessage) => {
        if (newMessage?.conversationId === this.conversation?.id) {
          this.messages = [...this.messages, newMessage];
          setTimeout(() => this.scrollToBottom(), 100);
          if (newMessage.sender?.id !== this.currentUserId && newMessage.sender?._id !== this.currentUserId) {
            this.graphqlService.markMessageAsRead(newMessage.id).subscribe();
          }
        }
      },
      error: (error) => {
        this.toastService.showError('Connection to new messages lost');
      }
    });
    this.subscriptions.add(sub);
  }

  private subscribeToTypingIndicators(conversationId: string): void {
    const sub = this.graphqlService.subscribeToTypingIndicator(conversationId).subscribe({
      next: (event) => {
        if (event.userId !== this.currentUserId) {
          this.isTyping = event.isTyping;
          if (this.isTyping) {
            clearTimeout(this.typingTimeout);
            this.typingTimeout = setTimeout(() => {
              this.isTyping = false;
            }, 2000);
          }
        }
      }
    });
    this.subscriptions.add(sub);
  }

  private markMessagesAsRead(): void {
    const unreadMessages = this.messages.filter(
      msg => !msg.isRead && (msg.receiver?.id === this.currentUserId || msg.receiver?._id === this.currentUserId)
    );
    
    unreadMessages.forEach(msg => {
      const sub = this.graphqlService.markMessageAsRead(msg.id).subscribe({
        error: (error) => {
          console.error('Error marking message as read:', error);
        }
      });
      this.subscriptions.add(sub);
    });
  }

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file size (e.g., 5MB max)
    if (file.size > 5 * 1024 * 1024) {
      this.toastService.showError('File size should be less than 5MB');
      return;
    }

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 
                       'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!validTypes.includes(file.type)) {
      this.toastService.showError('Invalid file type. Only images, PDFs and Word docs are allowed');
      return;
    }

    this.selectedFile = file;
    const reader = new FileReader();
    reader.onload = () => {
      this.previewUrl = reader.result;
    };
    reader.readAsDataURL(file);
  }

  removeAttachment(): void {
    this.selectedFile = null;
    this.previewUrl = null;
    if (this.fileInput?.nativeElement) {
      this.fileInput.nativeElement.value = '';
    }
  }

  onTyping(): void {
    if (this.conversation?.id && this.currentUserId) {
      this.graphqlService.startTyping({
        userId: this.currentUserId,
        conversationId: this.conversation.id
      }).subscribe();
    }
  }

  sendMessage(): void {
    if ((this.messageForm.invalid && !this.selectedFile) || !this.currentUserId || !this.otherParticipant?.id) {
      return;
    }

    const content = this.messageForm.get('content')?.value;
    this.isUploading = true;
    
    const sendSub = this.graphqlService
      .sendMessage(this.otherParticipant.id, content, this.selectedFile || undefined)
      .subscribe({
        next: () => {
          this.messageForm.reset();
          this.removeAttachment();
          this.isUploading = false;
          this.scrollToBottom();
        },
        error: (error) => {
          this.isUploading = false;
          this.toastService.showError('Failed to send message');
        }
      });
    this.subscriptions.add(sendSub);
  }

  formatMessageTime(timestamp: string | Date): string {
    const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  formatLastActive(lastActive: string | Date | undefined): string {
    if (!lastActive) return 'Offline';
    const lastActiveDate = lastActive instanceof Date ? lastActive : new Date(lastActive);
    const now = new Date();
    const diffHours = Math.abs(now.getTime() - lastActiveDate.getTime()) / (1000 * 60 * 60);

    if (diffHours < 24) {
      return `Active ${lastActiveDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    return `Active ${lastActiveDate.toLocaleDateString()}`;
  }

  formatMessageDate(timestamp: string | Date): string {
    const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
    const today = new Date();

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    }

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }

    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  shouldShowDateHeader(index: number): boolean {
    if (index === 0) return true;
    const currentMsg = this.messages[index];
    const prevMsg = this.messages[index - 1];

    const currentDate = this.getDateFromTimestamp(currentMsg.timestamp);
    const prevDate = this.getDateFromTimestamp(prevMsg.timestamp);

    return currentDate !== prevDate;
  }

  private getDateFromTimestamp(timestamp: string | Date): string {
    return (timestamp instanceof Date ? timestamp : new Date(timestamp)).toDateString();
  }

  getMessageTypeClass(message: Message): string {
    if (message.sender?.id === this.currentUserId || message.sender?._id === this.currentUserId) {
      return 'bg-purple-100 rounded-tr-none';
    }
    return 'bg-gray-100 rounded-tl-none';
  }

  ngAfterViewChecked() {
    this.scrollToBottom();
  }

  scrollToBottom(): void {
    try {
      setTimeout(() => {
        this.messagesContainer.nativeElement.scrollTop =
          this.messagesContainer.nativeElement.scrollHeight;
      }, 100);
    } catch (err) {
      console.error('Error scrolling to bottom:', err);
    }
  }

  private handleError(message: string, error?: any): void {
    this.error = message;
    this.loading = false;
    console.error(message, error);
    this.toastService.showError(message);
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    clearTimeout(this.typingTimeout);
  }
}