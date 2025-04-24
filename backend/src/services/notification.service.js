
const Conversation = require('../models/conversation.model');
const User = require('../models/user.model');
const { pubsub } = require('../config/pubsub');

class NotificationService {
  constructor() {
    this.pubsub = pubsub;
  }
  async sendPushNotification(userId, notification) {
    try {
      // Publish to GraphQL subscription
      this.pubsub.publish(`NOTIFICATION_${userId}`, {
        notificationReceived: {
          ...notification,
          id: notification._id?.toString() || Math.random().toString(36).substring(2),
          timestamp: new Date().toISOString()
        }
      });

      // Update user's notification count
      await User.findByIdAndUpdate(userId, {
        $inc: { notificationCount: 1 },
        lastNotification: new Date()
      });

      return true;
    } catch (error) {
      console.error('Notification error:', error);
      return false;
    }
  }

 
  async markAsRead(userId, notificationIds) {
    try {
      this.pubsub.publish(`NOTIFICATION_READ_${userId}`, {
        notificationsRead: notificationIds
      });

      await User.findByIdAndUpdate(userId, {
        $inc: { notificationCount: -notificationIds.length },
        $pull: { unreadNotifications: { $in: notificationIds } }
      });

      return true;
    } catch (error) {
      console.error('Mark as read error:', error);
      return false;
    }
  }
 
  async sendMessageNotification(message) {
    try {
      const receiverId = message.receiver || 
                        (message.group ? await this.getGroupParticipants(message.group) : null);
      if (!receiverId) return;

      const notification = {
        type: 'NEW_MESSAGE',
        messageId: message._id,
        senderId: message.sender,
        content: message.content.substring(0, 100), // Truncate long messages
        isRead: false
      };

      if (Array.isArray(receiverId)) {
        // Group message - notify all except sender
        await Promise.all(
          receiverId
            .filter(id => id.toString() !== message.sender.toString())
            .map(id => this.sendPushNotification(id, notification))
        );
      } else {
        // Direct message
        await this.sendPushNotification(receiverId, notification);
      }
    } catch (error) {
      console.error('Message notification error:', error);
    }
  }


  async getGroupParticipants(groupId) {
    try {
      const conversation = await Conversation.findById(groupId)
        .select('participants')
        .lean();
      return conversation?.participants || [];
    } catch (error) {
      console.error('Get group participants error:', error);
      return [];
    }
  }
}

module.exports = new NotificationService();