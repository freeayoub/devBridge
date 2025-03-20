const mongoose = require('mongoose');

// User Model using Mongoose
const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['student', 'tutor', 'admin'], default: 'student' },
    createdAt: { type: Date, default: Date.now },
    isOnline: { type: Boolean, default: false }
});

const User = mongoose.model('User', UserSchema);

// Message Model using Mongoose
const MessageSchema = new mongoose.Schema({
    senderId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    receiverId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    content: { 
        type: String, 
        required: true, 
        trim: true 
    },
    timestamp: { 
        type: Date, 
        default: Date.now 
    },
    fileUrl: { 
        type: String, 
        default: null 
    },
    isRead: { 
        type: Boolean, 
        default: false 
    },
});

const Message = mongoose.model('Message', MessageSchema);

// Conversation Model using Mongoose
const ConversationSchema = new mongoose.Schema({
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }],
    messages: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Message' }],
    createdAt: { type: Date, default: Date.now },
});

const Conversation = mongoose.model('Conversation', ConversationSchema);

module.exports = { User, Message, Conversation };
