const Call = require("../models/call.model");
const User = require("../models/User");
const Conversation = require("../models/conversation.model");
const { GraphQLError } = require("graphql");
const mongoose = require("mongoose");
const pubsub = require("../config/pubsub");
const logger = require("../utils/logger");
const { v4: uuidv4 } = require("uuid");

class CallService {
  /**
   * Initialise un nouvel appel
   * @param {string} callerId ID de l'appelant
   * @param {string} recipientId ID du destinataire
   * @param {string} callType Type d'appel (audio/vidéo)
   * @param {string} callId ID unique de l'appel
   * @param {string} offer Offre SDP
   * @param {string} conversationId ID de la conversation (optionnel)
   * @returns {Promise<Object>} L'appel créé
   */
  async initiateCall(
    callerId,
    recipientId,
    callType,
    callId,
    offer,
    conversationId = null
  ) {
    try {
      // Vérifier que l'appelant et le destinataire existent
      const [caller, recipient] = await Promise.all([
        User.findById(callerId),
        User.findById(recipientId),
      ]);

      if (!caller || !recipient) {
        throw new GraphQLError("Utilisateur non trouvé");
      }

      // Vérifier si une conversation existe entre les utilisateurs
      let conversation = null;
      if (conversationId) {
        conversation = await Conversation.findById(conversationId);
        if (!conversation) {
          throw new GraphQLError("Conversation non trouvée");
        }
      }

      // Créer un nouvel appel
      const call = new Call({
        _id: callId,
        caller: callerId,
        recipient: recipientId,
        type: callType,
        status: "ringing",
        startTime: new Date(),
        conversationId: conversationId,
      });

      await call.save();

      // Publier l'événement d'appel entrant
      pubsub.publish("INCOMING_CALL", {
        incomingCall: {
          id: callId,
          caller: caller,
          type: callType,
          conversationId: conversationId,
          offer: offer,
        },
      });

      return {
        id: callId,
        caller: caller,
        recipient: recipient,
        type: callType,
        status: "ringing",
        startTime: call.startTime,
        conversationId: conversationId,
      };
    } catch (error) {
      console.error("Error initiating call:", error);
      throw new GraphQLError(
        error.message || "Erreur lors de l'initialisation de l'appel"
      );
    }
  }

  /**
   * Envoie un signal d'appel
   * @param {string} callId ID de l'appel
   * @param {string} senderId ID de l'expéditeur
   * @param {string} signalType Type de signal
   * @param {string} signalData Données du signal
   * @returns {Promise<Object>} Résultat de l'opération
   */
  async sendCallSignal(callId, senderId, signalType, signalData) {
    try {
      // Vérifier que l'appel existe
      const call = await Call.findById(callId);
      if (!call) {
        throw new GraphQLError("Appel non trouvé");
      }

      // Vérifier que l'expéditeur est impliqué dans l'appel
      if (
        call.caller.toString() !== senderId &&
        call.recipient.toString() !== senderId
      ) {
        throw new GraphQLError(
          "Non autorisé à envoyer des signaux pour cet appel"
        );
      }

      // Mettre à jour le statut de l'appel en fonction du type de signal
      if (signalType === "answer") {
        call.status = "connected";
        await call.save();
      } else if (signalType === "reject") {
        call.status = "rejected";
        call.endTime = new Date();
        call.duration = Math.round((call.endTime - call.startTime) / 1000);
        await call.save();
      } else if (signalType === "end-call") {
        call.status = "ended";
        call.endTime = new Date();
        call.duration = Math.round((call.endTime - call.startTime) / 1000);
        await call.save();
      }

      // Publier le signal
      pubsub.publish("CALL_SIGNAL", {
        callSignal: {
          callId,
          senderId,
          type: signalType,
          data: signalData,
          timestamp: new Date(),
        },
      });

      return { success: true };
    } catch (error) {
      console.error("Error sending call signal:", error);
      throw new GraphQLError(
        error.message || "Erreur lors de l'envoi du signal d'appel"
      );
    }
  }

  /**
   * Termine un appel
   * @param {string} callId ID de l'appel
   * @param {string} userId ID de l'utilisateur qui termine l'appel
   * @returns {Promise<Object>} L'appel terminé
   */
  async endCall(callId, userId) {
    try {
      // Vérifier que l'appel existe
      const call = await Call.findById(callId);
      if (!call) {
        throw new GraphQLError("Appel non trouvé");
      }

      // Vérifier que l'utilisateur est impliqué dans l'appel
      if (
        call.caller.toString() !== userId &&
        call.recipient.toString() !== userId
      ) {
        throw new GraphQLError("Non autorisé à terminer cet appel");
      }

      // Mettre à jour le statut de l'appel
      call.status = "ended";
      call.endTime = new Date();
      call.duration = Math.round((call.endTime - call.startTime) / 1000);
      await call.save();

      // Publier le signal de fin d'appel
      pubsub.publish("CALL_SIGNAL", {
        callSignal: {
          callId,
          senderId: userId,
          type: "end-call",
          data: "",
          timestamp: new Date(),
        },
      });

      return call;
    } catch (error) {
      console.error("Error ending call:", error);
      throw new GraphQLError(
        error.message || "Erreur lors de la fin de l'appel"
      );
    }
  }

