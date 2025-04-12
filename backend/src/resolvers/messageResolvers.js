const pubsub = require("../config/pubsub");
const GraphQLUpload = require("graphql-upload/GraphQLUpload.js");
const User  = require("../models/schemas/user.schema");
const Message = require("../models/schemas/message.schema");
const Conversation  = require("../models/schemas/conversation.schema");
const uploadFile = require("../services/messageService");
const { messageSchema } = require("../models/validators/message.validators");
const { isValidObjectId } = require("mongoose");
// Validate user IDs
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
    return date instanceof Date ? date.toISOString() : new Date(date).toISOString();
  } catch {
    return null; // Fallback for invalid dates
  }
}

// Helper: Ensure consistent message formatting
function formatMessageResponse(message) {
  if (!message) throw new Error("Message cannot be null");

  const msg = message.toObject?.() || message; // Handle both Mongoose docs and plain objects

  return {
    ...msg,
    id: msg._id?.toString?.(),
    timestamp: safeToISOString(msg.timestamp),
    readAt: safeToISOString(msg.readAt),
    // Ensure all other Date fields are safe
    createdAt: safeToISOString(msg.createdAt),
    updatedAt: safeToISOString(msg.updatedAt)
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
    getMessages: async (_, { senderId, receiverId, page = 1, limit = 10 }, context) => {
      if (!context.userId) throw new Error("Unauthorized");
      
      try {
        await validateUserIds(senderId, receiverId);
        const safeLimit = Math.min(limit, 100);
        const skip = (page - 1) * safeLimit;
    
        const messages = await Message.find({
          $or: [
            { senderId, receiverId },
            { senderId: receiverId, receiverId: senderId }
          ]
        })
        .select('_id senderId receiverId content fileUrl isRead timestamp conversationId')
        .sort({ timestamp: 1 })
        .skip(skip)
        .limit(safeLimit)
        .lean()
        .exec();
    
        return messages.map(msg => ({
          ...msg,
          id: msg._id.toString(),
          timestamp: msg.timestamp?.toISOString() || new Date().toISOString()
        }));
        
      } catch (error) {
        console.error("Error fetching messages:", error);
        throw new Error(`Failed to fetch messages: ${error.message}`);
      }
    },
    getUnreadMessages: async (_, { userId }, context) => {
      if (!context.userId || context.userId !== userId)
        throw new Error("Unauthorized");
      try {
        const unreadMessages = await Message.find({
          receiverId: userId,
          isRead: false,
        })
        .lean();
        return unreadMessages.map(msg => ({
          ...msg,
          id: msg._id.toString(),
          timestamp: msg.timestamp.toISOString()
        }));
      } catch (error) {
        console.error("Error fetching unread messages:", error);
        throw new Error(`Failed to fetch unread messages: ${error.message}`);
      }
    },
  },
  Upload: GraphQLUpload,

  Mutation: {
    sendMessage: async (_, { senderId, receiverId, content, file }, context) => {
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
    
        // Transaction-like operation for conversation and message
        const message = new Message({
          senderId,
          receiverId,
          content,
          fileUrl
          // conversationId will be set after conversation is created/updated
        });
    
        // Find or create conversation with proper error handling
        let conversation = await Conversation.findOneAndUpdate(
          { participants: { $all: [senderId, receiverId] } },
          { $setOnInsert: { participants: [senderId, receiverId], messages: [] } },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
    
        // Update conversation with the new message
        conversation.messages.push(message._id);
        conversation.lastMessage = message._id;
        conversation.updatedAt = new Date();
    
        // Set the conversation reference on the message
        message.conversationId = conversation._id;
    
        // Save both in parallel for better performance
        await Promise.all([message.save(), conversation.save()]);
    
        // Prepare the response object
        const responseMessage = {
          ...message.toObject(),
          id: message._id.toString(),
          timestamp: message.timestamp.toISOString()
        };
    
        // Publish events
        pubsub.publish(`MESSAGE_SENT_${senderId}_${receiverId}`, {
          messageSent: responseMessage
        });
    
        pubsub.publish(`UNREAD_MESSAGES_${receiverId}`, {
          unreadMessages: [responseMessage]
        });
    
        return responseMessage;
      } catch (error) {
        console.error("Error sending message:", error);
        throw new Error(`Failed to send message: ${error.message}`);
      }
    },
     markMessageAsRead : async (_, { messageId }, context) => {
      if (!context.userId) throw new Error("Unauthorized: Authentication required");
    
      try {
        // 1. Fetch and validate message
        const message = await Message.findById(messageId);
        if (!message) throw new Error("Message not found");
    
        // 2. Authorization check
        if (message.receiverId.toString() !== context.userId) {
          throw new Error("Unauthorized: You can only mark your own messages as read");
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
            readAt: new Date() 
          },
          { new: true }
        );
    
        // 5. Publish real-time event
        pubsub.publish(`MESSAGE_READ_${message.senderId}_${context.userId}`, {
          messageRead: {
            messageId: updatedMessage._id.toString(),
            readAt: updatedMessage.readAt.toISOString(), // Guaranteed to be valid
            readerId: context.userId
          }
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
    subscribe: (_, { senderId, receiverId }) => 
      pubsub.asyncIterator(`MESSAGE_SENT_${senderId}_${receiverId}`)
  },
  unreadMessages: {
    subscribe: (_, { receiverId }) => 
      pubsub.asyncIterator(`UNREAD_MESSAGES_${receiverId}`)
  },
  userStatusChanged: {
    subscribe: () => pubsub.asyncIterator("USER_STATUS_CHANGED")
  }
}
};

module.exports = resolvers;