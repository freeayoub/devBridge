const Conversation = require("../models/conversation.model");
const User = require("../models/User");
const pubsub = require("../config/pubsub");
const Notification = require("../models/notification.model");

class NotificationService {
  constructor() {
    this.pubsub = pubsub;
    this.Notification = Notification;
  }
  async sendPushNotification(userId, notificationData) {
    try {
      console.log(
        `[NotificationService] 🚀 INSTANT NOTIFICATION: Sending to user ${userId}`
      );

      // Créer une nouvelle notification MongoDB avec timestamp précis
      const savedNotification = await this.Notification.create({
        ...notificationData,
        userId,
        timestamp: new Date(),
        createdAt: new Date(),
      });

      console.log(
        `[NotificationService] ✅ Notification saved to DB: ${savedNotification._id}`
      );

      // PUBLICATION INSTANTANÉE via WebSocket
      const notificationPayload = {
        notificationReceived: {
          ...savedNotification.toObject(),
          id: savedNotification._id.toString(),
          senderId: savedNotification.senderId
            ? {
                id:
                  savedNotification.senderId._id?.toString() ||
                  savedNotification.senderId.toString(),
                username: savedNotification.senderId.username || "Unknown User",
                image: savedNotification.senderId.image || null,
              }
            : null,
        },
      };

      // Publier IMMÉDIATEMENT via WebSocket
      console.log(
        `[NotificationService] 📡 Publishing WebSocket event to NOTIFICATION_${userId}`
      );
      this.pubsub.publish(`NOTIFICATION_${userId}`, notificationPayload);

      // Mettre à jour l'utilisateur en arrière-plan (non-bloquant)
      setImmediate(async () => {
        try {
          await User.findByIdAndUpdate(userId, {
            $inc: { notificationCount: 1 },
            lastNotification: new Date(),
          });
          console.log(
            `[NotificationService] 📊 User notification count updated for ${userId}`
          );
        } catch (updateError) {
          console.error(
            `[NotificationService] ⚠️ Error updating user count:`,
            updateError
          );
        }
      });

      console.log(
        `[NotificationService] ⚡ INSTANT notification sent successfully to ${userId}`
      );
      return true;
    } catch (error) {
      console.error(
        `[NotificationService] ❌ CRITICAL: Notification error for ${userId}:`,
        error
      );
      return false;
    }
  }

  async markAsRead(userId, notificationIds) {
    try {
      if (!Array.isArray(notificationIds) || notificationIds.length === 0) {
        throw new Error("No notification IDs provided");
      }
      const notifications = await Notification.find({
        _id: { $in: notificationIds },
        userId,
      });

      if (notifications.length !== notificationIds.length) {
        throw new Error("Some notifications do not belong to the user");
      }

      // Mettre à jour les notifications
      await Notification.updateMany(
        {
          _id: { $in: notificationIds },
          isRead: false,
        },
        {
          $set: { isRead: true, readAt: new Date() },
        }
      );

      // Publier l'événement
      this.pubsub.publish(`NOTIFICATION_READ_${userId}`, {
        notificationsRead: notificationIds,
      });

      // Mettre à jour le compteur
      const updatedUser = await User.findByIdAndUpdate(
        userId,
        { $inc: { notificationCount: -notificationIds.length } },
        { new: true }
      );

      return {
        success: true,
        readCount: notificationIds.length,
        remainingCount: updatedUser.notificationCount,
      };
    } catch (error) {
      console.error("Error marking notifications as read:", error);
      throw error;
    }
  }

