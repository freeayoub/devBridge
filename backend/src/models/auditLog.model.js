const mongoose = require("mongoose");

const AuditLogSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true,
      enum: [
        "USER_REGISTER",
        "USER_LOGIN",
        "USER_LOGOUT",
        "USER_UPDATE",
        "ADMIN_USER_UPDATE",
        "USER_SELF_UPDATE",
        "USER_DEACTIVATION",
        "USER_REACTIVATION",
        "USER_DELETION",
        "USER_CREATION",
        "PROFILE_IMAGE_UPLOAD",
        "PROFILE_IMAGE_REMOVED",
      ],
    },
    targetUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: function () {
        // Rendre required seulement pour certaines actions
        return !["USER_REGISTER", "USER_LOGIN"].includes(this.action);
      },
      default: null, // Ajout d'une valeur par défaut
    },
    details: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: function (doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Index pour améliorer les performances des requêtes
AuditLogSchema.index({ action: 1 });
AuditLogSchema.index({ targetUserId: 1 });
AuditLogSchema.index({ performedBy: 1 });
AuditLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model("AuditLog", AuditLogSchema);
