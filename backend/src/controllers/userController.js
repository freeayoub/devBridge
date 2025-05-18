const User = require("../models/User");
const AuditLog = require("../models/auditLog.model");
const cloudinary = require("../config/cloudinaryConfig");
const uploadFile = require("../services/fileUpload.service");
const stream = require("stream");
// Helpers
const sanitizeUser = (user) => {
  if (!user) return null;

  const userObj = user.toObject?.() || user;
  const { password, __v, refreshToken, ...userData } = userObj;

  userData.image =
    userData.image ||
    process.env.DEFAULT_IMAGE ||
    "https://ui-avatars.com/api/?name=" + encodeURIComponent(userData.username);

  return userData;
};
const extractPublicId = (url) => {
  const matches = url.match(/\/upload\/v\d+\/(.+)\./);
  return matches ? matches[1] : null;
};
// Contrôleurs
const userController = {
  // getProfile
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
  // getUserById
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
  //logout
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
  //uploadProfileImage
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
      if (user.image) {
        try {
          const publicId = extractPublicId(user.image);
          if (publicId) {
            await cloudinary.uploader.destroy(publicId);
          }
        } catch (cleanupError) {
          console.error("Old image cleanup failed:", cleanupError);
        }
      }

      // 7. Update user
      user.image = imageUrl;
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
  //removeProfileImage
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
      if (!user.image) {
        return res.status(400).json({
          error: "Aucune photo de profil à supprimer",
          code: "NO_PROFILE_IMAGE",
        });
      }

      // 4. Extract and Validate Public ID
      const publicId = extractPublicId(user.image);
      if (!publicId) {
        console.warn(`Invalid Cloudinary URL format: ${user.image}`);
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
      user.image = null;
      await user.save();

      // 7. Audit Log
      await new AuditLog({
        action: "PROFILE_IMAGE_REMOVED",
        targetUserId: user._id,
        performedBy: req.user.id,
        details: "Suppression de la photo de profil",
        metadata: {
          oldImageUrl: user.image,
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
