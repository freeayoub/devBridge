const MessageService = require("../services/message.service");
const NotificationService = require("../services/notification.service");
const { GraphQLError } = require("graphql");
const GraphQLUpload = require("graphql-upload/GraphQLUpload.js");
const UserService = require("../services/user.service");
const { messageSchema } = require("../validators/message.validators");
const { messageUpdateSchema } = require("../validators/message.validators");
const AuthenticationError = (message) =>
  new GraphQLError(message, {
    extensions: { code: "UNAUTHENTICATED" },
  });

const resolvers = {
  Upload: GraphQLUpload,

  Message: {
    id: (parent) => parent._id.toString(),
    sender: async (parent) => {
      if (parent.senderId) return parent.senderId;
      return User.findById(parent.senderId);
    },
    receiver: async (parent) => {
      if (parent.receiverId) return parent.receiverId;
      if (parent.receiverId) return User.findById(parent.receiverId);
      return null;
    },
    group: async (parent) => {
      if (parent.group) return parent.group;
      if (parent.groupId) return Group.findById(parent.groupId);
      return null;
    },
    timestamp: (parent) => {
      if (!(parent.timestamp instanceof Date)) {
        parent.timestamp = new Date(parent.timestamp);
      }
      return parent.timestamp.toISOString();
    },
    timestamp: (parent) => {
      if (!parent.timestamp) return null;
      if (!(parent.timestamp instanceof Date)) {
        parent.timestamp = new Date(parent.timestamp);
      }
      return parent.timestamp.toISOString();
    },
    readAt: (parent) => {
      if (!parent.readAt) return null;
      if (!(parent.readAt instanceof Date)) {
        parent.readAt = new Date(parent.readAt);
      }
      return parent.readAt.toISOString();
    },
    conversation: async (parent) => {
      if (parent.conversation) return parent.conversation;
      return Conversation.findById(parent.conversationId);
    },
  },

  Conversation: {
    id: (parent) => {
      if (!parent) return null;
      if (parent._id) return parent._id.toString();
      if (parent.id) return parent.id.toString();
      return null;
    },
    participants: async (parent) => {
      if (parent.participants && parent.participants[0]?.username) {
        return parent.participants;
      }
      return User.find({ _id: { $in: parent.participants } });
    },
    messages: async (parent, { limit = 50, offset = 0 }) => {
      return MessageService.getMessages({
        conversationId: parent._id,
        limit,
        offset,
      });
    },
    lastMessage: async (parent) => {
      if (parent.lastMessage) return parent.lastMessage;
      return Message.findById(parent.lastMessageId);
    },
    unreadCount: async (parent, _, { userId }) => {
      if (parent.unreadCount !== undefined) return parent.unreadCount;
      return MessageService.getUnreadCount(parent._id, userId);
    },
    pinnedMessages: async (parent) => {
      return Message.find({ _id: { $in: parent.pinnedMessages } });
    },
    typingUsers: async (parent) => {
      return User.find({ _id: { $in: parent.typingUsers } });
    },
  },
  
  Query: {
    getMessages: async (_, { senderId, receiverId, page, limit }, context) => {
      if (!context.userId) throw AuthenticationError("Unauthorized");
      return MessageService.getMessages({
        senderId,
        receiverId,
        page,
        limit,
      });
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
      { query, conversationId, limit, offset },
      { userId }
    ) => {
      if (!userId) throw AuthenticationError("Not authenticated");
      return MessageService.searchMessages({
        userId,
        query,
        conversationId,
        limit,
        offset,
      });
    },

    getConversation: async (_, { conversationId }, context) => {
      if (!context.userId) {
        throw new AuthenticationError("Unauthorized");
      }

      try {
        return await MessageService.getConversation(
          conversationId,
          context.userId
        );
      } catch (error) {
        console.error("Resolver error:", error);
        throw new ApolloError("Failed to fetch conversation");
      }
    },

    getConversations: async (_, __, context) => {
      if (!context.userId) throw AuthenticationError("Unauthorized");
      return MessageService.getConversations(context.userId);
    },

    getAllUsers: async (_, { search }, context) => {
      if (!context.userId) throw AuthenticationError("Unauthorized");
      return UserService.getAllUsers(search);
    },

    getOneUser: async (_, { id }, context) => {
      if (!context.userId) throw AuthenticationError("Unauthorized");
      return UserService.getOneUser(id);
    },
  },

  Mutation: {
    sendMessage: async (_, { receiverId, content, file }, context) => {
      try {
        // Validate input
        const input = {
          senderId: context.userId,
          receiverId,
          content,
          file,
          type: "text",
          status: "sending",
        };
        await messageSchema.validate(input, { abortEarly: false });

        if (!context.userId) throw new AuthenticationError("Unauthorized");

        return MessageService.sendMessage({
          senderId: context.userId,
          receiverId,
          content,
          file,
          replyTo: null,
          context,
        });
      } catch (error) {
        console.error("Send message error:", error);
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
      if (!userId) throw new AuthenticationError("Not authenticated");

      const result = await NotificationService.markAsRead(
        userId,
        notificationIds
      );
      if (!result) {
        throw new Error("Failed to mark notifications as read");
      }

      return true;
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
        if (!payload?.messageSent) {
          throw new Error("No message payload");
        }
        return {
          ...payload.messageSent,
          id: payload.messageSent._id?.toString() || payload.messageSent.id,
          timestamp:
            payload.messageSent.timestamp?.toISOString() ||
            new Date().toISOString(),
          senderId: {
            id: payload.messageSent.sender || payload.messageSent.senderId,
            username: payload.sender?.username || "",
            image: payload.sender?.image || "",
          },
          receiverId: {
            id: payload.messageSent.receiver || payload.messageSent.receiverId,
            username: payload.receiver?.username || "",
            image: payload.receiver?.image || "",
          },
        };
      },
    },
    userStatusChanged: {
      subscribe: (_, __, context) => {
        if (!context.pubsub) {
          throw new Error("PubSub not available in context");
        }
        return context.pubsub.asyncIterator("USER_STATUS_CHANGED");
      },
      resolve: (payload) => {
        if (!payload?.userStatusChanged) {
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
      subscribe: (_, { receiverId }, { pubsub }) =>
        pubsub.asyncIterator(`UNREAD_MESSAGES_${receiverId}`),
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
      subscribe: (_, __, { userId, pubsub }) => {
        if (!userId) throw new AuthenticationError("Not authenticated");
        return pubsub.asyncIterator(`NOTIFICATION_${userId}`);
      },
      resolve: (payload) => {
        if (!payload?.notificationReceived) {
          throw new Error('Invalid notification format');
        }
        return payload.notificationReceived;
      }
    },
  },
};

module.exports = resolvers;
