const MessageService = require("../services/message.service");
const NotificationService = require("../services/notification.service");
const Message = require("../models/message.model");
const Conversation = require("../models/conversation.model");
const User = require("../models/user.model");
const { GraphQLError } = require("graphql");
const GraphQLUpload = require("graphql-upload/GraphQLUpload.js");
const { isValidObjectId } = require("mongoose");
const AuthenticationError = (message) =>
  new GraphQLError(message, {
    extensions: { code: "UNAUTHENTICATED" },
  });
const UserInputError = (message) =>
  new GraphQLError(message, {
    extensions: { code: "BAD_USER_INPUT" },
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
    timestamp: (parent) => parent.timestamp.toISOString(),
    readAt: (parent) => parent.readAt?.toISOString() || null,
  },
  Conversation: {
    id: (parent) => parent._id.toString(),
    participants: async (parent) => {
      if (parent.participants && parent.participants[0]?.username) {
        return parent.participants;
      }
      return User.find({ _id: { $in: parent.participants } });
    },
    messages: async (parent, { limit = 50, offset = 0 }) => {
      return Message.find({ conversationId: parent._id })
        .sort({ timestamp: -1 })
        .skip(offset)
        .limit(limit);
    },
    lastMessage: async (parent) => {
      if (parent.lastMessage) return parent.lastMessage;
      return Message.findById(parent.lastMessageId);
    },
    unreadCount: async (parent, _, { userId }) => {
      if (parent.unreadCount !== undefined) return parent.unreadCount;
      return Message.countDocuments({
        conversationId: parent._id,
        receiver: userId,
        isRead: false,
      });
    },
    pinnedMessages: async (parent) => {
      return Message.find({ _id: { $in: parent.pinnedMessages } });
    },
    typingUsers: async (parent) => {
      return User.find({ _id: { $in: parent.typingUsers } });
    },
  },
  Query: {
    getMessages: async (
      _,
      { senderId, receiverId, page = 1, limit = 10 },
      context
    ) => {
      if (!context.userId) throw new Error("Unauthorized");

      try {
        await MessageService.validateUserIds(senderId, receiverId);
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
        return messages.map((msg) => MessageService.formatMessageResponse(msg));
      } catch (error) {
        console.error("Error fetching messages:", error);
        throw new Error(`Failed to fetch messages: ${error.message}`);
      }
    },

    getUnreadMessages: async (_, { userId }, context) => {
      try {
        if (!context.userId) throw new Error("Authentication required");
        if (context.userId !== userId) {
          throw new Error(
            "Unauthorized: You can only view your own unread messages"
          );
        }

        const unreadMessages = await Message.find({
          receiverId: userId,
          isRead: false,
        })
          .populate("sender", "id username email image")
          .sort({ timestamp: -1 })
          .lean();

        return unreadMessages.map((msg) => {
          return {
            ...MessageService.formatMessageResponse(msg),
            sender: msg.sender
              ? {
                  id: msg.sender._id.toString(),
                  username: msg.sender.username,
                  email: msg.sender.email,
                  image: msg.sender.image,
                  isOnline: msg.sender.isOnline,
                }
              : null,
          };
        });
      } catch (error) {
        console.error("Error in getUnreadMessages:", error);
        throw new Error(
          error.message.includes("Unauthorized") ||
          error.message.includes("Authentication")
            ? error.message
            : "Failed to fetch unread messages"
        );
      }
    },
    searchMessages: async (_, { query, conversationId, limit, offset }, { userId }) => {
      if (!userId) throw new AuthenticationError('Not authenticated');
      
      return MessageService.searchMessages({
        userId,
        query,
        conversationId,
        limit,
        offset
      });
    },
    getConversation: async (_, { conversationId }, context) => {
      if (!context.userId) throw new Error("Unauthorized");

      try {
        // Validate conversation ID
        if (!isValidObjectId(conversationId)) {
          throw new Error("Invalid conversation ID");
        }

        // Find the conversation with minimal population first
        const conversation = await Conversation.findById(conversationId)
          .populate("participants", "id username email image isOnline")
          .lean();

        if (!conversation) {
          throw new Error("Conversation not found");
        }

        // Check if current user is a participant
        const isParticipant = conversation.participants.some(
          (p) => p._id.toString() === context.userId
        );

        if (!isParticipant) {
          throw new Error(
            "Unauthorized: You are not a participant in this conversation"
          );
        }

        // Now get messages separately with pagination
        const messages = await Message.find({
          conversationId: conversation._id,
        })
          .sort({ timestamp: -1 })
          .limit(50)
          .populate("senderId receiverId", "id username email image")
          .lean();

        // Get last message separately if needed
        const lastMessage = conversation.lastMessage
          ? await Message.findById(conversation.lastMessage)
              .populate("senderId receiverId", "id username email image")
              .lean()
          : null;

        // Safe date formatting function
        const safeDate = (date) => {
          if (!date) return null;
          try {
            return new Date(date).toISOString();
          } catch {
            return null;
          }
        };

        // Format the response
        return {
          ...conversation,
          id: conversation._id.toString(),
          createdAt: safeDate(conversation.createdAt),
          updatedAt: safeDate(conversation.updatedAt),
          messages: messages.map((msg) => ({
            ...msg,
            id: msg._id.toString(),
            timestamp: safeDate(msg.timestamp),
            senderId: msg.senderId
              ? {
                  ...msg.senderId,
                  id: msg.senderId._id.toString(),
                }
              : null,
            receiverId: msg.receiverId
              ? {
                  ...msg.receiverId,
                  id: msg.receiverId._id.toString(),
                }
              : null,
          })),
          lastMessage: lastMessage
            ? {
                ...lastMessage,
                id: lastMessage._id.toString(),
                timestamp: safeDate(lastMessage.timestamp),
                senderId: lastMessage.senderId
                  ? {
                      ...lastMessage.senderId,
                      id: lastMessage.senderId._id.toString(),
                    }
                  : null,
                receiverId: lastMessage.receiverId
                  ? {
                      ...lastMessage.receiverId,
                      id: lastMessage.receiverId._id.toString(),
                    }
                  : null,
              }
            : null,
        };
      } catch (error) {
        console.error("Error fetching conversation:", error);
        throw new Error(`Failed to fetch conversation: ${error.message}`);
      }
    },
    getConversations: async (_, __, context) => {
      if (!context.userId) throw new Error("Unauthorized");

      try {
        const conversations = await Conversation.find({
          participants: context.userId,
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

        const conversationsWithValidData = await Promise.all(
          conversations.map(async (conv) => {
            // Handle missing timestamps safely
            const safeTimestamp = (date) => {
              if (!date) return new Date().toISOString(); // Fallback to current time
              return date.toISOString();
            };

            // Filter invalid participants
            const validParticipants = conv.participants
              .filter((p) => p && p._id)
              .map((p) => ({
                ...p,
                id: p._id.toString(),
              }));

            // Count unread messages
            const unreadCount = await Message.countDocuments({
              conversationId: conv._id,
              receiverId: context.userId,
              isRead: false,
            });

            // Handle lastMessage safely
            let lastMessage = null;
            if (conv.lastMessage) {
              lastMessage = {
                ...conv.lastMessage,
                id: conv.lastMessage._id.toString(),
                timestamp: safeTimestamp(conv.lastMessage.timestamp),
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
              updatedAt: safeTimestamp(conv.updatedAt),
              createdAt: safeTimestamp(conv.createdAt),
              lastMessage,
            };
          })
        );

        return conversationsWithValidData;
      } catch (error) {
        console.error("Error fetching conversations:", error);
        throw new Error(`Failed to fetch conversations: ${error.message}`);
      }
    },
    getAllUsers: async (_, { search }, context) => {
      try {
        // Authentication check
        if (!context.userId) throw new Error("Unauthorized");

        const filter = {};

        if (search) {
          filter.$or = [
            { username: { $regex: search, $options: "i" } },
            { email: { $regex: search, $options: "i" } },
          ];
        }

        const users = await User.find(filter).sort({ createdAt: -1 }).lean();

        return users.map((user) => ({
          ...user,
          id: user._id.toString(),
          createdAt: user.createdAt.toISOString(),
          updatedAt: user.updatedAt.toISOString(),
          lastActive: user.lastActive?.toISOString() || null,
        }));
      } catch (error) {
        console.error("Error fetching users:", error);
        throw new Error(`Failed to fetch users: ${error.message}`);
      }
    },
    getOneUser: async (_, { id }, context) => {
      try {
        // Authentication check
        if (!context.userId) throw new Error("Unauthorized");

        // Authorization
        // if (context.userId !== id && context.user.role !== "admin") {
        //   throw new Error("Unauthorized: You can only view your own profile");
        // }

        const user = await User.findById(id).lean();
        if (!user) throw new Error("User not found");

        return {
          ...user,
          id: user._id.toString(),
          createdAt: user.createdAt.toISOString(),
          updatedAt: user.updatedAt.toISOString(),
          lastActive: user.lastActive?.toISOString() || null,
        };
      } catch (error) {
        console.error("Error fetching user:", error);
        throw new Error(`Failed to fetch user: ${error.message}`);
      }
    },
  },

  Mutation: {
    sendMessage: async (
      _,
      { senderId, receiverId, content, file },
      context
    ) => {
      return MessageService.sendMessage({
        senderId,
        receiverId,
        content,
        file,
        context,
      });
    },
    sendGroupMessage: async (_, { content, groupId, file }, { userId }) => {
      if (!userId) throw new AuthenticationError('Not authenticated');
      
      let attachments = [];
      if (file) {
        const { createReadStream, filename, mimetype } = await file;
        const stream = createReadStream();
        const url = await uploadFile(stream, filename, mimetype);
        
        const type = mimetype.startsWith('image/') ? 'image' : 
                     mimetype.startsWith('audio/') ? 'audio' : 'file';
        
        attachments.push({
          url,
          type,
          name: filename,
          size: 0
        });
      }

      const message = await MessageService.sendGroupMessage({
        senderId: userId,
        groupId,
        content,
        attachments,
        type: attachments.length ? attachments[0].type : 'text'
      });

      // Send notifications
      await NotificationService.sendMessageNotification(message);

      return message;
    },

    editMessage: async (_, { messageId, newContent }, { userId }) => {
      if (!userId) throw new AuthenticationError('Not authenticated');
      return MessageService.editMessage({ messageId, userId, newContent });
    },

    deleteMessage: async (_, { messageId }, { userId }) => {
      if (!userId) throw new AuthenticationError('Not authenticated');
      return MessageService.deleteMessage({ messageId, userId });
    },
    markMessageAsRead: async (_, { messageId }, context) => {
      if (!context.userId) throw new Error("Unauthorized");
      return MessageService.markAsRead({ messageId, userId: context.userId });
    },

    setUserOnline: async (_, { userId }, context) => {
      if (!context.userId || context.userId !== userId) {
        throw new Error("Unauthorized: You can only update your own status");
      }

      try {
        const now = new Date();
        const user = await User.findByIdAndUpdate(
          userId,
          {
            isOnline: true,
            lastActive: now,
          },
          { new: true, lean: true }
        );

        if (!user) throw new Error("User not found");

        const formattedUser = {
          ...user,
          id: user._id.toString(),
          createdAt: MessageService.safeToISOString(user.createdAt),
          updatedAt: MessageService.safeToISOString(user.updatedAt),
          lastActive: MessageService.safeToISOString(user.lastActive),
        };

        pubsub.publish("USER_STATUS_CHANGED", {
          userStatusChanged: formattedUser,
        });

        return formattedUser;
      } catch (error) {
        console.error("Error setting user online:", error);
        throw new Error(`Failed to set user online: ${error.message}`);
      }
    },

    setUserOffline: async (_, { userId }, context) => {
      if (!context.userId || context.userId !== userId) {
        throw new Error("Unauthorized: You can only update your own status");
      }

      try {
        const now = new Date();
        const user = await User.findByIdAndUpdate(
          userId,
          {
            isOnline: false,
            lastActive: now,
          },
          { new: true, lean: true }
        );

        if (!user) throw new Error("User not found");

        const formattedUser = {
          ...user,
          id: user._id.toString(),
          createdAt: MessageService.safeToISOString(user.createdAt),
          updatedAt: MessageService.safeToISOString(user.updatedAt),
          lastActive: MessageService.safeToISOString(user.lastActive),
        };

        pubsub.publish("USER_STATUS_CHANGED", {
          userStatusChanged: formattedUser,
        });

        return formattedUser;
      } catch (error) {
        console.error("Error setting user offline:", error);
        throw new Error(`Failed to set user offline: ${error.message}`);
      }
    },
    createGroup: async (_, { name, participantIds, photo }, { userId }) => {
      if (!userId) throw new AuthenticationError('Not authenticated');
      
      // Add current user to participants
      const participants = [...new Set([userId, ...participantIds])];
      
      if (participants.length < 2) {
        throw new UserInputError('A group must have at least 2 participants');
      }

      let groupPhotoUrl;
      if (photo) {
        const { createReadStream, filename } = await photo;
        const stream = createReadStream();
        groupPhotoUrl = await uploadFile(stream, filename, 'image');
      }

      const group = new Conversation({
        participants,
        isGroup: true,
        groupName: name,
        groupPhoto: groupPhotoUrl,
        groupAdmins: [userId]
      });

      await group.save();

      return group;
    },
    createGroup: async (_, { name, participantIds, photo }, { userId }) => {
      if (!userId) throw new AuthenticationError('Not authenticated');
      
      // Add current user to participants
      const participants = [...new Set([userId, ...participantIds])];
      
      if (participants.length < 2) {
        throw new UserInputError('A group must have at least 2 participants');
      }

      let groupPhotoUrl;
      if (photo) {
        const { createReadStream, filename } = await photo;
        const stream = createReadStream();
        groupPhotoUrl = await uploadFile(stream, filename, 'image');
      }

      const group = new Conversation({
        participants,
        isGroup: true,
        groupName: name,
        groupPhoto: groupPhotoUrl,
        groupAdmins: [userId]
      });

      await group.save();

      return group;
    }
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
    },
  },
};

module.exports = resolvers;
