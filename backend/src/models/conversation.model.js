const mongoose = require('mongoose');
const Message = require('./message.model');

const ConversationSchema = new mongoose.Schema({
  participants: {
    type: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }],
    validate: [
      {
        validator: function(participants) {
          return participants.length >= (this.isGroup ? 2 : 2); // Minimum 2 participants
        },
        message: 'A conversation must have at least 2 participants'
      },
      {
        validator: function(participants) {
          const uniqueIds = new Set(participants.map(p => p.toString()));
          return uniqueIds.size === participants.length;
        },
        message: 'Participants must be unique'
      }
    ],
    required: true
  },
  lastMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
    default: null
  },
  lastRead: {
    type: Map,
    of: Date,
    default: () => new Map()
  },
  messageCount: {
    type: Number,
    default: 0,
    min: 0
  },
  isGroup: {
    type: Boolean,
    default: false,
    index: true
  },
  groupName: {
    type: String,
    trim: true,
    maxlength: 100,
    required: function() { return this.isGroup; }
  },
  groupPhoto: {
    type: String,
    validate: {
      validator: function(v) {
        if (!this.isGroup) return true;
        return /^(https?|ftp):\/\/[^\s/$.?#].[^\s]*$/i.test(v);
      },
      message: 'Invalid group photo URL'
    }
  },
  groupDescription: {
    type: String,
    maxlength: 500
  },
  groupAdmins: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: function() { return this.isGroup; },
    validate: {
      validator: function(v) {
        return this.participants.some(p => p.equals(v));
      },
      message: 'Admin must be a participant'
    }
  }],
  pinnedMessages: {
    type: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message'
    }],
    validate: {
      validator: function(v) {
        return v.length <= 10; // Max 10 pinned messages
      },
      message: 'Maximum 10 pinned messages per conversation'
    },
    default: []
  },
  typingUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: []
  }],
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true,
  toJSON: { 
    virtuals: true,
    transform: function(doc, ret) {
      delete ret.__v;
      ret.id = ret._id.toString();
      delete ret._id;
      return ret;
    }
  },
  toObject: { 
    virtuals: true,
    transform: function(doc, ret) {
      delete ret.__v;
      ret.id = ret._id.toString();
      delete ret._id;
      return ret;
    }
  }
});

// Virtual for messages with pagination
ConversationSchema.virtual('messages', {
  ref: 'Message',
  localField: '_id',
  foreignField: 'conversationId',
  options: {
    sort: { createdAt: -1 },
    limit: 50
  }
});

// Virtual for unread message count
ConversationSchema.virtual('unreadCount', {
  ref: 'Message',
  localField: '_id',
  foreignField: 'conversationId',
  match: { 
    isRead: false,
    isDeleted: false 
  },
  count: true
});

// Compound indexes for frequent queries
ConversationSchema.index({ participants: 1, isGroup: 1, updatedAt: -1 });
ConversationSchema.index({ isGroup: 1, updatedAt: -1 });
ConversationSchema.index({ 'groupAdmins': 1 });

// Cascade delete middleware
ConversationSchema.pre('deleteOne', { document: true }, async function(next) {
  try {
    await Message.deleteMany({ conversationId: this._id });
    next();
  } catch (err) {
    next(err);
  }
});

// Add participant method
ConversationSchema.methods.addParticipant = async function(userId) {
  if (!this.participants.includes(userId)) {
    this.participants.push(userId);
    await this.save();
  }
  return this;
};

// Remove participant method
ConversationSchema.methods.removeParticipant = async function(userId) {
  const index = this.participants.indexOf(userId);
  if (index > -1) {
    this.participants.splice(index, 1);
    await this.save();
  }
  return this;
};

// Pin message method
ConversationSchema.methods.pinMessage = async function(messageId) {
  if (!this.pinnedMessages.includes(messageId)) {
    this.pinnedMessages.push(messageId);
    await this.save();
  }
  return this;
};

// Unpin message method
ConversationSchema.methods.unpinMessage = async function(messageId) {
  const index = this.pinnedMessages.indexOf(messageId);
  if (index > -1) {
    this.pinnedMessages.splice(index, 1);
    await this.save();
  }
  return this;
};

// Find private conversation between two users
ConversationSchema.statics.findPrivateConversation = async function(user1, user2) {
  return this.findOne({
    isGroup: false,
    participants: { $all: [user1, user2], $size: 2 }
  });
};

// Update last read timestamp
ConversationSchema.methods.updateLastRead = async function(userId) {
  this.lastRead.set(userId.toString(), new Date());
  await this.save();
  return this;
};

// Add admin method
ConversationSchema.methods.addAdmin = async function(userId) {
  if (!this.groupAdmins.includes(userId)) {
    this.groupAdmins.push(userId);
    await this.save();
  }
  return this;
};

// Remove admin method
ConversationSchema.methods.removeAdmin = async function(userId) {
  const index = this.groupAdmins.indexOf(userId);
  if (index > -1) {
    this.groupAdmins.splice(index, 1);
    await this.save();
  }
  return this;
};

module.exports = mongoose.model('Conversation', ConversationSchema);