const { Message } = require('../models/Models');
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
        res.status(201).json({ message: 'Message sent successfully', data: newMessage });
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ message: 'Error sending message', error: error.message });
    }
};
module.exports = { sendMessage };