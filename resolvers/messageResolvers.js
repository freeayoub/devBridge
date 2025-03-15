
const pubsub = require("../config/pubsub");
const GraphQLUpload = require("graphql-upload/GraphQLUpload.js");
const { User, Message, Conversation } = require("../models/Models");
const uploadFile = require("../services/messageService");
const { messageSchema } = require("../utils/validators");
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
const resolvers = {
  Query: {
    getMessages: async (
      _,
      { senderId, receiverId, page = 1, limit = 10 },
      context
    ) => {
      if (!context.userId) throw new Error("Unauthorized");
      try {
        await validateUserIds(senderId, receiverId);
        const skip = (page - 1) * limit;

        const messages = await Message.find({
          $or: [
            { senderId, receiverId },
            { senderId: receiverId, receiverId: senderId },
          ],
        })
          .sort({ timestamp: 1 })
          .skip(skip)
          .limit(limit);
        return messages;
      } catch (error) {
        console.error("Error fetching messages:", error);
        throw new Error("Failed to fetch messages");
      }
    },
    getConversation: async (_, { conversationId }, context) => {
      if (!context.userId) throw new Error("Unauthorized");
      try {
        const conversation = await Conversation.findById(conversationId)
          .populate("participants") // Remplir les participants
          .populate("messages"); // Remplir les messages
        if (!conversation) {
          throw new Error("Conversation not found");
        }
        // Vérifier si l'utilisateur actuel fait partie des participants
        const isParticipant = conversation.participants.some(
          (participant) => participant._id.toString() === context.userId
        );
        if (!isParticipant) {
          throw new Error(
            "Unauthorized: You are not a participant in this conversation"
          );
        }
        return conversation;
      } catch (error) {
        console.error("Error fetching conversation:", error);
        throw new Error("Failed to fetch conversation");
      }
    },
    getUnreadMessages: async (_, { userId }, context) => {
      if (!context.userId || context.userId !== userId)
        throw new Error("Unauthorized");
      try {
        const unreadMessages = await Message.find({
          receiverId: userId,
          isRead: false,
        });
        return unreadMessages;
      } catch (error) {
        console.error("Error fetching unread messages:", error);
        throw new Error("Failed to fetch unread messages");
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
      if (!context.userId) throw new Error("Unauthorized");
      if (context.userId !== senderId)
        throw new Error(
          "Unauthorized: You cannot send messages on behalf of others"
        );
      try {
        await validateUserIds(senderId, receiverId);
        await messageSchema.validate({ senderId, receiverId, content });
        let fileUrl = null;
        if (file) {
          const { createReadStream, filename } = await file;
          const stream = createReadStream();

          // Upload the file to Firebase Storage or any other storage service
          fileUrl = await uploadFile(stream, filename);
        }
        const message = new Message({ senderId, receiverId, content, fileUrl });
        await message.save();

        // Trouver ou créer une conversation entre les deux utilisateurs
        let conversation = await Conversation.findOne({
          participants: { $all: [senderId, receiverId] },
        });
        if (!conversation) {
          // Créer une nouvelle conversation si elle n'existe pas
          conversation = new Conversation({
            participants: [senderId, receiverId],
            messages: [message._id],
          });
        } else {
          // Ajouter le message à la conversation existante
          conversation.messages.push(message._id);
        }

        await conversation.save();

        // Publier un événement pour la subscription
        pubsub.publish(`MESSAGE_SENT_${senderId}_${receiverId}`, {
          messageSent: message,
        });
        pubsub.publish(`UNREAD_MESSAGES_${receiverId}`, {
          unreadMessages: [message],
        });
        return message;
      } catch (error) {
        console.error("Error sending message:", error);
        throw new Error("Failed to send message");
      }
    },
    markMessageAsRead: async (_, { messageId }, context) => {
      if (!context.userId) throw new Error("Unauthorized");
      try {
        const message = await Message.findById(messageId);
        if (!message) throw new Error("Message not found");
        if (message.receiverId.toString() !== context.userId)
          throw new Error("Unauthorized");

        message.isRead = true;
        await message.save();
        return message;
      } catch (error) {
        console.error("Error marking message as read:", error);
        throw new Error("Failed to mark message as read");
      }
    },
    setUserOnline: async (_, { userId }, context) => {
      if (!context.userId) throw new Error("Unauthorized");
      try {
        const user = await User.findById(userId);
        if (!user) throw new Error("User not found");

        user.isOnline = true;
        await user.save();
        pubsub.publish("USER_STATUS_CHANGED", { userStatusChanged: user });
        return user;
      } catch (error) {
        console.error("Error setting user online:", error);
        throw new Error("Failed to set user online");
      }
    },
    setUserOffline: async (_, { userId }, context) => {
      if (!context.userId) throw new Error("Unauthorized");
      try {
        const user = await User.findById(userId);
        if (!user) throw new Error("User not found");

        user.isOnline = false;
        await user.save();
        pubsub.publish("USER_STATUS_CHANGED", { userStatusChanged: user });
        return user;
      } catch (error) {
        console.error("Error setting user offline:", error);
        throw new Error("Failed to set user offline");
      }
    },
  },

  Subscription: {
    messageSent: {
      subscribe: (_, { senderId, receiverId }) => {
       
        return pubsub.asyncIterator([`MESSAGE_SENT_${senderId}_${receiverId}`]);
      },
    },
    unreadMessages: {
          subscribe: (_, { receiverId }) => {
            return pubsub.asyncIterator(`UNREAD_MESSAGES_${receiverId}`);
          },
        },
    userStatusChanged: {
      subscribe: () => 
     pubsub.asyncIterator(["USER_STATUS_CHANGED"]),
    },
  },
};

module.exports = resolvers;

