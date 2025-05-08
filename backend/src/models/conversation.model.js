const mongoose = require('mongoose');

const ConversationSchema = new mongoose.Schema({
  participants: {
    type: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    }],
    validate: {
      validator: function(participants) {
        // Convertir les ObjectId en strings pour la comparaison
        const participantStrings = participants.map(p => p.toString());
        // Vérifier qu'il y a exactement 2 participants uniques
        return participantStrings.length === 2 && 
               new Set(participantStrings).size === 2;
      },
      message: 'Une conversation privée doit avoir exactement 2 participants uniques'
    }
  },
  lastMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
    default: null
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
        return /^(https?|ftp):\/\/[^\s/$.?#].[^\s]*$|^data:image\/(png|jpeg|jpg|gif);base64,/i.test(v);
      },
      message: 'Invalid group photo URL'
    }
  },
  groupAdmins: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    validate: {
      validator: function(v) {
        return this.isGroup && this.participants.some(p => p.equals(v));
      },
      message: 'Admin must be a participant'
    }
  }],
  typingUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }]
}, {
  timestamps: true,
  toJSON: { 
    virtuals: true,
    transform: function(doc, ret) {
      ret.id = ret._id.toString();
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  }
});

// Méthodes statiques
ConversationSchema.statics.findOrCreatePrivate = async function(user1, user2) {
  const existing = await this.findOne({
    isGroup: false,
    participants: { $all: [user1, user2], $size: 2 }
  });
  
  return existing || this.create({
    participants: [user1, user2],
    isGroup: false
  });
};
// Ajoutez ceci dans ConversationSchema
ConversationSchema.set('toObject', { virtuals: true });
ConversationSchema.set('toJSON', { virtuals: true });

// Ajoutez un pre-find hook pour s'assurer que la population fonctionne
ConversationSchema.pre('find', function() {
  this.populate({
    path: 'participants',
    select: '_id username email image isOnline lastActive role'
  });});
module.exports = mongoose.model('Conversation', ConversationSchema);