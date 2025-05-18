const GroupInvitation = require("../models/group-invitation.model");
const Conversation = require("../models/conversation.model");
const User = require("../models/User");
const Message = require("../models/message.model");
const { safeFormatDate } = require("../utils/date-utils");
const { pubsub } = require("../graphql/pubsub");

/**
 * Service pour gérer les invitations de groupe
 */
class GroupInvitationService {
  /**
   * Crée une nouvelle invitation à rejoindre un groupe
   * @param {Object} params - Paramètres
   * @param {string} params.conversationId - ID de la conversation de groupe
   * @param {string} params.inviterId - ID de l'utilisateur qui invite
   * @param {string} params.inviteeId - ID de l'utilisateur invité
   * @param {string} params.message - Message personnalisé (optionnel)
   * @returns {Promise<Object>} - L'invitation créée
   */
  async createInvitation({
    conversationId,
    inviterId,
    inviteeId,
    message = "",
  }) {
    try {
      // Vérifier que la conversation existe et est un groupe
      const conversation = await Conversation.findById(conversationId);
      if (!conversation) {
        throw new Error(`Conversation not found: ${conversationId}`);
      }

      if (!conversation.isGroup) {
        throw new Error("Cannot invite to a non-group conversation");
      }

      // Vérifier que l'inviteur est un participant du groupe
      if (!conversation.participants.includes(inviterId)) {
        throw new Error("Inviter is not a participant of this group");
      }

      // Vérifier que l'invité n'est pas déjà un participant du groupe
      if (conversation.participants.includes(inviteeId)) {
        throw new Error("Invitee is already a participant of this group");
      }

      // Vérifier que l'invité existe
      const invitee = await User.findById(inviteeId);
      if (!invitee) {
        throw new Error(`Invitee not found: ${inviteeId}`);
      }

      // Vérifier s'il existe déjà une invitation en attente
      const existingInvitation = await GroupInvitation.findOne({
        conversationId,
        inviteeId,
        status: "pending",
        expiresAt: { $gt: new Date() },
      });

      if (existingInvitation) {
        throw new Error("An invitation is already pending for this user");
      }

      // Créer l'invitation
      const invitation = await GroupInvitation.create({
        conversationId,
        inviterId,
        inviteeId,
        message,
        status: "pending",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 jours
      });

      // Récupérer l'invitation avec les références
      const populatedInvitation = await GroupInvitation.findById(invitation._id)
        .populate("conversationId", "groupName groupPhoto groupDescription")
        .populate("inviterId", "username email image")
        .populate("inviteeId", "username email image");

      // Publier l'événement d'invitation
      await pubsub.publish(`GROUP_INVITATION_RECEIVED_${inviteeId}`, {
        groupInvitationReceived:
          this.formatInvitationResponse(populatedInvitation),
      });

      console.log(`Group invitation created: ${invitation._id}`);
      return this.formatInvitationResponse(populatedInvitation);
    } catch (error) {
      console.error(`Error creating group invitation: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Récupère les invitations en attente pour un utilisateur
   * @param {string} userId - ID de l'utilisateur
   * @returns {Promise<Array>} - Liste des invitations
   */
  async getPendingInvitationsForUser(userId) {
    try {
      const invitations = await GroupInvitation.find({
        inviteeId: userId,
        status: "pending",
        expiresAt: { $gt: new Date() },
      })
        .populate(
          "conversationId",
          "groupName groupPhoto groupDescription participants"
        )
        .populate("inviterId", "username email image isOnline lastActive")
        .populate("inviteeId", "username email image")
        .sort({ createdAt: -1 });

      return invitations.map((invitation) =>
        this.formatInvitationResponse(invitation)
      );
    } catch (error) {
      console.error(
        `Error getting pending invitations: ${error.message}`,
        error
      );
      throw error;
    }
  }

  /**
   * Récupère les invitations envoyées par un utilisateur
   * @param {string} userId - ID de l'utilisateur
   * @returns {Promise<Array>} - Liste des invitations
   */
  async getSentInvitationsByUser(userId) {
    try {
      const invitations = await GroupInvitation.find({
        inviterId: userId,
      })
        .populate(
          "conversationId",
          "groupName groupPhoto groupDescription participants"
        )
        .populate("inviterId", "username email image")
        .populate("inviteeId", "username email image isOnline lastActive")
        .sort({ createdAt: -1 });

      return invitations.map((invitation) =>
        this.formatInvitationResponse(invitation)
      );
    } catch (error) {
      console.error(`Error getting sent invitations: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Accepte une invitation à rejoindre un groupe
   * @param {string} invitationId - ID de l'invitation
   * @param {string} userId - ID de l'utilisateur qui accepte
   * @returns {Promise<Object>} - La conversation mise à jour
   */
  async acceptInvitation(invitationId, userId) {
    try {
      // Récupérer l'invitation
      const invitation = await GroupInvitation.findOne({
        _id: invitationId,
        inviteeId: userId,
        status: "pending",
        expiresAt: { $gt: new Date() },
      }).populate("conversationId");

      if (!invitation) {
        throw new Error("Invitation not found or expired");
      }

      // Mettre à jour le statut de l'invitation
      invitation.status = "accepted";
      invitation.respondedAt = new Date();
      await invitation.save();

      // Ajouter l'utilisateur au groupe
      const conversation = await Conversation.findById(
        invitation.conversationId._id
      );
      if (!conversation) {
        throw new Error("Conversation not found");
      }

      // Vérifier que l'utilisateur n'est pas déjà dans le groupe
      if (conversation.participants.includes(userId)) {
        throw new Error("User is already a participant of this group");
      }

      // Ajouter l'utilisateur aux participants
      conversation.participants.push(userId);
      await conversation.save();

      // Créer un message système pour indiquer que l'utilisateur a rejoint le groupe
      const user = await User.findById(userId);
      const systemMessage = new Message({
        senderId: userId,
        conversationId: conversation._id,
        content: `${user.username} a rejoint le groupe`,
        type: "system",
        timestamp: new Date(),
      });

      await systemMessage.save();

      // Publier l'événement de mise à jour de l'invitation
      const populatedInvitation = await GroupInvitation.findById(invitation._id)
        .populate("conversationId", "groupName groupPhoto groupDescription")
        .populate("inviterId", "username email image")
        .populate("inviteeId", "username email image");

      await pubsub.publish(`GROUP_INVITATION_STATUS_CHANGED_${invitationId}`, {
        groupInvitationStatusChanged:
          this.formatInvitationResponse(populatedInvitation),
      });

      // Publier l'événement de mise à jour de la conversation
      await pubsub.publish(`CONVERSATION_UPDATED_${conversation._id}`, {
        conversationUpdated: conversation,
      });

      // Retourner la conversation mise à jour
      return conversation;
    } catch (error) {
      console.error(`Error accepting invitation: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Refuse une invitation à rejoindre un groupe
   * @param {string} invitationId - ID de l'invitation
   * @param {string} userId - ID de l'utilisateur qui refuse
   * @returns {Promise<boolean>} - true si l'opération a réussi
   */
  async declineInvitation(invitationId, userId) {
    try {
      // Récupérer l'invitation
      const invitation = await GroupInvitation.findOne({
        _id: invitationId,
        inviteeId: userId,
        status: "pending",
        expiresAt: { $gt: new Date() },
      });

      if (!invitation) {
        throw new Error("Invitation not found or expired");
      }

      // Mettre à jour le statut de l'invitation
      invitation.status = "declined";
      invitation.respondedAt = new Date();
      await invitation.save();

      // Publier l'événement de mise à jour de l'invitation
      const populatedInvitation = await GroupInvitation.findById(invitation._id)
        .populate("conversationId", "groupName groupPhoto groupDescription")
        .populate("inviterId", "username email image")
        .populate("inviteeId", "username email image");

      await pubsub.publish(`GROUP_INVITATION_STATUS_CHANGED_${invitationId}`, {
        groupInvitationStatusChanged:
          this.formatInvitationResponse(populatedInvitation),
      });

      return true;
    } catch (error) {
      console.error(`Error declining invitation: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Annule une invitation à rejoindre un groupe
   * @param {string} invitationId - ID de l'invitation
   * @param {string} userId - ID de l'utilisateur qui annule
   * @returns {Promise<boolean>} - true si l'opération a réussi
   */
  async cancelInvitation(invitationId, userId) {
    try {
      // Récupérer l'invitation
      const invitation = await GroupInvitation.findOne({
        _id: invitationId,
        inviterId: userId,
        status: "pending",
      });

      if (!invitation) {
        throw new Error("Invitation not found or not pending");
      }

      // Mettre à jour le statut de l'invitation
      invitation.status = "cancelled";
      invitation.respondedAt = new Date();
      await invitation.save();

      // Publier l'événement de mise à jour de l'invitation
      const populatedInvitation = await GroupInvitation.findById(invitation._id)
        .populate("conversationId", "groupName groupPhoto groupDescription")
        .populate("inviterId", "username email image")
        .populate("inviteeId", "username email image");

      await pubsub.publish(`GROUP_INVITATION_STATUS_CHANGED_${invitationId}`, {
        groupInvitationStatusChanged:
          this.formatInvitationResponse(populatedInvitation),
      });

      return true;
    } catch (error) {
      console.error(`Error cancelling invitation: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Formate une invitation pour la réponse
   * @param {Object} invitation - L'invitation à formater
   * @returns {Object} - L'invitation formatée
   */
  formatInvitationResponse(invitation) {
    if (!invitation) return null;

    try {
      // Convertir en objet simple si c'est un document Mongoose
      const invitationObj = invitation.toObject
        ? invitation.toObject()
        : { ...invitation };

      // Formater les dates
      invitationObj.createdAt = safeFormatDate(invitationObj.createdAt, true);
      invitationObj.updatedAt = safeFormatDate(invitationObj.updatedAt, true);
      invitationObj.expiresAt = safeFormatDate(invitationObj.expiresAt, true);
      invitationObj.respondedAt = safeFormatDate(invitationObj.respondedAt);

      // Formater l'ID
      invitationObj.id = invitationObj._id
        ? invitationObj._id.toString()
        : invitationObj.id;
      delete invitationObj._id;

      // Formater la conversation
      if (invitationObj.conversationId) {
        if (typeof invitationObj.conversationId === "object") {
          invitationObj.conversation = {
            ...invitationObj.conversationId,
            id: invitationObj.conversationId._id
              ? invitationObj.conversationId._id.toString()
              : invitationObj.conversationId.id,
          };
          delete invitationObj.conversation._id;
        } else {
          invitationObj.conversation = {
            id: invitationObj.conversationId.toString(),
          };
        }
        invitationObj.conversationId = invitationObj.conversation.id;
      }

      // Formater l'inviteur
      if (invitationObj.inviterId) {
        if (typeof invitationObj.inviterId === "object") {
          invitationObj.inviter = {
            ...invitationObj.inviterId,
            id: invitationObj.inviterId._id
              ? invitationObj.inviterId._id.toString()
              : invitationObj.inviterId.id,
          };
          delete invitationObj.inviter._id;
        } else {
          invitationObj.inviter = {
            id: invitationObj.inviterId.toString(),
            username: "Unknown User",
          };
        }
        invitationObj.inviterId = invitationObj.inviter.id;
      }

      // Formater l'invité
      if (invitationObj.inviteeId) {
        if (typeof invitationObj.inviteeId === "object") {
          invitationObj.invitee = {
            ...invitationObj.inviteeId,
            id: invitationObj.inviteeId._id
              ? invitationObj.inviteeId._id.toString()
              : invitationObj.inviteeId.id,
          };
          delete invitationObj.invitee._id;
        } else {
          invitationObj.invitee = {
            id: invitationObj.inviteeId.toString(),
            username: "Unknown User",
          };
        }
        invitationObj.inviteeId = invitationObj.invitee.id;
      }

      return invitationObj;
    } catch (error) {
      console.error(`Error formatting invitation response: ${error.message}`);
      // Retourner un objet minimal en cas d'erreur
      return {
        id: invitation._id ? invitation._id.toString() : "unknown",
        status: invitation.status || "unknown",
        createdAt: safeFormatDate(invitation.createdAt, true),
      };
    }
  }
}

module.exports = new GroupInvitationService();
