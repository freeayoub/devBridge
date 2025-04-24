const Message = require("../models/message.model");
const Conversation = require("../models/conversation.model");
const User = require("../models/user.model");
const { pubsub } = require("../config/pubsub");
const { isValidObjectId } = require("mongoose");
const { messageValidators } = require("../validators/message.validators");
const uploadFile = require("../services/fileUpload.service");
const NotificationService = require("./notification.service");
class MessageService {
  constructor() {
    this.pubsub = pubsub;
  }
  async validateUserIds(...userIds) {
    for (const userId of userIds) {
      if (!isValidObjectId(userId)) {
        throw new Error(`Invalid ID: ${userId}`);
      }
    }

    const usersExist = await Promise.all(
      userIds.map(id => User.exists({ _id: id }))
    );

    if (usersExist.some(exists => !exists)) {
      throw new Error("One or more users do not exist");
    }
  }
  safeToISOString(date) {
    if (!date) return null;
    try {
      return date instanceof Date ? date.toISOString() : new Date(date).toISOString();
    } catch {
      return null;
    }
  }

  formatMessageResponse(message) {
    if (!message) throw new Error("Message cannot be null");

    const msg = message.toObject?.() || message;
    return {
      ...msg,
      id: msg._id?.toString(),
      timestamp: this.safeToISOString(msg.timestamp),
      readAt: this.safeToISOString(msg.readAt),
      createdAt: this.safeToISOString(msg.createdAt),
      updatedAt: this.safeToISOString(msg.updatedAt),
    };
  }
// Message operations
async sendMessage({ senderId, receiverId, content, file, context }) {
  try {
       // Validation approfondie
     // Validation approfondie
     if (!senderId || !receiverId) {
      throw new Error('Sender and receiver IDs are required');
    }

    if (!content && !file) {
      throw new Error('Message must have content or file');
    }

    // Vérification que l'expéditeur est bien l'utilisateur authentifié
    if (context.userId !== senderId) {
      throw new Error('Unauthorized to send message as another user');
    }


    await this.validateUserIds(senderId, receiverId);

    let attachments = [];
    if (file) {
      const { createReadStream, filename, mimetype } = await file;
      const stream = createReadStream();
      const url = await uploadFile(stream, filename, { 
        mime_type: mimetype, 
        folder: "message_attachments" 
      });

      const type = mimetype.startsWith("image/") ? "image" : 
                  mimetype.startsWith("audio/") ? "audio" : "file";
      attachments.push({ url, type, name: filename, size: 0 });
    }

    // Find or create conversation with proper error handling
    let conversation = await Conversation.findOne({
      participants: { $all: [senderId, receiverId], $size: 2 }
    });

    if (!conversation) {
      conversation = new Conversation({
        participants: [senderId, receiverId],
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      await conversation.save();
    }

    // Create and save message
    const message = new Message({
      senderId,
      receiverId,
      content,
      attachments,
      type: attachments.length ? attachments[0].type : "text",
      conversationId: conversation._id,
      status: "sent",
      timestamp: new Date(),
    });

    await message.save();

    // Update conversation
    conversation.messages.push(message._id);
    conversation.lastMessage = message._id;
    conversation.updatedAt = new Date();
    await conversation.save();

    // Format response
    const responseMessage = this.formatMessageResponse(message);

    // Publish events
    this.publishMessageEvent({
      eventType: "MESSAGE_SENT",
      conversationId: conversation._id,
      senderId,
      receiverId,
      message: responseMessage
    });

    // Send notification
    await NotificationService.sendMessageNotification(message);

    return responseMessage;
  } catch (error) {
    console.error("Error in sendMessage:", error);
    throw new Error(`Failed to send message: ${error.message}`);
  }
}

async sendGroupMessage({ senderId, groupId, content, attachments = [], type = "text" }) {
  await this.validateUserIds(senderId, ...groupId.participants);

  const conversation = await Conversation.findById(groupId);
  if (!conversation?.isGroup) {
    throw new Error("Group conversation not found");
  }

  if (!conversation.participants.includes(senderId)) {
    throw new Error("Not a group member");
  }

  const message = new Message({
    sender: senderId,
    group: groupId,
    content,
    attachments,
    type,
    conversationId: conversation._id,
    status: "sent",
  });
  await message.save();

  // Update conversation
  conversation.messages.push(message._id);
  conversation.lastMessage = message._id;
  conversation.updatedAt = new Date();
  await conversation.save();

  // Publish events
  this.publishMessageEvent({
    eventType: "GROUP_MESSAGE_SENT",
    conversationId: groupId,
    senderId,
    message
  });

  // Send notifications
  await NotificationService.sendMessageNotification(message);

  return message;
}
  async editMessage({ messageId, userId, newContent }) {
    const message = await Message.findById(messageId);
    if (!message) {
      throw new Error("Message not found");
    }

    if (message.sender.toString() !== userId.toString()) {
      throw new Error("Unauthorized to edit this message");
    }

    if (message.isDeleted) {
      throw new Error("Cannot edit a deleted message");
    }

    message.content = newContent;
    message.isEdited = true;
    await message.save();

    // Publish update event
    this.pubsub.publish(`MESSAGE_UPDATED_${message.conversationId}`, {
      messageUpdated: message,
    });

    return message;
  }

  async deleteMessage({ messageId, userId }) {
    const message = await Message.findById(messageId);
    if (!message) {
      throw new Error("Message not found");
    }

    if (message.sender.toString() !== userId.toString()) {
      throw new Error("Unauthorized to delete this message");
    }

    message.isDeleted = true;
    await message.save();

    // Publish delete event
    this.pubsub.publish(`MESSAGE_DELETED_${message.conversationId}`, {
      messageDeleted: message,
    });

    return message;
  }

  async reactToMessage({ messageId, userId, emoji }) {
    const message = await Message.findById(messageId);
    if (!message) {
      throw new Error("Message not found");
    }

    // Check if user already reacted with this emoji
    const existingReactionIndex = message.reactions.findIndex(
      (r) => r.userId.toString() === userId.toString() && r.emoji === emoji
    );

    if (existingReactionIndex >= 0) {
      // Remove reaction
      message.reactions.splice(existingReactionIndex, 1);
    } else {
      // Add reaction
      message.reactions.push({
        userId,
        emoji,
      });
    }

    await message.save();

    // Publish reaction event
    this.pubsub.publish(`MESSAGE_REACTION_${message.conversationId}`, {
      messageReaction: {
        messageId: message._id,
        reactions: message.reactions,
      },
    });

    return message;
  }

  async forwardMessage({ messageId, userId, conversationIds }) {
    const originalMessage = await Message.findById(messageId);
    if (!originalMessage) {
      throw new Error("Message not found");
    }

    const forwardedMessages = [];

    for (const conversationId of conversationIds) {
      const conversation = await Conversation.findById(conversationId);
      if (!conversation) {
        continue;
      }
      if (!conversation.participants.includes(userId)) {
        continue;
      }

      const forwardedMessage = new Message({
        content: originalMessage.content,
        type: originalMessage.type,
        sender: userId,
        conversationId,
        attachments: originalMessage.attachments,
        forwardedFrom: originalMessage._id,
        status: "sent",
      });

      if (conversation.isGroup) {
        forwardedMessage.group = conversationId;
      } else {
        const receiverId = conversation.participants.find(
          (p) => p.toString() !== userId.toString()
        );
        forwardedMessage.receiver = receiverId;
      }

      await forwardedMessage.save();

      // Update conversation
      conversation.messages.push(forwardedMessage._id);
      conversation.lastMessage = forwardedMessage._id;
      await conversation.save();

      // Publish events
      if (conversation.isGroup) {
        this.pubsub.publish(`GROUP_MESSAGE_${conversationId}`, {
          groupMessageSent: forwardedMessage,
        });
      } else {
        this.pubsub.publish(`MESSAGE_SENT_${conversationId}`, {
          messageSent: forwardedMessage,
        });
      }

      forwardedMessages.push(forwardedMessage);
    }

    return forwardedMessages;
  }

  async pinMessage({ messageId, userId, conversationId }) {
    const message = await Message.findById(messageId);
    if (!message) {
      throw new Error("Message not found");
    }

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    // Check if user is participant
    if (!conversation.participants.includes(userId)) {
      throw new Error("Unauthorized to pin messages in this conversation");
    }

    // Check if message is already pinned
    const isPinned = conversation.pinnedMessages.includes(messageId);

    if (isPinned) {
      // Unpin the message
      conversation.pinnedMessages = conversation.pinnedMessages.filter(
        (id) => id.toString() !== messageId.toString()
      );
      message.pinned = false;
    } else {
      // Pin the message
      conversation.pinnedMessages.push(messageId);
      message.pinned = true;
    }

    await Promise.all([conversation.save(), message.save()]);

    // Publish pin event
    this.pubsub.publish(`CONVERSATION_UPDATED_${conversationId}`, {
      conversationUpdated: conversation,
    });

    return message;
  }

  async searchMessages({
    userId,
    query,
    conversationId = null,
    limit = 20,
    offset = 0,
  }) {
    const searchQuery = {
      $or: [
        { content: { $regex: query, $options: "i" } },
        { "attachments.name": { $regex: query, $options: "i" } },
      ],
      isDeleted: false,
    };

    if (conversationId) {
      // Search in specific conversation
      const conversation = await Conversation.findById(conversationId);
      if (!conversation || !conversation.participants.includes(userId)) {
        throw new Error("Conversation not found or unauthorized");
      }
      searchQuery.conversationId = conversationId;
    } else {
      // Search across all user's conversations
      const conversations = await Conversation.find({
        participants: userId,
      });
      searchQuery.conversationId = {
        $in: conversations.map((c) => c._id),
      };
    }

    const messages = await Message.find(searchQuery)
      .sort({ timestamp: -1 })
      .skip(offset)
      .limit(limit)
      .populate("sender", "username email image")
      .populate("receiver", "username email image")
      .populate("group", "groupName groupPhoto");

    return messages;
  }

  async startTyping({ userId, conversationId }) {
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    if (!conversation.participants.includes(userId)) {
      throw new Error("Unauthorized");
    }

    if (!conversation.typingUsers.includes(userId)) {
      conversation.typingUsers.push(userId);
      await conversation.save();
    }

    // Publish typing event to all participants except sender
    this.pubsub.publish(`TYPING_INDICATOR_${conversationId}`, {
      typingIndicator: {
        conversationId,
        userId,
        isTyping: true,
      },
    });

    return conversation;
  }

  async stopTyping({ userId, conversationId }) {
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    if (!conversation.participants.includes(userId)) {
      throw new Error("Unauthorized");
    }

    conversation.typingUsers = conversation.typingUsers.filter(
      (id) => id.toString() !== userId.toString()
    );
    await conversation.save();

    // Publish typing event to all participants except sender
    this.pubsub.publish(`TYPING_INDICATOR_${conversationId}`, {
      typingIndicator: {
        conversationId,
        userId,
        isTyping: false,
      },
    });

    return conversation;
  }

  async markAsRead({ messageId, userId }) {
    if (!userId) throw new Error("Unauthorized: Authentication required");

    try {
      const message = await Message.findById(messageId);
      if (!message) throw new Error("Message not found");

      if (message.receiver?.toString() !== userId) {
        throw new Error(
          "Unauthorized: You can only mark your own messages as read"
        );
      }

      if (message.isRead) {
        return this.formatMessageResponse(message);
      }

      const updatedMessage = await Message.findByIdAndUpdate(
        messageId,
        {
          isRead: true,
          readAt: new Date(),
          status: "read",
        },
        { new: true }
      );

      // Publish to both old and new channels
      this.pubsub.publish(`MESSAGE_READ_${message.sender}_${userId}`, {
        messageRead: {
          messageId: updatedMessage._id.toString(),
          readerId: userId,
          readAt: updatedMessage.readAt.toISOString(),
        },
      });
      this.pubsub.publish(`MESSAGE_READ_${message.sender}`, {
        messageRead: {
          messageId: updatedMessage._id.toString(),
          readerId: userId,
          readAt: updatedMessage.readAt.toISOString(),
        },
      });

      await Conversation.updateOne(
        { _id: message.conversationId },
        { $set: { [`lastRead.${userId}`]: new Date() } }
      );

      return this.formatMessageResponse(updatedMessage);
    } catch (error) {
      console.error(`[Message Read Error] ID: ${messageId}`, error);
      throw new Error(
        error.message.startsWith("Unauthorized")
          ? error.message
          : "Failed to update message status"
      );
    }
  }

  publishMessageEvent({ eventType, conversationId, senderId, receiverId, message }) {
    const eventMap = {
      MESSAGE_SENT: [
        `MESSAGE_SENT_${senderId}_${receiverId}`,
        `MESSAGE_SENT_${conversationId}`,
        `UNREAD_MESSAGES_${receiverId}`
      ],
      GROUP_MESSAGE_SENT: [
        `GROUP_MESSAGE_${conversationId}`,
        ...message.group.participants
          .filter(id => id.toString() !== senderId.toString())
          .map(id => `USER_${id}`)
      ]
    };

    const channels = eventMap[eventType];
    if (!channels) return;

    channels.forEach(channel => {
      this.pubsub.publish(channel, {
        [channel.startsWith('GROUP_') ? 'groupMessageSent' : 'messageSent']: message
      });
    });
  }
}

module.exports = new MessageService();
