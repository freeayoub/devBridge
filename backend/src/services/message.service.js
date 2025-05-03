const Message = require("../models/message.model");
const Conversation = require("../models/conversation.model");
const User = require("../models/user.model");
const { pubsub } = require("../config/pubsub");
const { isValidObjectId } = require("mongoose");
const uploadFile = require("../services/fileUpload.service");
const NotificationService = require("./notification.service");
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");
class MessageService {
  constructor() {
    this.pubsub = pubsub || {
      publish: (channel, payload) => {
        console.log(`Would publish to ${channel}:`, payload);
      },
    };
  }
  async validateUserIds(...userIds) {
    for (const userId of userIds) {
      if (!isValidObjectId(userId)) {
        throw new Error(`Invalid ID: ${userId}`);
      }
    }

    const usersExist = await Promise.all(
      userIds.map((id) => User.exists({ _id: id }))
    );

    if (usersExist.some((exists) => !exists)) {
      throw new Error("One or more users do not exist");
    }
  }
  safeToISOString(date) {
    if (!date) return null;
    try {
      return date instanceof Date
        ? date.toISOString()
        : new Date(date).toISOString();
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
  async generateThumbnail(originalUrl) {
    try {
      // Skip thumbnail generation for remote URLs
      if (originalUrl.startsWith("http")) {
        return originalUrl; // Return original URL for remote files
      }

      const filename = path.basename(originalUrl);
      const thumbFilename = `thumb_${filename}`;
      const thumbPath = path.join(
        __dirname,
        "../uploads/thumbnails",
        thumbFilename
      );

      if (!fs.existsSync(path.dirname(thumbPath))) {
        fs.mkdirSync(path.dirname(thumbPath), { recursive: true });
      }

      await sharp(originalUrl).resize(200, 200).toFile(thumbPath);

      return `/thumbnails/${thumbFilename}`;
    } catch (error) {
      console.error("Error generating thumbnail:", error);
      return originalUrl;
    }
  }
  async getMediaDuration(url) {
    return 0; 
  }
  async getConversation(conversationId, userId) {
    try {
      if (!isValidObjectId(conversationId)) {
        throw new Error('Invalid conversation ID');
      }
      if (!isValidObjectId(userId)) {
        throw new Error('Invalid user ID');
      }
  
      const conversation = await Conversation.findOne({
        _id: conversationId,
        participants: userId,
      })
      .populate({
        path: 'participants',
        select: '_id username',
      })
      .populate({
        path: 'lastMessage',
        select: '_id content',
        options: { lean: true }
      })
      .lean();
  
      if (!conversation) {
        return null; // Or return an empty conversation object if preferred
      }
  
      return {
        id: conversation._id.toString(),
        participants: conversation.participants.map(p => ({
          id: p._id.toString(),
          username: p.username
        })),
        lastMessage: conversation.lastMessage ? {
          id: conversation.lastMessage._id.toString(),
          content: conversation.lastMessage.content
        } : null
      };
    } catch (error) {
      console.error('Error in getConversation:', error);
      throw error; // Let GraphQL handle the error
    }
  }
  
  async getConversations(userId) {
    const conversations = await Conversation.find({
      participants: userId,
    })
      .populate({
        path: "participants",
        select: "_id username email image isOnline lastActive",
        match: { _id: { $exists: true } },
      })
      .populate({
        path: "lastMessage",
        select: "_id content timestamp isRead",
        options: { lean: true },
      })
      .lean();

    return Promise.all(
      conversations.map(async (conv) => {
        const validParticipants = conv.participants
          .filter((p) => p && p._id)
          .map((p) => ({
            ...p,
            id: p._id.toString(),
          }));

        const unreadCount = await Message.countDocuments({
          conversationId: conv._id,
          receiverId: userId,
          isRead: false,
        });

        let lastMessage = null;
        if (conv.lastMessage) {
          lastMessage = {
            ...conv.lastMessage,
            id: conv.lastMessage._id.toString(),
            timestamp: this.safeToISOString(conv.lastMessage.timestamp),
            isRead:
              conv.lastMessage.isRead !== undefined
                ? conv.lastMessage.isRead
                : false,
          };
        }

        return {
          ...conv,
          id: conv._id.toString(),
          participants: validParticipants,
          unreadCount,
          updatedAt: this.safeToISOString(conv.updatedAt),
          createdAt: this.safeToISOString(conv.createdAt),
          lastMessage,
        };
      })
    );
  }
  async createGroup({ name, participantIds, photo, userId }) {
    const participants = [...new Set([userId, ...participantIds])];

    if (participants.length < 2) {
      throw new Error("A group must have at least 2 participants");
    }

    let groupPhotoUrl;
    if (photo) {
      const { createReadStream, filename } = await photo;
      const stream = createReadStream();
      groupPhotoUrl = await uploadFile(stream, filename, "image");
    }

    const group = new Conversation({
      participants,
      isGroup: true,
      groupName: name,
      groupPhoto: groupPhotoUrl,
      groupAdmins: [userId],
    });

    await group.save();
    return group;
  }
  async getMessages({ senderId, receiverId, page = 1, limit = 10 }) {
    await this.validateUserIds(senderId, receiverId);
    const safeLimit = Math.min(limit, 100);
    const skip = (page - 1) * safeLimit;

    const messages = await Message.find({
      $or: [
        { senderId, receiverId },
        { senderId: receiverId, receiverId: senderId },
      ],
    })
      .select(
        "_id senderId receiverId content fileUrl isRead timestamp conversationId"
      )
      .sort({ timestamp: 1 })
      .skip(skip)
      .limit(safeLimit)
      .lean();

    return messages.map((msg) => this.formatMessageResponse(msg));
  }

  async getUnreadMessages(userId) {
    const unreadMessages = await Message.find({
      receiverId: userId,
      isRead: false,
      isDeleted: false
    })
      .populate("senderId")
      .populate({
        path: "conversationId",
        model: "Conversation", 
        select: "_id participants isGroup groupName"
      })
      .sort({ timestamp: -1 })
      .lean();
  
    return unreadMessages.map((msg) => {
      const formattedMessage = this.formatMessageResponse(msg);
      
      // Handle sender
      const sender = msg.senderId ? {
        id: msg.senderId._id.toString(),
        username: msg.senderId.username,
        email: msg.senderId.email,
        image: msg.senderId.image,
        isOnline: msg.senderId.isOnline,
      } : {
        id: 'deleted-user',
        username: 'Deleted User',
        email: null,
        image: null,
        isOnline: false
      };
  
      // Handle conversation
      const conversation = msg.conversationId ? {
        id: msg.conversationId._id.toString(),
        participants: msg.conversationId.participants,
        isGroup: msg.conversationId.isGroup || false,
        groupName: msg.conversationId.groupName || null
      } : {
        id: 'unknown-conversation',
        participants: [],
        isGroup: false,
        groupName: null
      };
  
      return {
        ...formattedMessage,
        sender,
        conversation, 
        conversationId: conversation.id
      };
    });
  }

  async sendMessage({ senderId, receiverId, content, file, context }) {
    try {
      // Validate inputs
      if (!senderId || !receiverId) {
        throw new Error("Sender and receiver IDs are required");
      }

      if (!content && !file) {
        throw new Error("Message must have content or file");
      }

      if (context.userId !== senderId) {
        throw new Error("Unauthorized to send message as another user");
      }

      await this.validateUserIds(senderId, receiverId);

      // Handle file upload
      let attachments = [];
      if (file) {
        const { createReadStream, filename, mimetype } = await file;
        const stream = createReadStream();
        const url = await uploadFile(stream, filename, {
          mime_type: mimetype,
          folder: "message_attachments",
        });
        // Determine file type
        let fileType = "file";
        if (mimetype.startsWith("image/")) fileType = "image";
        else if (mimetype.startsWith("audio/")) fileType = "audio";
        else if (mimetype.startsWith("video/")) fileType = "video";

        const attachment = {
          url,
          type: fileType,
          name: filename,
          size: 0, // You may want to get actual file size
          mimeType: fileType !== "file" ? mimetype : undefined,
        };

        // Add thumbnail for images/videos if needed
        if (fileType === "image" || fileType === "video") {
          attachment.thumbnailUrl = await this.generateThumbnail(url);
        }

        // Add duration for audio/video if needed
        if (fileType === "audio" || fileType === "video") {
          attachment.duration = await this.getMediaDuration(url);
        }

        attachments.push(attachment);
      }

      // Find or create conversation
      let conversation = await Conversation.findOne({
        participants: { $all: [senderId, receiverId], $size: 2 },
      });

      if (!conversation) {
        conversation = new Conversation({
          participants: [senderId, receiverId],
          messages: [], // Initialize messages array
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      } else if (!conversation.messages) {
        // Ensure messages array exists
        conversation.messages = [];
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

      // Populate sender data
      const populatedMessage = await Message.populate(message, {
        path: "senderId",
        select: "username email image",
      });

      const responseMessage = this.formatMessageResponse(populatedMessage);

      await this.publishMessageEvent({
        eventType: "MESSAGE_SENT",
        conversationId: conversation._id,
        senderId,
        receiverId,
        message: responseMessage,
      });

      await NotificationService.sendMessageNotification({
        message: responseMessage,
        receiverId,
      });

      return responseMessage;
    } catch (error) {
      console.error("Error in sendMessage:", error);
      throw new Error(`Failed to send message: ${error.message}`);
    }
  }
  async sendGroupMessage({
    senderId,
    groupId,
    content,
    attachments = [],
    type = "text",
  }) {
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
      message,
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
    filters = {}
  }) {
    // Base search query
    const searchQuery = {
      $or: [
        { content: { $regex: query, $options: "i" } },
        { "attachments.name": { $regex: query, $options: "i" } },
      ],
      ...filters // Spread additional filters
    };
  
    // Handle conversation scope
    if (conversationId) {
      const conversation = await Conversation.findById(conversationId);
      if (!conversation || !conversation.participants.includes(userId)) {
        throw new Error("Conversation not found or unauthorized");
      }
      searchQuery.conversationId = conversationId;
    } else {
      const conversations = await Conversation.find({
        participants: userId,
      });
      searchQuery.conversationId = {
        $in: conversations.map((c) => c._id),
      };
    }
  
    // Handle date range filters
    if (filters.dateFrom || filters.dateTo) {
      searchQuery.timestamp = {};
      if (filters.dateFrom) searchQuery.timestamp.$gte = filters.dateFrom;
      if (filters.dateTo) searchQuery.timestamp.$lte = filters.dateTo;
    }
  
    // Execute query
    const messages = await Message.find(searchQuery)
      .sort({ timestamp: -1 })
      .skip(offset)
      .limit(limit)
      .populate("sender", "username email image")
      .populate("receiver", "username email image")
      .populate("group", "groupName groupPhoto");
  
    return messages.map(msg => this.formatMessageResponse(msg));
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
      const conversation = await Conversation.findById(message.conversationId);
      if (!conversation.participants.includes(userId)) {
        throw new Error(
          "Unauthorized: You are not a participant in this conversation"
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

      // Publish events
      this.pubsub.publish(`MESSAGE_READ_${message.conversationId}`, {
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
      throw error; // Re-throw the original error
    }
  }

  async publishMessageEvent({
    eventType,
    conversationId,
    senderId,
    receiverId,
    message,
  }) {
    try {
      const payload = {
        [eventType === "GROUP_MESSAGE_SENT"
          ? "groupMessageSent"
          : "messageSent"]: message,
      };

      // Common channels for all message types
      const commonChannels = [
        `MESSAGE_SENT_${conversationId}`,
        `USER_${senderId}`,
      ];

      // Handle different event types
      if (eventType === "MESSAGE_SENT") {
        // Private message channels
        const privateChannels = [
          `MESSAGE_SENT_${senderId}_${receiverId}`,
          `UNREAD_MESSAGES_${receiverId}`,
          `USER_${receiverId}`,
        ];

        // Publish to all relevant channels
        [...commonChannels, ...privateChannels].forEach((channel) => {
          this.pubsub.publish(channel, payload);
        });
      } else if (eventType === "GROUP_MESSAGE_SENT") {
        let participantIds = [];

        // Try to get participants from message if available
        if (message.group?.participants) {
          participantIds = message.group.participants.filter(
            (id) => id.toString() !== senderId.toString()
          );
        } else {
          // Fallback: fetch conversation if participants not populated
          const conversation = await Conversation.findById(conversationId)
            .select("participants")
            .lean();
          if (conversation) {
            participantIds = conversation.participants
              .map((id) => id.toString())
              .filter((id) => id !== senderId.toString());
          }
        }

        // Group message channels
        const groupChannels = [
          `GROUP_MESSAGE_${conversationId}`,
          ...participantIds.map((id) => `USER_${id}`),
        ];

        // Publish to all relevant channels
        [...commonChannels, ...groupChannels].forEach((channel) => {
          this.pubsub.publish(channel, payload);
        });
      }
    } catch (error) {
      console.error("Error in publishMessageEvent:", error);
      // Don't throw error here as it would prevent message sending
    }
  }
}
module.exports = new MessageService();
