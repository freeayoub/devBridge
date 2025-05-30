const mongoose = require("mongoose");

const ConversationSchema = new mongoose.Schema(
  {
    participants: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
      ],
      validate: {
        validator: function (participants) {
          // Pour les groupes, minimum 2 participants
          if (this.isGroup) {
            return participants.length >= 2;
          }
          // Pour les conversations privées, exactement 2 participants uniques
          const participantStrings = participants.map((p) => p.toString());
          return (
            participantStrings.length === 2 &&
            new Set(participantStrings).size === 2
          );
        },
        message:
          "Une conversation privée doit avoir exactement 2 participants uniques, un groupe minimum 2",
      },
    },
    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },
    lastMessageTime: {
      type: Date,
      default: Date.now,
      index: true,
    },
    messageCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    isGroup: {
      type: Boolean,
      default: false,
      index: true,
    },
    groupName: {
      type: String,
      trim: true,
      maxlength: 100,
      required: function () {
        return this.isGroup;
      },
    },
    groupDescription: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    groupPhoto: {
      type: String,
      validate: {
        validator: function (v) {
          if (!v) return true; // Optionnel
          return /^(https?|ftp):\/\/[^\s/$.?#].[^\s]*$|^data:image\/(png|jpeg|jpg|gif);base64,/i.test(
            v
          );
        },
        message: "Invalid group photo URL",
      },
    },
    groupAdmins: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        validate: {
          validator: function (v) {
            if (!this.isGroup) return true;
            return this.participants.some((p) => p.equals(v));
          },
          message: "Admin must be a participant",
        },
      },
    ],
    typingUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    // Nouveaux champs pour l'optimisation
    unreadCounts: {
      type: Map,
      of: Number,
      default: new Map(),
    },
    pinnedMessages: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Message",
      },
    ],
    isArchived: {
      type: Boolean,
      default: false,
      index: true,
    },
    isMuted: {
      type: Map,
      of: Boolean,
      default: new Map(),
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: function (doc, ret) {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Indexes composites pour optimiser les requêtes
ConversationSchema.index({ participants: 1, isGroup: 1 });
ConversationSchema.index({ lastMessageTime: -1 });
ConversationSchema.index({ isGroup: 1, lastMessageTime: -1 });
ConversationSchema.index({
  participants: 1,
  isArchived: 1,
  lastMessageTime: -1,
});

// Méthodes statiques optimisées
ConversationSchema.statics.findOrCreatePrivate = async function (user1, user2) {
  const existing = await this.findOne({
    isGroup: false,
    participants: { $all: [user1, user2], $size: 2 },
  }).select("_id participants lastMessage lastMessageTime messageCount");

  if (existing) return existing;

  return this.create({
    participants: [user1, user2],
    isGroup: false,
    messageCount: 0,
    lastMessageTime: new Date(),
  });
};

// Méthode pour incrémenter le compteur de messages
ConversationSchema.methods.incrementMessageCount = async function () {
  this.messageCount += 1;
  this.lastMessageTime = new Date();
  return this.save();
};

// Méthode pour mettre à jour le nombre de messages non lus
ConversationSchema.methods.updateUnreadCount = function (
  userId,
  increment = true
) {
  const currentCount = this.unreadCounts.get(userId.toString()) || 0;
  const newCount = increment ? currentCount + 1 : 0;
  this.unreadCounts.set(userId.toString(), Math.max(0, newCount));
  return this.save();
};

// Méthode pour obtenir le nombre de messages non lus pour un utilisateur
ConversationSchema.methods.getUnreadCount = function (userId) {
  return this.unreadCounts.get(userId.toString()) || 0;
};

// Middleware pour mettre à jour automatiquement lastMessageTime
ConversationSchema.pre("save", function (next) {
  if (this.isModified("lastMessage")) {
    this.lastMessageTime = new Date();
  }
  next();
});

// Configuration des virtuals et transformations
ConversationSchema.set("toObject", { virtuals: true });
ConversationSchema.set("toJSON", { virtuals: true });

// Virtual pour obtenir les participants actifs (non supprimés)
ConversationSchema.virtual("activeParticipants", {
  ref: "User",
  localField: "participants",
  foreignField: "_id",
  match: { isActive: true },
});
module.exports = mongoose.model("Conversation", ConversationSchema);
