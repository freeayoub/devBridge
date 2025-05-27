const mongoose = require("mongoose");

// Définir les rôles étendus pour supporter les deux systèmes
const roles = [
  "admin",
  "student",
  "teacher",
  "user",
  "etudiant",
  "professeur",
  "manager",
  "developer",
  "designer",
  "tester",
];

const userSchema = new mongoose.Schema(
  {
    // Champs principaux du premier système
    fullName: {
      type: String,
      required: function () {
        // Requis seulement si firstName et lastName ne sont pas fournis
        return !this.firstName && !this.lastName;
      },
      default: function () {
        // Générer fullName à partir de firstName et lastName si disponibles
        if (this.firstName && this.lastName) {
          return `${this.firstName} ${this.lastName}`;
        }
        return this.name || "";
      },
    },
    email: {
      type: String,
      required: function () {
        // Email requis pour le premier système, optionnel pour le second
        return !this.firstName && !this.lastName;
      },
      unique: true,
      sparse: true, // Permet les valeurs null/undefined tout en gardant l'unicité
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: false, // Rendu optionnel pour supporter le second système
      minlength: 6, // Ajusté pour supporter les deux systèmes
    },
    role: {
      type: String,
      enum: roles,
      required: function () {
        return !this.profession; // Requis si profession n'est pas fournie
      },
      default: function () {
        // Mapper profession vers role pour compatibilité
        if (this.profession === "etudiant") return "student";
        if (this.profession === "professeur") return "teacher";
        return this.profession || "student";
      },
    },
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      default: null,
    },
    profileImage: {
      type: String,
      default: function () {
        return this.profilePicture || "uploads/default.png";
      },
    },
    verified: { type: Boolean, default: false },
    verificationCode: { type: String },
    resetCode: { type: String },

    // Champs du second système
    firstName: {
      type: String,
      required: function () {
        // Requis seulement si fullName n'est pas fourni
        return !this.fullName;
      },
      trim: true,
      default: function () {
        // Extraire firstName de fullName si disponible
        if (this.fullName && !this.firstName) {
          return this.fullName.split(" ")[0] || "";
        }
        return "";
      },
    },
    lastName: {
      type: String,
      required: function () {
        // Requis seulement si fullName n'est pas fourni
        return !this.fullName;
      },
      trim: true,
      default: function () {
        // Extraire lastName de fullName si disponible
        if (this.fullName && !this.lastName) {
          const parts = this.fullName.split(" ");
          return parts.slice(1).join(" ") || "";
        }
        return "";
      },
    },
    profession: {
      type: String,
      enum: ["etudiant", "professeur", ""],
      default: function () {
        // Mapper role vers profession pour compatibilité
        if (this.role === "student") return "etudiant";
        if (this.role === "teacher") return "professeur";
        return "";
      },
    },
    dateOfBirth: {
      type: Date,
      default: null,
    },

    // Champs de compatibilité et supplémentaires
    name: {
      type: String,
      trim: true,
      default: function () {
        return (
          this.fullName ||
          `${this.firstName || ""} ${this.lastName || ""}`.trim()
        );
      },
    },
    department: {
      type: String,
      trim: true,
      default: "",
    },
    position: {
      type: String,
      trim: true,
      default: "",
    },
    phoneNumber: {
      type: String,
      trim: true,
      default: "",
    },
    address: {
      type: String,
      trim: true,
      default: "",
    },
    profilePicture: {
      type: String,
      default: function () {
        return this.profileImage || "uploads/default.png";
      },
    },
    bio: {
      type: String,
      default: "",
    },
    skills: [
      {
        type: String,
        trim: true,
      },
    ],

    // Champs de statut et métadonnées
    username: {
      type: String,
      default: function () {
        return (
          this.fullName ||
          `${this.firstName || ""} ${this.lastName || ""}`.trim() ||
          this.name
        );
      },
    },
    image: {
      type: String,
      default: function () {
        return (
          this.profileImage || this.profilePicture || "uploads/default.png"
        );
      },
    },
    isActive: {
      type: Boolean,
      default: function () {
        return this.verified !== undefined ? this.verified : true;
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

        // Synchroniser les champs entre les deux systèmes
        // Assurer la cohérence fullName <-> firstName/lastName
        if (!ret.fullName && ret.firstName && ret.lastName) {
          ret.fullName = `${ret.firstName} ${ret.lastName}`;
        }
        if (!ret.firstName && ret.fullName) {
          const parts = ret.fullName.split(" ");
          ret.firstName = parts[0] || "";
          ret.lastName = parts.slice(1).join(" ") || "";
        }

        // Synchroniser name avec fullName
        if (!ret.name) {
          ret.name =
            ret.fullName ||
            `${ret.firstName || ""} ${ret.lastName || ""}`.trim();
        }

        // Synchroniser username
        if (!ret.username) {
          ret.username =
            ret.fullName ||
            ret.name ||
            `${ret.firstName || ""} ${ret.lastName || ""}`.trim();
        }

        // Synchroniser les images
        if (!ret.image) {
          ret.image =
            ret.profileImage || ret.profilePicture || "uploads/default.png";
        }
        if (!ret.profileImage) {
          ret.profileImage =
            ret.image || ret.profilePicture || "uploads/default.png";
        }
        if (!ret.profilePicture) {
          ret.profilePicture =
            ret.profileImage || ret.image || "uploads/default.png";
        }

        // Synchroniser role <-> profession
        if (!ret.role && ret.profession) {
          if (ret.profession === "etudiant") ret.role = "student";
          else if (ret.profession === "professeur") ret.role = "teacher";
          else ret.role = ret.profession;
        }
        if (!ret.profession && ret.role) {
          if (ret.role === "student") ret.profession = "etudiant";
          else if (ret.role === "teacher") ret.profession = "professeur";
          else ret.profession = "";
        }

        // Assurer isActive
        if (ret.isActive === undefined) {
          ret.isActive = ret.verified !== undefined ? ret.verified : true;
        }

        // Suppression des champs sensibles
        delete ret.password;
        delete ret.verificationCode;
        delete ret.resetCode;
        delete ret.__v;

        return ret;
      },
    },
    toObject: {
      virtuals: true,
      transform: function (doc, ret) {
        // Même logique que toJSON pour toObject
        ret.id = ret._id;

        // Synchroniser les champs
        if (!ret.fullName && ret.firstName && ret.lastName) {
          ret.fullName = `${ret.firstName} ${ret.lastName}`;
        }
        if (!ret.name) {
          ret.name =
            ret.fullName ||
            `${ret.firstName || ""} ${ret.lastName || ""}`.trim();
        }
        if (!ret.username) {
          ret.username = ret.fullName || ret.name;
        }

        return ret;
      },
    },
  }
);

