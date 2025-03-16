const mongoose = require('mongoose');

// User Model
const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['student', 'tutor', 'admin'], default: 'student' },
    createdAt: { type: Date, default: Date.now },
});

const User = mongoose.model('User', UserSchema);

// Message Model
const MessageSchema = new mongoose.Schema({
    senderId: { type: String, required: true, trim: true },
    receiverId: { type: String, required: true, trim: true },
    content: { type: String, required: true, trim: true },
    timestamp: { type: Date, default: Date.now },
    fileUrl: { type: String },
});

const Message = mongoose.model('Message', MessageSchema);

// Conversation Model
const ConversationSchema = new mongoose.Schema({
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }],
    messages: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Message' }],
    createdAt: { type: Date, default: Date.now },
});

const Conversation = mongoose.model('Conversation', ConversationSchema);

module.exports = { User, Message, Conversation };
