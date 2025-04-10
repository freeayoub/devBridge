const User = require("../models/schemas/user.schema");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const config = require("../config/config");
const AuditLog = require("../models/schemas/auditLog.schema");
const { userValidationSchema } = require("../models/validators/user.validators");

// Helpers
const generateToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      username: user.username,
      email: user.email,
      role: user.role
    },
    config.JWT_SECRET,
    { expiresIn: config.JWT_EXPIRATION || '7d' }
  );
};

const sanitizeUser = (user) => {
  if (!user) return null;
  const userObj = user.toObject ? user.toObject() : user;
  const { password, __v, refreshToken, ...userData } = userObj;
  return userData;
};

// Format Yup validation errors
const formatYupErrors = (error) => {
  const errors = {};
  error.inner.forEach(err => {
    errors[err.path] = err.message;
  });
  return errors;
};

// Contrôleurs
const userController = {
  /**
   * Enregistrement d'un nouvel utilisateur
   */
  async register(req, res) {
    try {
      // Validation avec Yup
      await userValidationSchema.validate(req.body, { abortEarly: false });
      
      const { username, email, password, role } = req.body;

      // Vérification existence
      const existingUser = await User.findOne({ $or: [{ email }, { username }] });
      if (existingUser) {
        return res.status(409).json({ 
          error: 'Un utilisateur avec cet email ou nom d\'utilisateur existe déjà' 
        });
      }

      // Création
      const hashedPassword = await bcrypt.hash(password, 12);
      const newUser = await User.create({
        username,
        email,
        password: hashedPassword,
        role,
        isActive: true,
        isOnline: false
      });

      // Journalisation avec performedBy
      await new AuditLog({
        action: 'USER_REGISTER',
        targetUserId: newUser._id,
        performedBy: newUser._id, // L'utilisateur lui-même comme performeur
        details: 'Nouvel utilisateur enregistré'
      }).save();

      // Réponse
      const token = generateToken(newUser);
      res.status(201).json({
        message: 'Utilisateur enregistré avec succès',
        user: sanitizeUser(newUser),
        token
      });

    } catch (error) {
      console.error('Register error:', error);
      
      if (error.name === 'ValidationError') {
        return res.status(400).json({
          error: 'Erreur de validation',
          details: formatYupErrors(error)
        });
      }
      
      res.status(500).json({ 
        error: 'Erreur lors de l\'enregistrement',
        ...(process.env.NODE_ENV === 'development' && { details: error.message })
      });
    }
  },
  /**
   * Connexion de l'utilisateur
   */
  async login(req, res) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'Email et mot de passe requis' });
      }

      // Vérification
      const user = await User.findOne({ email, isActive: true }).select('+password');
      if (!user) {
        return res.status(401).json({ error: 'Identifiants invalides' });
      }

      // Mot de passe
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).json({ error: 'Identifiants invalides' });
      }

      // Mise à jour du statut
      user.isOnline = true;
      user.lastActive = new Date();
      await user.save();

      // Journalisation avec performedBy
      await new AuditLog({
        action: 'USER_LOGIN',
        targetUserId: user._id,
        performedBy: user._id, // L'utilisateur lui-même comme performeur
        details: 'Connexion réussie'
      }).save();

      // Réponse
      const token = generateToken(user);
      res.json({
        message: 'Connexion réussie',
        user: sanitizeUser(user),
        token
      });

    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ 
        error: 'Erreur lors de la connexion',
        ...(process.env.NODE_ENV === 'development' && { details: error.message })
      });
    }
  },
  /**
   * Récupération du profil utilisateur
   */
  async getProfile(req, res) {
    try {
      const user = await User.findById(req.user.id);
      if (!user) {
        return res.status(404).json({ error: 'Utilisateur non trouvé' });
      }
      res.json(sanitizeUser(user));
    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({ error: 'Erreur lors de la récupération du profil' });
    }
  },
  async updateSelf(req, res) {
    try {
      const { username, email, currentPassword, newPassword } = req.body;
      
      // Validation
      if (!username && !email && !newPassword) {
        return res.status(400).json({ error: 'Aucune donnée à mettre à jour' });
      }
  
      const user = await User.findById(req.user.id);
      if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé' });
  
      const updates = {};
      const updatedFields = [];
  
      if (username && username !== user.username) {
        // Vérifier si le nouveau username est déjà pris
        const existingUser = await User.findOne({ username });
        if (existingUser) {
          return res.status(409).json({ error: 'Ce nom d\'utilisateur est déjà utilisé' });
        }
        updates.username = username;
        updatedFields.push('username');
      }
  
      if (email && email !== user.email) {
        // Vérifier si le nouvel email est déjà pris
        const existingUser = await User.findOne({ email });
        if (existingUser) {
          return res.status(409).json({ error: 'Cet email est déjà utilisé' });
        }
        updates.email = email;
        updatedFields.push('email');
      }
  
      if (newPassword) {
        if (!currentPassword) {
          return res.status(400).json({ error: 'Le mot de passe actuel est requis' });
        }
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
          return res.status(401).json({ error: 'Mot de passe actuel incorrect' });
        }
        updates.password = await bcrypt.hash(newPassword, 12);
        updatedFields.push('password');
      }
  
      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: 'Aucune modification détectée' });
      }
  
      const updatedUser = await User.findByIdAndUpdate(
        req.user.id,
        updates,
        { new: true }
      );
  
      // Audit log
      await new AuditLog({
        action: 'USER_SELF_UPDATE',
        targetUserId: req.user.id,
        performedBy: req.user.id,
        changes: updatedFields,
        ipAddress: req.ip
      }).save();
  
      res.json({
        message: 'Profil mis à jour avec succès',
        user: sanitizeUser(updatedUser)
      });
  
    } catch (error) {
      console.error('Update self error:', error);
      res.status(500).json({ 
        error: 'Erreur lors de la mise à jour du profil',
        ...(process.env.NODE_ENV === 'development' && { details: error.message })
      });
    }
  },
