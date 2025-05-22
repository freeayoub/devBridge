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
import { Observable, Subject, of, throwError, BehaviorSubject } from 'rxjs';
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
  switchMap,
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
    console.log('Rejoindre la conversation:', notification);

    // Marquer la notification comme lue
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
      // Rediriger vers la conversation existante
      console.log(
        'Redirection vers la conversation existante:',
        conversationId
      );
      // Utiliser le format exact de l'URL fournie avec l'ID
      window.location.href = `/messages/conversations/chat/${conversationId}`;
    } else if (groupId) {
      // Rediriger vers le groupe
      console.log('Redirection vers le groupe:', groupId);
      window.location.href = `/messages/group/${groupId}`;
    } else if (notification.senderId && notification.senderId.id) {
      // Si aucun ID de conversation n'est trouvé, mais qu'il y a un expéditeur,
      // utiliser getOrCreateConversation pour obtenir ou créer une conversation
      console.log(
        "Création/récupération d'une conversation avec l'utilisateur:",
        notification.senderId.id
      );

      // Afficher un indicateur de chargement si nécessaire
      // this.loading = true;

      this.messageService
        .getOrCreateConversation(notification.senderId.id)
        .subscribe({
          next: (conversation) => {
            console.log('Conversation obtenue:', conversation);
            // this.loading = false;

            if (conversation && conversation.id) {
              // Rediriger vers la conversation nouvellement créée ou récupérée
              // Utiliser le format exact de l'URL fournie avec l'ID
              window.location.href = `/messages/conversations/chat/${conversation.id}`;
            } else {
              console.error('Conversation invalide reçue:', conversation);
              window.location.href = '/messages';
            }
          },
          error: (error) => {
            console.error(
              'Erreur lors de la création/récupération de la conversation:',
              error
            );
            // this.loading = false;

            // En cas d'erreur, rediriger vers la liste des messages
            window.location.href = '/messages';
          },
        });
    } else {
      // Si aucune information n'est trouvée, rediriger vers la liste des messages
      console.log('Redirection vers la liste des messages');
      window.location.href = '/messages';
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
      console.log(
        `Préférence de son chargée: ${
          this.isSoundMuted ? 'désactivé' : 'activé'
        }`
      );
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
    // Récupérer les IDs des notifications supprimées du localStorage
    const deletedNotificationIds = this.getDeletedNotificationIds();

    if (deletedNotificationIds.size > 0) {
      console.log(
        `Filtrage de ${deletedNotificationIds.size} notifications supprimées`
      );

      // Filtrer les notifications pour exclure celles qui ont été supprimées
      this.notifications$.pipe(take(1)).subscribe((notifications) => {
        const filteredNotifications = notifications.filter(
          (notification) => !deletedNotificationIds.has(notification.id)
        );

        // Mettre à jour l'interface utilisateur
        (this.messageService as any).notifications.next(filteredNotifications);

        // Mettre à jour le compteur de notifications non lues
        const unreadCount = filteredNotifications.filter(
          (n) => !n.isRead
        ).length;
        (this.messageService as any).notificationCount.next(unreadCount);

        // Mettre à jour le cache de notifications dans le service
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
    console.log('NotificationListComponent: Loading notifications');
    this.loading = true;
    this.loadingMore = false;
    this.error = null;
    this.hasMoreNotifications = true;

    // Récupérer les IDs des notifications supprimées du localStorage
    const deletedNotificationIds = this.getDeletedNotificationIds();
    console.log(
      `${deletedNotificationIds.size} notifications supprimées trouvées dans le localStorage`
    );

    this.messageService
      .getNotifications(true)
      .pipe(
        takeUntil(this.destroy$),
        map((notifications) => {
          // Filtrer les notifications supprimées
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
          console.log(
            'NotificationListComponent: Notifications loaded successfully',
            notifications
          );

          // Mettre à jour l'interface utilisateur avec les notifications filtrées
          (this.messageService as any).notifications.next(notifications);

          // Mettre à jour le compteur de notifications non lues
          const unreadCount = notifications.filter((n) => !n.isRead).length;
          (this.messageService as any).notificationCount.next(unreadCount);

          this.loading = false;
          this.hasMoreNotifications =
            this.messageService.hasMoreNotifications();
        },
        error: (err: Error) => {
          console.error(
            'NotificationListComponent: Error loading notifications',
            err
          );
          this.error = err;
          this.loading = false;
          this.hasMoreNotifications = false;
        },
      });
  }

  loadMoreNotifications(): void {
    if (this.loadingMore || !this.hasMoreNotifications) return;

    console.log('NotificationListComponent: Loading more notifications');
    this.loadingMore = true;

    // Récupérer les IDs des notifications supprimées du localStorage
    const deletedNotificationIds = this.getDeletedNotificationIds();
    console.log(
      `${deletedNotificationIds.size} notifications supprimées trouvées dans le localStorage`
    );

    this.messageService
      .loadMoreNotifications()
      .pipe(
        takeUntil(this.destroy$),
        map((notifications) => {
          // Filtrer les notifications supprimées
          if (deletedNotificationIds.size > 0) {
            const filteredNotifications = notifications.filter(
              (notification) => !deletedNotificationIds.has(notification.id)
            );
            console.log(
              `Filtré ${
                notifications.length - filteredNotifications.length
              } notifications supprimées`
            );
            return filteredNotifications;
          }
          return notifications;
        })
      )
      .subscribe({
        next: (notifications) => {
          console.log(
            'NotificationListComponent: More notifications loaded successfully',
            notifications
          );

          // Mettre à jour l'interface utilisateur avec les notifications filtrées
          this.notifications$
            .pipe(take(1))
            .subscribe((existingNotifications) => {
              const allNotifications = [
                ...existingNotifications,
                ...notifications,
              ];
              (this.messageService as any).notifications.next(allNotifications);

              // Mettre à jour le compteur de notifications non lues
              const unreadCount = allNotifications.filter(
                (n) => !n.isRead
              ).length;
              (this.messageService as any).notificationCount.next(unreadCount);

              // Mettre à jour le cache de notifications dans le service
              this.updateNotificationCache(allNotifications);
            });

          this.loadingMore = false;
          this.hasMoreNotifications =
            this.messageService.hasMoreNotifications();
        },
        error: (err: Error) => {
          console.error(
            'NotificationListComponent: Error loading more notifications',
            err
          );
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
          console.error('Notification stream error:', error);
          return of(null);
        })
      )
      .subscribe();
    this.messageService
      .subscribeToNotificationsRead()
      .pipe(
        takeUntil(this.destroy$),
        catchError((error) => {
          console.error('Notifications read stream error:', error);
          return of(null);
        })
      )
      .subscribe();
  }
  markAsRead(notificationId: string): void {
    console.log('Marking notification as read:', notificationId);

    if (!notificationId) {
      console.error('Invalid notification ID:', notificationId);
      this.error = new Error('Invalid notification ID');
      return;
    }

    // Afficher des informations de débogage sur la notification
    this.notifications$.pipe(take(1)).subscribe((notifications) => {
      const notification = notifications.find((n) => n.id === notificationId);
      if (notification) {
        console.log('Found notification to mark as read:', {
          id: notification.id,
          type: notification.type,
          isRead: notification.isRead,
        });

        // Mettre à jour localement la notification
        const updatedNotifications = notifications.map((n) =>
          n.id === notificationId
            ? { ...n, isRead: true, readAt: new Date().toISOString() }
            : n
        );

        // Mettre à jour l'interface utilisateur immédiatement
        (this.messageService as any).notifications.next(updatedNotifications);

        // Mettre à jour le compteur de notifications non lues
        const unreadCount = updatedNotifications.filter(
          (n) => !n.isRead
        ).length;
        (this.messageService as any).notificationCount.next(unreadCount);

        // Mettre à jour le cache de notifications dans le service
        this.updateNotificationCache(updatedNotifications);

        // Appeler le service pour marquer la notification comme lue
        this.messageService
          .markAsRead([notificationId])
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: (result) => {
              console.log('Mark as read result:', result);
              if (result && result.success) {
                console.log('Notification marked as read successfully');
                // Si l'erreur était liée à cette opération, la réinitialiser
                if (this.error && this.error.message.includes('mark')) {
                  this.error = null;
                }
              }
            },
            error: (err) => {
              console.error('Error marking notification as read:', err);
              console.error('Error details:', {
                message: err.message,
                stack: err.stack,
                notificationId,
              });
              // Ne pas définir d'erreur pour éviter de perturber l'interface utilisateur
              // this.error = err;
            },
          });
      } else {
        console.warn('Notification not found in local cache:', notificationId);

        // Forcer le rechargement des notifications
        this.loadNotifications();
      }
    });
  }

  // Méthode pour mettre à jour le cache de notifications dans le service
  private updateNotificationCache(notifications: any[]): void {
    // Mettre à jour le cache de notifications dans le service
    const notificationCache = (this.messageService as any).notificationCache;
    if (notificationCache) {
      notifications.forEach((notification) => {
        notificationCache.set(notification.id, notification);
      });

      // Forcer la mise à jour du compteur
      const unreadCount = notifications.filter((n) => !n.isRead).length;
      (this.messageService as any).notificationCount.next(unreadCount);

      console.log('Notification cache updated, new unread count:', unreadCount);
    }
  }

  markAllAsRead(): void {
    console.log('Marking all notifications as read');

    this.notifications$.pipe(take(1)).subscribe((notifications) => {
      console.log('All notifications:', notifications);
      const unreadIds = notifications.filter((n) => !n.isRead).map((n) => n.id);

      console.log('Unread notification IDs to mark as read:', unreadIds);

      if (unreadIds.length === 0) {
        console.log('No unread notifications to mark as read');
        return;
      }

      // Vérifier que tous les IDs sont valides
      const validIds = unreadIds.filter(
        (id) => id && typeof id === 'string' && id.trim() !== ''
      );

      if (validIds.length !== unreadIds.length) {
        console.error('Some notification IDs are invalid:', unreadIds);
        this.error = new Error('Invalid notification IDs');
        return;
      }

      console.log('Marking all notifications as read:', validIds);

      // Mettre à jour localement toutes les notifications
      const updatedNotifications = notifications.map((n) =>
        validIds.includes(n.id)
          ? { ...n, isRead: true, readAt: new Date().toISOString() }
          : n
      );

      // Mettre à jour l'interface utilisateur immédiatement
      (this.messageService as any).notifications.next(updatedNotifications);

      // Mettre à jour le compteur de notifications non lues
      const unreadCount = updatedNotifications.filter((n) => !n.isRead).length;
      (this.messageService as any).notificationCount.next(unreadCount);

      // Mettre à jour le cache de notifications dans le service
      this.updateNotificationCache(updatedNotifications);

      // Appeler le service pour marquer toutes les notifications comme lues
      this.messageService
        .markAsRead(validIds)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (result) => {
            console.log('Mark all as read result:', result);
            if (result && result.success) {
              console.log('All notifications marked as read successfully');
              // Si l'erreur était liée à cette opération, la réinitialiser
              if (this.error && this.error.message.includes('mark')) {
                this.error = null;
              }
            }
          },
          error: (err) => {
            console.error('Error marking all notifications as read:', err);
            console.error('Error details:', {
              message: err.message,
              stack: err.stack,
            });
            // Ne pas définir d'erreur pour éviter de perturber l'interface utilisateur
            // this.error = err;
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
    console.log(
      `Filtre des notifications non lues ${
        this.showOnlyUnread ? 'activé' : 'désactivé'
      }`
    );

    if (this.showOnlyUnread) {
      // Utiliser la méthode du service pour obtenir uniquement les notifications non lues
      this.filteredNotifications$ =
        this.messageService.getUnreadNotifications();
    } else {
      // Afficher toutes les notifications
      this.filteredNotifications$ = this.notifications$;
    }
  }

  /**
   * Active/désactive le son des notifications
   */
  toggleSound(): void {
    this.isSoundMuted = !this.isSoundMuted;
    console.log(
      `Son des notifications ${this.isSoundMuted ? 'désactivé' : 'activé'}`
    );

    // Utiliser la méthode du service pour activer/désactiver le son
    this.messageService.setMuted(this.isSoundMuted);

    // Tester le son si activé
    if (!this.isSoundMuted) {
      console.log('Test du son de notification...');

      // Jouer le son après un court délai pour s'assurer que le navigateur est prêt
      setTimeout(() => {
        // Jouer le son deux fois pour s'assurer qu'il est audible
        this.messageService.playNotificationSound();

        // Jouer une deuxième fois après 1 seconde
        setTimeout(() => {
          this.messageService.playNotificationSound();
        }, 1000);
      }, 100);
    }

    // Sauvegarder la préférence dans le localStorage
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
    if (!notificationId) {
      console.error('ID de notification invalide');
      return;
    }

    console.log(
      `Récupération des pièces jointes pour la notification ${notificationId}`
    );

    // Réinitialiser les pièces jointes et afficher le modal
    this.currentAttachments = [];
    this.loadingAttachments = true;
    this.showAttachmentsModal = true;

    // Vérifier d'abord si la notification existe dans le cache local
    let notification: Notification | undefined;

    // Utiliser pipe(take(1)) pour obtenir la valeur actuelle de l'Observable
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
      console.log(
        'Pièces jointes trouvées dans le cache local:',
        notification.message.attachments
      );
      this.loadingAttachments = false;
      // Conversion des pièces jointes au format attendu
      this.currentAttachments = notification.message.attachments.map(
        (attachment: NotificationAttachment) =>
          ({
            id: '', // NotificationAttachment n'a pas d'ID
            url: attachment.url || '',
            type: this.convertAttachmentType(attachment.type),
            name: attachment.name || '',
            size: attachment.size || 0,
            duration: 0, // NotificationAttachment n'a pas de durée
          } as Attachment)
      );
      return;
    }

    // Si aucune pièce jointe n'est trouvée localement, essayer de les récupérer du serveur
    this.messageService
      .getNotificationAttachments(notificationId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (attachments) => {
          console.log(
            `${attachments.length} pièces jointes récupérées du serveur`,
            attachments
          );
          this.loadingAttachments = false;
          this.currentAttachments = attachments;
        },
        error: (err) => {
          console.error(
            'Erreur lors de la récupération des pièces jointes',
            err
          );
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
    console.log('Ouverture des détails de la notification:', notification);
    this.currentNotification = notification;
    this.showNotificationDetailsModal = true;

    // Marquer la notification comme lue
    if (!notification.isRead) {
      this.markAsRead(notification.id);
    }
  }

  /**
   * Ferme le modal des détails de notification
   */
  closeNotificationDetailsModal(): void {
    this.showNotificationDetailsModal = false;
    this.currentNotification = null;
  }

  /**
   * Vérifie si le type de fichier est une image
   * @param type Type MIME du fichier
   * @returns true si c'est une image, false sinon
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
    console.log('Suppression de la notification:', notificationId);

    if (!notificationId) {
      console.error('ID de notification invalide');
      this.error = new Error('ID de notification invalide');
      return;
    }

    // Récupérer les IDs des notifications supprimées du localStorage
    const deletedNotificationIds = this.getDeletedNotificationIds();

    // Ajouter l'ID de la notification à supprimer
    deletedNotificationIds.add(notificationId);

    // Sauvegarder les IDs dans le localStorage
    this.saveDeletedNotificationIds(deletedNotificationIds);

    // Appeler le service pour supprimer la notification
    this.messageService
      .deleteNotification(notificationId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result) => {
          console.log('Résultat de la suppression:', result);
          if (result && result.success) {
            console.log('Notification supprimée avec succès');
            // Si l'erreur était liée à cette opération, la réinitialiser
            if (this.error && this.error.message.includes('suppression')) {
              this.error = null;
            }
          }
        },
        error: (err) => {
          console.error(
            'Erreur lors de la suppression de la notification:',
            err
          );
          // Même en cas d'erreur, conserver l'ID dans le localStorage
          this.error = err;
        },
      });
  }

  /**
   * Supprime toutes les notifications et les stocke dans le localStorage
   */
  deleteAllNotifications(): void {
    console.log('Suppression de toutes les notifications');

    // Récupérer toutes les notifications actuelles
    this.notifications$.pipe(take(1)).subscribe((notifications) => {
      // Récupérer les IDs des notifications supprimées du localStorage
      const deletedNotificationIds = this.getDeletedNotificationIds();

      // Ajouter tous les IDs des notifications actuelles
      notifications.forEach((notification) => {
        deletedNotificationIds.add(notification.id);
      });

      // Sauvegarder les IDs dans le localStorage
      this.saveDeletedNotificationIds(deletedNotificationIds);

      // Appeler le service pour supprimer toutes les notifications
      this.messageService
        .deleteAllNotifications()
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (result) => {
            console.log(
              'Résultat de la suppression de toutes les notifications:',
              result
            );
            if (result && result.success) {
              console.log(
                `${result.count} notifications supprimées avec succès`
              );
              // Si l'erreur était liée à cette opération, la réinitialiser
              if (this.error && this.error.message.includes('suppression')) {
                this.error = null;
              }
            }
          },
          error: (err) => {
            console.error(
              'Erreur lors de la suppression de toutes les notifications:',
              err
            );
            // Même en cas d'erreur, conserver les IDs dans le localStorage
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
      console.error(
        'Erreur lors de la récupération des IDs de notifications supprimées:',
        error
      );
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
      console.log(
        `${deletedIds.size} IDs de notifications supprimées sauvegardés dans le localStorage`
      );
    } catch (error) {
      console.error(
        'Erreur lors de la sauvegarde des IDs de notifications supprimées:',
        error
      );
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
    if (this.selectedNotifications.size === 0) {
      return;
    }

    const selectedIds = Array.from(this.selectedNotifications);
    console.log('Suppression des notifications sélectionnées:', selectedIds);

    // Supprimer localement les notifications sélectionnées
    this.notifications$.pipe(take(1)).subscribe((notifications) => {
      const updatedNotifications = notifications.filter(
        (notification) => !this.selectedNotifications.has(notification.id)
      );

      // Mettre à jour l'interface utilisateur immédiatement
      (this.messageService as any).notifications.next(updatedNotifications);

      // Mettre à jour le compteur de notifications non lues
      const unreadCount = updatedNotifications.filter((n) => !n.isRead).length;
      (this.messageService as any).notificationCount.next(unreadCount);

      // Mettre à jour le cache de notifications dans le service
      this.updateNotificationCache(updatedNotifications);

      // Réinitialiser la sélection
      this.selectedNotifications.clear();
      this.allSelected = false;
      this.showSelectionBar = false;
    });

    // Appeler le service pour supprimer les notifications sélectionnées
    this.messageService
      .deleteMultipleNotifications(selectedIds)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result) => {
          console.log('Résultat de la suppression multiple:', result);
          if (result && result.success) {
            console.log(`${result.count} notifications supprimées avec succès`);
          }
        },
        error: (err) => {
          console.error(
            'Erreur lors de la suppression multiple des notifications:',
            err
          );
        },
      });
  }

  /**
   * Marque les notifications sélectionnées comme lues
   */
  markSelectedAsRead(): void {
    if (this.selectedNotifications.size === 0) {
      return;
    }

    const selectedIds = Array.from(this.selectedNotifications);
    console.log(
      'Marquage des notifications sélectionnées comme lues:',
      selectedIds
    );

    // Marquer localement les notifications sélectionnées comme lues
    this.notifications$.pipe(take(1)).subscribe((notifications) => {
      const updatedNotifications = notifications.map((notification) =>
        this.selectedNotifications.has(notification.id)
          ? { ...notification, isRead: true, readAt: new Date().toISOString() }
          : notification
      );

      // Mettre à jour l'interface utilisateur immédiatement
      (this.messageService as any).notifications.next(updatedNotifications);

      // Mettre à jour le compteur de notifications non lues
      const unreadCount = updatedNotifications.filter((n) => !n.isRead).length;
      (this.messageService as any).notificationCount.next(unreadCount);

      // Mettre à jour le cache de notifications dans le service
      this.updateNotificationCache(updatedNotifications);

      // Réinitialiser la sélection
      this.selectedNotifications.clear();
      this.allSelected = false;
      this.showSelectionBar = false;
    });

    // Appeler le service pour marquer les notifications comme lues
    this.messageService
      .markAsRead(selectedIds)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result) => {
          console.log('Résultat du marquage comme lu:', result);
          if (result && result.success) {
            console.log('Notifications marquées comme lues avec succès');
          }
        },
        error: (err) => {
          console.error(
            'Erreur lors du marquage des notifications comme lues:',
            err
          );
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

  /**
   * Convertit un type de pièce jointe de notification en type de message
   * @param type Type de pièce jointe
   * @returns Type de message correspondant
   */
  private convertAttachmentType(type: AttachmentType): MessageType {
    switch (type) {
      case 'IMAGE':
        return MessageType.IMAGE;
      case 'FILE':
        return MessageType.FILE;
      case 'AUDIO':
        return MessageType.AUDIO;
      case 'VIDEO':
        return MessageType.VIDEO;
      case 'image':
        return MessageType.IMAGE_LOWER;
      case 'file':
        return MessageType.FILE_LOWER;
      case 'audio':
        return MessageType.AUDIO_LOWER;
      case 'video':
        return MessageType.VIDEO_LOWER;
      default:
        return MessageType.FILE; // Type par défaut
    }
  }
}