  async sendMessageNotification(message) {
    try {
      console.log(
        `[NotificationService] ⚡ INSTANT MESSAGE NOTIFICATION: Processing message ${message._id}`
      );

      // Déterminer le destinataire de la notification RAPIDEMENT
      let receiverId = null;
      const senderId = message.senderId || message.sender;

      // Si c'est un message de groupe
      if (message.group) {
        console.log(
          `[NotificationService] 👥 Group message detected, getting participants`
        );
        receiverId = await this.getGroupParticipants(message.group);
      }
      // Si c'est un message privé
      else if (message.receiverId) {
        console.log(
          `[NotificationService] 💬 Private message detected, receiver: ${message.receiverId}`
        );
        receiverId = message.receiverId;
      }
      // Si le message a un champ receiver (objet)
      else if (message.receiver) {
        console.log(
          `[NotificationService] 📨 Message with receiver object detected`
        );
        receiverId = message.receiver._id || message.receiver;
      }

      if (!receiverId) {
        console.error(
          `[NotificationService] ❌ No receiver found for message: ${message._id}`
        );
        return;
      }

      // Créer la notification OPTIMISÉE
      const notification = {
        type: "NEW_MESSAGE",
        messageId: message._id,
        senderId: senderId,
        content: message.content
          ? message.content.substring(0, 100)
          : message.type === "VOICE_MESSAGE"
          ? "🎤 Voice message"
          : message.type === "IMAGE"
          ? "📷 Image"
          : message.type === "FILE"
          ? "📎 File"
          : "New message",
        isRead: false,
        createdAt: new Date(),
        timestamp: new Date(),
      };

      console.log(
        `[NotificationService] 📋 Notification object created for ${
          Array.isArray(receiverId)
            ? receiverId.length + " recipients"
            : "1 recipient"
        }`
      );

      // ENVOI PARALLÈLE ET INSTANTANÉ
      if (Array.isArray(receiverId)) {
        console.log(
          `[NotificationService] 🚀 Sending to ${receiverId.length} group recipients INSTANTLY`
        );

        // Filtrer l'expéditeur et envoyer en parallèle
        const recipients = receiverId.filter(
          (id) => id.toString() !== senderId.toString()
        );

        // Envoi PARALLÈLE pour performance maximale
        const notificationPromises = recipients.map((id) =>
          this.sendPushNotification(id, notification)
        );

        await Promise.all(notificationPromises);
        console.log(
          `[NotificationService] ✅ Group notifications sent to ${recipients.length} users`
        );
      } else {
        // Vérifier que ce n'est pas l'expéditeur qui se notifie lui-même
        if (receiverId.toString() !== senderId.toString()) {
          console.log(
            `[NotificationService] 🎯 Sending to single recipient: ${receiverId}`
          );
          await this.sendPushNotification(receiverId, notification);
          console.log(`[NotificationService] ✅ Private notification sent`);
        } else {
          console.log(`[NotificationService] 🔄 Skipping self-notification`);
        }
      }

      console.log(
        `[NotificationService] ⚡ INSTANT message notification completed successfully`
      );
    } catch (error) {
      console.error(
        `[NotificationService] ❌ CRITICAL: Error sending message notification:`,
        error
      );
      console.error(`[NotificationService] Error stack:`, error.stack);
      // Ne pas bloquer l'envoi du message même si la notification échoue
    }
  }

  async getGroupParticipants(groupId) {
    try {
      const conversation = await Conversation.findById(groupId)
        .select("participants")
        .lean();
      return conversation.participants || [];
    } catch (error) {
      console.error("Error retrieving group participants:", error);
      return [];
    }
  }

  async getUserNotifications(userId) {
    console.log(
      "NotificationService.getUserNotifications called with userId:",
      userId
    );

    try {
      console.log("Executing Notification.find query for all notifications");

      // Récupérer toutes les notifications dans la base de données
      const allNotifications = await this.Notification.find({})
        .sort({ createdAt: -1 })
        .populate("senderId", "username image")
        .populate("message", "content");

      console.log(
        "Total notifications found in database:",
        allNotifications.length
      );

      // Afficher toutes les notifications pour le débogage
      allNotifications.forEach((notif, index) => {
        console.log(`Notification ${index + 1}:`, {
          id: notif._id.toString(),
          userId: notif.userId.toString(),
          type: notif.type,
          content: notif.content,
          isRead: notif.isRead,
          senderId: notif.senderId ? notif.senderId._id.toString() : "N/A",
        });
      });

      console.log("First notification (if any):", allNotifications[0]);

      return allNotifications;
    } catch (error) {
      console.error(
        "Error in NotificationService.getUserNotifications:",
        error
      );
      console.error("Error stack:", error.stack);
      throw error;
    }
  }

