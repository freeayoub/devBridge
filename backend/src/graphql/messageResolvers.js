const MessageService = require("../services/message.service");
const NotificationService = require("../services/notification.service");
const UserService = require("../services/user.service");
const { GraphQLError } = require("graphql");
const GraphQLUpload = require("graphql-upload/GraphQLUpload.js");
const { AuthenticationError, ApolloError } = require("../graphql/errors");
const { messageUpdateSchema } = require("../validators/message.validators");
const User = require("../models/user.model");
const Group = require("../models/group.model");
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

    getAllUsers: async (_, { search }, context) => {
      if (!context.userId) throw AuthenticationError("Unauthorized");
      return UserService.getAllUsers(search);
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
            timestamp: notification.createdAt,
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
  },

  Mutation: {
    sendMessage: async (
      _,
      { receiverId, content, file, type = "TEXT" },
      { userId, pubsub }
    ) => {
      console.log(
        `[GraphQL] sendMessage mutation called: receiverId=${receiverId}, userId=${userId}, hasFile=${!!file}, type=${type}`
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

        const userNotifications = notifications.filter(
          (n) => n.userId.toString() === userId
        );

        if (userNotifications.length !== notifications.length) {
          const notUserIds = notifications
            .filter((n) => n.userId.toString() !== userId)
            .map((n) => n._id.toString());
          console.error(
            `[GraphQL] Some notifications do not belong to the user: ${JSON.stringify(
              notUserIds
            )}`
          );
          throw new Error(
            `Some notifications do not belong to the user: ${notUserIds.join(
              ", "
            )}`
          );
        }

        const result = await NotificationService.markAsRead(
          userId,
          notificationIds
        );
        console.log(
          `[GraphQL] Notifications marked as read successfully: ${JSON.stringify(
            result
          )}`
        );
        return result;
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

    updateGroup: async (_, { id, input }, { userId }) => {
      if (!userId) throw new GraphQLError("Unauthorized");
      return MessageService.updateGroup({ groupId: id, input, userId });
    },

    updateUserProfile: async (_, { input }, { userId }) => {
      if (!userId) throw new GraphQLError("Unauthorized");
      return UserService.updateProfile(userId, input);
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

  Subscription: {
    messageSent: {
      subscribe: (_, { senderId, receiverId, conversationId }, { pubsub }) => {
        if (conversationId) {
          return pubsub.asyncIterator(`MESSAGE_SENT_${conversationId}`);
        }
        if (!senderId || !receiverId) {
          throw new Error("Missing senderId or receiverId");
        }
        const channels = [
          `MESSAGE_SENT_${senderId}_${receiverId}`,
          `MESSAGE_SENT_${receiverId}_${senderId}`,
        ];
        return pubsub.asyncIterator(channels);
      },
      resolve: (payload) => {
        const message = payload.messageSent;
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
