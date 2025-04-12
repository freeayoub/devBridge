const mongoose = require('mongoose');

const ConversationSchema = new mongoose.Schema({
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }],
  messages: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  }],
  lastMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },
  lastRead: {
    type: Map,
    of: Date
  },
  unreadCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true,
  toJSON: { 
    virtuals: false,
    getters: true 
  },
  toObject: { 
    virtuals: false,
    getters: true 
  }
});

// Validation for participants
ConversationSchema.path('participants').validate(function(participants) {
  if (!participants || participants.length < 2) {
    throw new Error('A conversation requires at least 2 participants');
  }
  
  const participantIds = participants.map(p => p.toString());
  const uniqueParticipants = new Set(participantIds);
  
  if (uniqueParticipants.size !== participantIds.length) {
    throw new Error('Participants must be unique');
  }
  
  return true;
});

// Add indexes
ConversationSchema.index({ participants: 1 });
ConversationSchema.index({ lastMessage: 1 });
ConversationSchema.index({ messages: 1 });

module.exports = mongoose.model('Conversation', ConversationSchema);