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
const CallService = require("./call.service");
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");
const { logger } = require("../utils/logger");

class MessageService {
  constructor() {
    this.pubsub = pubsub || {
      publish: (channel, payload) => {
        logger.debug(`Would publish to ${channel}:`, payload);
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

    // Convertir le type de fichier en majuscules pour correspondre à l'énumération AttachmentType
    const attachmentType = fileType.toUpperCase();

    const attachment = {
      url,
      type: attachmentType, // Utiliser la valeur en majuscules
      name: filename,
      size: 0, // À remplacer par la taille réelle si possible
      mimeType: fileType !== "file" ? mimetype : undefined,
    };

    if (["image", "video"].includes(fileType.toLowerCase())) {
      attachment.thumbnailUrl = await this.generateThumbnail(url);
    }

    if (["audio", "video"].includes(fileType.toLowerCase())) {
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
      logger.error("Error generating thumbnail:", error);
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
      logger.error(`[Message Read Error] ID: ${messageId}`, error);
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
      logger.info(
        `[MessageService] New conversation created: ${newConversation._id}`
      );
      return newConversation;
    } catch (error) {
      if (error.code === 11000) {
        // Duplicate key error
        // Retenter la recherche si la création a échoué
        logger.warn(
          `[MessageService] Duplicate key error when creating conversation, retrying search`
        );
        const existingAfterError = await Conversation.findOne({
          isGroup: false,
          $and: [
            { participants: user1Id },
            { participants: user2Id },
            { $expr: { $eq: [{ $size: "$participants" }, 2] } },
          ],
        });
        if (existingAfterError) {
          logger.info(
            `[MessageService] Found existing conversation after error: ${existingAfterError._id}`
          );
          return existingAfterError;
        }
        logger.error(
          `[MessageService] Failed to find conversation after duplicate key error`
        );
      }
      logger.error(`[MessageService] Error creating conversation:`, {
        error: error.message,
        stack: error.stack,
        user1Id: user1Id.toString(),
        user2Id: user2Id.toString(),
      });
      throw new Error(`Failed to create conversation: ${error.message}`);
    }
  }
  async sendMessage({ senderId, receiverId, content, file, type, metadata }) {
    try {
      logger.info(
        `[MessageService] Starting sendMessage flow: senderId=${senderId}, receiverId=${receiverId}, type=${type}, hasMetadata=${!!metadata}`
      );

      if (metadata) {
        logger.debug(
          `[MessageService] Message metadata: ${JSON.stringify(metadata)}`
        );
      }

      // Vérification que les utilisateurs existent
      logger.debug(
        `[MessageService] Finding sender and receiver users: ${senderId}, ${receiverId}`
      );
      const [sender, receiver] = await Promise.all([
        User.findById(senderId).lean(),
        User.findById(receiverId).lean(),
      ]);

      if (!sender) {
        logger.error(`[MessageService] Sender user not found: ${senderId}`);
        throw new Error("Sender user not found");
      }
      if (!receiver) {
        logger.error(`[MessageService] Receiver user not found: ${receiverId}`);
        throw new Error("Receiver user not found");
      }

      logger.debug(
        `[MessageService] Users found: sender=${sender.username}, receiver=${receiver.username}`
      );

      logger.debug(
        `[MessageService] Getting or creating conversation between ${senderId} and ${receiverId}`
      );
      const conversation = await this.getOrCreateConversation(
        senderId,
        receiverId
      );
      logger.debug(
        `[MessageService] Conversation retrieved/created: ${conversation._id}`
      );

      let attachments = [];
      if (file) {
        logger.debug(`[MessageService] Processing file attachment`);
        attachments = [await this.handleFileUpload(file)];
        logger.debug(
          `[MessageService] File processed successfully: ${attachments[0].url}`
        );

        // Si c'est un message vocal, ajouter la durée à l'attachement
        if (type === "VOICE_MESSAGE" && metadata && metadata.duration) {
          attachments[0].duration = metadata.duration;
          logger.debug(
            `[MessageService] Added duration ${metadata.duration} to voice message attachment`
          );
        }
      }

      logger.debug(`[MessageService] Creating new message object`);
      // Déterminer le type de message
      let messageType = type || "TEXT";

      // Si le type est VOICE_MESSAGE, le conserver même s'il y a des pièces jointes
      if (messageType !== "VOICE_MESSAGE" && attachments.length > 0) {
        messageType = attachments[0].type;
      }

      logger.debug(`[MessageService] Final message type: ${messageType}`);

      const message = new Message({
        senderId,
        receiverId,
        content: content || "",
        attachments,
        type: messageType,
        conversationId: conversation._id,
        status: "sent",
        metadata: metadata || undefined,
      });

      logger.debug(`[MessageService] Saving message to database`);
      const savedMessage = await message.save();
      logger.info(
        `[MessageService] Message saved successfully: ${savedMessage._id}`
      );

      // Mise à jour de la conversation
      logger.debug(
        `[MessageService] Updating conversation with new last message: ${savedMessage._id}`
      );
      await Conversation.findByIdAndUpdate(conversation._id, {
        $set: {
          lastMessage: savedMessage._id,
          updatedAt: new Date(),
          [`lastRead.${senderId}`]: new Date(),
        },
      });
      logger.debug(`[MessageService] Conversation updated successfully`);

      // Publier l'événement de message
      logger.debug(`[MessageService] Publishing message event`);
      this.publishMessageEvent({
        eventType: "MESSAGE_SENT",
        conversationId: conversation._id,
        senderId,
        receiverId,
        message: savedMessage,
      });

      // Envoyer une notification
      logger.debug(`[MessageService] Sending message notification`);
      try {
        await NotificationService.sendMessageNotification(savedMessage);
        logger.debug(`[MessageService] Notification sent successfully`);
      } catch (error) {
        logger.error(`[MessageService] Error sending notification:`, error);
        // Ne pas bloquer l'envoi du message si la notification échoue
      }

      // Formatage de la réponse
      logger.debug(`[MessageService] Formatting message response`);
      const formattedMessage = this.formatMessageResponse({
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

      logger.info(
        `[MessageService] Message flow completed successfully: messageId=${savedMessage._id}`
      );

      // Si c'est un message vocal, créer un enregistrement d'appel
      if (messageType === "VOICE_MESSAGE" || messageType === "voice_message") {
        try {
          logger.debug(
            `[MessageService] Creating call record for voice message: ${savedMessage._id}`
          );
          await CallService.createVoiceMessageCall({
            senderId,
            receiverId,
            conversationId: conversation._id,
            messageId: savedMessage._id.toString(),
            duration: metadata?.duration || 0,
            metadata,
          });
          logger.debug(
            `[MessageService] Call record created successfully for voice message: ${savedMessage._id}`
          );
        } catch (callError) {
          logger.error(
            `[MessageService] Error creating call record for voice message:`,
            {
              error: callError.message,
              stack: callError.stack,
              messageId: savedMessage._id,
            }
          );
          // Ne pas bloquer l'envoi du message si la création de l'enregistrement d'appel échoue
        }
      }

      return formattedMessage;
    } catch (error) {
      logger.error("Send message error:", {
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

  async getConversations(userId) {
    try {
      // 1. Fetch conversations with forced population
      const conversations = await Conversation.find({ participants: userId })
        .populate({
          path: "participants",
          select: "_id username email image isOnline lastActive role",
          model: "User",
        })
        .populate("lastMessage")
        .lean({ virtuals: true });

      // 2. Debug: Verify populated data
      if (
        conversations.length > 0 &&
        conversations[0].participants.length > 0 &&
        conversations[0].participants[0] instanceof mongoose.Types.ObjectId
      ) {
        logger.warn("⚠ Population failed - Manual fallback triggered");
      }

      // 3. Fallback manual population if needed
      const enhancedConversations = await Promise.all(
        conversations.map(async (conv) => {
          try {
            if (
              !conv.participants ||
              conv.participants.length === 0 ||
              conv.participants.some(
                (p) => p instanceof mongoose.Types.ObjectId
              )
            ) {
              logger.debug(
                `[MessageService] Manual population needed for conversation ${conv._id}`
              );

              // Ensure we have valid participant IDs
              const participantIds = conv.participants
                .map((p) => (p instanceof mongoose.Types.ObjectId ? p : p._id))
                .filter((id) => id); // Filter out any undefined/null values

              if (participantIds.length === 0) {
                logger.warn(
                  `[MessageService] No valid participant IDs found for conversation ${conv._id}`
                );
                conv.participants = [];
                return conv;
              }

              conv.participants = await User.find({
                _id: { $in: participantIds },
              })
                .select("_id username email image isOnline lastActive role")
                .lean();

              logger.debug(
                `[MessageService] Manual population completed for conversation ${conv._id} - found ${conv.participants.length} participants`
              );
            }
            return conv;
          } catch (error) {
            logger.error(
              `[MessageService] Error during manual population for conversation ${conv._id}:`,
              error
            );
            // Return conversation with empty participants rather than failing completely
            conv.participants = conv.participants || [];
            return conv;
          }
        })
      );

      // 4. Get unread counts using the robust method
      const unreadCounts = await this.getBulkUnreadCounts(
        enhancedConversations.map((c) => c._id),
        userId
      );

      // 5. Format final output
      return enhancedConversations.map((conv) => ({
        id: conv._id.toString(),
        participants: conv.participants.map((p) => ({
          id: p._id.toString(),
          username: p.username,
          email: p.email,
          image: p.image,
          isOnline: p.isOnline,
          lastActive: p.lastActive?.toISOString(),
          role: p.role,
        })),
        lastMessage: conv.lastMessage
          ? {
              id: conv.lastMessage._id.toString(),
              content: conv.lastMessage.content,
              timestamp: conv.lastMessage.timestamp?.toISOString(),
              isRead: conv.lastMessage.isRead,
            }
          : null,
        unreadCount: unreadCounts.get(conv._id.toString()) || 0,
        isGroup: conv.isGroup || false,
        groupName: conv.groupName || null,
        groupPhoto: conv.groupPhoto || null,
        createdAt: conv.createdAt.toISOString(),
        updatedAt: conv.updatedAt.toISOString(),
      }));
    } catch (error) {
      console.error("Conversation fetch error:", error);
      throw new Error(`Failed to load conversations: ${error.message}`);
    }
  }
  // New helper function for bulk unread counts
  async getBulkUnreadCounts(conversationIds, userId) {
    if (!conversationIds || conversationIds.length === 0) {
      logger.warn(
        `[MessageService] getBulkUnreadCounts called with empty conversationIds`
      );
      return new Map();
    }

    if (!userId) {
      logger.warn(
        `[MessageService] getBulkUnreadCounts called with empty userId`
      );
      return new Map();
    }

    try {
      logger.debug(
        `[MessageService] Getting unread counts for ${conversationIds.length} conversations`
      );

      // Ensure all IDs are valid ObjectIds
      const validConversationIds = conversationIds.filter((id) =>
        mongoose.Types.ObjectId.isValid(id)
      );

      if (validConversationIds.length === 0) {
        logger.warn(
          `[MessageService] No valid conversation IDs found for unread counts`
        );
        return new Map();
      }

      const results = await Message.aggregate([
        {
          $match: {
            conversationId: {
              $in: validConversationIds.map(
                (id) => new mongoose.Types.ObjectId(id)
              ),
            },
            receiverId: new mongoose.Types.ObjectId(userId),
            isRead: false,
            isDeleted: false,
          },
        },
        {
          $group: {
            _id: "$conversationId",
            count: { $sum: 1 },
          },
        },
      ]);

      logger.debug(
        `[MessageService] Found unread counts for ${results.length} conversations`
      );

      // Create a map with all conversations (including those with 0 unread)
      const unreadMap = new Map();
      validConversationIds.forEach((id) => unreadMap.set(id.toString(), 0));

      // Update with actual counts
      results.forEach((r) => unreadMap.set(r._id.toString(), r.count));

      return unreadMap;
    } catch (error) {
      logger.error(`[MessageService] Bulk unread count error:`, {
        error: error.message,
        stack: error.stack,
        userId,
        conversationCount: conversationIds?.length || 0,
      });

      // Return a map with zeros rather than empty map
      return new Map(conversationIds.map((id) => [id.toString(), 0]));
    }
  }
  // Your existing single-conversation unread count
  async getUnreadCount(conversationId, userId) {
    if (!conversationId || !userId) {
      logger.warn(
        `[MessageService] getUnreadCount called with missing parameters: conversationId=${conversationId}, userId=${userId}`
      );
      return 0;
    }

    if (
      !mongoose.Types.ObjectId.isValid(conversationId) ||
      !mongoose.Types.ObjectId.isValid(userId)
    ) {
      logger.warn(
        `[MessageService] getUnreadCount called with invalid IDs: conversationId=${conversationId}, userId=${userId}`
      );
      return 0;
    }

    try {
      logger.debug(
        `[MessageService] Getting unread count for conversation ${conversationId}, user ${userId}`
      );

      const result = await Message.aggregate([
        {
          $match: {
            conversationId: new mongoose.Types.ObjectId(conversationId),
            receiverId: new mongoose.Types.ObjectId(userId),
            isRead: false,
            isDeleted: false,
          },
        },
        {
          $count: "unreadCount",
        },
      ]);

      const unreadCount = result[0]?.unreadCount || 0;
      logger.debug(
        `[MessageService] Found ${unreadCount} unread messages for conversation ${conversationId}`
      );

      return unreadCount;
    } catch (error) {
      logger.error(`[MessageService] Unread count error:`, {
        error: error.message,
        stack: error.stack,
        conversationId,
        userId,
      });
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
    offset,
  }) {
    logger.info(
      `[MessageService] Getting messages: conversationId=${conversationId}, senderId=${senderId}, receiverId=${receiverId}, page=${page}, limit=${limit}, userId=${userId}, offset=${offset}`
    );

    try {
      // Parameter validation
      logger.debug(`[MessageService] Validating parameters`);
      if (conversationId) {
        if (!mongoose.Types.ObjectId.isValid(conversationId)) {
          logger.error(
            `[MessageService] Invalid conversation ID: ${conversationId}`
          );
          throw new Error("Invalid conversation ID");
        }

        // Verify user is part of the conversation
        logger.debug(
          `[MessageService] Verifying user ${userId} is part of conversation ${conversationId}`
        );
        const conversation = await Conversation.findById(
          conversationId
        ).populate(
          "participants",
          "_id username email image isOnline lastActive"
        );
        if (
          !conversation ||
          !conversation.participants.some((p) => p._id.equals(userId))
        ) {
          logger.error(
            `[MessageService] User ${userId} not authorized to view messages in conversation ${conversationId}`
          );
          throw new AuthenticationError(
            "Not authorized to view these messages"
          );
        }
        logger.debug(
          `[MessageService] User authorization verified for conversation ${conversationId}`
        );
      } else if (senderId && receiverId) {
        // Verify current user is either sender or receiver
        logger.debug(
          `[MessageService] Verifying user ${userId} is either sender ${senderId} or receiver ${receiverId}`
        );
        const currentUserId = userId.toString();
        if (
          currentUserId !== senderId.toString() &&
          currentUserId !== receiverId.toString()
        ) {
          logger.error(
            `[MessageService] User ${userId} not authorized to view messages between ${senderId} and ${receiverId}`
          );
          throw new AuthenticationError(
            "Not authorized to view these messages"
          );
        }
        logger.debug(
          `[MessageService] Validating user IDs: ${senderId}, ${receiverId}`
        );
        await this.validateUserIds(senderId, receiverId);
        logger.debug(`[MessageService] User IDs validated successfully`);
      } else {
        logger.error(
          `[MessageService] Missing required parameters: conversationId or senderId/receiverId`
        );
        throw new Error(
          "Either conversationId or both senderId/receiverId must be provided"
        );
      }

      const safeLimit = Math.min(limit, 100);
      // Si offset est fourni, l'utiliser directement, sinon calculer à partir de page
      const skip = offset !== undefined ? offset : (page - 1) * safeLimit;
      logger.debug(
        `[MessageService] Using pagination: skip=${skip}, limit=${safeLimit}, original offset=${offset}, page=${page}`
      );

      // Build query
      const query = conversationId
        ? { conversationId }
        : {
            $or: [
              { senderId, receiverId },
              { senderId: receiverId, receiverId: senderId },
            ],
          };
      logger.debug(`[MessageService] Built query: ${JSON.stringify(query)}`);

      logger.debug(`[MessageService] Fetching messages from database`);
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

      logger.info(`[MessageService] Retrieved ${messages.length} messages`);

      // Ensure all required fields are present
      logger.debug(`[MessageService] Formatting message responses`);
      const formattedMessages = messages.map((msg) =>
        this.formatMessageResponse(msg)
      );

      logger.info(`[MessageService] Messages retrieval completed successfully`);
      return formattedMessages;
    } catch (error) {
      logger.error(`[MessageService] Error getting messages:`, {
        error: error.message,
        stack: error.stack,
        conversationId,
        senderId,
        receiverId,
        userId,
      });
      throw error;
    }
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
  async getConversation(conversationId, userId) {
    logger.info(
      `[MessageService] Getting conversation: conversationId=${conversationId}, userId=${userId}`
    );

    try {
      logger.debug(`[MessageService] Finding conversation in database`);
      const conversation = await Conversation.findOne({
        _id: conversationId,
        participants: userId,
      })
        .populate({
          path: "participants",
          select: "_id username email image isOnline lastActive role",
        })
        .populate({
          path: "lastMessage",
          select: "_id content timestamp isRead",
        })
        .lean();

      if (!conversation) {
        logger.warn(
          `[MessageService] Conversation not found or unauthorized: ${conversationId}`
        );
        throw new Error(
          `Conversation not found or user ${userId} not authorized to access it`
        );
      }

      logger.debug(`[MessageService] Conversation found: ${conversation._id}`);

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

      logger.debug(
        `[MessageService] Getting unread count for conversation: ${conversationId}`
      );
      const unreadCount = await this.getUnreadCount(conversation._id, userId);

      logger.debug(
        `[MessageService] Getting message count for conversation: ${conversationId}`
      );
      const messageCount = await Message.countDocuments({
        conversationId: conversation._id,
      });

      logger.debug(`[MessageService] Formatting conversation response`);
      const result = {
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
        unreadCount,
        messageCount,
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

      logger.info(
        `[MessageService] Conversation retrieval completed: ${conversationId}, unread: ${unreadCount}, messages: ${messageCount}`
      );
      return result;
    } catch (error) {
      logger.error(`[MessageService] Error getting conversation:`, {
        error: error.message,
        stack: error.stack,
        conversationId,
        userId,
      });
      throw error;
    }
  }
}
module.exports = new MessageService();
