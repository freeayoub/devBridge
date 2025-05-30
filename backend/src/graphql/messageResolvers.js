const MessageService = require("../services/message.service");
const NotificationService = require("../services/notification.service");
const UserService = require("../services/user.service");
const CallService = require("../services/call.service");
const { GraphQLError } = require("graphql");
const GraphQLUpload = require("graphql-upload/GraphQLUpload.js");
const { AuthenticationError, ApolloError } = require("../graphql/errors");
const { messageUpdateSchema } = require("../validators/message.validators");
const User = require("../models/User");
const Group = require("../models/groupConversation.model");
const Message = require("../models/message.model");
const Conversation = require("../models/conversation.model");
const resolvers = {
  Upload: GraphQLUpload,

  Message: {
    id: (parent) => parent._id?.toString() || parent.id,
    sender: (parent) => {
      return (
        parent.sender || {
          id: parent.senderId?.toString() || "unknown-user",
          username: "Unknown User",
          email: null,
          image: null,
        }
      );
    },
    receiver: (parent) => {
      return (
        parent.receiver ||
        (parent.receiverId
          ? {
              id: parent.receiverId.toString(),
            }
          : null)
      );
    },
    group: async (parent, _, { loaders }) => {
      if (!parent.groupId) return null;
      try {
        return loaders?.groupLoader
          ? await loaders.groupLoader.load(parent.groupId.toString())
          : await Group.findById(parent.groupId);
      } catch (error) {
        console.error("Error loading group:", error);
        return null;
      }
    },
    conversation: async (parent, _, { loaders }) => {
      if (!parent.conversationId) return null;
      try {
        return loaders?.conversationLoader
          ? await loaders.conversationLoader.load(
              parent.conversationId.toString()
            )
          : await Conversation.findById(parent.conversationId);
      } catch (error) {
        console.error("Error loading conversation:", error);
        return null;
      }
    },
    forwardedFrom: async (parent, _, { loaders }) => {
      if (!parent.forwardedFrom) return null;
      try {
        return loaders?.messageLoader
          ? await loaders.messageLoader.load(parent.forwardedFrom.toString())
          : await Message.findById(parent.forwardedFrom).lean();
      } catch (error) {
        console.error("Error loading forwarded message:", error);
        return null;
      }
    },
    replyTo: async (parent, _, { loaders }) => {
      if (!parent.replyTo) return null;
      try {
        return loaders?.messageLoader
          ? await loaders.messageLoader.load(parent.replyTo.toString())
          : await Message.findById(parent.replyTo).lean();
      } catch (error) {
        console.error("Error loading replied message:", error);
        return null;
      }
    },
    pinnedBy: async (parent, _, { loaders }) => {
      if (!parent.pinnedBy) return null;
      try {
        return loaders?.userLoader
          ? await loaders.userLoader.load(parent.pinnedBy.toString())
          : await User.findById(parent.pinnedBy).lean();
      } catch (error) {
        console.error("Error loading pinnedBy user:", error);
        return null;
      }
    },
    timestamp: (parent) => {
      // Gestion robuste du timestamp
      if (!parent.timestamp) return null;

      try {
        const date =
          parent.timestamp instanceof Date
            ? parent.timestamp
            : new Date(parent.timestamp);

        return date.toISOString();
      } catch (error) {
        console.error("Invalid timestamp:", parent.timestamp);
        return null;
      }
    },
    readAt: (parent) => {
      if (!parent.readAt) return null;
      try {
        return parent.readAt instanceof Date
          ? parent.readAt.toISOString()
          : new Date(parent.readAt).toISOString();
      } catch (error) {
        console.error("Error formatting readAt date:", error);
        return null;
      }
    },
    deletedAt: (parent) => {
      if (!parent.deletedAt) return null;
      try {
        return parent.deletedAt instanceof Date
          ? parent.deletedAt.toISOString()
          : new Date(parent.deletedAt).toISOString();
      } catch (error) {
        console.error("Error formatting deletedAt date:", error);
        return null;
      }
    },
    pinnedAt: (parent) => {
      if (!parent.pinnedAt) return null;
      try {
        return parent.pinnedAt instanceof Date
          ? parent.pinnedAt.toISOString()
          : new Date(parent.pinnedAt).toISOString();
      } catch (error) {
        console.error("Error formatting pinnedAt date:", error);
        return null;
      }
    },
    reactions: async (parent, _, { loaders }) => {
      if (!parent.reactions?.length) return [];
      try {
        const reactionUsers = await Promise.all(
          parent.reactions.map((r) =>
            loaders?.userLoader
              ? loaders.userLoader.load(r.userId.toString())
              : User.findById(r.userId).lean()
          )
        );
        return parent.reactions.map((reaction, index) => ({
          ...reaction,
          userId: reaction.userId.toString(),
          user: reactionUsers[index],
        }));
      } catch (error) {
        console.error("Error loading reaction users:", error);
        return [];
      }
    },
    attachments: (parent) => parent.attachments || [],
  },

  Conversation: {
    id: (parent) => parent._id?.toString() || parent.id,
    messages: async (
      parent,
      { limit = 50, offset = 0 },
      { loaders, userId }
    ) => {
      try {
        console.log(
          `[GraphQL] Conversation.messages resolver called with userId: ${userId}, conversationId: ${
            parent._id || parent.id
          }, limit: ${limit}, offset: ${offset}`
        );

        if (!userId) {
          console.error(
            `[GraphQL] No userId provided in context for Conversation.messages resolver`
          );
          return [];
        }

        const messages = await MessageService.getMessages({
          conversationId: parent._id || parent.id,
          limit,
          offset,
          userId,
        });

        console.log(
          `[GraphQL] Retrieved ${messages.length} messages for conversation ${
            parent._id || parent.id
          }`
        );

        if (loaders?.messageLoader) {
          messages.forEach((msg) => {
            loaders.messageLoader.prime(msg._id.toString(), msg);
          });
        }

        return messages;
      } catch (error) {
        console.error("Error loading messages:", error);
        return [];
      }
    },

    participants: async (parent) => {
      // If participants are already populated (from getConversations)
      if (
        Array.isArray(parent.participants) &&
        parent.participants.length > 0
      ) {
        return parent.participants;
      }

      // Fallback population
      try {
        const conv = await Conversation.findById(parent.id)
          .populate({
            path: "participants",
            select: "_id username email image isOnline lastActive role",
            model: "User",
          })
          .lean();

        return (conv?.participants || []).map((p) => ({
          id: p._id.toString(),
          username: p.username,
          email: p.email,
          image: p.image,
          isOnline: p.isOnline,
          lastActive: p.lastActive?.toISOString(),
          role: p.role,
        }));
      } catch (error) {
        console.error("Error loading participants:", error);
        return [];
      }
    },

    unreadCount: async (parent, _, { userId }) => {
      try {
        return await Message.countDocuments({
          conversationId: parent.id,
          receiverId: userId,
          isRead: false,
        });
      } catch (error) {
        console.error("Error calculating unread count:", error);
        return 0;
      }
    },
    lastMessage: async (parent, _, { loaders }) => {
      if (!parent.lastMessage && !parent.lastMessageId) return null;
      try {
        if (parent.lastMessage) return parent.lastMessage;
        return loaders?.messageLoader
          ? await loaders.messageLoader.load(parent.lastMessageId.toString())
          : await Message.findById(parent.lastMessageId).lean();
      } catch (error) {
        console.error("Error loading last message:", error);
        return null;
      }
    },

    pinnedMessages: async (parent, _, { loaders }) => {
      if (!parent.pinnedMessages?.length) return [];
      try {
        return loaders?.messageLoader
          ? await Promise.all(
              parent.pinnedMessages.map((id) =>
                loaders.messageLoader.load(id.toString())
              )
            )
          : await Message.find({
              _id: { $in: parent.pinnedMessages },
            }).lean();
      } catch (error) {
        console.error("Error loading pinned messages:", error);
        return [];
      }
    },

    typingUsers: async (parent, _, { loaders }) => {
      if (!parent.typingUsers?.length) return [];
      try {
        return loaders?.userLoader
          ? await Promise.all(
              parent.typingUsers.map((id) =>
                loaders.userLoader.load(id.toString())
              )
            )
          : await User.find({
              _id: { $in: parent.typingUsers },
            }).lean();
      } catch (error) {
        console.error("Error loading typing users:", error);
        return [];
      }
    },

    groupAdmins: async (parent, _, { loaders }) => {
      if (!parent.groupAdmins?.length) return [];
      try {
        return loaders?.userLoader
          ? await Promise.all(
              parent.groupAdmins.map((id) =>
                loaders.userLoader.load(id.toString())
              )
            )
          : await User.find({
              _id: { $in: parent.groupAdmins },
            }).lean();
      } catch (error) {
        console.error("Error loading group admins:", error);
        return [];
      }
    },
  },

  Query: {
    getMessages: async (
      _,
      { senderId, receiverId, conversationId, page = 1, limit = 10 },
      { userId, loaders }
    ) => {
      if (!userId) {
        console.error("Unauthorized attempt to get messages without userId");
        throw new AuthenticationError("Unauthorized");
      }

      console.log(
        `[GraphQL] getMessages resolver called: conversationId=${conversationId}, senderId=${senderId}, receiverId=${receiverId}, page=${page}, limit=${limit}, userId=${userId}`
      );

      try {
        console.log(`[GraphQL] Calling MessageService.getMessages`);
        const messages = await MessageService.getMessages({
          senderId,
          receiverId,
          conversationId,
          page,
          limit,
          userId,
          loaders,
        });
        console.log(
          `[GraphQL] Retrieved ${messages.length} messages from service`
        );

        // Ensure no null values for non-nullable fields
        console.log(`[GraphQL] Formatting message responses for client`);
        const formattedMessages = messages.map((msg) => ({
          ...msg,
          sender: {
            ...msg.sender,
            username: msg.sender.username || "Unknown User",
            email: msg.sender.email || "unknown@example.com",
          },
          receiver: msg.receiver
            ? {
                ...msg.receiver,
                username: msg.receiver.username || "Unknown User",
                email: msg.receiver.email || "unknown@example.com",
              }
            : null,
        }));

        console.log(
          `[GraphQL] Successfully formatted ${formattedMessages.length} messages`
        );
        return formattedMessages;
      } catch (error) {
        console.error("Error in getMessages resolver:", error);
        console.error("Error details:", {
          message: error.message,
          stack: error.stack,
          conversationId,
          senderId,
          receiverId,
          userId,
        });
        throw new ApolloError(
          "Failed to fetch messages",
          "MESSAGE_FETCH_FAILED",
          {
            originalError: error,
          }
        );
      }
    },
    getUnreadMessages: async (_, { userId }, context) => {
      if (!context.user) throw new AuthenticationError("Not authenticated");
      if (context.user.id !== userId)
        throw new ForbiddenError("Not authorized");

      try {
        const messages = await MessageService.getUnreadMessages(userId);

        // Ensure each message has a populated conversation
        return messages.map((message) => ({
          ...message,
          conversation: message.conversation || { _id: message.conversationId },
        }));
      } catch (error) {
        throw new ApolloError(error.message, "MESSAGE_FETCH_FAILED", {
          userId,
          originalError: error,
        });
      }
    },

    searchMessages: async (
      _,
      {
        query,
        conversationId,
        limit = 20,
        offset = 0,
        isRead,
        isDeleted,
        type,
        senderId,
        receiverId,
        groupId,
        pinned,
        dateFrom,
        dateTo,
      },
      { userId }
    ) => {
      if (!userId) throw AuthenticationError("Not authenticated");

      return MessageService.searchMessages({
        userId,
        query,
        conversationId,
        limit,
        offset,
        filters: {
          isRead,
          isDeleted,
          type,
          senderId,
          receiverId,
          groupId,
          pinned,
          dateFrom: dateFrom ? new Date(dateFrom) : undefined,
          dateTo: dateTo ? new Date(dateTo) : undefined,
        },
      });
    },

    getConversation: async (_, { conversationId }, context) => {
      console.log(
        `[GraphQL] getConversation resolver called: conversationId=${conversationId}, userId=${context.userId}`
      );

      if (!context.userId) {
        console.error(
          `[GraphQL] Unauthorized attempt to get conversation: ${conversationId}`
        );
        throw new AuthenticationError("Unauthorized");
      }

      try {
        console.log(`[GraphQL] Calling MessageService.getConversation`);
        const conversation = await MessageService.getConversation(
          conversationId,
          context.userId
        );

        if (!conversation) {
          console.error(`[GraphQL] Conversation not found: ${conversationId}`);
          throw new ApolloError("Conversation not found", "NOT_FOUND");
        }

        console.log(
          `[GraphQL] Conversation retrieved successfully: ${conversationId}`
        );

        return conversation;
      } catch (error) {
        console.error("Error fetching conversation:", error);
        console.error("Error details:", {
          message: error.message,
          stack: error.stack,
          conversationId,
          userId: context.userId,
        });
        throw new ApolloError(
          error.message || "Failed to fetch conversation",
          error.extensions?.code || "CONVERSATION_FETCH_FAILED",
          { originalError: error }
        );
      }
    },

    getConversations: async (_, __, context) => {
      console.log(
        `[GraphQL] getConversations resolver called for userId=${context.userId}`
      );

      if (!context.userId) {
        console.error(
          `[GraphQL] Unauthorized attempt to get conversations without userId`
        );
        throw new AuthenticationError("Unauthorized");
      }

      try {
        console.log(`[GraphQL] Calling MessageService.getConversations`);
        const conversations = await MessageService.getConversations(
          context.userId
        );
        console.log(
          `[GraphQL] Retrieved ${conversations.length} conversations from service`
        );

        return conversations;
      } catch (error) {
        console.error("Error fetching conversations:", error);
        console.error("Error details:", {
          message: error.message,
          stack: error.stack,
          userId: context.userId,
        });
        throw new ApolloError(
          "Failed to fetch conversations",
          "CONVERSATIONS_FETCH_FAILED",
          { originalError: error }
        );
      }
    },

    // ✅ Nouveau resolver optimisé pour récupérer les messages avec pagination
    getConversationMessages: async (
      _,
      { conversationId, limit = 50, before, after },
      context
    ) => {
      console.log(
        `[GraphQL] getConversationMessages resolver called: conversationId=${conversationId}, userId=${context.userId}, limit=${limit}, before=${before}, after=${after}`
      );

      if (!context.userId) {
        console.error(
          `[GraphQL] Unauthorized attempt to get messages without userId`
        );
        throw new AuthenticationError("Unauthorized");
      }

      try {
        console.log(`[GraphQL] Calling MessageService.getMessages`);
        const result = await MessageService.getMessages(
          conversationId,
          context.userId,
          { limit, before, after }
        );

        console.log(
          `[GraphQL] Retrieved ${result.messages.length} messages with pagination info`
        );

        return result;
      } catch (error) {
        console.error("Error fetching conversation messages:", error);
        console.error("Error details:", {
          message: error.message,
          stack: error.stack,
          conversationId,
          userId: context.userId,
        });
        throw new ApolloError(
          "Failed to fetch conversation messages",
          "MESSAGES_FETCH_FAILED",
          { originalError: error }
        );
      }
    },

    getAllUsers: async (
      _,
      { search, page, limit, sortBy, sortOrder, isOnline },
      context
    ) => {
      if (!context.userId) throw AuthenticationError("Unauthorized");
      console.log("GraphQL getAllUsers resolver called with params:", {
        search,
        page,
        limit,
        sortBy,
        sortOrder,
        isOnline,
      });
      return UserService.getAllUsers({
        search,
        page,
        limit,
        sortBy,
        sortOrder,
        isOnline,
      });
    },

    getOneUser: async (_, { id }, context) => {
      if (!context.userId) throw AuthenticationError("Unauthorized");
      return UserService.getOneUser(id);
    },

    getUserNotifications: async (_, __, { userId }) => {
      console.log("getUserNotifications resolver called for userId:", userId);

      if (!userId) {
        console.error("No userId provided in context");
        throw new AuthenticationError("Not authenticated");
      }

      try {
        console.log(
          "Calling NotificationService.getUserNotifications with userId:",
          userId
        );
        const notifications = await NotificationService.getUserNotifications(
          userId
        );
        console.log("Notifications retrieved successfully:", notifications);

        // Transformer les notifications pour correspondre au schéma GraphQL
        const transformedNotifications = notifications.map((notification) => {
          return {
            id: notification._id.toString(),
            type: notification.type,
            content: notification.content,
            timestamp:
              notification.createdAt || notification.timestamp || new Date(),
            isRead: notification.isRead,
            readAt: notification.readAt,
            senderId: notification.senderId,
            message: notification.message,
            relatedEntity: notification.relatedEntity
              ? notification.relatedEntity.toString()
              : null,
            metadata: notification.metadata,
          };
        });

        console.log("Transformed notifications:", transformedNotifications);

        return transformedNotifications;
      } catch (error) {
        console.error("Error fetching notifications:", error);
        console.error("Error stack:", error.stack);
        throw new ApolloError(
          "Failed to fetch notifications",
          "NOTIFICATION_ERROR",
          { originalError: error }
        );
      }
    },

    getCurrentUser: async (_, __, { userId }) => {
      if (!userId) throw new GraphQLError("Unauthorized");
      return UserService.getOneUser(userId);
    },

    getGroup: async (_, { id }, { userId }) => {
      if (!userId) throw new GraphQLError("Unauthorized");
      return MessageService.getGroup(id, userId);
    },

    getUserGroups: async (_, __, { userId }) => {
      if (!userId) throw new GraphQLError("Unauthorized");
      return MessageService.getUserGroups(userId);
    },

    /**
     * Récupère tous les messages vocaux de l'utilisateur
     */
    getVoiceMessages: async (_, __, { userId }) => {
      console.log(
        `[GraphQL] getVoiceMessages resolver called for userId=${userId}`
      );

      if (!userId) {
        console.error(
          `[GraphQL] Unauthorized attempt to get voice messages without userId`
        );
        throw new AuthenticationError("Unauthorized");
      }

      try {
        console.log(`[GraphQL] Calling CallService.getVoiceMessages`);
        const voiceMessages = await CallService.getVoiceMessages(userId);
        console.log(
          `[GraphQL] Retrieved ${voiceMessages.length} voice messages from service`
        );

        // Transformer les appels en format compatible avec le schéma GraphQL
        return voiceMessages.map((call) => ({
          id: call._id.toString(),
          caller: {
            id: call.caller._id.toString(),
            username: call.caller.username || "Unknown User",
            image: call.caller.image || null,
          },
          recipient: {
            id: call.recipient._id.toString(),
            username: call.recipient.username || "Unknown User",
            image: call.recipient.image || null,
          },
          type: "AUDIO",
          status: "ENDED",
          startTime: call.startTime.toISOString(),
          endTime: call.endTime.toISOString(),
          duration: call.duration || 0,
          conversationId: call.conversationId.toString(),
          metadata: {
            ...call.metadata,
            isVoiceMessage: true,
          },
        }));
      } catch (error) {
        console.error("Error fetching voice messages:", error);
        console.error("Error details:", {
          message: error.message,
          stack: error.stack,
          userId,
        });
        throw new ApolloError(
          "Failed to fetch voice messages",
          "VOICE_MESSAGES_FETCH_FAILED",
          { originalError: error }
        );
      }
    },
  },

  Mutation: {
    sendMessage: async (
      _,
      { receiverId, content, file, type = "TEXT", metadata },
      { userId, pubsub }
    ) => {
      console.log(
        `[GraphQL] sendMessage mutation called: receiverId=${receiverId}, userId=${userId}, hasFile=${!!file}, type=${type}, metadata=${JSON.stringify(
          metadata
        )}`
      );

      if (!userId) {
        console.error(
          `[GraphQL] Unauthorized attempt to send message to ${receiverId}`
        );
        throw new AuthenticationError("Unauthorized");
      }

      try {
        console.log(`[GraphQL] Calling MessageService.sendMessage`);

        const result = await MessageService.sendMessage({
          senderId: userId,
          receiverId,
          content,
          file,
          type,
          metadata,
          context: { userId, pubsub },
        });

        console.log(
          `[GraphQL] Message sent successfully: messageId=${result.id}`
        );
        return result;
      } catch (error) {
        console.error("Send message error:", error);
        console.error("Error details:", {
          message: error.message,
          stack: error.stack,
          receiverId,
          userId,
          hasFile: !!file,
        });
        throw new Error(error.message);
      }
    },
    sendGroupMessage: async (_, { input }, { userId }) => {
      if (!userId) throw AuthenticationError("Not authenticated");
      return MessageService.sendGroupMessage({
        content: input.content,
        groupId: input.groupId,
        file: input.file,
        userId,
      });
    },

    editMessage: async (_, { messageId, newContent }, { userId }) => {
      if (!userId) throw AuthenticationError("Not authenticated");
      return MessageService.editMessage({ messageId, userId, newContent });
    },

    deleteMessage: async (_, { messageId }, { userId }) => {
      if (!userId) throw AuthenticationError("Not authenticated");
      return MessageService.deleteMessage({ messageId, userId });
    },

    markMessageAsRead: async (_, { messageId }, context) => {
      // 1. Validation
      await messageUpdateSchema.validate({ isRead: true });
      if (!context.userId) throw AuthenticationError("Unauthorized");
      return MessageService.markAsRead({ messageId, userId: context.userId });
    },

    setUserOnline: async (_, { userId }, context) => {
      if (!context.userId || context.userId !== userId) {
        throw AuthenticationError(
          "Unauthorized: You can only update your own status"
        );
      }
      return UserService.setUserOnline(userId);
    },

    setUserOffline: async (_, { userId }, context) => {
      if (!context.userId || context.userId !== userId) {
        throw AuthenticationError(
          "Unauthorized: You can only update your own status"
        );
      }
      return UserService.setUserOffline(userId);
    },

    createGroup: async (_, { name, participantIds, photo }, { userId }) => {
      if (!userId) throw AuthenticationError("Not authenticated");
      return MessageService.createGroup({
        name,
        participantIds,
        photo,
        userId,
      });
    },

    markNotificationsAsRead: async (_, { notificationIds }, { userId }) => {
      console.log(
        `[GraphQL] markNotificationsAsRead mutation called: userId=${userId}, notificationIds=${JSON.stringify(
          notificationIds
        )}`
      );

      if (!userId) {
        console.error(
          `[GraphQL] Unauthorized attempt to mark notifications as read without userId`
        );
        throw new AuthenticationError("Not authenticated");
      }

      if (
        !notificationIds ||
        !Array.isArray(notificationIds) ||
        notificationIds.length === 0
      ) {
        console.error(
          `[GraphQL] Invalid notificationIds provided: ${JSON.stringify(
            notificationIds
          )}`
        );
        throw new Error("Invalid notification IDs provided");
      }

      // Vérifier que tous les IDs sont des chaînes valides
      for (const id of notificationIds) {
        if (typeof id !== "string" || id.trim() === "") {
          console.error(`[GraphQL] Invalid notification ID format: ${id}`);
          throw new Error(`Invalid notification ID format: ${id}`);
        }

        // Vérifier si l'ID est un ObjectId MongoDB valide
        try {
          const mongoose = require("mongoose");
          if (!mongoose.Types.ObjectId.isValid(id)) {
            console.error(`[GraphQL] Invalid MongoDB ObjectId: ${id}`);
            throw new Error(`Invalid MongoDB ObjectId: ${id}`);
          }
        } catch (err) {
          console.error(`[GraphQL] Error validating ObjectId: ${id}`, err);
          throw new Error(`Error validating notification ID: ${id}`);
        }
      }

      try {
        console.log(
          `[GraphQL] Calling NotificationService.markAsRead with userId=${userId}, notificationIds=${JSON.stringify(
            notificationIds
          )}`
        );

        // Vérifier si les notifications existent et appartiennent à l'utilisateur
        const Notification = require("../models/notification.model");
        const notifications = await Notification.find({
          _id: { $in: notificationIds },
        });

        console.log(
          `[GraphQL] Found ${notifications.length} notifications out of ${notificationIds.length} requested`
        );

        if (notifications.length !== notificationIds.length) {
          const foundIds = notifications.map((n) => n._id.toString());
          const missingIds = notificationIds.filter(
            (id) => !foundIds.includes(id)
          );
          console.error(
            `[GraphQL] Some notifications not found: ${JSON.stringify(
              missingIds
            )}`
          );
          throw new Error(
            `Some notifications not found: ${missingIds.join(", ")}`
          );
        }

        // Nous ne vérifions plus si les notifications appartiennent à l'utilisateur actuel
        // car nous voulons permettre à l'utilisateur de marquer toutes les notifications comme lues
        console.log(
          `[GraphQL] Marking all notifications as read, regardless of ownership`
        );

        // Mettre à jour les notifications dans la base de données
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
        const pubsub = require("../config/pubsub");
        pubsub.publish(`NOTIFICATION_READ_${userId}`, {
          notificationsRead: notificationIds,
        });

        // Mettre à jour le compteur
        const updatedUser = await User.findByIdAndUpdate(
          userId,
          { $inc: { notificationCount: -notificationIds.length } },
          { new: true }
        );

        // Créer la réponse au format NotificationReadResponse
        const response = {
          success: true,
          readCount: notificationIds.length,
          remainingCount: updatedUser.notificationCount || 0,
        };

        console.log(
          `[GraphQL] Notifications marked as read successfully: ${JSON.stringify(
            response
          )}`
        );
        return response;
      } catch (error) {
        console.error(`[GraphQL] Error marking notifications as read:`, error);
        console.error(`[GraphQL] Error details:`, {
          message: error.message,
          stack: error.stack,
          userId,
          notificationIds,
        });
        throw new Error(
          `Failed to mark notifications as read: ${error.message}`
        );
      }
    },

    reactToMessage: async (_, { messageId, emoji }, { userId, pubsub }) => {
      if (!userId) throw new GraphQLError("Unauthorized");
      return MessageService.reactToMessage({
        messageId,
        userId,
        emoji,
        pubsub,
      });
    },

    forwardMessage: async (_, { messageId, conversationIds }, { userId }) => {
      if (!userId) throw new GraphQLError("Unauthorized");
      return MessageService.forwardMessage({
        messageId,
        userId,
        conversationIds,
      });
    },

    pinMessage: async (_, { messageId, conversationId }, { userId }) => {
      if (!userId) throw new GraphQLError("Unauthorized");
      return MessageService.pinMessage({ messageId, conversationId, userId });
    },

    startTyping: async (_, { conversationId }, { userId, pubsub }) => {
      if (!userId) throw new GraphQLError("Unauthorized");
      return MessageService.startTyping({ userId, conversationId, pubsub });
    },

    stopTyping: async (_, { conversationId }, { userId, pubsub }) => {
      if (!userId) throw new GraphQLError("Unauthorized");
      return MessageService.stopTyping({ userId, conversationId, pubsub });
    },

    // === RESOLVERS D'APPEL WEBRTC ===

    initiateCall: async (
      _,
      { recipientId, callType, callId, offer, conversationId, options },
      { userId, pubsub }
    ) => {
      console.log(
        `[GraphQL] initiateCall mutation called: recipientId=${recipientId}, callType=${callType}, callId=${callId}`
      );

      if (!userId) {
        console.error(`[GraphQL] Unauthorized attempt to initiate call`);
        throw new AuthenticationError("Unauthorized");
      }

      try {
        // Récupérer les informations des utilisateurs avec tous les champs requis
        const caller = await User.findById(userId).select(
          "username image email isOnline isActive lastActive role createdAt updatedAt"
        );
        const recipient = await User.findById(recipientId).select(
          "username image email isOnline isActive lastActive role createdAt updatedAt"
        );

        if (!caller || !recipient) {
          console.error(
            `[GraphQL] User not found: caller=${!!caller}, recipient=${!!recipient}`
          );
          throw new ApolloError("User not found", "USER_NOT_FOUND");
        }

        console.log(
          `[GraphQL] Found users: caller=${caller.username}, recipient=${recipient.username}`
        );

        // Créer l'objet Call avec les vraies informations selon le schéma GraphQL
        const call = {
          id: callId,
          caller: {
            id: caller._id.toString(),
            username: caller.username || "Unknown",
            email: caller.email || "unknown@example.com",
            image: caller.image || null,
            isOnline: caller.isOnline || false,
            isActive: caller.isActive || true,
            lastActive: caller.lastActive
              ? caller.lastActive.toISOString()
              : null,
            role: caller.role || "user",
            notificationCount: 0,
            lastNotification: null,
            createdAt: caller.createdAt
              ? caller.createdAt.toISOString()
              : new Date().toISOString(),
            updatedAt: caller.updatedAt
              ? caller.updatedAt.toISOString()
              : new Date().toISOString(),
            notifications: [],
          },
          recipient: {
            id: recipient._id.toString(),
            username: recipient.username || "Unknown",
            email: recipient.email || "unknown@example.com",
            image: recipient.image || null,
            isOnline: recipient.isOnline || false,
            isActive: recipient.isActive || true,
            lastActive: recipient.lastActive
              ? recipient.lastActive.toISOString()
              : null,
            role: recipient.role || "user",
            notificationCount: 0,
            lastNotification: null,
            createdAt: recipient.createdAt
              ? recipient.createdAt.toISOString()
              : new Date().toISOString(),
            updatedAt: recipient.updatedAt
              ? recipient.updatedAt.toISOString()
              : new Date().toISOString(),
            notifications: [],
          },
          type: callType,
          status: "RINGING",
          startTime: new Date().toISOString(),
          endTime: null,
          duration: null,
          conversationId: conversationId,
          metadata: options || {},
        };

        console.log(`[GraphQL] Created call object:`, call);

        // Publier l'appel entrant au destinataire
        const incomingCall = {
          id: callId,
          caller: {
            id: caller._id.toString(),
            username: caller.username,
            image: caller.image,
          },
          type: callType,
          status: "ringing",
          conversationId: conversationId,
        };

        console.log(
          `[GraphQL] Publishing incoming call to user ${recipientId}`
        );
        pubsub.publish(`INCOMING_CALL_${recipientId}`, {
          incomingCall: incomingCall,
        });

        console.log(`[GraphQL] Call initiated successfully:`, call);
        return call;
      } catch (error) {
        console.error("Error initiating call:", error);
        throw new ApolloError(
          "Failed to initiate call",
          "CALL_INITIATION_FAILED",
          { originalError: error }
        );
      }
    },

    acceptCall: async (_, { callId, answer }, { userId, pubsub }) => {
      console.log(`[GraphQL] acceptCall mutation called: callId=${callId}`);

      if (!userId) {
        console.error(`[GraphQL] Unauthorized attempt to accept call`);
        throw new AuthenticationError("Unauthorized");
      }

      try {
        // Récupérer les informations de l'utilisateur
        const user = await User.findById(userId).select(
          "username image email isOnline isActive lastActive role createdAt updatedAt"
        );

        if (!user) {
          console.error(`[GraphQL] User not found: ${userId}`);
          throw new ApolloError("User not found", "USER_NOT_FOUND");
        }

        // Créer l'objet Call accepté selon le schéma GraphQL
        const call = {
          id: callId,
          caller: {
            id: "unknown",
            username: "Unknown",
            image: null,
            email: "unknown@example.com",
            isOnline: false,
            isActive: false,
            lastActive: new Date().toISOString(),
            role: "user",
            notificationCount: 0,
            lastNotification: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            notifications: [],
          },
          recipient: {
            id: user._id.toString(),
            username: user.username || "Unknown",
            email: user.email || "unknown@example.com",
            image: user.image || null,
            isOnline: user.isOnline || false,
            isActive: user.isActive || true,
            lastActive: user.lastActive ? user.lastActive.toISOString() : null,
            role: user.role || "user",
            notificationCount: 0,
            lastNotification: null,
            createdAt: user.createdAt
              ? user.createdAt.toISOString()
              : new Date().toISOString(),
            updatedAt: user.updatedAt
              ? user.updatedAt.toISOString()
              : new Date().toISOString(),
            notifications: [],
          },
          type: "VIDEO", // TODO: récupérer le vrai type depuis le cache/DB
          status: "CONNECTED",
          startTime: new Date().toISOString(),
          endTime: null,
          duration: null,
          conversationId: null,
          metadata: { answer: answer },
        };

        console.log(`[GraphQL] Call accepted:`, call);

        // Publier le signal d'acceptation
        pubsub.publish(`CALL_SIGNAL_${callId}`, {
          callSignal: {
            callId: callId,
            signalType: "answer",
            signalData: answer,
            from: userId,
            timestamp: new Date().toISOString(),
          },
        });

        return call;
      } catch (error) {
        console.error("Error accepting call:", error);
        throw new ApolloError(
          "Failed to accept call",
          "CALL_ACCEPTANCE_FAILED",
          { originalError: error }
        );
      }
    },

    rejectCall: async (_, { callId, reason }, { userId, pubsub }) => {
      console.log(`[GraphQL] rejectCall mutation called: callId=${callId}`);

      if (!userId) {
        console.error(`[GraphQL] Unauthorized attempt to reject call`);
        throw new AuthenticationError("Unauthorized");
      }

      try {
        // Récupérer les informations de l'utilisateur
        const user = await User.findById(userId).select(
          "username image email isOnline isActive lastActive role createdAt updatedAt"
        );

        if (!user) {
          console.error(`[GraphQL] User not found: ${userId}`);
          throw new ApolloError("User not found", "USER_NOT_FOUND");
        }

        // Créer l'objet Call rejeté selon le schéma GraphQL
        const call = {
          id: callId,
          caller: {
            id: "unknown",
            username: "Unknown",
            image: null,
            email: "unknown@example.com",
            isOnline: false,
            isActive: false,
            lastActive: new Date().toISOString(),
            role: "user",
            notificationCount: 0,
            lastNotification: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            notifications: [],
          },
          recipient: {
            id: user._id.toString(),
            username: user.username || "Unknown",
            email: user.email || "unknown@example.com",
            image: user.image || null,
            isOnline: user.isOnline || false,
            isActive: user.isActive || true,
            lastActive: user.lastActive ? user.lastActive.toISOString() : null,
            role: user.role || "user",
            notificationCount: 0,
            lastNotification: null,
            createdAt: user.createdAt
              ? user.createdAt.toISOString()
              : new Date().toISOString(),
            updatedAt: user.updatedAt
              ? user.updatedAt.toISOString()
              : new Date().toISOString(),
            notifications: [],
          },
          type: "VIDEO",
          status: "REJECTED",
          startTime: new Date().toISOString(),
          endTime: new Date().toISOString(),
          duration: 0,
          conversationId: null,
          metadata: { reason: reason },
        };

        console.log(`[GraphQL] Call rejected:`, call);

        // Publier le statut de rejet
        pubsub.publish(`CALL_STATUS_${callId}`, {
          callStatusChanged: {
            callId: callId,
            status: "rejected",
            reason: reason,
            timestamp: new Date().toISOString(),
          },
        });

        return call;
      } catch (error) {
        console.error("Error rejecting call:", error);
        throw new ApolloError(
          "Failed to reject call",
          "CALL_REJECTION_FAILED",
          { originalError: error }
        );
      }
    },

    endCall: async (_, { callId, feedback }, { userId, pubsub }) => {
      console.log(`[GraphQL] endCall mutation called: callId=${callId}`);

      if (!userId) {
        console.error(`[GraphQL] Unauthorized attempt to end call`);
        throw new AuthenticationError("Unauthorized");
      }

      try {
        // Récupérer les informations de l'utilisateur
        const user = await User.findById(userId).select(
          "username image email isOnline isActive lastActive role createdAt updatedAt"
        );

        if (!user) {
          console.error(`[GraphQL] User not found: ${userId}`);
          throw new ApolloError("User not found", "USER_NOT_FOUND");
        }

        // Créer l'objet Call terminé selon le schéma GraphQL
        const call = {
          id: callId,
          caller: {
            id: user._id.toString(),
            username: user.username || "Unknown",
            email: user.email || "unknown@example.com",
            image: user.image || null,
            isOnline: user.isOnline || false,
            isActive: user.isActive || true,
            lastActive: user.lastActive ? user.lastActive.toISOString() : null,
            role: user.role || "user",
            notificationCount: 0,
            lastNotification: null,
            createdAt: user.createdAt
              ? user.createdAt.toISOString()
              : new Date().toISOString(),
            updatedAt: user.updatedAt
              ? user.updatedAt.toISOString()
              : new Date().toISOString(),
            notifications: [],
          },
          recipient: {
            id: "unknown",
            username: "Unknown",
            image: null,
            email: "unknown@example.com",
            isOnline: false,
            isActive: false,
            lastActive: new Date().toISOString(),
            role: "user",
            notificationCount: 0,
            lastNotification: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            notifications: [],
          },
          type: "VIDEO",
          status: "ENDED",
          startTime: new Date(Date.now() - 60000).toISOString(), // 1 minute ago
          endTime: new Date().toISOString(),
          duration: 60, // 60 seconds
          conversationId: null,
          metadata: feedback || {},
        };

        console.log(`[GraphQL] Call ended:`, call);

        // Publier le statut de fin d'appel
        pubsub.publish(`CALL_STATUS_${callId}`, {
          callStatusChanged: {
            callId: callId,
            status: "ended",
            endedBy: userId,
            timestamp: new Date().toISOString(),
          },
        });

        return call;
      } catch (error) {
        console.error("Error ending call:", error);
        throw new ApolloError("Failed to end call", "CALL_END_FAILED", {
          originalError: error,
        });
      }
    },

    sendCallSignal: async (
      _,
      { callId, signalType, signalData },
      { userId, pubsub }
    ) => {
      console.log(
        `[GraphQL] sendCallSignal mutation called: callId=${callId}, signalType=${signalType}`
      );

      if (!userId) {
        console.error(`[GraphQL] Unauthorized attempt to send call signal`);
        throw new AuthenticationError("Unauthorized");
      }

      try {
        // Publier le signal
        pubsub.publish(`CALL_SIGNAL_${callId}`, {
          callSignal: {
            callId: callId,
            signalType: signalType,
            signalData: signalData,
            from: userId,
            timestamp: new Date().toISOString(),
          },
        });

        console.log(`[GraphQL] Call signal sent successfully`);
        return { success: true, message: "Signal sent successfully" };
      } catch (error) {
        console.error("Error sending call signal:", error);
        throw new ApolloError(
          "Failed to send call signal",
          "CALL_SIGNAL_FAILED",
          { originalError: error }
        );
      }
    },

    toggleCallMedia: async (
      _,
      { callId, video, audio },
      { userId, pubsub }
    ) => {
      console.log(
        `[GraphQL] toggleCallMedia mutation called: callId=${callId}, video=${video}, audio=${audio}`
      );

      if (!userId) {
        console.error(`[GraphQL] Unauthorized attempt to toggle call media`);
        throw new AuthenticationError("Unauthorized");
      }

      try {
        // Publier le changement de média
        pubsub.publish(`CALL_SIGNAL_${callId}`, {
          callSignal: {
            callId: callId,
            signalType: "media-toggle",
            signalData: JSON.stringify({ video, audio }),
            from: userId,
            timestamp: new Date().toISOString(),
          },
        });

        console.log(`[GraphQL] Call media toggled successfully`);
        return { success: true, message: "Media toggled successfully" };
      } catch (error) {
        console.error("Error toggling call media:", error);
        throw new ApolloError(
          "Failed to toggle call media",
          "CALL_MEDIA_TOGGLE_FAILED",
          { originalError: error }
        );
      }
    },

    updateGroup: async (_, { id, input }, { userId }) => {
      if (!userId) throw new GraphQLError("Unauthorized");
      return MessageService.updateGroup({ groupId: id, input, userId });
    },

    updateUserProfile: async (_, { input }, { userId }) => {
      if (!userId) throw new GraphQLError("Unauthorized");
      return UserService.updateProfile(userId, input);
    },

    /**
     * Supprime une notification spécifique
     */
    deleteNotification: async (_, { notificationId }, { userId }) => {
      console.log(
        `[GraphQL] deleteNotification mutation called: notificationId=${notificationId}, userId=${userId}`
      );

      if (!userId) {
        console.error(
          `[GraphQL] Unauthorized attempt to delete notification without userId`
        );
        throw new AuthenticationError("Not authenticated");
      }

      if (!notificationId) {
        console.error(`[GraphQL] Missing notificationId in deleteNotification`);
        throw new ApolloError("Missing notificationId", "BAD_USER_INPUT");
      }

      try {
        console.log(`[GraphQL] Calling NotificationService.deleteNotification`);

        const result = await NotificationService.deleteNotification(
          notificationId,
          userId
        );

        console.log(`[GraphQL] Notification deletion result:`, result);

        return result;
      } catch (error) {
        console.error(`[GraphQL] Error deleting notification:`, error);
        console.error(`[GraphQL] Error details:`, {
          message: error.message,
          stack: error.stack,
          notificationId,
          userId,
        });

        throw new ApolloError(
          error.message || "Failed to delete notification",
          "NOTIFICATION_DELETE_FAILED",
          { originalError: error }
        );
      }
    },

    /**
     * Supprime toutes les notifications d'un utilisateur
     */
    deleteAllNotifications: async (_, __, { userId }) => {
      console.log(
        `[GraphQL] deleteAllNotifications mutation called for userId=${userId}`
      );

      if (!userId) {
        console.error(
          `[GraphQL] Unauthorized attempt to delete all notifications without userId`
        );
        throw new AuthenticationError("Not authenticated");
      }

      try {
        console.log(
          `[GraphQL] Calling NotificationService.deleteAllNotifications`
        );

        const result = await NotificationService.deleteAllNotifications(userId);

        console.log(`[GraphQL] All notifications deletion result:`, result);

        return result;
      } catch (error) {
        console.error(`[GraphQL] Error deleting all notifications:`, error);
        console.error(`[GraphQL] Error details:`, {
          message: error.message,
          stack: error.stack,
          userId,
        });

        throw new ApolloError(
          error.message || "Failed to delete all notifications",
          "NOTIFICATIONS_DELETE_FAILED",
          { originalError: error }
        );
      }
    },

    /**
     * Supprime plusieurs notifications
     */
    deleteMultipleNotifications: async (_, { notificationIds }, { userId }) => {
      console.log(
        `[GraphQL] deleteMultipleNotifications mutation called: notificationIds=${JSON.stringify(
          notificationIds
        )}, userId=${userId}`
      );

      if (!userId) {
        console.error(
          `[GraphQL] Unauthorized attempt to delete multiple notifications without userId`
        );
        throw new AuthenticationError("Not authenticated");
      }

      if (
        !notificationIds ||
        !Array.isArray(notificationIds) ||
        notificationIds.length === 0
      ) {
        console.error(
          `[GraphQL] Missing or invalid notificationIds in deleteMultipleNotifications`
        );
        throw new ApolloError(
          "Missing or invalid notificationIds",
          "BAD_USER_INPUT"
        );
      }

      try {
        console.log(
          `[GraphQL] Calling NotificationService.deleteMultipleNotifications`
        );

        const result = await NotificationService.deleteMultipleNotifications(
          notificationIds,
          userId
        );

        console.log(
          `[GraphQL] Multiple notifications deletion result:`,
          result
        );

        return result;
      } catch (error) {
        console.error(
          `[GraphQL] Error deleting multiple notifications:`,
          error
        );
        console.error(`[GraphQL] Error details:`, {
          message: error.message,
          stack: error.stack,
          notificationIds,
          userId,
        });

        throw new ApolloError(
          error.message || "Failed to delete multiple notifications",
          "NOTIFICATIONS_DELETE_FAILED",
          { originalError: error }
        );
      }
    },

    createConversation: async (_, { userId: otherUserId }, { userId }) => {
      console.log(
        `[GraphQL] createConversation mutation called: otherUserId=${otherUserId}, userId=${userId}`
      );

      if (!userId) {
        console.error(
          `[GraphQL] Unauthorized attempt to create conversation without userId`
        );
        throw new AuthenticationError("Unauthorized");
      }

      if (!otherUserId) {
        console.error(`[GraphQL] Missing otherUserId in createConversation`);
        throw new ApolloError("Missing otherUserId", "BAD_USER_INPUT");
      }

      // Vérifier que l'utilisateur ne tente pas de créer une conversation avec lui-même
      if (userId === otherUserId) {
        console.error(
          `[GraphQL] User ${userId} attempted to create conversation with self`
        );
        throw new ApolloError(
          "Cannot create conversation with yourself",
          "BAD_USER_INPUT"
        );
      }

      try {
        console.log(`[GraphQL] Calling MessageService.getOrCreateConversation`);

        // Utiliser la méthode getOrCreateConversation du service
        const conversation = await MessageService.getOrCreateConversation(
          userId,
          otherUserId
        );

        if (!conversation) {
          console.error(
            `[GraphQL] Failed to create conversation between ${userId} and ${otherUserId}`
          );
          throw new ApolloError(
            "Failed to create conversation",
            "INTERNAL_SERVER_ERROR"
          );
        }

        console.log(
          `[GraphQL] Conversation created/retrieved: ${conversation._id}`
        );

        try {
          console.log(`[GraphQL] Populating conversation participants`);
          // Récupérer les informations des participants
          const populatedConversation = await Conversation.findById(
            conversation._id
          )
            .populate({
              path: "participants",
              select: "_id username email image isOnline lastActive role",
              model: "User",
            })
            .lean();

          if (!populatedConversation) {
            console.error(
              `[GraphQL] Failed to populate conversation ${conversation._id}`
            );
            throw new ApolloError(
              "Failed to populate conversation",
              "INTERNAL_SERVER_ERROR"
            );
          }

          if (
            !populatedConversation.participants ||
            populatedConversation.participants.length === 0
          ) {
            console.error(
              `[GraphQL] No participants found in populated conversation ${conversation._id}`
            );

            // Fallback: récupérer les utilisateurs manuellement
            console.log(`[GraphQL] Attempting manual participant population`);
            const users = await User.find({
              _id: { $in: conversation.participants },
            })
              .select("_id username email image isOnline lastActive role")
              .lean();

            populatedConversation.participants = users;
          }

          console.log(
            `[GraphQL] Found ${populatedConversation.participants.length} participants`
          );

          // Formater la réponse pour correspondre au schéma GraphQL
          return {
            id: conversation._id.toString(),
            participants: populatedConversation.participants.map((p) => ({
              id: p._id.toString(),
              username: p.username || "Unknown User",
              email: p.email || null,
              image: p.image || null,
              isOnline: p.isOnline || false,
              lastActive: p.lastActive?.toISOString() || null,
              role: p.role || "user",
            })),
            lastMessage: conversation.lastMessage,
            unreadCount: 0,
            updatedAt: conversation.updatedAt.toISOString(),
          };
        } catch (populateError) {
          console.error(
            `[GraphQL] Error populating conversation:`,
            populateError
          );

          // Retourner une réponse minimale en cas d'échec de la population
          return {
            id: conversation._id.toString(),
            participants: conversation.participants.map((id) => ({
              id: id.toString(),
              username: "User",
              email: null,
              image: null,
              isOnline: false,
              lastActive: null,
              role: "user",
            })),
            lastMessage: null,
            unreadCount: 0,
            updatedAt: conversation.updatedAt.toISOString(),
          };
        }
      } catch (error) {
        console.error("[GraphQL] Create conversation error:", error);
        console.error("[GraphQL] Error details:", {
          message: error.message,
          stack: error.stack,
          otherUserId,
          userId,
        });
        throw new ApolloError(
          error.message || "Failed to create conversation",
          "CONVERSATION_CREATE_FAILED",
          { originalError: error }
        );
      }
    },
  },

  Notification: {
    timestamp: (parent) => {
      // Gestion robuste du timestamp pour les notifications
      if (!parent.timestamp && !parent.createdAt) {
        console.warn(
          "Notification without timestamp, using current date:",
          parent.id
        );
        return new Date().toISOString();
      }

      try {
        const date = parent.timestamp || parent.createdAt;
        const dateObj = date instanceof Date ? date : new Date(date);
        return dateObj.toISOString();
      } catch (error) {
        console.error(
          "Invalid notification timestamp:",
          parent.timestamp,
          error
        );
        return new Date().toISOString();
      }
    },
    readAt: (parent) => {
      if (!parent.readAt) return null;
      try {
        return parent.readAt instanceof Date
          ? parent.readAt.toISOString()
          : new Date(parent.readAt).toISOString();
      } catch (error) {
        console.error("Error formatting notification readAt date:", error);
        return null;
      }
    },
  },

  Attachment: {
    url: (parent) => {
      // S'assurer que l'URL n'est jamais null
      if (!parent.url) {
        console.warn("Attachment without URL, using placeholder:", parent);
        return ""; // Retourner une chaîne vide au lieu de null
      }
      return parent.url;
    },
    type: (parent) => {
      // Normaliser le type d'attachment
      if (!parent.type) {
        console.warn("Attachment without type, using FILE as default:", parent);
        return "FILE";
      }
      return parent.type.toUpperCase();
    },
    name: (parent) => {
      // S'assurer que le nom n'est jamais null
      if (!parent.name) {
        console.warn("Attachment without name, using default:", parent);
        return "attachment";
      }
      return parent.name;
    },
    size: (parent) => {
      // S'assurer que la taille est un nombre valide
      if (typeof parent.size !== "number" || parent.size < 0) {
        console.warn("Invalid attachment size, using 0:", parent.size);
        return 0;
      }
      return parent.size;
    },
    mimeType: (parent) => {
      // Le mimeType peut être null (champ nullable)
      return parent.mimeType || null;
    },
    thumbnailUrl: (parent) => {
      // Le thumbnailUrl peut être null (champ nullable)
      return parent.thumbnailUrl || null;
    },
    duration: (parent) => {
      // La durée peut être null (champ nullable)
      return parent.duration || null;
    },
  },

  Subscription: {
    messageSent: {
      subscribe: (_, { senderId, receiverId, conversationId }, { pubsub }) => {
        console.log(
          `[GraphQL] Setting up messageSent subscription: conversationId=${conversationId}, senderId=${senderId}, receiverId=${receiverId}`
        );

        if (conversationId) {
          console.log(
            `[GraphQL] Subscribing to channel: MESSAGE_SENT_${conversationId}`
          );
          return pubsub.asyncIterator(`MESSAGE_SENT_${conversationId}`);
        }
        if (!senderId || !receiverId) {
          throw new Error("Missing senderId or receiverId");
        }
        const channels = [
          `MESSAGE_SENT_${senderId}_${receiverId}`,
          `MESSAGE_SENT_${receiverId}_${senderId}`,
        ];
        console.log(`[GraphQL] Subscribing to channels:`, channels);
        return pubsub.asyncIterator(channels);
      },
      resolve: (payload) => {
        const message = payload.messageSent;

        // Formater les attachments pour s'assurer qu'ils sont valides
        const formattedAttachments = (message.attachments || []).map(
          (attachment) => ({
            url: attachment.url || "",
            type: (attachment.type || "FILE").toUpperCase(),
            name: attachment.name || "attachment",
            size: typeof attachment.size === "number" ? attachment.size : 0,
            mimeType: attachment.mimeType || null,
            thumbnailUrl: attachment.thumbnailUrl || null,
            duration: attachment.duration || null,
          })
        );

        return {
          ...message,
          sender: {
            id: message.senderId,
            username: message.sender?.username || "Unknown",
            image: message.sender?.image || null,
          },
          receiver: message.receiverId
            ? {
                id: message.receiverId,
                username: message.receiver?.username || "Unknown",
                image: message.receiver?.image || null,
              }
            : null,
          attachments: formattedAttachments,
        };
      },
    },
    userStatusChanged: {
      subscribe: (_, __, context) => {
        // Vérifier si le contexte existe
        if (!context) {
          console.error(
            "Context is undefined in userStatusChanged subscription"
          );
          throw new AuthenticationError("Context is missing");
        }

        // Vérifier si pubsub existe dans le contexte
        if (!context.pubsub) {
          console.error(
            "pubsub is undefined in userStatusChanged subscription"
          );
          throw new Error("PubSub is missing");
        }

        console.log("Setting up userStatusChanged subscription");
        return context.pubsub.asyncIterator("USER_STATUS_CHANGED");
      },
      resolve: (payload) => {
        if (!payload) {
          console.error("Payload is undefined in userStatusChanged resolver");
          return null;
        }

        if (!payload.userStatusChanged) {
          console.error("Invalid user status payload:", payload);
          throw new Error("No user status payload received");
        }

        return {
          ...payload.userStatusChanged,
          lastActive: payload.userStatusChanged.lastActive
            ? new Date(payload.userStatusChanged.lastActive).toISOString()
            : null,
        };
      },
    },

    unreadMessages: {
      subscribe: (_, { receiverId }, { pubsub }) => {
        if (!receiverId) {
          console.error(
            `[GraphQL] Missing receiverId in unreadMessages subscription`
          );
          throw new Error("Missing receiverId");
        }

        if (!pubsub) {
          console.error(
            `[GraphQL] PubSub is missing in unreadMessages subscription`
          );
          throw new Error("PubSub is missing");
        }

        console.log(
          `[GraphQL] Setting up unreadMessages subscription for user ${receiverId}`
        );
        return pubsub.asyncIterator(`UNREAD_MESSAGES_${receiverId}`);
      },
      resolve: (payload) => {
        if (!payload || !payload.unreadMessages) {
          console.error(`[GraphQL] Invalid unreadMessages payload:`, payload);
          return [];
        }

        return payload.unreadMessages;
      },
    },

    groupMessageSent: {
      subscribe: (_, { groupId }, { pubsub }) => {
        return pubsub.asyncIterator(`GROUP_MESSAGE_${groupId}`);
      },
    },

    messageUpdated: {
      subscribe: (_, { conversationId }, { pubsub }) => {
        return pubsub.asyncIterator(`MESSAGE_UPDATED_${conversationId}`);
      },
    },

    messageDeleted: {
      subscribe: (_, { conversationId }, { pubsub }) => {
        return pubsub.asyncIterator(`MESSAGE_DELETED_${conversationId}`);
      },
    },

    messageRead: {
      subscribe: (_, { userId }, { pubsub }) => {
        return pubsub.asyncIterator(`MESSAGE_READ_${userId}`);
      },
    },

    messageReaction: {
      subscribe: (_, { conversationId }, { pubsub }) => {
        return pubsub.asyncIterator(`MESSAGE_REACTION_${conversationId}`);
      },
    },

    conversationUpdated: {
      subscribe: (_, { conversationId }, { pubsub }) => {
        return pubsub.asyncIterator(`CONVERSATION_UPDATED_${conversationId}`);
      },
    },

    typingIndicator: {
      subscribe: (_, { conversationId }, { pubsub }) => {
        return pubsub.asyncIterator(`TYPING_INDICATOR_${conversationId}`);
      },
    },

    notificationReceived: {
      subscribe: (_, __, context) => {
        // Vérifier si le contexte existe
        if (!context) {
          console.error(
            "Context is undefined in notificationReceived subscription"
          );
          throw new AuthenticationError("Context is missing");
        }

        // Vérifier si userId existe dans le contexte
        if (!context.userId) {
          console.error(
            "userId is undefined in notificationReceived subscription"
          );
          throw new AuthenticationError("Not authenticated");
        }

        // Vérifier si pubsub existe dans le contexte
        if (!context.pubsub) {
          console.error(
            "pubsub is undefined in notificationReceived subscription"
          );
          throw new Error("PubSub is missing");
        }

        console.log(
          `Setting up notificationReceived subscription for user ${context.userId}`
        );
        return context.pubsub.asyncIterator(`NOTIFICATION_${context.userId}`);
      },
      resolve: (payload) => {
        if (!payload) {
          console.error(
            "Payload is undefined in notificationReceived resolver"
          );
          return null;
        }

        if (!payload.notificationReceived) {
          console.error("Invalid notification format:", payload);
          throw new Error("Invalid notification format");
        }

        return payload.notificationReceived;
      },
    },

    notificationsRead: {
      subscribe: (_, __, context) => {
        // Vérifier si le contexte existe
        if (!context) {
          console.error(
            "Context is undefined in notificationsRead subscription"
          );
          throw new AuthenticationError("Context is missing");
        }

        // Vérifier si userId existe dans le contexte
        if (!context.userId) {
          console.error(
            "userId is undefined in notificationsRead subscription"
          );
          throw new AuthenticationError("Not authenticated");
        }

        // Vérifier si pubsub existe dans le contexte
        if (!context.pubsub) {
          console.error(
            "pubsub is undefined in notificationsRead subscription"
          );
          throw new Error("PubSub is missing");
        }

        console.log(
          `Setting up notificationsRead subscription for user ${context.userId}`
        );
        return context.pubsub.asyncIterator(
          `NOTIFICATION_READ_${context.userId}`
        );
      },
      resolve: (payload) => {
        if (!payload) {
          console.error("Payload is undefined in notificationsRead resolver");
          return [];
        }

        if (!payload.notificationsRead) {
          console.error("Invalid notifications read payload:", payload);
          return [];
        }

        return payload.notificationsRead;
      },
    },

    // Resolvers pour les appels
    callSignal: {
      subscribe: (_, { callId }, context) => {
        // Vérifier si le contexte existe
        if (!context) {
          console.error("Context is undefined in callSignal subscription");
          throw new AuthenticationError("Context is missing");
        }

        // Vérifier si pubsub existe dans le contexte
        if (!context.pubsub) {
          console.error("pubsub is undefined in callSignal subscription");
          throw new Error("PubSub is missing");
        }

        const channel = callId
          ? `CALL_SIGNAL_${callId}`
          : `CALL_SIGNAL_ALL_${context.userId}`;

        console.log(
          `Setting up callSignal subscription for channel ${channel}`
        );
        return context.pubsub.asyncIterator(channel);
      },
      resolve: (payload) => {
        if (!payload) {
          console.error("Payload is undefined in callSignal resolver");
          return null;
        }

        if (!payload.callSignal) {
          console.error("Invalid call signal payload:", payload);
          throw new Error("Invalid call signal format");
        }

        return payload.callSignal;
      },
    },

    incomingCall: {
      subscribe: (_, __, context) => {
        // Vérifier si le contexte existe
        if (!context) {
          console.error("Context is undefined in incomingCall subscription");
          throw new AuthenticationError("Context is missing");
        }

        // Vérifier si userId existe dans le contexte
        if (!context.userId) {
          console.error("userId is undefined in incomingCall subscription");
          throw new AuthenticationError("Not authenticated");
        }

        // Vérifier si pubsub existe dans le contexte
        if (!context.pubsub) {
          console.error("pubsub is undefined in incomingCall subscription");
          throw new Error("PubSub is missing");
        }

        console.log(
          `Setting up incomingCall subscription for user ${context.userId}`
        );
        return context.pubsub.asyncIterator(`INCOMING_CALL_${context.userId}`);
      },
      resolve: (payload) => {
        if (!payload) {
          console.error("Payload is undefined in incomingCall resolver");
          return null;
        }

        if (!payload.incomingCall) {
          console.error("Invalid incoming call payload:", payload);
          throw new Error("Invalid incoming call format");
        }

        return payload.incomingCall;
      },
    },

    callStatusChanged: {
      subscribe: (_, { callId }, context) => {
        // Vérifier si le contexte existe
        if (!context) {
          console.error(
            "Context is undefined in callStatusChanged subscription"
          );
          throw new AuthenticationError("Context is missing");
        }

        // Vérifier si pubsub existe dans le contexte
        if (!context.pubsub) {
          console.error(
            "pubsub is undefined in callStatusChanged subscription"
          );
          throw new Error("PubSub is missing");
        }

        const channel = callId
          ? `CALL_STATUS_${callId}`
          : `CALL_STATUS_ALL_${context.userId}`;

        console.log(
          `Setting up callStatusChanged subscription for channel ${channel}`
        );
        return context.pubsub.asyncIterator(channel);
      },
      resolve: (payload) => {
        if (!payload) {
          console.error("Payload is undefined in callStatusChanged resolver");
          return null;
        }

        if (!payload.callStatusChanged) {
          console.error("Invalid call status payload:", payload);
          throw new Error("Invalid call status format");
        }

        return payload.callStatusChanged;
      },
    },
  },
};

module.exports = resolvers;
