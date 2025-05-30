import {
  Component,
  OnInit,
  OnDestroy,
  HostListener,
  ElementRef,
  ViewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { MessageService } from 'src/app/services/message.service';
import { Observable, Subject, of, BehaviorSubject } from 'rxjs';
import {
  Notification,
  Attachment,
  NotificationAttachment,
  AttachmentType,
  MessageType,
} from 'src/app/models/message.model';
import {
  catchError,
  map,
  takeUntil,
  take,
  debounceTime,
  distinctUntilChanged,
  filter,
} from 'rxjs/operators';
import { ThemeService } from '@app/services/theme.service';
@Component({
  selector: 'app-notification-list',
  templateUrl: './notification-list.component.html',
  styleUrls: ['./notification-list.component.css'],
})
export class NotificationListComponent implements OnInit, OnDestroy {
  @ViewChild('notificationContainer', { static: false })
  notificationContainer!: ElementRef;

  notifications$: Observable<Notification[]>;
  filteredNotifications$: Observable<Notification[]>;
  unreadCount$: Observable<number>;
  isDarkMode$: Observable<boolean>;
  loading = true;
  loadingMore = false;
  hasMoreNotifications = true;
  error: Error | null = null;
  showOnlyUnread = false;
  isSoundMuted = false;

  // Propriétés pour la sélection multiple
  selectedNotifications: Set<string> = new Set<string>();
  allSelected = false;
  showSelectionBar = false;

  // Propriétés pour le modal des pièces jointes
  showAttachmentsModal = false;
  loadingAttachments = false;
  currentAttachments: Attachment[] = [];

  // Propriétés pour le modal des détails de notification
  showNotificationDetailsModal = false;
  currentNotification: Notification | null = null;

  private destroy$ = new Subject<void>();
  private scrollPosition$ = new BehaviorSubject<number>(0);

  constructor(
    private messageService: MessageService,
    private themeService: ThemeService,
    private router: Router
  ) {
    this.notifications$ = this.messageService.notifications$;
    this.filteredNotifications$ = this.notifications$; // Par défaut, afficher toutes les notifications
    this.unreadCount$ = this.messageService.notificationCount$;
    this.isDarkMode$ = this.themeService.darkMode$;

    // Vérifier l'état du son
    this.isSoundMuted = this.messageService.isMuted();
  }

  /**
   * Rejoint une conversation ou un groupe à partir d'une notification
   * @param notification Notification contenant les informations de la conversation ou du groupe
   */
  joinConversation(notification: Notification): void {
    // Marquer la notification comme lue d'abord
    this.markAsRead(notification.id);

    // Extraire les informations pertinentes de la notification
    const conversationId =
      notification.conversationId ||
      (notification.metadata && notification.metadata['conversationId']) ||
      (notification.relatedEntity &&
      notification.relatedEntity.includes('conversation')
        ? notification.relatedEntity
        : null);

    const groupId =
      notification.groupId ||
      (notification.metadata && notification.metadata['groupId']) ||
      (notification.relatedEntity &&
      notification.relatedEntity.includes('group')
        ? notification.relatedEntity
        : null);

    // Déterminer où rediriger l'utilisateur
    if (conversationId) {
      this.router.navigate(['/messages/conversations/chat', conversationId]);
    } else if (groupId) {
      this.router.navigate(['/messages/group', groupId]);
    } else if (notification.senderId && notification.senderId.id) {
      this.loading = true;

      this.messageService
        .getOrCreateConversation(notification.senderId.id)
        .subscribe({
          next: (conversation) => {
            this.loading = false;
            if (conversation && conversation.id) {
              this.router.navigate([
                '/messages/conversations/chat',
                conversation.id,
              ]);
            } else {
              this.router.navigate(['/messages']);
            }
          },
          error: (error) => {
            this.loading = false;
            this.error = error;
            this.router.navigate(['/messages']);
          },
        });
    } else {
      this.router.navigate(['/messages']);
    }
  }

  @HostListener('scroll', ['$event.target'])
  onScroll(target: HTMLElement): void {
    if (!target) return;

    const scrollPosition = target.scrollTop;
    const scrollHeight = target.scrollHeight;
    const clientHeight = target.clientHeight;

    // Si on est proche du bas (à 200px du bas)
    if (scrollHeight - scrollPosition - clientHeight < 200) {
      this.scrollPosition$.next(scrollPosition);
    }
  }
  ngOnInit(): void {
    // Charger la préférence de son depuis le localStorage
    const savedMutePreference = localStorage.getItem('notificationSoundMuted');
    if (savedMutePreference !== null) {
      this.isSoundMuted = savedMutePreference === 'true';
      this.messageService.setMuted(this.isSoundMuted);
    }

    this.loadNotifications();
    this.setupSubscriptions();
    this.setupInfiniteScroll();
    this.filterDeletedNotifications();
  }

  /**
   * Filtre les notifications supprimées lors du chargement initial
   */
  private filterDeletedNotifications(): void {
    const deletedNotificationIds = this.getDeletedNotificationIds();

    if (deletedNotificationIds.size > 0) {
      this.notifications$.pipe(take(1)).subscribe((notifications) => {
        const filteredNotifications = notifications.filter(
          (notification) => !deletedNotificationIds.has(notification.id)
        );

        (this.messageService as any).notifications.next(filteredNotifications);
        const unreadCount = filteredNotifications.filter(
          (n) => !n.isRead
        ).length;
        (this.messageService as any).notificationCount.next(unreadCount);
        this.updateNotificationCache(filteredNotifications);
      });
    }
  }

  setupInfiniteScroll(): void {
    // Configurer le chargement des anciennes notifications lors du défilement
    this.scrollPosition$
      .pipe(
        takeUntil(this.destroy$),
        debounceTime(200), // Attendre 200ms après le dernier événement de défilement
        distinctUntilChanged(), // Ne déclencher que si la position de défilement a changé
        filter(() => !this.loadingMore && this.hasMoreNotifications) // Ne charger que s'il y a plus de notifications et qu'on n'est pas déjà en train de charger
      )
      .subscribe(() => {
        this.loadMoreNotifications();
      });
  }
  loadNotifications(): void {
    this.loading = true;
    this.loadingMore = false;
    this.error = null;
    this.hasMoreNotifications = true;

    const deletedNotificationIds = this.getDeletedNotificationIds();

    this.messageService
      .getNotifications(true)
      .pipe(
        takeUntil(this.destroy$),
        map((notifications) => {
          if (deletedNotificationIds.size > 0) {
            return notifications.filter(
              (notification) => !deletedNotificationIds.has(notification.id)
            );
          }
          return notifications;
        })
      )
      .subscribe({
        next: (notifications) => {
          (this.messageService as any).notifications.next(notifications);
          const unreadCount = notifications.filter((n) => !n.isRead).length;
          (this.messageService as any).notificationCount.next(unreadCount);
          this.loading = false;
          this.hasMoreNotifications =
            this.messageService.hasMoreNotifications();
        },
        error: (err: Error) => {
          this.error = err;
          this.loading = false;
          this.hasMoreNotifications = false;
        },
      });
  }

  loadMoreNotifications(): void {
    if (this.loadingMore || !this.hasMoreNotifications) return;

    this.loadingMore = true;
    const deletedNotificationIds = this.getDeletedNotificationIds();

    this.messageService
      .loadMoreNotifications()
      .pipe(
        takeUntil(this.destroy$),
        map((notifications) => {
          if (deletedNotificationIds.size > 0) {
            return notifications.filter(
              (notification) => !deletedNotificationIds.has(notification.id)
            );
          }
          return notifications;
        })
      )
      .subscribe({
        next: (notifications) => {
          this.notifications$
            .pipe(take(1))
            .subscribe((existingNotifications) => {
              const allNotifications = [
                ...existingNotifications,
                ...notifications,
              ];
              (this.messageService as any).notifications.next(allNotifications);
              const unreadCount = allNotifications.filter(
                (n) => !n.isRead
              ).length;
              (this.messageService as any).notificationCount.next(unreadCount);
              this.updateNotificationCache(allNotifications);
            });

          this.loadingMore = false;
          this.hasMoreNotifications =
            this.messageService.hasMoreNotifications();
        },
        error: (err: Error) => {
          this.loadingMore = false;
          this.hasMoreNotifications = false;
        },
      });
  }
  setupSubscriptions(): void {
    this.messageService
      .subscribeToNewNotifications()
      .pipe(
        takeUntil(this.destroy$),
        catchError((error) => {
          console.log('Notification stream error:', error);
          return of(null);
        })
      )
      .subscribe();
    this.messageService
      .subscribeToNotificationsRead()
      .pipe(
        takeUntil(this.destroy$),
        catchError((error) => {
          console.log('Notifications read stream error:', error);
          return of(null);
        })
      )
      .subscribe();
  }
  markAsRead(notificationId: string): void {
    if (!notificationId) {
      this.error = new Error('ID de notification invalide');
      return;
    }

    this.notifications$.pipe(take(1)).subscribe((notifications) => {
      const notification = notifications.find((n) => n.id === notificationId);
      if (notification) {
        if (notification.isRead) return;

        const updatedNotifications = notifications.map((n) =>
          n.id === notificationId
            ? { ...n, isRead: true, readAt: new Date().toISOString() }
            : n
        );

        this.updateUIWithNotifications(updatedNotifications);

        this.messageService
          .markAsRead([notificationId])
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: (result) => {
              if (result && result.success) {
                if (this.error && this.error.message.includes('mark')) {
                  this.error = null;
                }
              }
            },
            error: (err) => {
              const revertedNotifications = notifications.map((n) =>
                n.id === notificationId
                  ? { ...n, isRead: false, readAt: undefined }
                  : n
              );
              (this.messageService as any).notifications.next(
                revertedNotifications
              );

              const revertedUnreadCount = revertedNotifications.filter(
                (n) => !n.isRead
              ).length;
              (this.messageService as any).notificationCount.next(
                revertedUnreadCount
              );
            },
          });
      } else {
        this.loadNotifications();
      }
    });
  }

  /**
   * Met à jour l'interface utilisateur avec les nouvelles notifications
   * @param notifications Notifications à afficher
   */
  private updateUIWithNotifications(notifications: any[]): void {
    // Mettre à jour l'interface utilisateur immédiatement
    (this.messageService as any).notifications.next(notifications);

    // Mettre à jour le compteur de notifications non lues
    const unreadCount = notifications.filter((n) => !n.isRead).length;
    (this.messageService as any).notificationCount.next(unreadCount);

    // Mettre à jour le cache de notifications dans le service
    this.updateNotificationCache(notifications);
  }

  /**
   * Met à jour le cache de notifications dans le service
   * @param notifications Notifications à mettre à jour
   */
  private updateNotificationCache(notifications: any[]): void {
    notifications.forEach((notification) => {
      (this.messageService as any).updateNotificationCache?.(notification);
    });
  }

  /**
   * Réinitialise la sélection des notifications
   */
  private resetSelection(): void {
    this.selectedNotifications.clear();
    this.allSelected = false;
    this.showSelectionBar = false;
  }

  markAllAsRead(): void {
    this.notifications$.pipe(take(1)).subscribe((notifications) => {
      const unreadIds = notifications.filter((n) => !n.isRead).map((n) => n.id);

      if (unreadIds.length === 0) return;

      const validIds = unreadIds.filter(
        (id) => id && typeof id === 'string' && id.trim() !== ''
      );

      if (validIds.length !== unreadIds.length) {
        this.error = new Error('Invalid notification IDs');
        return;
      }

      const updatedNotifications = notifications.map((n) =>
        validIds.includes(n.id)
          ? { ...n, isRead: true, readAt: new Date().toISOString() }
          : n
      );

      this.updateUIWithNotifications(updatedNotifications);

      this.messageService
        .markAsRead(validIds)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (result) => {
            if (result && result.success) {
              if (this.error && this.error.message.includes('mark')) {
                this.error = null;
              }
            }
          },
          error: (err) => {
            // Ne pas définir d'erreur pour éviter de perturber l'interface utilisateur
          },
        });
    });
  }

  hasNotifications(): Observable<boolean> {
    return this.notifications$.pipe(
      map((notifications) => notifications?.length > 0)
    );
  }
  hasUnreadNotifications(): Observable<boolean> {
    return this.unreadCount$.pipe(map((count) => count > 0));
  }

  /**
   * Active/désactive le filtre pour n'afficher que les notifications non lues
   */
  toggleUnreadFilter(): void {
    this.showOnlyUnread = !this.showOnlyUnread;

    if (this.showOnlyUnread) {
      this.filteredNotifications$ =
        this.messageService.getUnreadNotifications();
    } else {
      this.filteredNotifications$ = this.notifications$;
    }
  }

  /**
   * Active/désactive le son des notifications
   */
  toggleSound(): void {
    this.isSoundMuted = !this.isSoundMuted;
    this.messageService.setMuted(this.isSoundMuted);

    if (!this.isSoundMuted) {
      setTimeout(() => {
        this.messageService.playNotificationSound();
        setTimeout(() => {
          this.messageService.playNotificationSound();
        }, 1000);
      }, 100);
    }

    localStorage.setItem(
      'notificationSoundMuted',
      this.isSoundMuted.toString()
    );
  }

  /**
   * Récupère les pièces jointes d'une notification et ouvre le modal
   * @param notificationId ID de la notification
   */
  getNotificationAttachments(notificationId: string): void {
    if (!notificationId) return;

    this.currentAttachments = [];
    this.loadingAttachments = true;
    this.showAttachmentsModal = true;

    let notification: Notification | undefined;

    this.notifications$.pipe(take(1)).subscribe((notifications) => {
      notification = notifications.find(
        (n: Notification) => n.id === notificationId
      );
    });

    if (
      notification &&
      notification.message &&
      notification.message.attachments &&
      notification.message.attachments.length > 0
    ) {
      this.loadingAttachments = false;
      this.currentAttachments = notification.message.attachments.map(
        (attachment: NotificationAttachment) =>
          ({
            id: '',
            url: attachment.url || '',
            type: this.convertAttachmentTypeToMessageType(attachment.type),
            name: attachment.name || '',
            size: attachment.size || 0,
            duration: 0,
          } as Attachment)
      );
      return;
    }

    this.messageService
      .getNotificationAttachments(notificationId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (attachments) => {
          this.loadingAttachments = false;
          this.currentAttachments = attachments;
        },
        error: (err) => {
          this.loadingAttachments = false;
        },
      });
  }

  /**
   * Ferme le modal des pièces jointes
   */
  closeAttachmentsModal(): void {
    this.showAttachmentsModal = false;
  }

  /**
   * Ouvre le modal des détails de notification
   * @param notification Notification à afficher
   */
  openNotificationDetails(notification: Notification): void {
    this.currentNotification = notification;
    this.showNotificationDetailsModal = true;

    if (notification.message?.attachments?.length) {
      this.getNotificationAttachmentsForModal(notification.id);
    }
  }

  /**
   * Ferme le modal des détails de notification
   */
  closeNotificationDetailsModal(): void {
    this.showNotificationDetailsModal = false;
    this.currentNotification = null;
    this.currentAttachments = [];
  }

  /**
   * Récupère les pièces jointes d'une notification pour le modal de détails
   */
  private getNotificationAttachmentsForModal(notificationId: string): void {
    this.currentAttachments = [];

    if (this.currentNotification?.message?.attachments?.length) {
      this.currentAttachments =
        this.currentNotification.message.attachments.map(
          (attachment: NotificationAttachment) =>
            ({
              id: '',
              url: attachment.url || '',
              type: this.convertAttachmentTypeToMessageType(attachment.type),
              name: attachment.name || '',
              size: attachment.size || 0,
              duration: 0,
            } as Attachment)
        );
    }
  }

  /**
   * Convertit AttachmentType en MessageType
   */
  private convertAttachmentTypeToMessageType(
    type: AttachmentType
  ): MessageType {
    switch (type) {
      case 'IMAGE':
      case 'image':
        return MessageType.IMAGE;
      case 'VIDEO':
      case 'video':
        return MessageType.VIDEO;
      case 'AUDIO':
      case 'audio':
        return MessageType.AUDIO;
      case 'FILE':
      case 'file':
        return MessageType.FILE;
      default:
        return MessageType.FILE;
    }
  }

  /**
   * Vérifie si un type de fichier est une image
   */
  isImage(type: string): boolean {
    return type?.startsWith('image/') || false;
  }

  /**
   * Obtient l'icône FontAwesome correspondant au type de fichier
   * @param type Type MIME du fichier
   * @returns Classe CSS de l'icône
   */
  getFileIcon(type: string): string {
    if (!type) return 'fas fa-file';

    if (type.startsWith('image/')) return 'fas fa-file-image';
    if (type.startsWith('video/')) return 'fas fa-file-video';
    if (type.startsWith('audio/')) return 'fas fa-file-audio';
    if (type.startsWith('text/')) return 'fas fa-file-alt';
    if (type.includes('pdf')) return 'fas fa-file-pdf';
    if (type.includes('word') || type.includes('document'))
      return 'fas fa-file-word';
    if (type.includes('excel') || type.includes('sheet'))
      return 'fas fa-file-excel';
    if (type.includes('powerpoint') || type.includes('presentation'))
      return 'fas fa-file-powerpoint';
    if (type.includes('zip') || type.includes('compressed'))
      return 'fas fa-file-archive';

    return 'fas fa-file';
  }

  /**
   * Obtient le libellé du type de fichier
   * @param type Type MIME du fichier
   * @returns Libellé du type de fichier
   */
  getFileTypeLabel(type: string): string {
    if (!type) return 'Fichier';

    if (type.startsWith('image/')) return 'Image';
    if (type.startsWith('video/')) return 'Vidéo';
    if (type.startsWith('audio/')) return 'Audio';
    if (type.startsWith('text/')) return 'Texte';
    if (type.includes('pdf')) return 'PDF';
    if (type.includes('word') || type.includes('document')) return 'Document';
    if (type.includes('excel') || type.includes('sheet'))
      return 'Feuille de calcul';
    if (type.includes('powerpoint') || type.includes('presentation'))
      return 'Présentation';
    if (type.includes('zip') || type.includes('compressed')) return 'Archive';

    return 'Fichier';
  }

  /**
   * Formate la taille du fichier en unités lisibles
   * @param size Taille en octets
   * @returns Taille formatée (ex: "1.5 MB")
   */
  formatFileSize(size: number): string {
    if (!size) return '';

    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let i = 0;
    let formattedSize = size;

    while (formattedSize >= 1024 && i < units.length - 1) {
      formattedSize /= 1024;
      i++;
    }

    return `${formattedSize.toFixed(1)} ${units[i]}`;
  }

  /**
   * Ouvre une pièce jointe dans un nouvel onglet
   * @param url URL de la pièce jointe
   */
  openAttachment(url: string): void {
    if (!url) return;
    window.open(url, '_blank');
  }

  /**
   * Télécharge une pièce jointe
   * @param attachment Pièce jointe à télécharger
   */
  downloadAttachment(attachment: Attachment): void {
    if (!attachment?.url) return;

    const link = document.createElement('a');
    link.href = attachment.url;
    link.download = attachment.name || 'attachment';
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  acceptFriendRequest(notification: Notification): void {
    this.markAsRead(notification.id);
  }

  /**
   * Supprime une notification et la stocke dans le localStorage
   * @param notificationId ID de la notification à supprimer
   */
  deleteNotification(notificationId: string): void {
    if (!notificationId) {
      this.error = new Error('ID de notification invalide');
      return;
    }

    const deletedNotificationIds = this.getDeletedNotificationIds();
    deletedNotificationIds.add(notificationId);
    this.saveDeletedNotificationIds(deletedNotificationIds);

    this.messageService
      .deleteNotification(notificationId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result) => {
          if (result && result.success) {
            if (this.error && this.error.message.includes('suppression')) {
              this.error = null;
            }
          }
        },
        error: (err) => {
          this.error = err;
        },
      });
  }

  /**
   * Supprime toutes les notifications et les stocke dans le localStorage
   */
  deleteAllNotifications(): void {
    this.notifications$.pipe(take(1)).subscribe((notifications) => {
      const deletedNotificationIds = this.getDeletedNotificationIds();

      notifications.forEach((notification) => {
        deletedNotificationIds.add(notification.id);
      });

      this.saveDeletedNotificationIds(deletedNotificationIds);

      this.messageService
        .deleteAllNotifications()
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (result) => {
            if (result && result.success) {
              if (this.error && this.error.message.includes('suppression')) {
                this.error = null;
              }
            }
          },
          error: (err) => {
            this.error = err;
          },
        });
    });
  }

  getErrorMessage(): string {
    return this.error?.message || 'Unknown error occurred';
  }

  /**
   * Récupère les IDs des notifications supprimées du localStorage
   * @returns Set contenant les IDs des notifications supprimées
   */
  private getDeletedNotificationIds(): Set<string> {
    try {
      const deletedIdsJson = localStorage.getItem('deletedNotificationIds');
      if (deletedIdsJson) {
        return new Set<string>(JSON.parse(deletedIdsJson));
      }
      return new Set<string>();
    } catch (error) {
      return new Set<string>();
    }
  }

  /**
   * Sauvegarde les IDs des notifications supprimées dans le localStorage
   * @param deletedIds Set contenant les IDs des notifications supprimées
   */
  private saveDeletedNotificationIds(deletedIds: Set<string>): void {
    try {
      localStorage.setItem(
        'deletedNotificationIds',
        JSON.stringify(Array.from(deletedIds))
      );
    } catch (error) {
      // Ignore silently
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Sélectionne ou désélectionne une notification
   * @param notificationId ID de la notification
   * @param event Événement de la case à cocher
   */
  toggleSelection(notificationId: string, event: Event): void {
    event.stopPropagation(); // Empêcher la propagation de l'événement

    if (this.selectedNotifications.has(notificationId)) {
      this.selectedNotifications.delete(notificationId);
    } else {
      this.selectedNotifications.add(notificationId);
    }

    // Mettre à jour l'état de sélection globale
    this.updateSelectionState();

    // Afficher ou masquer la barre de sélection
    this.showSelectionBar = this.selectedNotifications.size > 0;
  }

  /**
   * Sélectionne ou désélectionne toutes les notifications
   * @param event Événement de la case à cocher
   */
  toggleSelectAll(event: Event): void {
    event.stopPropagation(); // Empêcher la propagation de l'événement

    this.allSelected = !this.allSelected;

    this.filteredNotifications$.pipe(take(1)).subscribe((notifications) => {
      if (this.allSelected) {
        // Sélectionner toutes les notifications
        notifications.forEach((notification) => {
          this.selectedNotifications.add(notification.id);
        });
      } else {
        // Désélectionner toutes les notifications
        this.selectedNotifications.clear();
      }

      // Afficher ou masquer la barre de sélection
      this.showSelectionBar = this.selectedNotifications.size > 0;
    });
  }

  /**
   * Met à jour l'état de sélection globale
   */
  private updateSelectionState(): void {
    this.filteredNotifications$.pipe(take(1)).subscribe((notifications) => {
      this.allSelected =
        notifications.length > 0 &&
        this.selectedNotifications.size === notifications.length;
    });
  }

  /**
   * Supprime les notifications sélectionnées
   */
  deleteSelectedNotifications(): void {
    if (this.selectedNotifications.size === 0) return;

    const selectedIds = Array.from(this.selectedNotifications);

    this.notifications$.pipe(take(1)).subscribe((notifications) => {
      const updatedNotifications = notifications.filter(
        (notification) => !this.selectedNotifications.has(notification.id)
      );

      this.updateUIWithNotifications(updatedNotifications);
      this.resetSelection();
    });

    this.messageService
      .deleteMultipleNotifications(selectedIds)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result) => {
          // Success handled silently
        },
        error: (err) => {
          // Error handled silently
        },
      });
  }

  /**
   * Marque les notifications sélectionnées comme lues
   */
  markSelectedAsRead(): void {
    if (this.selectedNotifications.size === 0) return;

    const selectedIds = Array.from(this.selectedNotifications);

    this.notifications$.pipe(take(1)).subscribe((notifications) => {
      const updatedNotifications = notifications.map((notification) =>
        this.selectedNotifications.has(notification.id)
          ? { ...notification, isRead: true, readAt: new Date().toISOString() }
          : notification
      );

      this.updateUIWithNotifications(updatedNotifications);
      this.resetSelection();
    });

    this.messageService
      .markAsRead(selectedIds)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result) => {
          // Success handled silently
        },
        error: (err) => {
          // Error handled silently
        },
      });
  }

  /**
   * Vérifie si une notification est sélectionnée
   * @param notificationId ID de la notification
   * @returns true si la notification est sélectionnée, false sinon
   */
  isSelected(notificationId: string): boolean {
    return this.selectedNotifications.has(notificationId);
  }
}
