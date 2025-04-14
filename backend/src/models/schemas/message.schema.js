const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  receiverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  content: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500
  },
  fileUrl: {
    type: String
  },
  isRead: {
    type: Boolean,
    default: false,
    index: true
  },
  readAt: {
    type: Date
  },
  conversationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    index: true
  },
  timestamp: {
    type: Date,
    required: true,
    default: Date.now,
    get: function(timestamp) {
      return timestamp instanceof Date ? timestamp.toISOString() : new Date(timestamp).toISOString();
    }
  }
}, {
  toJSON: { 
    getters: true,
    virtuals: true 
  },
  toObject: { 
    getters: true,
    virtuals: true 
  }
});

// Add indexes
MessageSchema.index({ senderId: 1, receiverId: 1, timestamp: 1 });
MessageSchema.index({ conversationId: 1, timestamp: 1 });

module.exports = mongoose.model('Message', MessageSchema);