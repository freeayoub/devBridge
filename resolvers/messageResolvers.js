const { PubSub } = require("graphql-subscriptions");
const GraphQLUpload = require("graphql-upload/GraphQLUpload.js");
const {User,Message,Conversation} = require("../models/Models")
const uploadFile = require("../services/messageService");

const { isValidObjectId } = require("mongoose");
const pubsub = new PubSub();
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
        // Récupérer la conversation par son ID
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
        pubsub.publish("MESSAGE_SENT", { messageSent: message });
        return message;
      } catch (error) {
        console.error("Error sending message:", error);
        throw new Error("Failed to send message");
      }
    },
  },

  Subscription: {
    messageSent: {
      subscribe: () => pubsub.asyncIterator(["MESSAGE_SENT"]),
    },
  },
};

module.exports = resolvers;
