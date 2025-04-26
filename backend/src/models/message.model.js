const mongoose = require("mongoose");
const Conversation = require('../models/conversation.model');

const ReactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  emoji: {
    type: String,
    required: true,
    trim: true,
    maxlength: 5 
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
}, { _id: false });

const AttachmentSchema = new mongoose.Schema({
  url: {
    type: String,
    required: true,
    validate: {
      validator: function(v) {
        return /^(https?|ftp):\/\/[^\s/$.?#].[^\s]*$/i.test(v);
      },
      message: 'URL invalide'
    }
  },
  type: {
    type: String,
    enum: ["image", "file", "audio", "video"],
    required: true
  },
  name: {
    type: String,
    required: true,
    maxlength: 255
  },
  size: {
    type: Number,
    required: true,
    min: 0,
    max: 100 * 1024 * 1024 // 100MB max
  },
  mimeType: {
    type: String,
    required: function() {
      return this.type !== 'file'; // Only required for non-file types
    }
  },
  thumbnailUrl: {
    type: String,
    required: function() {
      return this.type === 'image' || this.type === 'video';
    },
    default: null
  },
  duration: {
    type: Number,
    required: function() {
      return this.type === 'audio' || this.type === 'video';
    },
    default: 0
  }
}, { _id: false });
const MessageSchema = new mongoose.Schema({
  content: {
    type: String,
    trim: true,
    maxlength: 5000,
    validate: {
      validator: function(v) {
        return v || (this.attachments && this.attachments.length > 0);
      },
      message: 'Le message doit avoir du contenu ou au moins une pièce jointe'
    },
  },
  type: {
    type: String,
    enum: ["text", "image", "file", "audio", "video", "system"],
    default: "text",
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true,
    immutable: true // Ne peut pas être modifié
  },
  isRead: {
    type: Boolean,
    default: false,
    index: true
  },
  readAt: {
    type: Date,
    default: null
  },
  isEdited: {
    type: Boolean,
    default: false
  },
  isDeleted: {
    type: Boolean,
    default: false,
    index: true
  },
  deletedAt: {
    type: Date,
    default: null
  },
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true
  },
  receiverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    index: true,
    required: function() {
      return !this.group; // Requis si pas de groupe
    }
  },
  groupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Group",
    index: true,
    required: function() {
      return !this.receiverId; // Requis si pas de receiverId
    }
  },
  reactions: {
    type: [ReactionSchema],
    default: []
  },
  attachments: {
    type: [AttachmentSchema],
    default: [],
    validate: {
      validator: function(v) {
        // Max 10 pièces jointes par message
        return v.length <= 10;
      },
      message: 'Un message ne peut pas avoir plus de 10 pièces jointes'
    }
  },
  status: {
    type: String,
    enum: ["sending", "sent", "delivered", "read", "failed"],
    default: "sending",
    index: true
  },
  conversationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Conversation",
    required: true,
    index: true
  },
  pinned: {
    type: Boolean,
    default: false,
    index: true
  },
  pinnedAt: {
    type: Date,
    default: null
  },
  pinnedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null
  },
  forwardedFrom: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Message",
    default: null
  },
  replyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Message",
    default: null
  },
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
      ret.id = ret._id;
      delete ret._id;
      return ret;
    }
  },
  toObject: { virtuals: true }
});

// Virtuals pour faciliter l'accès
MessageSchema.virtual('sender', {
  ref: 'User',
  localField: 'senderId',
  foreignField: '_id',
  justOne: true
});

MessageSchema.virtual('receiver', {
  ref: 'User',
  localField: 'receiverId',
  foreignField: '_id',
  justOne: true
});

MessageSchema.virtual('group', {
  ref: 'Group',
  localField: 'groupId',
  foreignField: '_id',
  justOne: true
});

// Middleware pour mettre à jour la conversation après sauvegarde
MessageSchema.post('save', async function(doc) {
  await Conversation.findByIdAndUpdate(
    doc.conversationId,
    { 
      $set: { 
        lastMessage: doc._id,
        updatedAt: new Date() 
      },
      $inc: { messageCount: 1 }
    }
  );
});

// Middleware pour soft delete
MessageSchema.pre('findOneAndUpdate', function() {
  const update = this.getUpdate();
  if (update.$set && update.$set.isDeleted) {
    update.$set.deletedAt = new Date();
  }
});

// Indexes composites pour les requêtes fréquentes
MessageSchema.index({ conversationId: 1, isDeleted: 1, createdAt: -1 });
MessageSchema.index({ senderId: 1, receiverId: 1, createdAt: -1 });
MessageSchema.index({ groupId: 1, isDeleted: 1, createdAt: -1 });
MessageSchema.index({ conversationId: 1, pinned: -1 });
MessageSchema.index({ conversationId: 1, status: 1 });

// Middleware pour normaliser `type` et `status`
MessageSchema.pre('save', function(next) {
  // Normalisation de `type` et `status` pour respecter les valeurs en minuscules
  if (this.type) {
    this.type = this.type.toLowerCase();  // Convertir en minuscules
  }

  if (this.status) {
    this.status = this.status.toLowerCase();  // Convertir en minuscules
  }

  next();
});

// Méthode statique pour marquer comme lu
MessageSchema.statics.markAsRead = async function(messageId, userId) {
  return this.findByIdAndUpdate(messageId, {
    $set: {
      isRead: true,
      readAt: new Date(),
      status: 'read'
    }
  }, { new: true });
};

// Méthode d'instance pour ajouter une réaction
MessageSchema.methods.addReaction = function(userId, emoji) {
  const existingIndex = this.reactions.findIndex(
    r => r.userId.equals(userId) && r.emoji === emoji
  );
  
  if (existingIndex >= 0) {
    this.reactions.splice(existingIndex, 1);
  } else {
    this.reactions.push({ userId, emoji });
  }
  
  return this.save();
};

module.exports = mongoose.model("Message", MessageSchema);