// Middleware pre-save pour synchroniser les champs
userSchema.pre("save", function (next) {
  // Synchroniser fullName avec firstName/lastName
  if (this.firstName && this.lastName && !this.fullName) {
    this.fullName = `${this.firstName} ${this.lastName}`;
  }
  if (this.fullName && (!this.firstName || !this.lastName)) {
    const parts = this.fullName.split(" ");
    if (!this.firstName) this.firstName = parts[0] || "";
    if (!this.lastName) this.lastName = parts.slice(1).join(" ") || "";
  }

  // Synchroniser name
  if (!this.name) {
    this.name =
      this.fullName || `${this.firstName || ""} ${this.lastName || ""}`.trim();
  }

  // Synchroniser username
  if (!this.username) {
    this.username = this.fullName || this.name;
  }

  // Synchroniser les images
  if (!this.image && this.profileImage) {
    this.image = this.profileImage;
  }
  if (!this.profileImage && this.image) {
    this.profileImage = this.image;
  }
  if (!this.profilePicture && (this.profileImage || this.image)) {
    this.profilePicture = this.profileImage || this.image;
  }

  // Synchroniser role et profession
  if (this.profession && !this.role) {
    if (this.profession === "etudiant") this.role = "student";
    else if (this.profession === "professeur") this.role = "teacher";
    else this.role = this.profession;
  }
  if (this.role && !this.profession) {
    if (this.role === "student") this.profession = "etudiant";
    else if (this.role === "teacher") this.profession = "professeur";
  }

  // Mettre à jour updatedAt pour le second système
  this.updatedAt = new Date();

  next();
});

// Créer des index pour améliorer les performances de recherche
userSchema.index({
  fullName: "text",
  email: "text",
  firstName: "text",
  lastName: "text",
});
userSchema.index({ email: 1 });
userSchema.index({ role: 1 });
userSchema.index({ profession: 1 });
userSchema.index({ isActive: 1 });
userSchema.index({ createdAt: -1 });

module.exports = mongoose.model("User", userSchema);
