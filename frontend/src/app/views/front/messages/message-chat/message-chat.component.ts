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
import { Subscription } from 'rxjs';
import { User } from '@app/models/user.model';
import { UserStatusService } from 'src/app/services/user-status.service';
import { AppMessage , Conversation } from '@app/models/message.model';
@Component({
  selector: 'app-message-chat',
  templateUrl: './message-chat.component.html',
  styleUrls: ['./message-chat.component.css'],
})
export class MessageChatComponent
  implements OnInit, OnDestroy, AfterViewChecked
{

  @ViewChild('messagesContainer') private messagesContainer!: ElementRef;
  messages: AppMessage[] = [];
  messageForm: FormGroup;
 conversation: Conversation | null = null;
  loading = true;
  error: any;
  currentUserId: any | null = null;
  otherParticipant: any | null = null;
  isNewConversation = false;
  otherUserId: string | null = null;
  private subscriptions: Subscription = new Subscription();
  constructor(
    private graphqlService: GraphqlDataService,
    private route: ActivatedRoute,
    private authService: AuthuserService,
    private fb: FormBuilder,
    public statusService: UserStatusService,
    public router: Router
  ) {
    this.messageForm = this.fb.group({
      content: ['', [Validators.required, Validators.maxLength(1000)]],
    });

  }
  ngOnInit(): void {
    this.currentUserId = this.authService.getCurrentUserId();
    this.route.paramMap.subscribe(params => {
      const conversationId = params.get('conversationId');
      this.otherUserId = this.route.snapshot.queryParamMap.get('userId');
    if (conversationId) {
      this.loadConversation(conversationId);
    } else if (this.otherUserId) {
      this.isNewConversation = true;
      this.prepareNewConversation();
    } else {
      this.router.navigate(['/messages']);
    }
  });
  }
  prepareNewConversation(): void {
  
    this.loading = true;
    const sub = this.graphqlService.getOneUser(this.otherUserId!).subscribe({
      next: (user: User) => {
        this.otherParticipant = user;;
        this.loading = false;
      },
      error: (error: any) => {
        this.error = error;
        this.loading = false;
      },
    });
    this.subscriptions.add(sub);
  }
  // Modifier loadConversation
  loadConversation(conversationId: string): void {
    this.loading = true;
    const sub = this.graphqlService.getConversation(conversationId).subscribe({
      next: (conversation:any) => {
        this.conversation = conversation;
        this.messages = [...(conversation?.messages || [])];
        this.otherParticipant = conversation?.participants?.find(
          (p: any) => p.id !== this.currentUserId
        ) || null;
        
        this.loading = false;
        setTimeout(() => this.scrollToBottom(), 100);
        this.markMessagesAsRead();
        this.subscribeToConversationUpdates(conversationId);
        if (this.currentUserId && this.otherParticipant?.id) {
          this.subscribeToNewMessages();
        }
      },
      error: (error) => {
        this.error = error;
        this.loading = false;
        console.error('Error loading conversation:', error);
      }
    });
    this.subscriptions.add(sub);
  }
  private subscribeToConversationUpdates(conversationId: string): void {
    if (!this.currentUserId || !this.otherParticipant?.id) return;

    this.subscriptions.add(
      this.graphqlService.subscribeToConversationUpdates(conversationId).subscribe({
        next: (updatedConversation) => {
          this.conversation = updatedConversation;
          this.messages = [...updatedConversation.messages];
          this.scrollToBottom();
        },
        error: (error) => console.error('Conversation update error:', error)
      })
    );
  }
  markMessagesAsRead() {
    const unreadMessages = this.messages.filter(
      (msg) => !msg.isRead && msg.receiver.id === this.currentUserId
    );
    unreadMessages.forEach((msg) => {
      const sub = this.graphqlService.markMessageAsRead(msg.id).subscribe();
      this.subscriptions.add(sub);
    });
  }
  subscribeToNewMessages() {
    if (!this.otherParticipant?.id || this.currentUserId) {
      console.error('Missing required IDs for subscription');
      return;
    }
    const sub = this.graphqlService
      .subscribeToNewMessages(this.currentUserId, this.otherParticipant.id)
      .subscribe({
        next: (newMessage: AppMessage) => {
          if (newMessage?.conversationId === this.conversation?.id) {
            this.messages = [...this.messages, newMessage];
            setTimeout(() => this.scrollToBottom(), 100);
            if (newMessage.sender.id !== this.currentUserId) {
              this.graphqlService.markMessageAsRead(newMessage.id).subscribe();
            }
          }
        },
        error: (error) => {
          console.error('Message subscription error:', error);
        },
      });
      this.subscriptions.add(sub);
  }
  sendMessage() {
    if (
      this.messageForm.invalid ||
      !this.currentUserId ||
      !this.otherParticipant
    )
      return;

    const content = this.messageForm.get('content')?.value;
    const sub = this.graphqlService
      .sendMessage(this.currentUserId,this.otherParticipant.id, content )
      .subscribe({
        next: () => {
          this.messageForm.reset();
        },
        error: (error) => {
          console.error('Error sending message:', error);
        },
      });
      this.subscriptions.add(sub);
  }
  formatMessageTime(timestamp: string | Date): string {
    const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  formatLastActive(lastActive: string): string {
    if (!lastActive) return 'Offline';

    const lastActiveDate = new Date(lastActive);
    const now = new Date();
    const diffHours =
      Math.abs(now.getTime() - lastActiveDate.getTime()) / (1000 * 60 * 60);

    if (diffHours < 24) {
      return `Last seen ${lastActiveDate.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })}`;
    } else {
      return `Last seen ${lastActiveDate.toLocaleDateString()}`;
    }
  }
  formatMessageDate(timestamp: string | Date): string {
    // Convert to Date if it's a string
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

    const currentTimestamp = this.messages[index].timestamp;
    const prevTimestamp = this.messages[index - 1].timestamp;

    const currentDate = (
      currentTimestamp instanceof Date
        ? currentTimestamp
        : new Date(currentTimestamp)
    ).toDateString();
    const prevDate = (
      prevTimestamp instanceof Date ? prevTimestamp : new Date(prevTimestamp)
    ).toDateString();

    return currentDate !== prevDate;
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
    } catch (err) {}
  }
  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }
}