  async sendFriendRequestNotification({ senderId, receiverId }) {
    const notification = {
      type: "FRIEND_REQUEST",
      senderId,
      content: "You have a new friend request",
      isRead: false,
    };

    return this.sendPushNotification(receiverId, notification);
  }

  async sendGroupInviteNotification({ senderId, receiverId, groupId }) {
    const group = await Conversation.findById(groupId).select("groupName");

    const notification = {
      type: "GROUP_INVITE",
      senderId,
      relatedEntity: groupId,
      content: `You've been invited to join ${group.groupName}`,
      isRead: false,
    };

    return this.sendPushNotification(receiverId, notification);
  }

  /**
   * Supprime une notification spécifique
   * @param {string} notificationId - ID de la notification à supprimer
   * @param {string} userId - ID de l'utilisateur
   * @returns {Promise<Object>} - Résultat de l'opération
   */
  async deleteNotification(notificationId, userId) {
    console.log(
      `[NotificationService] Deleting notification ${notificationId} for user ${userId}`
    );

    try {
      // Vérifier si la notification existe
      const notification = await this.Notification.findById(notificationId);

      if (!notification) {
        console.error(
          `[NotificationService] Notification ${notificationId} not found`
        );
        return {
          success: false,
          message: "Notification not found",
        };
      }

      // Supprimer la notification
      await this.Notification.findByIdAndDelete(notificationId);

      console.log(
        `[NotificationService] Notification ${notificationId} deleted successfully`
      );

      return {
        success: true,
        message: "Notification deleted successfully",
      };
    } catch (error) {
      console.error(
        `[NotificationService] Error deleting notification:`,
        error
      );
      console.error(`[NotificationService] Error stack:`, error.stack);

      return {
        success: false,
        message: `Failed to delete notification: ${error.message}`,
      };
    }
  }

  /**
   * Supprime toutes les notifications d'un utilisateur
   * @param {string} userId - ID de l'utilisateur
   * @returns {Promise<Object>} - Résultat de l'opération
   */
  async deleteAllNotifications(userId) {
    console.log(
      `[NotificationService] Deleting all notifications for user ${userId}`
    );

    try {
      // Compter les notifications avant de les supprimer
      const count = await this.Notification.countDocuments({});

      // Supprimer toutes les notifications
      const result = await this.Notification.deleteMany({});

      console.log(
        `[NotificationService] Deleted ${result.deletedCount} notifications`
      );

      return {
        success: true,
        count: result.deletedCount,
        message: `${result.deletedCount} notifications deleted successfully`,
      };
    } catch (error) {
      console.error(
        `[NotificationService] Error deleting all notifications:`,
        error
      );
      console.error(`[NotificationService] Error stack:`, error.stack);

      return {
        success: false,
        count: 0,
        message: `Failed to delete notifications: ${error.message}`,
      };
    }
  }

  /**
   * Supprime plusieurs notifications
   * @param {string[]} notificationIds - IDs des notifications à supprimer
   * @param {string} userId - ID de l'utilisateur
   * @returns {Promise<Object>} - Résultat de l'opération
   */
  async deleteMultipleNotifications(notificationIds, userId) {
    console.log(
      `[NotificationService] Deleting multiple notifications for user ${userId}: ${notificationIds.join(
        ", "
      )}`
    );

    try {
      if (!Array.isArray(notificationIds) || notificationIds.length === 0) {
        return {
          success: false,
          count: 0,
          message: "No notification IDs provided",
        };
      }

      // Supprimer les notifications
      const result = await this.Notification.deleteMany({
        _id: { $in: notificationIds },
      });

      console.log(
        `[NotificationService] Deleted ${result.deletedCount} notifications`
      );

      return {
        success: true,
        count: result.deletedCount,
        message: `${result.deletedCount} notifications deleted successfully`,
      };
    } catch (error) {
      console.error(
        `[NotificationService] Error deleting multiple notifications:`,
        error
      );
      console.error(`[NotificationService] Error stack:`, error.stack);

      return {
        success: false,
        count: 0,
        message: `Failed to delete notifications: ${error.message}`,
      };
    }
  }
}

module.exports = new NotificationService();