// desactivate user by self
  async deactivateSelf(req, res) {
    try {
      const user = await User.findByIdAndUpdate(
        req.user.id,
        { 
          isActive: false,
          isOnline: false,
          lastActive: new Date()
        },
        { new: true }
      );
  
      if (!user) {
        return res.status(404).json({ error: 'Utilisateur non trouvé' });
      }
  
      // Journalisation
      await new AuditLog({
        action: 'USER_DEACTIVATION',
        targetUserId: user._id,
        performedBy: user._id,
        details: 'Auto-désactivation du compte',
        metadata: {
          deactivationType: 'self_deactivation'
        }
      }).save();
  
      res.json({ 
        message: 'Votre compte a été désactivé avec succès',
        user: sanitizeUser(user)
      });
    } catch (error) {
      console.error('Deactivate self error:', error);
      res.status(500).json({ error: 'Erreur lors de la désactivation du compte' });
    }
  },
  // getAllUsers 
  async getAllUsers(req, res) {
    try {
      const filter = {};
      
      if (req.query.search) {
        filter.$or = [
          { username: { $regex: req.query.search, $options: 'i' } },
          { email: { $regex: req.query.search, $options: 'i' } }
        ];
      }
      const users = await User.find(filter).sort({ createdAt: -1 });
      res.json(users.map(user => sanitizeUser(user)));
    } catch (error) {
      console.error('Get all users error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },
  /**
   * Récupération d'un utilisateur par ID
   */
  async getUserById(req, res) {
    try {
      const user = await User.findById(req.params.id);
      
      if (!user) {
        return res.status(404).json({ error: 'Utilisateur non trouvé' });
      }

      // Autorisation
      if (req.user.role !== 'admin' && req.user.id !== user.id) {
        return res.status(403).json({ error: 'Accès non autorisé' });
      }

      res.json(sanitizeUser(user));
    } catch (error) {
      console.error('Get user error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },
 
 /** Mise à jour polyvalente de l'utilisateur
 * - Admin peut tout modifier (sauf son propre rôle)
 * - User peut modifier ses infos personnelles et mot de passe
 */
async updateUser(req, res) {
  try {
    const { id } = req.params;
    const { username, email, currentPassword, newPassword, role } = req.body;
    const isAdmin = req.user.role === 'admin';
    const isSelfUpdate = req.user.id === id;

    // 1. Vérifications préliminaires
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé' });

    // 2. Autorisations
    if (!isAdmin && !isSelfUpdate) {
      return res.status(403).json({ error: 'Accès non autorisé' });
    }

    // 3. Construction des updates
    const updates = {};
    const updatedFields = [];

    // Champs modifiables par tous
    if (username !== undefined) {
      updates.username = username;
      updatedFields.push('username');
    }

    if (email !== undefined) {
      updates.email = email;
      updatedFields.push('email');
    }

    // Gestion mot de passe (user seulement)
    if (newPassword) {
      if (!isSelfUpdate) {
        return res.status(403).json({ error: 'Seul l\'utilisateur peut changer son mot de passe' });
      }
      
      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) return res.status(401).json({ error: 'Mot de passe actuel incorrect' });
      
      updates.password = await bcrypt.hash(newPassword, 12);
      updatedFields.push('password');
    }

    // Gestion rôle (admin seulement)
    if (role !== undefined) {
      if (!isAdmin) {
        return res.status(403).json({ error: 'Modification du rôle réservée aux admins' });
      }

      if (isSelfUpdate) {
        return res.status(403).json({ error: 'Un admin ne peut pas modifier son propre rôle' });
      }

      if (!['admin', 'teacher', 'tutor'].includes(role)) {
        return res.status(400).json({ error: 'Rôle invalide' });
      }

      updates.role = role;
      updatedFields.push('role');
    }

    // 4. Application des modifications
    const updatedUser = await User.findByIdAndUpdate(id, updates, { new: true });

    // 5. Journalisation différenciée
    await AuditLog.create({
      action: isAdmin ? 'ADMIN_USER_UPDATE' : 'USER_SELF_UPDATE',
      targetUserId: id,
      performedBy: req.user.id,
      changes: updatedFields,
      ipAddress: req.ip
    });

    res.json({
      message: 'Mise à jour effectuée',
      user: sanitizeUser(updatedUser)
    });

  } catch (error) {
    console.error('Update error:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la mise à jour',
      ...(process.env.NODE_ENV === 'development' && { details: error.message })
    });
  }
},
  /**
   * Désactivation d'un utilisateur (soft delete)
   */
  async deactivateUser(req, res) {
    try {
      const userId = req.params.id;

      // Autorisation
      if (req.user.role !== 'admin' && req.user.id !== userId) {
        return res.status(403).json({ error: 'Accès non autorisé' });
      }

      const user = await User.findByIdAndUpdate(
        userId,
        { 
          isActive: false,
          isOnline: false,
          lastActive: new Date()
        },
        { new: true }
      );

      if (!user) {
        return res.status(404).json({ error: 'Utilisateur non trouvé' });
      }

      // Journalisation
      await new AuditLog({
        action: 'USER_DEACTIVATION',
        targetUserId: user._id,
        performedBy: req.user.id,
        details: `Compte désactivé par ${req.user.role}`,
        metadata: {
          deactivationType: req.user.role === 'admin' ? 'by_admin' : 'self_deactivation'
        }
      }).save();

      res.json({ 
        message: 'Compte désactivé avec succès',
        user: sanitizeUser(user)
      });
    } catch (error) {
      console.error('Deactivate user error:', error);
      res.status(500).json({ error: 'Erreur lors de la désactivation' });
    }
  },
  /**
   * Réactivation d'un utilisateur (admin seulement)
   */
  async reactivateUser(req, res) {
    try {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Accès non autorisé' });
      }

      const user = await User.findByIdAndUpdate(
        req.params.id,
        { 
          isActive: true,
          isOnline: false
        },
        { new: true }
      );

      if (!user) {
        return res.status(404).json({ error: 'Utilisateur non trouvé' });
      }

      // Journalisation
      await new AuditLog({
        action: 'USER_REACTIVATION',
        targetUserId: user._id,
        performedBy: req.user.id,
        details: 'Compte réactivé par admin'
      }).save();

      res.json({ 
        message: 'Compte réactivé avec succès',
        user: sanitizeUser(user)
      });
    } catch (error) {
      console.error('Reactivate user error:', error);
      res.status(500).json({ error: 'Erreur lors de la réactivation' });
    }
  },
  /**
   * Suppression définitive (admin seulement)
   */
  async deleteUser(req, res) {
    try {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Accès non autorisé' });
      }

      const user = await User.findByIdAndDelete(req.params.id);
      if (!user) {
        return res.status(404).json({ error: 'Utilisateur non trouvé' });
      }

      // Journalisation
      await new AuditLog({
        action: 'USER_DELETION',
        targetUserId: user._id,
        performedBy: req.user.id,
        details: 'Suppression définitive du compte',
        metadata: {
          username: user.username,
          email: user.email
        }
      }).save();

      res.json({ message: 'Utilisateur supprimé définitivement' });
    } catch (error) {
      console.error('Delete user error:', error);
      res.status(500).json({ error: 'Erreur lors de la suppression' });
    }
  },
  /**
   * Déconnexion de l'utilisateur
   */
  async logout(req, res) {
    try {
      const user = await User.findByIdAndUpdate(
        req.user.id,
        { 
          isOnline: false,
          lastActive: new Date()
        },
        { new: true }
      );

      if (!user) {
        return res.status(404).json({ error: 'Utilisateur non trouvé' });
      }

      // Journalisation
      await new AuditLog({
        action: 'USER_LOGOUT',
        targetUserId: user._id,
        performedBy: user._id,
        details: 'Déconnexion réussie'
      }).save();

      res.json({ message: 'Déconnexion réussie' });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({ error: 'Erreur lors de la déconnexion' });
    }
  },
  /**
   * Création d'un utilisateur par l'admin
   */
  async createUser(req, res) {
    try {
      const { username, email, password, role = 'student', sendWelcomeEmail = false } = req.body;

      // Validation avec Yup
      await userValidationSchema.validate(req.body, { abortEarly: false });

      // Vérification existence
      const existingUser = await User.findOne({ $or: [{ email }, { username }] });
      if (existingUser) {
        return res.status(409).json({ 
          error: 'Un utilisateur avec cet email ou nom d\'utilisateur existe déjà' 
        });
      }

      // Création
      const hashedPassword = await bcrypt.hash(password, 12);
      const newUser = await User.create({
        username,
        email,
        password: hashedPassword,
        role,
        isActive: true,
        isOnline: false,
        createdBy: req.user?.id || 'system'
      });

      // Journalisation
      await new AuditLog({
        action: 'USER_CREATION',
        targetUserId: newUser._id,
        performedBy: req.user?.id || 'system',
        details: 'Nouvel utilisateur créé par admin',
        metadata: {
          method: 'manual',
          sendWelcomeEmail
        }
      }).save();

      res.status(201).json({
        message: 'Utilisateur créé avec succès',
        user: sanitizeUser(newUser)
      });
    } catch (error) {
      console.error('Create user error:', error);
      
      if (error.name === 'ValidationError') {
        return res.status(400).json({
          error: 'Erreur de validation',
          details: formatYupErrors(error)
        });
      }
      
      res.status(500).json({ 
        error: 'Erreur lors de la création de l\'utilisateur',
        ...(process.env.NODE_ENV === 'development' && { details: error.message })
      });
    }
  }
};
module.exports = userController;