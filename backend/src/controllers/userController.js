const User = require("../models/User");
// 
const jwt = require("jsonwebtoken");
const config = require("../config/config");
const AuditLog = require("../models/auditLog.model");
const cloudinary = require("../config/cloudinaryConfig");
const uploadFile = require("../services/fileUpload.service");
const stream = require("stream");
// Helpers
// const generateToken = (user) => {
//   return jwt.sign(
//     {
//       id: user._id,
//       username: user.username,
//       email: user.email,
//       role: user.role,
//       image: user.image,
//     },
//     config.JWT_SECRET,
//     { expiresIn: config.JWT_EXPIRATION || "7d" }
//   );
// };

const sanitizeUser = (user) => {
  if (!user) return null;

  const userObj = user.toObject?.() || user;
  const { password, __v, refreshToken, ...userData } = userObj;

  userData.profileImage =
    userData.profileImage ||
    process.env.DEFAULT_IMAGE ||
    "https://ui-avatars.com/api/?name=" + encodeURIComponent(userData.profileImage);

  return userData;
};

// Format Yup validation errors
const formatYupErrors = (error) => {
  const errors = {};
  error.inner.forEach((err) => {
    errors[err.path] = err.message;
  });
  return errors;
};
const extractPublicId = (url) => {
  const matches = url.match(/\/upload\/v\d+\/(.+)\./);
  return matches ? matches[1] : null;
};
// Contrôleurs
const userController = {
  /**
   * Enregistrement d'un nouvel utilisateur
   */
  // async register(req, res) {
  //   try {
  //     // Validation avec Yup
  //     await userValidationSchema.validate(req.body, { abortEarly: false });

  //     const { username, email, password, role } = req.body;

  //     // Vérification existence
  //     const existingUser = await User.findOne({
  //       $or: [{ email }, { username }],
  //     });
  //     if (existingUser) {
  //       return res.status(409).json({
  //         error:
  //           "Un utilisateur avec cet email ou nom d'utilisateur existe déjà",
  //       });
  //     }

  //     // Création
  //     const hashedPassword = await bcrypt.hash(password, 12);
  //     const newUser = await User.create({
  //       username,
  //       email,
  //       password: hashedPassword,
  //       image: req.body.image || null,
  //       role,
  //       isActive: true,
  //       isOnline: false,
  //     });

  //     // Journalisation avec performedBy
  //     await new AuditLog({
  //       action: "USER_REGISTER",
  //       targetUserId: newUser._id,
  //       performedBy: newUser._id,
  //       details: "Nouvel utilisateur enregistré",
  //     }).save();

  //     // Réponse
  //     const token = generateToken(newUser);
  //     res.status(201).json({
  //       message: "Utilisateur enregistré avec succès",
  //       user: sanitizeUser(newUser),
  //       token,
  //     });
  //   } catch (error) {
  //     console.error("Register error:", error);

  //     if (error.name === "ValidationError") {
  //       return res.status(400).json({
  //         error: "Erreur de validation",
  //         details: formatYupErrors(error),
  //       });
  //     }

  //     res.status(500).json({
  //       error: "Erreur lors de l'enregistrement",
  //       ...(process.env.NODE_ENV === "development" && {
  //         details: error.message,
  //       }),
  //     });
  //   }
  // },
  /**
   * Connexion de l'utilisateur
   */
  // async login(req, res) {
  //   try {
  //     const { email, password } = req.body;

  //     if (!email || !password) {
  //       return res.status(400).json({ error: "Email et mot de passe requis" });
  //     }

  //     // Vérification
  //     const user = await User.findOne({ email, isActive: true }).select(
  //       "+password"
  //     );
  //     if (!user) {
  //       return res.status(401).json({ error: "Identifiants invalides" });
  //     }

  //     // Mot de passe
  //     const isMatch = await bcrypt.compare(password, user.password);
  //     if (!isMatch) {
  //       return res.status(401).json({ error: "Identifiants invalides" });
  //     }

  //     // Mise à jour du statut
  //     user.isOnline = true;
  //     user.lastActive = new Date();
  //     await user.save();

  //     // Journalisation avec performedBy
  //     await new AuditLog({
  //       action: "USER_LOGIN",
  //       targetUserId: user._id,
  //       performedBy: user._id,
  //       details: "Connexion réussie",
  //     }).save();

  //     // Réponse
  //     const token = generateToken(user);
  //     res.json({
  //       message: "Connexion réussie",
  //       user: sanitizeUser(user),
  //       token,
  //     });
  //   } catch (error) {
  //     console.error("Login error:", error);
  //     res.status(500).json({
  //       error: "Erreur lors de la connexion",
  //       ...(process.env.NODE_ENV === "development" && {
  //         details: error.message,
  //       }),
  //     });
  //   }
  // },
  /**
   * Récupération du profil utilisateur
   */
  async getProfile(req, res) {
    try {
      const user = await User.findById(req.userId);
      if (!user) {
        return res.status(404).json({ error: "Utilisateur non trouvé" });
      }
      res.json(sanitizeUser(user));
    } catch (error) {
      console.error("Get profile error:", error);
      res
        .status(500)
        .json({ error: "Erreur lors de la récupération du profil" });
    }
  },
  // async updateSelf(req, res) {
  //   try {
  //     const { username, email, currentPassword, newPassword, image } = req.body;

  //     // Validate at least one field is being updated
  //     const updateFields = ["username", "email", "newPassword", "image"].filter(
  //       (field) => req.body[field] !== undefined
  //     );
  //     if (updateFields.length === 0) {
  //       return res.status(400).json({
  //         error: "No fields to update",
  //         code: "NO_UPDATES",
  //       });
  //     }

  //     const user = await User.findById(req.user.id);
  //     if (!user) {
  //       return res.status(404).json({
  //         error: "User not found",
  //         code: "USER_NOT_FOUND",
  //       });
  //     }

  //     const updates = {};
  //     const updatedFields = [];

  //     // Username update
  //     if (username !== undefined && username !== user.username) {
  //       const existingUser = await User.findOne({ username });
  //       if (existingUser) {
  //         return res.status(409).json({
  //           error: "Username already taken",
  //           code: "USERNAME_EXISTS",
  //         });
  //       }
  //       updates.username = username;
  //       updatedFields.push("username");
  //     }

  //     // Email update
  //     if (email !== undefined && email !== user.email) {
  //       const existingUser = await User.findOne({ email });
  //       if (existingUser) {
  //         return res.status(409).json({
  //           error: "Email already in use",
  //           code: "EMAIL_EXISTS",
  //         });
  //       }
  //       updates.email = email;
  //       updatedFields.push("email");
  //     }

  //     // Image update
  //     if (image !== undefined) {
  //       updates.image = image;
  //       updatedFields.push("image");
  //     }

  //     // Password update
  //     if (newPassword) {
  //       if (!currentPassword) {
  //         return res.status(400).json({
  //           error: "Current password required for password changes",
  //           code: "CURRENT_PASSWORD_REQUIRED",
  //         });
  //       }

  //       const isMatch = await bcrypt.compare(currentPassword, user.password);
  //       if (!isMatch) {
  //         return res.status(401).json({
  //           error: "Incorrect current password",
  //           code: "INCORRECT_PASSWORD",
  //         });
  //       }

  //       updates.password = await bcrypt.hash(newPassword, 12);
  //       updatedFields.push("password");
  //     }

  //     const updatedUser = await User.findByIdAndUpdate(
  //       req.user.id,
  //       { $set: updates },
  //       { new: true, runValidators: true }
  //     );

  //     // Audit log
  //     await new AuditLog({
  //       action: "USER_SELF_UPDATE",
  //       targetUserId: req.user.id,
  //       performedBy: req.user.id,
  //       details: `Updated fields: ${updatedFields.join(", ")}`,
  //       changes: updatedFields,
  //       ipAddress: req.ip,
  //     }).save();

  //     // Generate new token
  //     const token = generateToken(updatedUser);

  //     return res.json({
  //       success: true,
  //       message: "Profile updated successfully",
  //       user: sanitizeUser(updatedUser),
  //       token,
  //       updatedFields,
  //     });
  //   } catch (error) {
  //     console.error("Update self error:", error);
  //     return res.status(500).json({
  //       error: "Profile update failed",
  //       code: "UPDATE_FAILED",
  //       ...(process.env.NODE_ENV === "development" && {
  //         details: error.message,
  //       }),
  //     });
  //   }
  // },
  // desactivate user by self
  // async deactivateSelf(req, res) {
  //   try {
  //     const user = await User.findByIdAndUpdate(
  //       req.user.id,
  //       {
  //         isActive: false,
  //         isOnline: false,
  //         lastActive: new Date(),
  //       },
  //       { new: true }
  //     );

  //     if (!user) {
  //       return res.status(404).json({ error: "Utilisateur non trouvé" });
  //     }

  //     // Journalisation
  //     await new AuditLog({
  //       action: "USER_DEACTIVATION",
  //       targetUserId: user._id,
  //       performedBy: user._id,
  //       details: "Auto-désactivation du compte",
  //       metadata: {
  //         deactivationType: "self_deactivation",
  //       },
  //     }).save();

  //     res.json({
  //       message: "Votre compte a été désactivé avec succès",
  //       user: sanitizeUser(user),
  //     });
  //   } catch (error) {
  //     console.error("Deactivate self error:", error);
  //     res
  //       .status(500)
  //       .json({ error: "Erreur lors de la désactivation du compte" });
  //   }
  // },
  // getAllUsers
  async getAllUsers(req, res) {
    try {
      const filter = {};

      if (req.query.search) {
        filter.$or = [
          { username: { $regex: req.query.search, $options: "i" } },
          { email: { $regex: req.query.search, $options: "i" } },
        ];
      }
      const users = await User.find(filter).sort({ createdAt: -1 });
      res.json(users.map((user) => sanitizeUser(user)));
    } catch (error) {
      console.error("Get all users error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  },
  /**
   * Récupération d'un utilisateur par ID
   */
  async getUserById(req, res) {
    try {
      const user = await User.findById(req.params.id);

      if (!user) {
        return res.status(404).json({ error: "Utilisateur non trouvé" });
      }
      // Autorisation
      if (req.user.role !== "admin" && req.user.id !== user.id) {
        return res.status(403).json({ error: "Accès non autorisé" });
      }
      res.json(sanitizeUser(user));
    } catch (error) {
      console.error("Get user error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  },

  /** Mise à jour polyvalente de l'utilisateur
   * - Admin peut tout modifier (sauf son propre rôle)
   * - User peut modifier ses infos personnelles et mot de passe
   */
  // async updateUser(req, res) {
  //   try {
  //     const { id } = req.params;
  //     const { username, email, currentPassword, newPassword, role } = req.body;
  //     const isAdmin = req.user.role === "admin";
  //     const isSelfUpdate = req.user.id === id;

  //     // 1. Vérifications préliminaires
  //     const user = await User.findById(id);
  //     if (!user) {
  //       return res.status(404).json({ error: "Utilisateur non trouvé" });
  //     }

  //     // 2. Construction des updates
  //     const updates = {};
  //     const updatedFields = [];
  //     let requireCurrentPassword = false;

  //     // Champs modifiables par tous (y compris admin sur son propre profil)
  //     if (username !== undefined) {
  //       updates.username = username;
  //       updatedFields.push("username");
  //       requireCurrentPassword = isSelfUpdate;
  //     }

  //     if (email !== undefined) {
  //       updates.email = email;
  //       updatedFields.push("email");
  //       requireCurrentPassword = isSelfUpdate;
  //     }

  //     if (req.body.image !== undefined) {
  //       updates.image = req.body.image;
  //       updatedFields.push("image");
  //     }

  //     // Gestion mot de passe
  //     if (newPassword) {
  //       if (!isSelfUpdate) {
  //         return res.status(403).json({
  //           error: "Seul l'utilisateur peut changer son mot de passe",
  //         });
  //       }

  //       if (!currentPassword) {
  //         return res.status(400).json({
  //           error:
  //             "Le mot de passe actuel est requis pour changer le mot de passe",
  //         });
  //       }

  //       const isMatch = await bcrypt.compare(currentPassword, user.password);
  //       if (!isMatch) {
  //         return res
  //           .status(401)
  //           .json({ error: "Mot de passe actuel incorrect" });
  //       }

  //       updates.password = await bcrypt.hash(newPassword, 12);
  //       updatedFields.push("password");
  //     }

  //     // Gestion rôle (admin seulement, pas sur soi-même)
  //     if (role !== undefined) {
  //       if (!isAdmin) {
  //         return res.status(403).json({
  //           error: "Modification du rôle réservée aux admins",
  //         });
  //       }

  //       if (isSelfUpdate) {
  //         return res.status(403).json({
  //           error: "Un admin ne peut pas modifier son propre rôle",
  //         });
  //       }

  //       if (!["admin", "student", "tutor"].includes(role)) {
  //         return res.status(400).json({ error: "Rôle invalide" });
  //       }

  //       updates.role = role;
  //       updatedFields.push("role");
  //     }

  //     // Vérification mot de passe actuel pour les modifications sensibles
  //     if (requireCurrentPassword && !currentPassword) {
  //       return res.status(400).json({
  //         error:
  //           "Le mot de passe actuel est requis pour modifier ces informations",
  //       });
  //     }

  //     if (requireCurrentPassword) {
  //       const isMatch = await bcrypt.compare(currentPassword, user.password);
  //       if (!isMatch) {
  //         return res
  //           .status(401)
  //           .json({ error: "Mot de passe actuel incorrect" });
  //       }
  //     }

  //     // 3. Application des modifications
  //     const updatedUser = await User.findByIdAndUpdate(id, updates, {
  //       new: true,
  //     });

  //     // 4. Journalisation
  //     await AuditLog.create({
  //       action: isAdmin
  //         ? isSelfUpdate
  //           ? "ADMIN_SELF_UPDATE"
  //           : "ADMIN_USER_UPDATE"
  //         : "USER_SELF_UPDATE",
  //       targetUserId: id,
  //       performedBy: req.user.id,
  //       details: `Mise à jour des champs: ${updatedFields.join(", ")}`,
  //       changes: updatedFields,
  //       ipAddress: req.ip,
  //     });

  //     res.json({
  //       message: "Mise à jour effectuée",
  //       user: sanitizeUser(updatedUser),
  //     });
  //   } catch (error) {
  //     console.error("Update error:", error);
  //     res.status(500).json({
  //       error: "Erreur lors de la mise à jour",
  //       ...(process.env.NODE_ENV === "development" && {
  //         details: error.message,
  //       }),
  //     });
  //   }
  // },
  /**
   * Désactivation d'un utilisateur (soft delete)
   */
  // async deactivateUser(req, res) {
  //   try {
  //     const userId = req.params.id;

  //     // Autorisation
  //     if (req.user.role !== "admin" && req.user.id !== userId) {
  //       return res.status(403).json({ error: "Accès non autorisé" });
  //     }

  //     const user = await User.findByIdAndUpdate(
  //       userId,
  //       {
  //         isActive: false,
  //         isOnline: false,
  //         lastActive: new Date(),
  //       },
  //       { new: true }
  //     );

  //     if (!user) {
  //       return res.status(404).json({ error: "Utilisateur non trouvé" });
  //     }

  //     // Journalisation
  //     await new AuditLog({
  //       action: "USER_DEACTIVATION",
  //       targetUserId: user._id,
  //       performedBy: req.user.id,
  //       details: `Compte désactivé par ${req.user.role}`,
  //       metadata: {
  //         deactivationType:
  //           req.user.role === "admin" ? "by_admin" : "self_deactivation",
  //       },
  //     }).save();

  //     res.json({
  //       message: "Compte désactivé avec succès",
  //       user: sanitizeUser(user),
  //     });
  //   } catch (error) {
  //     console.error("Deactivate user error:", error);
  //     res.status(500).json({ error: "Erreur lors de la désactivation" });
  //   }
  // },
  // /**
  //  * Réactivation d'un utilisateur (admin seulement)
  //  */
  // async reactivateUser(req, res) {
  //   try {
  //     if (req.user.role !== "admin") {
  //       return res.status(403).json({ error: "Accès non autorisé" });
  //     }

  //     const user = await User.findByIdAndUpdate(
  //       req.params.id,
  //       {
  //         isActive: true,
  //         isOnline: false,
  //       },
  //       { new: true }
  //     );

  //     if (!user) {
  //       return res.status(404).json({ error: "Utilisateur non trouvé" });
  //     }

  //     // Journalisation
  //     await new AuditLog({
  //       action: "USER_REACTIVATION",
  //       targetUserId: user._id,
  //       performedBy: req.user.id,
  //       details: "Compte réactivé par admin",
  //     }).save();

  //     res.json({
  //       message: "Compte réactivé avec succès",
  //       user: sanitizeUser(user),
  //     });
  //   } catch (error) {
  //     console.error("Reactivate user error:", error);
  //     res.status(500).json({ error: "Erreur lors de la réactivation" });
  //   }
  // },
  /**
   * Suppression définitive (admin seulement)
   */
  // async deleteUser(req, res) {
  //   try {
  //     if (req.user.role !== "admin") {
  //       return res.status(403).json({ error: "Accès non autorisé" });
  //     }

  //     const user = await User.findByIdAndDelete(req.params.id);
  //     if (!user) {
  //       return res.status(404).json({ error: "Utilisateur non trouvé" });
  //     }

  //     // Journalisation
  //     await new AuditLog({
  //       action: "USER_DELETION",
  //       targetUserId: user._id,
  //       performedBy: req.user.id,
  //       details: "Suppression définitive du compte",
  //       metadata: {
  //         username: user.username,
  //         email: user.email,
  //       },
  //     }).save();

  //     res.json({ message: "Utilisateur supprimé définitivement" });
  //   } catch (error) {
  //     console.error("Delete user error:", error);
  //     res.status(500).json({ error: "Erreur lors de la suppression" });
  //   }
  // },
  /**
   * Déconnexion de l'utilisateur
   */
  async logout(req, res) {
    try {
      const user = await User.findByIdAndUpdate(
        req.user.id,
        {
          isOnline: false,
          lastActive: new Date(),
        },
        { new: true }
      );

      if (!user) {
        return res.status(404).json({ error: "Utilisateur non trouvé" });
      }

      // Journalisation
      await new AuditLog({
        action: "USER_LOGOUT",
        targetUserId: user._id,
        performedBy: user._id,
        details: "Déconnexion réussie",
      }).save();

      res.json({ message: "Déconnexion réussie" });
    } catch (error) {
      console.error("Logout error:", error);
      res.status(500).json({ error: "Erreur lors de la déconnexion" });
    }
  },
  /**
   * Création d'un utilisateur par l'admin
   */
  // async createUser(req, res) {
  //   try {
  //     const {
  //       username,
  //       email,
  //       password,
  //       role = "student",
  //       sendWelcomeEmail = false,
  //     } = req.body;

  //     // Validation avec Yup
  //     await userValidationSchema.validate(req.body, { abortEarly: false });

  //     // Vérification existence
  //     const existingUser = await User.findOne({
  //       $or: [{ email }, { username }],
  //     });
  //     if (existingUser) {
  //       return res.status(409).json({
  //         error:
  //           "Un utilisateur avec cet email ou nom d'utilisateur existe déjà",
  //       });
  //     }

  //     // Création
  //     const hashedPassword = await bcrypt.hash(password, 12);
  //     const newUser = await User.create({
  //       username,
  //       email,
  //       password: hashedPassword,
  //       role,
  //       isActive: true,
  //       isOnline: false,
  //       createdBy: req.user?.id || "system",
  //     });

  //     // Journalisation
  //     await new AuditLog({
  //       action: "USER_CREATION",
  //       targetUserId: newUser._id,
  //       performedBy: req.user?.id || "system",
  //       details: "Nouvel utilisateur créé par admin",
  //       metadata: {
  //         method: "manual",
  //         sendWelcomeEmail,
  //       },
  //     }).save();

  //     res.status(201).json({
  //       message: "Utilisateur créé avec succès",
  //       user: sanitizeUser(newUser),
  //     });
  //   } catch (error) {
  //     console.error("Create user error:", error);

  //     if (error.name === "ValidationError") {
  //       return res.status(400).json({
  //         error: "Erreur de validation",
  //         details: formatYupErrors(error),
  //       });
  //     }

  //     res.status(500).json({
  //       error: "Erreur lors de la création de l'utilisateur",
  //       ...(process.env.NODE_ENV === "development" && {
  //         details: error.message,
  //       }),
  //     });
  //   }
  // },
  /**
   * Upload d'image de profil
   */
  // In uploadProfileImage, ensure the file handling is correct:
  async uploadProfileImage(req, res) {
    try {
      // 1. Validate request contains a file
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: "No file uploaded",
          code: "MISSING_FILE",
        });
      }

      // 2. Validate file type
      const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
      if (!allowedTypes.includes(req.file.mimetype)) {
        return res.status(400).json({
          success: false,
          error: "Only JPEG, PNG, or WebP images are allowed",
          code: "INVALID_FILE_TYPE",
        });
      }

      // 3. Get user
      const user = await User.findById(req.user.id);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: "User not found",
          code: "USER_NOT_FOUND",
        });
      }

      // 4. Convert buffer to stream
      const bufferStream = new stream.PassThrough();
      bufferStream.end(req.file.buffer);

      // 5. Upload using your service
      const imageUrl = await uploadFile(bufferStream, req.file.originalname, {
        folder: "profile_images",
        resource_type: "image",
        transformation: {
          width: 500,
          height: 500,
          crop: "fill",
          quality: "auto",
        },
      });

      // 6. Delete old image if exists
      if (user.profileImage) {
        try {
          const publicId = extractPublicId(user.profileImage);
          if (publicId) {
            await cloudinary.uploader.destroy(publicId);
          }
        } catch (cleanupError) {
          console.error("Old image cleanup failed:", cleanupError);
        }
      }

      // 7. Update user
      user.profileImage = imageUrl;
      user.image = imageUrl;
      console.log(user.profileImage)
      await user.save();

      return res.json({
        success: true,
        message: "Profile image updated successfully",
        imageUrl,
      });
    } catch (error) {
      console.error("Upload error:", error);

      // Handle specific Cloudinary errors
      let errorCode = "UPLOAD_FAILED";
      let statusCode = 500;

      if (error.message.includes("File size too large")) {
        statusCode = 413;
        errorCode = "FILE_TOO_LARGE";
      }

      return res.status(statusCode).json({
        success: false,
        error: "Failed to upload image",
        code: errorCode,
        ...(process.env.NODE_ENV === "development" && {
          details: error.message,
        }),
      });
    }
  },
  /**
   * Suppression de l'image de profil
   */
  async removeProfileImage(req, res) {
    try {
      // 1. Input Validation
      if (!req.user?.id) {
        return res.status(401).json({
          error: "Non autorisé",
          code: "UNAUTHORIZED",
        });
      }

      // 2. Fetch User
      const user = await User.findById(req.user.id);
      if (!user) {
        return res.status(404).json({
          error: "Utilisateur non trouvé",
          code: "USER_NOT_FOUND",
        });
      }

      // 3. Check Existing Image
      if (!user.profileImage) {
        return res.status(400).json({
          error: "Aucune photo de profil à supprimer",
          code: "NO_PROFILE_IMAGE",
        });
      }

      // 4. Extract and Validate Public ID
      const publicId = extractPublicId(user.profileImage);
      if (!publicId) {
        console.warn(`Invalid Cloudinary URL format: ${user.profileImage}`);
      }

      // 5. Cloudinary Deletion (with error handling)
      try {
        if (publicId) {
          await cloudinary.uploader.destroy(publicId, {
            invalidate: true,
          });
        }
      } catch (cloudinaryError) {
        console.error("Cloudinary deletion error:", cloudinaryError);
      }

      // 6. Database Update
      user.profileImage = null;
      await user.save();

      // 7. Audit Log
      await new AuditLog({
        action: "PROFILE_IMAGE_REMOVED",
        targetUserId: user._id,
        performedBy: req.user.id,
        details: "Suppression de la photo de profil",
        metadata: {
          oldImageUrl: user.profileImage,
          cloudinaryPublicId: publicId,
        },
      }).save();

      // 8. Response
      return res.json({
        success: true,
        message: "Photo de profil supprimée avec succès",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Remove profile image error:", error);
      return res.status(500).json({
        error: "Erreur lors de la suppression de la photo de profil",
        code: "PROFILE_IMAGE_DELETION_FAILED",
        ...(process.env.NODE_ENV === "development" && {
          details: error.message,
          stack: error.stack,
        }),
      });
    }
  },
};
module.exports = userController;
