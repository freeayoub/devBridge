const mongoose = require("mongoose");
const User = require("../models/user.model");
const Group = require("../models/group.model");
const Message = require("../models/message.model");
const Conversation = require("../models/conversation.model");
const pubsub = require("../config/pubsub");
const { isValidObjectId } = require("mongoose");
const { AuthenticationError } = require("../graphql/errors");
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
    this.User = User || require("../models/user.model");
  }
  // Validation améliorée des IDs
  async validateUserIds(...userIds) {
    for (const userId of userIds) {
      if (!isValidObjectId(userId)) {
        throw new Error(`Invalid ID: ${userId}`);
      }
    }

    const usersExist = await Promise.all(
      userIds.map((id) => this.User.exists({ _id: id }))
    );

    if (usersExist.some((exists) => !exists)) {
      throw new Error("One or more users do not exist");
    }
    return true;
  }
  // Gestion des fichiers
  async handleFileUpload(file) {
    const { createReadStream, filename, mimetype } = await file;
    const stream = createReadStream();

    const url = await uploadFile(stream, filename, {
      mime_type: mimetype,
      folder: "message_attachments",
    });

    const type = mimetype.split("/")[0];
    const validTypes = ["image", "video", "audio"];
    const fileType = validTypes.includes(type) ? type : "file";

    const attachment = {
      url,
      type: fileType,
      name: filename,
      size: 0, // À remplacer par la taille réelle si possible
      mimeType: fileType !== "file" ? mimetype : undefined,
    };

    if (["image", "video"].includes(fileType)) {
      attachment.thumbnailUrl = await this.generateThumbnail(url);
    }

    if (["audio", "video"].includes(fileType)) {
      attachment.duration = await this.getMediaDuration(url);
    }

    return attachment;
  }
  // Gestion  thumbnail
  async generateThumbnail(originalUrl) {
    try {
      if (originalUrl.startsWith("http")) return originalUrl;

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
  // Helper methods
  async getMediaDuration() {
    // Implémentation à ajouter
    return 0;
  }

  async publishNewMessage(message, conversation) {
    const populated = await Message.populate(message, {
      path: "senderId",
      select: "username email image",
    });

    const channel = conversation.isGroup
      ? `GROUP_MESSAGE_${conversation._id}`
      : `MESSAGE_SENT_${conversation._id}`;

    this.pubsub.publish(channel, {
      messageSent: this.formatMessage(populated),
    });
  }
  // Gestion des groupes améliorée
  async createGroup({ name, participantIds, photo, userId }) {
    const participants = [...new Set([userId, ...participantIds])];
    if (participants.length < 2) {
      throw new Error("A group must have at least 2 participants");
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      let groupPhotoUrl;
      if (photo) {
        const { createReadStream, filename } = await photo;
        const stream = createReadStream();
        groupPhotoUrl = await uploadFile(stream, filename, "group-photos");
      }

      const conversation = new Conversation({
        participants,
        isGroup: true,
        groupName: name,
        groupPhoto: groupPhotoUrl,
        groupAdmins: [userId],
      });

      const group = new Group({
        name,
        creator: userId,
        admins: [userId],
        participants,
        conversation: conversation._id,
        photo: groupPhotoUrl,
      });

      await Promise.all([
        conversation.save({ session }),
        group.save({ session }),
      ]);

      await session.commitTransaction();

      return {
        ...conversation.toObject(),
        id: conversation._id.toString(),
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }
  async getUnreadMessages(userId) {
    const unreadMessages = await Message.find({
      receiverId: userId,
      isRead: false,
      isDeleted: false,
    })
      .populate("senderId")
      .populate({
        path: "conversationId",
        model: "Conversation",
        select: "_id participants isGroup groupName",
      })
      .sort({ timestamp: -1 })
      .lean();

    return unreadMessages.map((msg) => {
      const formattedMessage = this.formatMessageResponse(msg);

      // Handle sender
      const sender = msg.senderId
        ? {
            id: msg.senderId._id.toString(),
            username: msg.senderId.username,
            email: msg.senderId.email,
            image: msg.senderId.image,
            isOnline: msg.senderId.isOnline,
          }
        : {
            id: "deleted-user",
            username: "Deleted User",
            email: null,
            image: null,
            isOnline: false,
          };

      // Handle conversation
      const conversation = msg.conversationId
        ? {
            id: msg.conversationId._id.toString(),
            participants: msg.conversationId.participants,
            isGroup: msg.conversationId.isGroup || false,
            groupName: msg.conversationId.groupName || null,
          }
        : {
            id: "unknown-conversation",
            participants: [],
            isGroup: false,
            groupName: null,
          };

      return {
        ...formattedMessage,
        sender,
        conversation,
        conversationId: conversation.id,
      };
    });
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
  async getUserGroups(userId) {
    const groups = await Conversation.find({
      isGroup: true,
      participants: userId,
    }).populate("participants admins lastMessage");

    return groups.map((group) => ({
      ...group.toObject(),
      id: group._id.toString(),
      participants: group.participants,
      admins: group.admins,
      lastMessage: group.lastMessage,
    }));
  }
  async uploadPhoto(photo) {
    const { createReadStream, filename } = await photo;
    const stream = createReadStream();
    return await uploadFile(stream, filename, "group-photos");
  }
  async getGroup(groupId, userId) {
    const group = await Conversation.findOne({
      _id: groupId,
      isGroup: true,
      participants: userId,
    }).populate("participants admins lastMessage");

    if (!group) throw new Error("Group not found or access denied");

    return {
      ...group.toObject(),
      id: group._id.toString(),
    };
  }
  async updateGroup({ groupId, input, userId }) {
    const group = await Conversation.findOne({
      _id: groupId,
      isGroup: true,
      groupAdmins: userId, // Seul un admin peut modifier
    });

    if (!group) throw new Error("Group not found or access denied");

    const updates = {};
    if (input.name) updates.groupName = input.name;
    if (input.description) updates.groupDescription = input.description;

    if (input.addParticipants) {
      updates.$addToSet = { participants: { $each: input.addParticipants } };
    }

    if (input.removeParticipants) {
      updates.$pull = {
        participants: { $in: input.removeParticipants },
        groupAdmins: { $in: input.removeParticipants },
      };
    }

    if (input.addAdmins) {
      updates.$addToSet = { groupAdmins: { $each: input.addAdmins } };
    }

    if (input.removeAdmins) {
      updates.$pull = { groupAdmins: { $in: input.removeAdmins } };
    }

    if (input.photo) {
      updates.groupPhoto = await this.uploadPhoto(input.photo);
    }

    const updated = await Conversation.findByIdAndUpdate(groupId, updates, {
      new: true,
    }).populate("participants admins");

    // Mettre à jour le modèle Group si vous l'utilisez
    await Group.updateOne({ conversation: groupId }, updates);

    return updated;
  }
  async editMessage(messageId, userId, newContent) {
    const message = await Message.findOne({
      _id: messageId,
      senderId: userId,
      isDeleted: false,
    });

    if (!message) throw new Error("Message not found or unauthorized");

    message.content = newContent;
    message.isEdited = true;
    await message.save();

    this.pubsub.publish(`MESSAGE_UPDATED_${message.conversationId}`, {
      messageUpdated: this.formatMessage(message),
    });

    return message;
  }
  async deleteMessage(messageId, userId) {
    const message = await Message.findOneAndUpdate(
      {
        _id: messageId,
        senderId: userId,
        isDeleted: false,
      },
      { isDeleted: true },
      { new: true }
    );

    if (!message) throw new Error("Message not found or unauthorized");

    this.pubsub.publish(`MESSAGE_DELETED_${message.conversationId}`, {
      messageDeleted: this.formatMessage(message),
    });

    return message;
  }
  // Conversation methods

  async getOrCreateConversation(user1, user2) {
    // Vérifier que les IDs sont différents
    if (user1.toString() === user2.toString()) {
      throw new Error("Cannot create conversation with yourself");
    }

    // Convertir en ObjectId
    const user1Id = new mongoose.Types.ObjectId(user1);
    const user2Id = new mongoose.Types.ObjectId(user2);

    // Vérifier l'existence des utilisateurs
    const usersExist = await User.countDocuments({
      _id: { $in: [user1Id, user2Id] },
    });

    if (usersExist !== 2) {
      throw new Error("One or both users not found");
    }

    // Rechercher une conversation existante (dans les deux sens)
    const existing = await Conversation.findOne({
      isGroup: false,
      $and: [
        { participants: user1Id },
        { participants: user2Id },
        { $expr: { $eq: [{ $size: "$participants" }, 2] } },
      ],
    });

    if (existing) {
      return existing;
    }

    // Créer une nouvelle conversation
    const newConversation = new Conversation({
      participants: [user1Id, user2Id],
      isGroup: false,
    });

    try {
      await newConversation.save();
      return newConversation;
    } catch (error) {
      if (error.code === 11000) {
        // Duplicate key error
        // Retenter la recherche si la création a échoué
        const existingAfterError = await Conversation.findOne({
          isGroup: false,
          $and: [
            { participants: user1Id },
            { participants: user2Id },
            { $expr: { $eq: [{ $size: "$participants" }, 2] } },
          ],
        });
        if (existingAfterError) return existingAfterError;
      }
      throw error;
    }
  }
  async sendMessage({ senderId, receiverId, content, file }) {
    try {
      // Vérification que les utilisateurs existent
      const [sender, receiver] = await Promise.all([
        User.findById(senderId).lean(),
        User.findById(receiverId).lean(),
      ]);

      if (!sender) throw new Error("Sender user not found");
      if (!receiver) throw new Error("Receiver user not found");

      const conversation = await this.getOrCreateConversation(
        senderId,
        receiverId
      );
      const attachments = file ? [await this.handleFileUpload(file)] : [];

      const message = new Message({
        senderId,
        receiverId,
        content: content || "",
        attachments,
        type: attachments.length ? attachments[0].type : "text",
        conversationId: conversation._id,
        status: "sent",
      });

      const savedMessage = await message.save();

      // Mise à jour de la conversation
      await Conversation.findByIdAndUpdate(conversation._id, {
        $set: {
          lastMessage: savedMessage._id,
          updatedAt: new Date(),
          [`lastRead.${senderId}`]: new Date(),
        },
      });

      // Formatage de la réponse
      return this.formatMessageResponse({
        ...savedMessage.toObject(),
        sender: {
          _id: sender._id,
          username: sender.username,
          email: sender.email,
          image: sender.image,
        },
        receiver: {
          _id: receiver._id,
          username: receiver.username,
          email: receiver.email,
          image: receiver.image,
        },
      });
    } catch (error) {
      console.error("Send message error:", {
        error: error.message,
        stack: error.stack,
        senderId,
        receiverId,
      });
      throw new Error(`Failed to send message: ${error.message}`);
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
  async getConversation(conversationId, userId) {
    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: userId,
    })
      .populate({
        path: "participants",
        select: "_id username email image isOnline lastActive role",
        // Retirez le match: { isActive: true } si ce champ n'existe pas
      })
      .populate({
        path: "lastMessage",
        select: "_id content timestamp isRead",
      })
      .lean();

    if (!conversation) return null;

    // Formatage des participants avec des valeurs par défaut
    const participants =
      conversation.participants?.map((p) => ({
        id: p?._id?.toString() || "unknown",
        username: p?.username || "Utilisateur inconnu",
        email: p?.email || null,
        image: p?.image || null,
        isOnline: p?.isOnline || false,
        lastActive: p?.lastActive?.toISOString() || null,
        role: p?.role || "user",
      })) || [];

    return {
      id: conversation._id.toString(),
      participants,
      lastMessage: conversation.lastMessage
        ? {
            id: conversation.lastMessage._id.toString(),
            content: conversation.lastMessage.content,
            timestamp: conversation.lastMessage.timestamp?.toISOString(),
            isRead: conversation.lastMessage.isRead,
          }
        : null,
      lastMessageId: conversation.lastMessage?._id.toString(),
      unreadCount: await this.getUnreadCount(conversation._id, userId),
      messageCount: await Message.countDocuments({
        conversationId: conversation._id,
      }),
      isGroup: conversation.isGroup,
      groupName: conversation.groupName,
      groupPhoto: conversation.groupPhoto,
      groupDescription: conversation.groupDescription,
      groupAdmins:
        conversation.groupAdmins?.map((a) => ({
          id: a._id.toString(),
          username: a.username,
          email: a.email,
        })) || [],
      pinnedMessages: [], // Seront chargés via le resolver
      typingUsers:
        conversation.typingUsers?.map((u) => ({
          id: u._id.toString(),
          username: u.username,
        })) || [],
      lastRead: [], // À implémenter selon votre modèle
      createdAt: conversation.createdAt.toISOString(),
      updatedAt: conversation.updatedAt.toISOString(),
    };
  }

  async getConversations(userId) {
    try {
      // 1. Fetch conversations with forced population
      const conversations = await Conversation.find({ participants: userId })
        .populate({
          path: "participants",
          select: "_id username email image isOnline lastActive role",
          model: "User"
        })
        .populate("lastMessage")
        .lean({ virtuals: true });
  
      // 2. Debug: Verify populated data
      if (conversations.length > 0 && conversations[0].participants[0] instanceof mongoose.Types.ObjectId) {
        console.warn("⚠ Population failed - Manual fallback triggered");
      }
  
      // 3. Fallback manual population if needed
      const enhancedConversations = await Promise.all(
        conversations.map(async (conv) => {
          if (!conv.participants || conv.participants.some(p => p instanceof mongoose.Types.ObjectId)) {
            conv.participants = await User.find({ 
              _id: { $in: conv.participants } 
            })
            .select("_id username email image isOnline lastActive role")
            .lean();
          }
          return conv;
        })
      );
  
      // 4. Get unread counts using the robust method
      const unreadCounts = await this.getBulkUnreadCounts(
        enhancedConversations.map(c => c._id), 
        userId
      );
  
      // 5. Format final output
      return enhancedConversations.map(conv => ({
        id: conv._id.toString(),
        participants: conv.participants.map(p => ({
          id: p._id.toString(),
          username: p.username,
          email: p.email,
          image: p.image,
          isOnline: p.isOnline,
          lastActive: p.lastActive?.toISOString(),
          role: p.role
        })),
        lastMessage: conv.lastMessage ? {
          id: conv.lastMessage._id.toString(),
          content: conv.lastMessage.content,
          timestamp: conv.lastMessage.timestamp?.toISOString(),
          isRead: conv.lastMessage.isRead
        } : null,
        unreadCount: unreadCounts.get(conv._id.toString()) || 0,
        isGroup: conv.isGroup || false,
        groupName: conv.groupName || null,
        groupPhoto: conv.groupPhoto || null,
        createdAt: conv.createdAt.toISOString(),
        updatedAt: conv.updatedAt.toISOString()
      }));
  
    } catch (error) {
      console.error("Conversation fetch error:", error);
      throw new Error(`Failed to load conversations: ${error.message}`);
    }
  }
  // New helper function for bulk unread counts
  async getBulkUnreadCounts(conversationIds, userId) {
    try {
      const results = await Message.aggregate([
        {
          $match: {
            conversationId: { $in: conversationIds },
            receiverId: new mongoose.Types.ObjectId(userId),
            isRead: false,
            isDeleted: false
          }
        },
        {
          $group: {
            _id: "$conversationId",
            count: { $sum: 1 }
          }
        }
      ]);
  
      return new Map(
        results.map(r => [r._id.toString(), r.count])
      );
    } catch (error) {
      console.error("Bulk unread count error:", error);
      return new Map(); // Fail gracefully
    }
  }
  // Your existing single-conversation unread count
  async getUnreadCount(conversationId, userId) {
    try {
      const result = await Message.aggregate([
        {
          $match: {
            conversationId: new mongoose.Types.ObjectId(conversationId),
            receiverId: new mongoose.Types.ObjectId(userId),
            isRead: false,
            isDeleted: false
          }
        },
        {
          $count: "unreadCount"
        }
      ]);
      
      return result[0]?.unreadCount || 0;
    } catch (error) {
      console.error("Unread count error:", error);
      return 0;
    }
  }
  async searchMessages({
    userId,
    query,
    conversationId = null,
    limit = 20,
    offset = 0,
    filters = {},
  }) {
    const searchQuery = {
      $or: [
        { content: { $regex: query, $options: "i" } },
        { "attachments.name": { $regex: query, $options: "i" } },
      ],
      ...filters,
    };

    // Gestion de la portée de la conversation
    if (conversationId) {
      const conversation = await Conversation.findOne({
        _id: conversationId,
        participants: userId,
      });
      if (!conversation) {
        throw new Error("Conversation not found or unauthorized");
      }
      searchQuery.conversationId = conversationId;
    } else {
      const conversations = await Conversation.find({ participants: userId });
      searchQuery.conversationId = { $in: conversations.map((c) => c._id) };
    }

    // Gestion des dates
    if (filters.dateFrom || filters.dateTo) {
      searchQuery.timestamp = {};
      if (filters.dateFrom)
        searchQuery.timestamp.$gte = new Date(filters.dateFrom);
      if (filters.dateTo) searchQuery.timestamp.$lte = new Date(filters.dateTo);
    }

    const messages = await Message.find(searchQuery)
      .populate("sender", "_id username email image")
      .populate("receiver", "_id username email image")
      .populate("group", "_id groupName groupPhoto")
      .sort({ timestamp: -1 })
      .skip(offset)
      .limit(limit)
      .lean();

    return messages.map((msg) => ({
      ...msg,
      id: msg._id.toString(),
      sender: {
        id: msg.sender._id.toString(),
        username: msg.sender.username,
        email: msg.sender.email,
        image: msg.sender.image,
      },
      receiver: msg.receiver
        ? {
            id: msg.receiver._id.toString(),
            username: msg.receiver.username,
            email: msg.receiver.email,
            image: msg.receiver.image,
          }
        : null,
      group: msg.group
        ? {
            id: msg.group._id.toString(),
            groupName: msg.group.groupName,
            groupPhoto: msg.group.groupPhoto,
          }
        : null,
      timestamp: msg.timestamp?.toISOString(),
    }));
  }
  async sendGroupMessage({
    senderId,
    groupId,
    content,
    attachments = [],
    type = "text",
  }) {
    try {
      await this.validateUserIds(senderId, ...groupId.participants);

      const conversation = await Conversation.findById(groupId);
      if (!conversation?.isGroup) {
        throw new Error("CONVERSATION_NOT_GROUP");
      }

      if (!conversation.participants.includes(senderId)) {
        throw new Error("USER_NOT_IN_GROUP");
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

      await Promise.all([
        message.save(),
        Conversation.findByIdAndUpdate(groupId, {
          $push: { messages: message._id },
          $set: {
            lastMessage: message._id,
            updatedAt: new Date(),
          },
        }),
      ]);
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
    } catch (error) {
      console.error(`[GroupMessage] Error: ${error.message}`);
      throw new Error("MESSAGE_SEND_FAILED");
    }
  }
  async getMessages({
    senderId,
    receiverId,
    conversationId,
    page = 1,
    limit = 10,
    userId,
    loaders,
  }) {
    // Parameter validation
    if (conversationId) {
      if (!mongoose.Types.ObjectId.isValid(conversationId)) {
        throw new Error("Invalid conversation ID");
      }

      // Verify user is part of the conversation
      const conversation = await Conversation.findById(conversationId).populate(
        "participants",
        "_id username email image isOnline lastActive"
      );
      if (
        !conversation ||
        !conversation.participants.some((p) => p._id.equals(userId))
      ) {
        throw new AuthenticationError("Not authorized to view these messages");
      }
    } else if (senderId && receiverId) {
      // Verify current user is either sender or receiver
      const currentUserId = userId.toString();
      if (
        currentUserId !== senderId.toString() &&
        currentUserId !== receiverId.toString()
      ) {
        throw new AuthenticationError("Not authorized to view these messages");
      }
      await this.validateUserIds(senderId, receiverId);
    } else {
      throw new Error(
        "Either conversationId or both senderId/receiverId must be provided"
      );
    }

    const safeLimit = Math.min(limit, 100);
    const skip = (page - 1) * safeLimit;

    // Build query
    const query = conversationId
      ? { conversationId }
      : {
          $or: [
            { senderId, receiverId },
            { senderId: receiverId, receiverId: senderId },
          ],
        };

    const messages = await Message.find(query)
      .populate("sender", "_id username email image isOnline lastActive")
      .populate("receiver", "_id username email image isOnline lastActive")
      .populate("pinnedBy", "_id username email image")
      .populate("forwardedFrom")
      .populate("replyTo")
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(safeLimit)
      .lean();

    // Ensure all required fields are present
    return messages.map((msg) => this.formatMessagesResponse(msg));
  }
  // Formatage cohérent des messages
  formatMessageResponse(message) {
    if (!message) return null;

    const formatDate = (dateValue) => {
      if (!dateValue) return null;

      try {
        const date =
          dateValue instanceof Date ? dateValue : new Date(dateValue);
        return date.toISOString();
      } catch (error) {
        console.error("Date formatting error:", error);
        return null;
      }
    };

    // Handle sender data
    const senderData =
      message.sender ||
      (message.senderId && typeof message.senderId === "object"
        ? message.senderId
        : null);

    // Handle receiver data
    const receiverData =
      message.receiver ||
      (message.receiverId && typeof message.receiverId === "object"
        ? message.receiverId
        : null);

    return {
      ...(message.toObject ? message.toObject() : message),
      id: message._id?.toString() || message.id,
      timestamp: formatDate(message.timestamp),
      readAt: formatDate(message.readAt),
      createdAt: formatDate(message.createdAt),
      updatedAt: formatDate(message.updatedAt),
      sender: senderData
        ? {
            id: senderData._id?.toString() || senderData.id,
            username: senderData.username,
            email: senderData.email,
            image: senderData.image,
          }
        : {
            id: message.senderId?.toString(),
            username: "Unknown User",
            email: null,
            image: null,
          },
      receiver: receiverData
        ? {
            id: receiverData._id?.toString() || receiverData.id,
            username: receiverData.username,
            email: receiverData.email,
            image: receiverData.image,
          }
        : null,
    };
  }
  formatMessagesResponse(message) {
    if (!message) return null;

    const formatDate = (dateValue) => {
      if (!dateValue) return null;
      try {
        return dateValue instanceof Date
          ? dateValue.toISOString()
          : new Date(dateValue).toISOString();
      } catch (error) {
        console.error("Date formatting error:", error);
        return null;
      }
    };

    // Create default user object
    const createDefaultUser = (userId) => ({
      _id: userId || "unknown-user",
      id: userId?.toString() || "unknown-user",
      username: "Unknown User",
      email: "unknown@example.com",
      image: null,
      isOnline: false,
      isActive: false,
      lastActive: null,
      role: "user",
      notificationCount: 0,
      lastNotification: null,
    });

    // Handle sender
    const sender = message.sender || createDefaultUser(message.senderId);

    // Handle receiver
    const receiver = message.receiverId
      ? message.receiver || createDefaultUser(message.receiverId)
      : null;

    // Handle pinnedBy
    const pinnedBy = message.pinnedBy
      ? {
          ...message.pinnedBy,
          id: message.pinnedBy._id?.toString(),
        }
      : null;

    return {
      ...message,
      id: message._id?.toString(),
      type: message.type || "text",
      timestamp: formatDate(message.timestamp) || new Date().toISOString(),
      isRead: message.isRead !== undefined ? message.isRead : false,
      readAt: formatDate(message.readAt),
      isEdited: message.isEdited !== undefined ? message.isEdited : false,
      isDeleted: message.isDeleted !== undefined ? message.isDeleted : false,
      deletedAt: formatDate(message.deletedAt),
      sender: {
        ...sender,
        id: sender._id?.toString() || sender.id,
        createdAt: formatDate(sender.createdAt) || new Date().toISOString(),
        updatedAt: formatDate(sender.updatedAt) || new Date().toISOString(),
      },
      receiver: receiver
        ? {
            ...receiver,
            id: receiver._id?.toString() || receiver.id,
            createdAt:
              formatDate(receiver.createdAt) || new Date().toISOString(),
            updatedAt:
              formatDate(receiver.updatedAt) || new Date().toISOString(),
          }
        : null,
      group: message.group || null,
      conversation: message.conversation || null,
      conversationId: message.conversationId?.toString(),
      reactions: message.reactions || [],
      attachments: message.attachments || [],
      status: message.status || "sent",
      pinned: message.pinned !== undefined ? message.pinned : false,
      pinnedAt: formatDate(message.pinnedAt),
      pinnedBy,
      forwardedFrom: message.forwardedFrom || null,
      replyTo: message.replyTo || null,
      metadata: message.metadata || {},
    };
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
}
module.exports = new MessageService();
