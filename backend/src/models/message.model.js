const mongoose = require("mongoose");

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
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const AttachmentSchema = new mongoose.Schema({
  url: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    enum: ["image", "file", "audio", "video"],
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  size: {
    type: Number,
    required: true,
  },
});

const MessageSchema = new mongoose.Schema(
  {
    content: {
      type: String,
      trim: true,
      maxlength: 5000,
      validate: {
        validator: function(v) {
          return v || (this.attachments && this.attachments.length > 0);
        },
        message: 'Le message doit avoir du contenu ou une pièce jointe'
      },
    },
    // 
    type: {
      type: String,
      enum: ["text", "image", "file", "audio", "video"],
      default: "text",
    },
    timestamp: {
      type: Date,
      required: true,
      default: Date.now,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    isEdited: {
      type: Boolean,
      default: false,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
    },
    reactions: [ReactionSchema],
    attachments: [AttachmentSchema],
    status: {
      type: String,
      enum: ["sent", "delivered", "read"],
      default: "sent",
    },
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
    },
    pinned: {
      type: Boolean,
      default: false,
    },
    forwardedFrom: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
    },
  },
  {
    timestamps: true,
    toJSON: { 
      virtuals: true,
      transform: function(doc, ret) {
        delete ret.__v;
        ret.id = ret._id;
        delete ret._id;
        return ret;
      }
    }

  });
  MessageSchema.post('save', async function(doc) {
    // Mise à jour de la conversation associée
    await Conversation.updateOne(
      { _id: doc.conversationId },
      { $set: { lastMessage: doc._id, updatedAt: new Date() } }
    );
  });
// Indexes for better performance
MessageSchema.index({ senderId: 1, timestamp: 1 });
MessageSchema.index({ receiverId: 1, timestamp: 1 });
MessageSchema.index({ group: 1, timestamp: 1 });
MessageSchema.index({ conversationId: 1, timestamp: 1 });
MessageSchema.index({ isRead: 1 });
MessageSchema.index({ pinned: 1 });

module.exports = mongoose.model("Message", MessageSchema);
