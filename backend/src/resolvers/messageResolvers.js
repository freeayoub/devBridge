const pubsub = require("../config/pubsub");
const GraphQLUpload = require("graphql-upload/GraphQLUpload.js");
const User = require("../models/schemas/user.schema");
const Message = require("../models/schemas/message.schema");
const Conversation = require("../models/schemas/conversation.schema");
const uploadFile = require("../services/messageService");
const { messageSchema } = require("../models/validators/message.validators");
const { isValidObjectId } = require("mongoose");
const validateUserIds = async (senderId, receiverId) => {
  if (!isValidObjectId(senderId)) throw new Error("Invalid senderId");
  if (!isValidObjectId(receiverId)) throw new Error("Invalid receiverId");

  const [senderExists, receiverExists] = await Promise.all([
    User.exists({ _id: senderId }),
    User.exists({ _id: receiverId }),
  ]);

  if (!senderExists || !receiverExists) {
    throw new Error("Sender or receiver does not exist");
  }
};
// Helper: Safely convert to ISO string (or return null)
function safeToISOString(date) {
  if (!date) return null;
  try {
    return date instanceof Date
      ? date.toISOString()
      : new Date(date).toISOString();
  } catch {
    return null;
  }
}

// Helper: Ensure consistent message formatting
function formatMessageResponse(message) {
  if (!message) throw new Error("Message cannot be null");

  const msg = message.toObject?.() || message;
  return {
    ...msg,
    id: msg._id?.toString?.(),
    timestamp: safeToISOString(msg.timestamp),
    readAt: safeToISOString(msg.readAt),
    // Ensure all other Date fields are safe
    createdAt: safeToISOString(msg.createdAt),
    updatedAt: safeToISOString(msg.updatedAt),
  };
}
const resolvers = {
  Query: {
    me: async (_, __, context) => {
      if (!context.user) {
        throw new Error("Non authentifié");
      }
      return context.user;
    },
    getMessages: async (
      _,
      { senderId, receiverId, page = 1, limit = 10 },
      context
    ) => {
      if (!context.userId) throw new Error("Unauthorized");

      try {
        await validateUserIds(senderId, receiverId);
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
          .lean()
          .exec();

        return messages.map((msg) => ({
          ...msg,
          id: msg._id.toString(),
          timestamp: msg.timestamp?.toISOString() || new Date().toISOString(),
        }));
      } catch (error) {
        console.error("Error fetching messages:", error);
        throw new Error(`Failed to fetch messages: ${error.message}`);
      }
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
    getUnreadMessages: async (_, { userId }, context) => {
      try {
        // 1. Authentication check
        if (!context.userId) {
          throw new Error("Authentication required");
        }

        // 2. Authorization check
        if (context.userId !== userId) {
          throw new Error(
            "Unauthorized: You can only view your own unread messages"
          );
        }

        // 3. Fetch unread messages with sender info
        const unreadMessages = await Message.find({
          receiverId: userId,
          isRead: false,
        })
          .populate({
            path: "senderId",
            select: "id username email image",
          })
          .sort({ timestamp: -1 })
          .lean();

        // 4. Format response with safe date handling
        return unreadMessages.map((msg) => {
          // Safely handle timestamp
          let timestamp;
          try {
            timestamp =
              msg.timestamp?.toISOString?.() ||
              new Date(msg.timestamp).toISOString();
          } catch (e) {
            timestamp = new Date().toISOString(); // Fallback to current time
            console.warn(`Invalid timestamp for message ${msg._id}`);
          }

          return {
            id: msg._id.toString(),
            senderId: msg.senderId?._id.toString(), // Just the ID string
            receiverId: msg.receiverId.toString(),
            content: msg.content,
            timestamp,
            isRead: false, // Explicit since we're querying unread messages
            sender: msg.senderId
              ? {
                  // Full sender details
                  id: msg.senderId._id.toString(),
                  username: msg.senderId.username,
                  email: msg.senderId.email,
                  image: msg.senderId.image,
                  role: msg.senderId.role,
                  isOnline: msg.senderId.isOnline,
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
    // In resolvers.js
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
                isRead: conv.lastMessage.isRead !== undefined ? conv.lastMessage.isRead : false,
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
  },
  Upload: GraphQLUpload,

  Mutation: {
    sendMessage: async (
      _,
      { senderId, receiverId, content, file },
      context
    ) => {
      // Authentication check
      if (!context.userId) throw new Error("Unauthorized");
      if (context.userId !== senderId) {
        throw new Error("Unauthorized: Cannot send messages as another user");
      }

      try {
        // Validation
        await validateUserIds(senderId, receiverId);
        await messageSchema.validate({ senderId, receiverId, content });

        // File upload if present
        let fileUrl = null;
        if (file) {
          const { createReadStream, filename } = await file;
          fileUrl = await uploadFile(createReadStream(), filename);
        }

        // Create message with explicit timestamp
        const messageData = {
          senderId,
          receiverId,
          content,
          fileUrl,
          timestamp: new Date(), // Explicitly set timestamp here
        };

        // Find or create conversation
    
        let conversation = await Conversation.findOne({
          participants: { $all: [senderId, receiverId], $size: 2 },
        });

        // If not found, create new one
        if (!conversation) {
          conversation = new Conversation({
            participants: [senderId, receiverId],
            messages: [],
            createdAt: new Date(),
            updatedAt: new Date(),
          });
          await conversation.save();
        } else {
          // Update existing conversation
          conversation.updatedAt = new Date();
          await conversation.save();
        }

        // Create and save message
        const message = new Message(messageData);
        message.conversationId = conversation._id;
        await message.save();

        // Update conversation with the new message
        conversation.messages.push(message._id);
        conversation.lastMessage = message._id;
        await conversation.save();

        // Get the fully populated message with proper timestamp formatting
        const savedMessage = await Message.findById(message._id).lean();

        // Format the response properly
        const responseMessage = {
          ...savedMessage,
          id: savedMessage._id.toString(),
          senderId: savedMessage.senderId.toString(),
          receiverId: savedMessage.receiverId.toString(),
          timestamp: new Date(savedMessage.timestamp).toISOString(),
          isRead: savedMessage.isRead || false,
        };

        // Publish events
        pubsub.publish(`MESSAGE_SENT_${senderId}_${receiverId}`, {
          messageSent: responseMessage,
        });

        pubsub.publish(`UNREAD_MESSAGES_${receiverId}`, {
          unreadMessages: [responseMessage],
        });

        return responseMessage;
      } catch (error) {
        console.error("Error sending message:", error);
        throw new Error(`Failed to send message: ${error.message}`);
      }
    },
    markMessageAsRead: async (_, { messageId }, context) => {
      if (!context.userId)
        throw new Error("Unauthorized: Authentication required");

      try {
        // 1. Fetch and validate message
        const message = await Message.findById(messageId);
        if (!message) throw new Error("Message not found");

        // 2. Authorization check
        if (message.receiverId.toString() !== context.userId) {
          throw new Error(
            "Unauthorized: You can only mark your own messages as read"
          );
        }

        // 3. Skip if already read (optimization)
        if (message.isRead) {
          return formatMessageResponse(message);
        }

        // 4. Update message status
        const updatedMessage = await Message.findByIdAndUpdate(
          messageId,
          {
            isRead: true,
            readAt: new Date(),
          },
          { new: true }
        );

        // 5. Publish real-time event
        pubsub.publish(`MESSAGE_READ_${message.senderId}_${context.userId}`, {
          messageRead: {
            messageId: updatedMessage._id.toString(),
            readAt: updatedMessage.readAt.toISOString(), // Guaranteed to be valid
            readerId: context.userId,
          },
        });

        // 6. Update conversation's last read timestamp (optional)
        await Conversation.updateOne(
          { _id: message.conversationId },
          { $set: { [`lastRead.${context.userId}`]: new Date() } }
        );

        // 7. Return formatted response
        return formatMessageResponse(updatedMessage);
      } catch (error) {
        console.error(`[Message Read Error] ID: ${messageId}`, error);
        throw new Error(
          error.message.startsWith("Unauthorized")
            ? error.message
            : "Failed to update message status"
        );
      }
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
          createdAt: user.createdAt.toISOString(),
          updatedAt: user.updatedAt.toISOString(),
          lastActive: user.lastActive.toISOString(),
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
          createdAt: user.createdAt.toISOString(),
          updatedAt: user.updatedAt.toISOString(),
          lastActive: user.lastActive.toISOString(),
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
  },

  Subscription: {
    messageSent: {
      subscribe: (_, { senderId, receiverId }, { pubsub }) => {
        if (!senderId || !receiverId) {
          throw new Error("Missing senderId or receiverId");
        }
        return pubsub.asyncIterator(`MESSAGE_SENT_${senderId}_${receiverId}`);
      },
      resolve: (payload) => {
        if (!payload?.messageSent) {
          throw new Error("No message payload");
        }
        return {
          ...payload.messageSent,
          timestamp: new Date(payload.messageSent.timestamp).toISOString(),
        };
      },
    },
    unreadMessages: {
      subscribe: (_, { receiverId }, { pubsub }) =>
        pubsub.asyncIterator(`UNREAD_MESSAGES_${receiverId}`),
    },

    userStatusChanged: {
      subscribe: (_, __, { pubsub }) =>
        pubsub.asyncIterator("USER_STATUS_CHANGED"),
      resolve: (payload) => {
        if (!payload?.userStatusChanged) {
          throw new Error("No user status payload");
        }
        return {
          ...payload.userStatusChanged,
          lastActive: new Date(
            payload.userStatusChanged.lastActive
          ).toISOString(),
        };
      },
    },
  },
};

module.exports = resolvers;
