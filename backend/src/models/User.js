const mongoose = require("mongoose");

// Définir les rôles directement dans le modèle
const roles = ["admin", "student", "teacher", "user"];

const userSchema = new mongoose.Schema(
  {
    // Champs originaux de User.js
    fullName: { type: String, required: true },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 8,
    },
    role: {
      type: String,
      enum: roles,
      required: true,
      default: "student",
    },
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      default: null,
    },
    profileImage: { type: String, default: "uploads/default.png" },
    verified: { type: Boolean, default: false },
    verificationCode: { type: String },
    resetCode: { type: String },

    username: {
      type: String,
      default: function () {
        return this.fullName;
      },
    },
    image: {
      type: String,
      default: function () {
        return this.profileImage;
      },
    },
    isActive: {
      type: Boolean,
      default: function () {
        return this.verified;
      },
    },
    isOnline: {
      type: Boolean,
      default: false,
    },
    lastActive: {
      type: Date,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: function (doc, ret) {
        // Compatibilité avec user.model.js
        ret.id = ret._id;

        // Utiliser les champs directs s'ils existent, sinon utiliser les champs de secours
        if (!ret.username) ret.username = ret.fullName;
        if (!ret.image) ret.image = ret.profileImage;
        if (!ret.isActive && ret.verified !== undefined)
          ret.isActive = ret.verified;

        // Suppression des champs sensibles
        delete ret.password;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Créer un index de texte pour améliorer les performances de recherche
userSchema.index({ fullName: "text", email: "text" });

module.exports = mongoose.model("User", userSchema);
