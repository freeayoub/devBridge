const mongoose = require('mongoose');

const notificationTypes = ['NEW_MESSAGE', 'FRIEND_REQUEST', 'GROUP_INVITE', 'MESSAGE_REACTION'];

const notificationSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    index: true
  },
  type: { 
    type: String, 
    required: true, 
    enum: notificationTypes 
  },
  content: { 
    type: String, 
    required: true,
    maxlength: 500
  },
  isRead: { 
    type: Boolean, 
    default: false,
    index: true
  },
  readAt: { 
    type: Date 
  },
  relatedEntity: { 
    type: mongoose.Schema.Types.ObjectId,
    index: true
  },
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      ret.id = ret._id.toString();
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  }
});

// Index pour les requêtes fréquentes
notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ relatedEntity: 1, type: 1 });

module.exports = mongoose.model('Notification', notificationSchema);