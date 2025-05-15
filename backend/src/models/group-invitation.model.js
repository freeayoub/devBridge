const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * Schéma pour les invitations de groupe
 */
const groupInvitationSchema = new Schema(
  {
    // Conversation de groupe concernée
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
    },
    
    // Utilisateur qui envoie l'invitation
    inviterId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    
    // Utilisateur invité
    inviteeId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    
    // Statut de l'invitation
    status: {
      type: String,
      enum: ['pending', 'accepted', 'declined', 'expired', 'cancelled'],
      default: 'pending',
    },
    
    // Message personnalisé de l'invitation
    message: {
      type: String,
      default: '',
    },
    
    // Date d'expiration de l'invitation
    expiresAt: {
      type: Date,
      default: function() {
        // Par défaut, l'invitation expire après 7 jours
        const now = new Date();
        return new Date(now.setDate(now.getDate() + 7));
      },
    },
    
    // Date de réponse à l'invitation
    respondedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexer pour des recherches efficaces
groupInvitationSchema.index({ conversationId: 1, inviteeId: 1 }, { unique: true });
groupInvitationSchema.index({ inviteeId: 1, status: 1 });
groupInvitationSchema.index({ inviterId: 1 });
groupInvitationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Méthodes statiques
groupInvitationSchema.statics = {
  /**
   * Crée une nouvelle invitation
   * @param {Object} invitationData - Données de l'invitation
   * @returns {Promise<Object>} - L'invitation créée
   */
  async createInvitation(invitationData) {
    return this.create(invitationData);
  },

  /**
   * Récupère les invitations en attente pour un utilisateur
   * @param {string} userId - ID de l'utilisateur
   * @returns {Promise<Array>} - Liste des invitations
   */
  async getPendingInvitationsForUser(userId) {
    return this.find({
      inviteeId: userId,
      status: 'pending',
      expiresAt: { $gt: new Date() },
    })
      .populate('conversationId', 'groupName groupPhoto groupDescription')
      .populate('inviterId', 'username email image')
      .sort({ createdAt: -1 });
  },

  /**
   * Accepte une invitation
   * @param {string} invitationId - ID de l'invitation
   * @param {string} userId - ID de l'utilisateur qui accepte
   * @returns {Promise<Object>} - L'invitation mise à jour
   */
  async acceptInvitation(invitationId, userId) {
    return this.findOneAndUpdate(
      {
        _id: invitationId,
        inviteeId: userId,
        status: 'pending',
        expiresAt: { $gt: new Date() },
      },
      {
        status: 'accepted',
        respondedAt: new Date(),
      },
      { new: true }
    );
  },

  /**
   * Refuse une invitation
   * @param {string} invitationId - ID de l'invitation
   * @param {string} userId - ID de l'utilisateur qui refuse
   * @returns {Promise<Object>} - L'invitation mise à jour
   */
  async declineInvitation(invitationId, userId) {
    return this.findOneAndUpdate(
      {
        _id: invitationId,
        inviteeId: userId,
        status: 'pending',
        expiresAt: { $gt: new Date() },
      },
      {
        status: 'declined',
        respondedAt: new Date(),
      },
      { new: true }
    );
  },
};

const GroupInvitation = mongoose.model('GroupInvitation', groupInvitationSchema);

module.exports = GroupInvitation;
