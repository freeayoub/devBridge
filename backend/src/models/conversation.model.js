
const mongoose = require('mongoose');

const ConversationSchema = new mongoose.Schema({
  participants: {
    type: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    }],
    validate: {
      validator: function(participants) {
        // Ensure participants is an array
        if (!Array.isArray(participants)) {
          return false;
        }

        // Check minimum participants (2)
        if (participants.length < 2) {
          return false;
        }

        // Check for duplicate participants
        const participantIds = participants.map(p => 
          p instanceof mongoose.Types.ObjectId ? p.toString() : p
        );
        return new Set(participantIds).size === participantIds.length;
      },
      message: props => {
        if (!Array.isArray(props.value)) {
          return "Participants must be an array of User IDs";
        }
        if (props.value.length < 2) {
          return "A conversation must have at least 2 participants";
        }
        return "Participants must be unique (no duplicates)";
      }
    },
    required: [true, "Participants array is required"],
  },
  messages: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
  }],
  lastMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
  },
  lastRead: {
    type: Map,
    of: Date,
  },
  unreadCount: {
    type: Number,
    default: 0,
  },
  isGroup: {
    type: Boolean,
    default: false,
  },
  groupName: {
    type: String,
    trim: true,
  },
  groupPhoto: {
    type: String,
  },
  groupAdmins: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  pinnedMessages: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
  }],
  typingUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
}, {
  timestamps: true,
  toJSON: { 
    virtuals: true,
    getters: true,
  },
  toObject: { 
    virtuals: true,
    getters: true,
  },
});

// Indexes for better query performance
ConversationSchema.index({ participants: 1 });
ConversationSchema.index({ lastMessage: 1 });
ConversationSchema.index({ messages: 1 });
ConversationSchema.index({ isGroup: 1 });

 module.exports = mongoose.model('Conversation', ConversationSchema);
// const mongoose = require('mongoose');

// const ConversationSchema = new mongoose.Schema({
//   participants: [{
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User',
//     required: true
//   }],
//   messages: [{
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'Message'
//   }],
//   lastMessage: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'Message'
//   },
//   lastRead: {
//     type: Map,
//     of: Date
//   },
//   unreadCount: {
//     type: Number,
//     default: 0
//   },
//   isGroup: {
//     type: Boolean,
//     default: false
//   },
//   groupName: {
//     type: String,
//     trim: true
//   },
//   groupPhoto: {
//     type: String
//   },
//   groupAdmins: [{
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User'
//   }],
//   pinnedMessages: [{
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'Message'
//   }],
//   typingUsers: [{
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User'
//   }]
// }, {
//   timestamps: true,
//   toJSON: { 
//     virtuals: true,
//     getters: true 
//   },
//   toObject: { 
//     virtuals: true,
//     getters: true 
//   }
// });

// ConversationSchema.path('participants').validate(function(participants) {
//   if (!participants || participants.length < 2) {
//     throw new Error('A conversation requires at least 2 participants');
//   }
  
//   const participantIds = participants.map(p => p.toString());
//   const uniqueParticipants = new Set(participantIds);
  
//   if (uniqueParticipants.size !== participantIds.length) {
//     throw new Error('Participants must be unique');
//   }
  
//   return true;
// });
// ConversationSchema.index({ participants: 1 });
// ConversationSchema.index({ lastMessage: 1 });
// ConversationSchema.index({ messages: 1 });
// ConversationSchema.index({ isGroup: 1 });

// module.exports = mongoose.model('Conversation', ConversationSchema);