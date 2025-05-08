const MessageService = require("../services/message.service");
const NotificationService = require("../services/notification.service");
const UserService = require("../services/user.service");
const { GraphQLError } = require("graphql");
const GraphQLUpload = require("graphql-upload/GraphQLUpload.js");
const { messageSchema } = require("../validators/message.validators");
const { AuthenticationError } = require('../graphql/errors');
const { messageUpdateSchema } = require("../validators/message.validators");
const User = require("../models/user.model");
const   Group  = require("../models/group.model");
const  Message = require("../models/message.model");
const Conversation  = require("../models/conversation.model");

const resolvers = {

  Upload: GraphQLUpload,

  Message: {
    id: (parent) => parent._id?.toString() || parent.id,
    sender: (parent) => {
      return parent.sender || {
        id: parent.senderId?.toString() || 'unknown-user',
        username: 'Unknown User',
        email: null,
        image: null
      };
    },
    receiver: (parent) => {
      return parent.receiver || (parent.receiverId ? {
        id: parent.receiverId.toString()
      } : null);
    },
    group: async (parent, _, { loaders }) => {
      if (!parent.groupId) return null;
      try {
        return loaders?.groupLoader 
          ? await loaders.groupLoader.load(parent.groupId.toString())
          : await Group.findById(parent.groupId);
      } catch (error) {
        console.error('Error loading group:', error);
        return null;
      }
    },
    conversation: async (parent, _, { loaders }) => {
      if (!parent.conversationId) return null;
      try {
        return loaders?.conversationLoader 
          ? await loaders.conversationLoader.load(parent.conversationId.toString())
          : await Conversation.findById(parent.conversationId);
      } catch (error) {
        console.error('Error loading conversation:', error);
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
        console.error('Error loading forwarded message:', error);
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
        console.error('Error loading replied message:', error);
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
        console.error('Error loading pinnedBy user:', error);
        return null;
      }
    },
    timestamp: (parent) => {
      // Gestion robuste du timestamp
      if (!parent.timestamp) return null;
      
      try {
        const date = parent.timestamp instanceof Date 
          ? parent.timestamp 
          : new Date(parent.timestamp);
        
        return date.toISOString();
      } catch (error) {
        console.error('Invalid timestamp:', parent.timestamp);
        return null;
      }
    },
    readAt: (parent) => parent.readAt?.toISOString() || null,
    deletedAt: (parent) => parent.deletedAt?.toISOString() || null,
    pinnedAt: (parent) => parent.pinnedAt?.toISOString() || null,
    reactions: async (parent, _, { loaders }) => {
      if (!parent.reactions?.length) return [];
      try {
        const reactionUsers = await Promise.all(
          parent.reactions.map(r => 
            loaders?.userLoader 
              ? loaders.userLoader.load(r.userId.toString())
              : User.findById(r.userId).lean()
          )
        );
        return parent.reactions.map((reaction, index) => ({
          ...reaction,
          userId: reaction.userId.toString(),
          user: reactionUsers[index]
        }));
      } catch (error) {
        console.error('Error loading reaction users:', error);
        return [];
      }
    },
    attachments: (parent) => parent.attachments || []
  },

  Conversation: {
    
    id: (parent) => parent._id?.toString() || parent.id,
    messages: async (parent, { limit = 50, offset = 0 }, { loaders }) => {
      try {
        const messages = await MessageService.getMessages({
          conversationId: parent._id || parent.id,
          limit,
          offset
        });
  
        if (loaders?.messageLoader) {
          messages.forEach(msg => {
            loaders.messageLoader.prime(msg._id.toString(), msg);
          });
        }
  
        return messages;
      } catch (error) {
        console.error('Error loading messages:', error);
        return [];
      }
    },
  
    participants: async (parent) => {
      // If participants are already populated (from getConversations)
      if (Array.isArray(parent.participants) && parent.participants.length > 0) {
        return parent.participants;
      }
      
      // Fallback population
      try {
        const conv = await Conversation.findById(parent.id)
          .populate({
            path: "participants",
            select: "_id username email image isOnline lastActive role",
            model: "User"
          })
          .lean();
        
        return (conv?.participants || []).map(p => ({
          id: p._id.toString(),
          username: p.username,
          email: p.email,
          image: p.image,
          isOnline: p.isOnline,
          lastActive: p.lastActive?.toISOString(),
          role: p.role
        }));
      } catch (error) {
        console.error('Error loading participants:', error);
        return [];
      }
    },
  
    unreadCount: async (parent, _, { userId }) => {
      try {
        return await Message.countDocuments({
          conversationId: parent.id,
          receiverId: userId,
          isRead: false
        });
      } catch (error) {
        console.error('Error calculating unread count:', error);
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
        console.error('Error loading last message:', error);
        return null;
      }
    },

    pinnedMessages: async (parent, _, { loaders }) => {
      if (!parent.pinnedMessages?.length) return [];
      try {
        return loaders?.messageLoader
          ? await Promise.all(
              parent.pinnedMessages.map(id => 
                loaders.messageLoader.load(id.toString())
              )
            )
          : await Message.find({ 
              _id: { $in: parent.pinnedMessages } 
            }).lean();
      } catch (error) {
        console.error('Error loading pinned messages:', error);
        return [];
      }
    },
  
    typingUsers: async (parent, _, { loaders }) => {
      if (!parent.typingUsers?.length) return [];
      try {
        return loaders?.userLoader
          ? await Promise.all(
              parent.typingUsers.map(id => 
                loaders.userLoader.load(id.toString())
              )
            )
          : await User.find({ 
              _id: { $in: parent.typingUsers } 
            }).lean();
      } catch (error) {
        console.error('Error loading typing users:', error);
        return [];
      }
    },
  
    groupAdmins: async (parent, _, { loaders }) => {
      if (!parent.groupAdmins?.length) return [];
      try {
        return loaders?.userLoader
          ? await Promise.all(
              parent.groupAdmins.map(id => 
                loaders.userLoader.load(id.toString())
              )
            )
          : await User.find({ 
              _id: { $in: parent.groupAdmins } 
            }).lean();
      } catch (error) {
        console.error('Error loading group admins:', error);
        return [];
      }
    }

  },

  Query: {
    getMessages: async (_, { senderId, receiverId, conversationId, page = 1, limit = 10 }, { userId, loaders }) => {
      if (!userId) throw new AuthenticationError('Unauthorized');
      
      try {
        const messages = await MessageService.getMessages({
          senderId,
          receiverId,
          conversationId,
          page,
          limit,
          userId,
          loaders
        });
    
        // Ensure no null values for non-nullable fields
        return messages.map(msg => ({
          ...msg,
          sender: {
            ...msg.sender,
            username: msg.sender.username || 'Unknown User',
            email: msg.sender.email || 'unknown@example.com'
          },
          receiver: msg.receiver ? {
            ...msg.receiver,
            username: msg.receiver.username || 'Unknown User',
            email: msg.receiver.email || 'unknown@example.com'
          } : null
        }));
      } catch (error) {
        console.error('Error in getMessages:', error);
        throw new ApolloError('Failed to fetch messages', 'MESSAGE_FETCH_FAILED', {
          originalError: error
        });
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
      if (!context.userId) {
        throw new AuthenticationError("Unauthorized");
      }

      try {
        const conversation = await MessageService.getConversation(
          conversationId,
          context.userId
        );
        if (!conversation) {
          throw new ApolloError("Conversation not found", "NOT_FOUND");
        }
        return conversation;
      } catch (error) {
        console.error("Error fetching conversation:", error);
        throw new ApolloError(
          error.message || "Failed to fetch conversation",
          error.extensions?.code || "CONVERSATION_FETCH_FAILED",
          { originalError: error }
        );
      }
    },
    
    getConversations: async (_, __, context) => {
      if (!context.userId) throw new AuthenticationError('Unauthorized');
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

    getUserNotifications: async (_, __, { userId }) => {
      if (!userId) throw new AuthenticationError("Not authenticated");

      try {
        return await NotificationService.getUserNotifications(userId);
      } catch (error) {
        console.error("Error fetching notifications:", error);
        throw new ApolloError("Failed to fetch notifications");
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
    sendMessage: async (_, { receiverId, content, file }, { userId, pubsub }) => {
      if (!userId) throw new AuthenticationError('Unauthorized');
      try {
        const result = await MessageService.sendMessage({
          senderId: userId,
          receiverId,
          content,
          file,
          context: { userId, pubsub }
        });
        return result;
      } catch (error) {
        console.error('Send message error:', error);
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

      try {
        const result = await NotificationService.markAsRead(
          userId,
          notificationIds
        );
        return result;
      } catch (error) {
        throw new Error(error.message);
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
            username: message.sender?.username || 'Unknown',
            image: message.sender?.image || null
          },
          receiver: message.receiverId ? {
            id: message.receiverId,
            username: message.receiver?.username || 'Unknown',
            image: message.receiver?.image || null
          } : null,
        };
      },
    },
    userStatusChanged: {
      subscribe: (_, __, { pubsub }) => {
        return pubsub.asyncIterator("USER_STATUS_CHANGED");
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
      subscribe: (_, { receiverId }, { pubsub }) => {
        pubsub.asyncIterator(`UNREAD_MESSAGES_${receiverId}`);
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
      subscribe: (_, __, { userId, pubsub }) => {
        if (!userId) throw new AuthenticationError("Not authenticated");
        return pubsub.asyncIterator(`NOTIFICATION_${userId}`);
      },
      resolve: (payload) => {
        if (!payload?.notificationReceived) {
          throw new Error("Invalid notification format");
        }
        return payload.notificationReceived;
      },
    },

    notificationsRead: {
      subscribe: (_, __, { userId, pubsub }) => {
        if (!userId) throw new AuthenticationError("Not authenticated");
        return pubsub.asyncIterator(`NOTIFICATION_READ_${userId}`);
      },
      resolve: (payload) => {
        if (!payload?.notificationsRead) {
          throw new Error("Invalid notifications read payload");
        }
        return payload.notificationsRead;
      },
    },
  },

};

module.exports = resolvers;