  /**
   * Récupère l'historique des appels d'un utilisateur
   * @param {string} userId ID de l'utilisateur
   * @param {number} limit Nombre d'appels à récupérer
   * @param {number} offset Décalage pour la pagination
   * @returns {Promise<Array>} Liste des appels
   */
  async getCallHistory(userId, limit = 20, offset = 0) {
    try {
      const calls = await Call.find({
        $or: [{ caller: userId }, { recipient: userId }],
      })
        .sort({ startTime: -1 })
        .skip(offset)
        .limit(limit)
        .populate("caller")
        .populate("recipient");

      return calls;
    } catch (error) {
      console.error("Error getting call history:", error);
      throw new GraphQLError(
        error.message ||
          "Erreur lors de la récupération de l'historique des appels"
      );
    }
  }

  /**
   * Crée un enregistrement d'appel vocal pour un message vocal
   * @param {Object} params Paramètres de l'appel
   * @param {string} params.senderId ID de l'expéditeur
   * @param {string} params.receiverId ID du destinataire
   * @param {string} params.conversationId ID de la conversation
   * @param {string} params.messageId ID du message vocal
   * @param {number} params.duration Durée de l'enregistrement en secondes
   * @param {Object} params.metadata Métadonnées supplémentaires
   * @returns {Promise<Object>} L'enregistrement d'appel créé
   */
  async createVoiceMessageCall({
    senderId,
    receiverId,
    conversationId,
    messageId,
    duration,
    metadata,
  }) {
    try {
      console.log(
        `[CallService] Creating voice message call record: senderId=${senderId}, receiverId=${receiverId}`
      );

      // Vérifier que les utilisateurs existent
      const [sender, receiver] = await Promise.all([
        User.findById(senderId).lean(),
        User.findById(receiverId).lean(),
      ]);

      if (!sender) {
        console.error(`[CallService] Sender user not found: ${senderId}`);
        throw new Error("Sender user not found");
      }
      if (!receiver) {
        console.error(`[CallService] Receiver user not found: ${receiverId}`);
        throw new Error("Receiver user not found");
      }

      // Vérifier que la conversation existe
      const conversation = await Conversation.findById(conversationId);
      if (!conversation) {
        console.error(
          `[CallService] Conversation not found: ${conversationId}`
        );
        throw new Error("Conversation not found");
      }

      // Créer un nouvel enregistrement d'appel
      const callRecord = new Call({
        _id: messageId, // Utiliser l'ID du message comme ID d'appel
        caller: senderId,
        recipient: receiverId,
        type: "audio",
        status: "ended", // L'appel est déjà terminé puisque c'est un message vocal
        startTime: new Date(),
        endTime: new Date(),
        duration: duration || 0,
        conversationId,
        metadata: {
          ...metadata,
          isVoiceMessage: true,
          messageId,
        },
      });

      console.log(`[CallService] Saving call record to database`);
      const savedCall = await callRecord.save();
      console.log(
        `[CallService] Call record saved successfully: ${savedCall._id}`
      );

      return savedCall;
    } catch (error) {
      console.error(
        `[CallService] Error creating voice message call record:`,
        error
      );
      throw new Error(
        `Failed to create voice message call record: ${error.message}`
      );
    }
  }

  /**
   * Récupère tous les messages vocaux pour un utilisateur
   * @param {string} userId ID de l'utilisateur
   * @returns {Promise<Array>} Liste des messages vocaux
   */
  async getVoiceMessages(userId) {
    try {
      console.log(`[CallService] Getting voice messages for user: ${userId}`);

      const calls = await Call.find({
        $or: [{ caller: userId }, { recipient: userId }],
        "metadata.isVoiceMessage": true,
      })
        .sort({ startTime: -1 })
        .populate("caller", "_id username image")
        .populate("recipient", "_id username image")
        .lean();

      console.log(
        `[CallService] Found ${calls.length} voice messages for user ${userId}`
      );
      return calls;
    } catch (error) {
      console.error(`[CallService] Error getting voice messages:`, error);
      throw new Error(`Failed to get voice messages: ${error.message}`);
    }
  }
}

module.exports = new CallService();
