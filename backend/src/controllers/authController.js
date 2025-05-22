const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const generateCode = require("../utils/generateCode");
const { sendVerificationEmail } = require("../utils/sendEmail");

exports.signup = async (req, res) => {
  const { fullName, email, password, role } = req.body;

  try {
    const existingUser = await User.findOne({ email });

    // Si l'utilisateur existe déjà
    if (existingUser) {
      // Si l'utilisateur existe mais n'est pas vérifié, générer un nouveau code et l'envoyer
      if (!existingUser.verified) {
        const newCode = generateCode();
        existingUser.verificationCode = newCode;
        await existingUser.save();

        try {
          await sendVerificationEmail(email, newCode);
          return res.status(200).json({
            message:
              "Un nouveau code de vérification a été envoyé à votre email.",
            needsVerification: true,
          });
        } catch (emailError) {
          console.error("Erreur d'envoi d'email:", emailError);
          return res.status(200).json({
            message:
              "Compte existant non vérifié. Veuillez vérifier votre email.",
            needsVerification: true,
          });
        }
      }

      // Si l'utilisateur existe et est déjà vérifié
      return res.status(400).json({ message: "Email already exists" });
    }

    // Créer un nouvel utilisateur
    const hashedPassword = await bcrypt.hash(password, 10);
    const code = generateCode();

    const user = new User({
      fullName,
      email,
      password: hashedPassword,
      role: "student",
      profileImage: process.env.DEFAULT_IMAGE || null,
      verificationCode: code,
      verified: false,
      isOnline: false,
      lastActive: null,
    });

    await user.save();

    try {
      await sendVerificationEmail(email, code);
      res.status(201).json({
        message:
          "Inscription réussie. Un code de vérification a été envoyé à votre email.",
      });
    } catch (emailError) {
      console.error("Erreur d'envoi d'email:", emailError);
      // Même si l'email échoue, l'utilisateur est créé et peut demander un nouveau code
      res.status(201).json({
        message:
          "Inscription réussie. Veuillez demander un nouveau code de vérification si vous ne le recevez pas.",
      });
    }
  } catch (err) {
    console.error("Erreur d'inscription:", err);
    res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
};

exports.login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email }).populate(
      "group",
      "name description"
    );
    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    if (!user.verified) {
      return res.status(403).json({ message: "Email not verified" });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ message: "Invalid credentials" });

    const token = jwt.sign(
      {
        id: user._id,
        role: user.role,
        fullName: user.fullName,
        username: user.fullName,
        email: user.email,
        profileImage: user.profileImage,
        image: user.profileImage,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );
    // Mise à jour du statut
    user.isOnline = true;
    user.lastActive = new Date();
    await user.save();
    res.json({
      token,
      user: {
        id: user._id,
        fullName: user.fullName,
        username: user.fullName,
        email: user.email,
        profileImage: user.profileImage,
        image: user.profileImage,
        isActive: user.isActive !== undefined ? user.isActive : user.verified,
        role: user.role,
        group: user.group
          ? {
              id: user.group._id,
              name: user.group.name,
              description: user.group.description,
            }
          : null,
      },
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select("-password")
      .populate("group", "name description");

    if (!user) return res.status(404).json({ message: "User not found" });

    res.json(user);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const { fullName, email } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (fullName) {
      user.fullName = fullName;
      user.username = fullName; // Mettre à jour username également
    }
    if (email) user.email = email;

    // Check if an image was uploaded
    if (req.file) {
      user.profileImage = req.file.path;
      user.image = req.file.path; // Mettre à jour image également
    }

    await user.save();

    // Get the group information if user belongs to a group
    let groupInfo = null;
    if (user.group) {
      const Group = require("../models/Group");
      const group = await Group.findById(user.group);
      if (group) {
        groupInfo = {
          id: group._id,
          name: group.name,
        };
      }
    }

    res.json({
      message: "Profile updated successfully",
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        group: groupInfo,
        profileImageURL: `${req.protocol}://${req.get("host")}/${
          user.profileImage
        }`,
      },
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch)
      return res.status(400).json({ message: "Current password is incorrect" });

    const hashed = await bcrypt.hash(newPassword, 10);
    user.password = hashed;

    await user.save();

    res.json({ message: "Password changed successfully" });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

exports.verifyEmail = async (req, res) => {
  const { email, code } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.verified)
      return res.status(400).json({ message: "Email already verified" });

    if (user.verificationCode === code) {
      user.verified = true;
      user.isActive = true; // Définir explicitement isActive
      user.verificationCode = null;
      await user.save();
      res.json({ message: "Email verified successfully" });
    } else {
      res.status(400).json({ message: "Invalid verification code" });
    }
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

exports.forgotPassword = async (req, res) => {
  const { email } = req.body;
  const code = Math.floor(100000 + Math.random() * 900000).toString();

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    user.resetCode = code;
    await user.save();
    await sendVerificationEmail(email, code); // reuse the email function

    res.json({ message: "Reset code sent to email" });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

exports.resetPassword = async (req, res) => {
  const { email, code, newPassword } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user || user.resetCode !== code) {
      return res.status(400).json({ message: "Invalid code or email" });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    user.password = hashed;
    user.resetCode = null;

    await user.save();

    res.json({ message: "Password reset successful" });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
exports.resendCode = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user)
      return res.status(404).json({ message: "Utilisateur introuvable" });

    // Vérifier si l'utilisateur est déjà vérifié
    if (user.verified) {
      return res.status(400).json({
        message: "Ce compte est déjà vérifié. Veuillez vous connecter.",
      });
    }

    // Generate new code
    const code = generateCode();
    user.verificationCode = code;
    await user.save();

    try {
      // Send email
      await sendVerificationEmail(email, code);
      res.json({ message: "Un nouveau code a été envoyé à votre email." });
    } catch (emailError) {
      console.error("Erreur d'envoi d'email:", emailError);
      res.status(500).json({
        message:
          "Erreur lors de l'envoi de l'email. Veuillez réessayer plus tard.",
        error: emailError.message,
      });
    }
  } catch (err) {
    console.error("Erreur de renvoi de code:", err);
    res
      .status(500)
      .json({ message: "Erreur lors de l'envoi du code.", error: err.message });
  }
};
