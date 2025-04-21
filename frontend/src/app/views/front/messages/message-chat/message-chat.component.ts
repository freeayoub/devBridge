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
import { DataService } from 'src/app/services/data.service';
import { UserStatusService } from 'src/app/services/user-status.service';
@Component({
  selector: 'app-message-chat',
  templateUrl: './message-chat.component.html',
  styleUrls: ['./message-chat.component.css'],
})
export class MessageChatComponent
  implements OnInit, OnDestroy, AfterViewChecked
{
  @ViewChild('messagesContainer') private messagesContainer!: ElementRef;
  messages: any[] = [];
  messageForm: FormGroup;
  conversation: any = null;
  loading = true;
  error: any;
  currentUserId: any;
  otherParticipant: any = null;
  isNewConversation = false;
  otherUserId: string | null = null;
  private subscriptions: Subscription[] = [];
  constructor(
    private graphqlService: GraphqlDataService,
    private route: ActivatedRoute,
    private authService: AuthuserService,
    private dataService: DataService,
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
    const conversationId = this.route.snapshot.paramMap.get('conversationId');
    this.otherUserId = this.route.snapshot.queryParamMap.get('userId');
    if (conversationId) {
      this.loadConversation(conversationId);
    } else if (this.otherUserId) {
      this.isNewConversation = true;
      this.prepareNewConversation();
    } else {
      this.router.navigate(['/messages']);
    }
  }
  prepareNewConversation(): void {
    this.loading = true;
    this.dataService.getOneUser(this.otherUserId!).subscribe({
      next: (user: User) => {
        this.otherParticipant = {
          id: user._id,
          username: user.username,
          image: user.image,
          isOnline: user.isOnline,
        };
        this.loading = false;
      },
      error: (error: any) => {
        this.error = error;
        this.loading = false;
      },
    });
  }
  loadConversation(conversationId: string) {
    const sub = this.graphqlService.getConversation(conversationId).subscribe({
      next: ({ data, loading }: any) => {
        this.conversation = data?.getConversation;
        this.messages = this.conversation?.messages || [];
        this.otherParticipant = this.conversation?.participants?.find(
          (p: any) => p.id !== this.currentUserId
        );
        this.loading = loading;
        setTimeout(() => this.scrollToBottom(), 100);
        this.markMessagesAsRead();
        // Subscribe to new messages after initial load
        if (this.currentUserId && this.otherParticipant?.id) {
          this.subscribeToNewMessages();
        }
      },
      error: (error) => {
        this.error = error;
        this.loading = false;
        console.error('Error loading conversation:', error);
      },
    });
    this.subscriptions.push(sub);
  }

  markMessagesAsRead() {
    const unreadMessages = this.messages.filter(
      (msg) => !msg.isRead && msg.receiverId.id === this.currentUserId
    );
    unreadMessages.forEach((msg) => {
      const sub = this.graphqlService.markMessageAsRead(msg.id).subscribe();
      this.subscriptions.push(sub);
    });
  }
  subscribeToNewMessages() {
    if (!this.otherParticipant?.id || this.currentUserId) {
      console.error('Missing required IDs for subscription');
      return;
    }
    const sub = this.graphqlService
      .subscribeToNewMessages(this.otherParticipant.id, this.currentUserId)
      .subscribe({
        next: (newMessage) => {
          if (newMessage?.conversationId === this.conversation?.id) {
            this.messages = [...this.messages, newMessage];
            setTimeout(() => this.scrollToBottom(), 100);
            if (newMessage.receiverId.id === this.currentUserId) {
              this.graphqlService.markMessageAsRead(newMessage.id).subscribe();
            }
          }
        },
        error: (error) => {
          console.error('Message subscription error:', error);
        },
      });
    this.subscriptions.push(sub);
  }
  sendMessage() {
    if (
      this.messageForm.invalid ||
      !this.currentUserId ||
      !this.otherParticipant
    )
      return;

    const content = this.messageForm.get('content')?.value;
    const sub =
    this.graphqlService
      .sendMessage(this.currentUserId, this.otherParticipant.id, content)
      .subscribe({
        next: () => {
          this.messageForm.reset();
        },
        error: (error) => {
          console.error('Error sending message:', error);
        },
      });
      this.subscriptions.push(sub);
  }
  
  formatMessageTime(timestamp: string): string {
    const date = new Date(timestamp);
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
  formatMessageDate(timestamp: string): string {
    const date = new Date(timestamp);
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
  } shouldShowDateHeader(index: number): boolean {
    if (index === 0) return true;
    
    const currentDate = new Date(this.messages[index].timestamp).toDateString();
    const prevDate = new Date(this.messages[index - 1].timestamp).toDateString();
    
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
    } catch(err) { }
  }
  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }
}