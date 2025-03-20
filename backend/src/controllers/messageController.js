const { User, Message, Conversation } = require("../models/Models");
const { messageSchema } = require("../utils/validators");
const { isValidObjectId } = require("mongoose");

const sendMessage = async (req, res) => {
  const { senderId, receiverId, content, file } = req.body;
  try {
    if (!isValidObjectId(senderId) || !isValidObjectId(receiverId)) {
      return res
        .status(400)
        .json({ message: "Invalid senderId or receiverId" });
    }

    const [senderExists, receiverExists] = await Promise.all([
      User.exists({ _id: senderId }),
      User.exists({ _id: receiverId }),
    ]);

    if (!senderExists || !receiverExists) {
      return res
        .status(404)
        .json({ message: "Sender or receiver does not exist" });
    }

    await messageSchema.validate({ senderId, receiverId, content });

    let fileUrl = null;
    if (file) {
      const { createReadStream, filename } = await file;
      const stream = createReadStream();
      fileUrl = await uploadFile(stream, filename);
    }

    const message = new Message({ senderId, receiverId, content, fileUrl });
    await message.save();

    let conversation = await Conversation.findOne({
      participants: { $all: [senderId, receiverId] },
    });

    if (!conversation) {
      conversation = new Conversation({
        participants: [senderId, receiverId],
        messages: [message._id],
      });
    } else {
      conversation.messages.push(message._id);
    }

    await conversation.save();

    res.status(201).json(message);
  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).json({ message: "Failed to send message" });
  }
};
const getMessage = async (req, res) => {
  const { id } = req.params;
  try {
    const message = await Message.findById(id);
    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }
    res.status(200).json(message);
  } catch (error) {
    console.error("Error fetching message:", error);
    res.status(500).json({ message: "Failed to fetch message" });
  }
};
const markMessageAsRead = async (req, res) => {
  const { id } = req.params;
  try {
    const message = await Message.findById(id);
    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }
    message.isRead = true;
    await message.save();
    res.status(200).json(message);
  } catch (error) {
    console.error("Error marking message as read:", error);
    res.status(500).json({ message: "Failed to mark message as read" });
  }
};
const uploadSingleFile = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }
  try {
    // Renvoyer l'URL du fichier téléversé
    const fileUrl = `${req.protocol}://${req.get("host")}/uploads/${
      req.file.filename
    }`;
    return res.json({ message: "✅ File uploaded successfully", fileUrl });
  } catch (error) {
    console.error("❌ Error in uploadSingleFile:", error);
    res.status(500).json({ error: error.message });
  }
};
module.exports = {
  sendMessage,
  getMessage,
  markMessageAsRead,
  uploadSingleFile,
};
