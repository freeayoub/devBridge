
const { Message } = require("../models/Models");

const sendMessage = async (req, res) => {
  try {
    const { senderId, receiverId, content, fileUrl } = req.body;

    const newMessage = new Message({
      senderId,
      receiverId,
      content,
      fileUrl,
    });

    await newMessage.save();
    res
      .status(201)
      .json({ message: "Message sent successfully", data: newMessage });
  } catch (error) {
    console.error("Error sending message:", error);
    res
      .status(500)
      .json({ message: "Error sending message", error: error.message });
  }
};

const uploadSingleFile = async (req, res) => {
  
    if (!req.file) {
      return  res.status(400).json({ error: "No file uploaded" });
    }
    try {
    // Renvoyer l'URL du fichier téléversé
    const fileUrl = `${req.protocol}://${req.get("host")}/uploads/${
      req.file.filename
    }`;
    return   res.json({ message: "✅ File uploaded successfully", fileUrl });
  } catch (error) {
        console.error("❌ Error in uploadSingleFile:", error);
        res.status(500).json({ error: error.message });
      }
};

module.exports = { sendMessage, uploadSingleFile };