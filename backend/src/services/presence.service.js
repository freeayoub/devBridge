const User = require("../models/User");
const pubsub = require("../config/pubsub");
const mongoose = require("mongoose");
const { logger } = require("../utils/logger");

/**
 * Service de gestion de la présence en ligne des utilisateurs
 * Implémente un système robuste pour suivre l'état en ligne/hors ligne
 * et les activités des utilisateurs
 */
class PresenceService {
  constructor() {
    this.activeUsers = new Map(); // userId -> { lastActivity, status, device }
    this.heartbeatIntervals = new Map(); // userId -> intervalId
    this.HEARTBEAT_INTERVAL = 60000; // 60 secondes (increased to reduce server load)
    this.OFFLINE_THRESHOLD = 5 * 60 * 1000; // 5 minutes (increased to prevent premature offline status)

    // Démarrer le nettoyage périodique des utilisateurs inactifs
    this.startCleanupInterval();
  }

  /**
   * Démarre l'intervalle de nettoyage des utilisateurs inactifs
   * @private
   */
  startCleanupInterval() {
    setInterval(() => {
      this.cleanupInactiveUsers();
    }, this.HEARTBEAT_INTERVAL);
  }

  /**
   * Nettoie les utilisateurs inactifs
   * @private
   */
  async cleanupInactiveUsers() {
    try {
      const now = Date.now();
      const offlineThreshold = now - this.OFFLINE_THRESHOLD;

      for (const [userId, userInfo] of this.activeUsers.entries()) {
        if (userInfo.lastActivity < offlineThreshold) {
          await this.userDisconnected(userId);
          logger.info(`User ${userId} marked as offline due to inactivity`);
        }
      }
    } catch (error) {
      logger.error(
        `[PresenceService] Error in cleanupInactiveUsers: ${error.message}`
      );
    }
  }

  /**
   * Enregistre la connexion d'un utilisateur
   * @param {string} userId - ID de l'utilisateur
   * @param {Object|string} deviceInfo - Informations sur l'appareil
   * @returns {Promise<boolean>} - Succès de l'opération
   */
  async userConnected(userId, deviceInfo = {}) {
    try {
      if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
        logger.warn(`[PresenceService] Invalid user ID: ${userId}`);
        return false;
      }

      const now = Date.now();

      // Normalize deviceInfo
      let deviceData = deviceInfo;
      if (typeof deviceInfo === "string") {
        deviceData = { type: deviceInfo };
      }

      // Check if user exists
      const userExists = await User.exists({ _id: userId });
      if (!userExists) {
        logger.warn(`[PresenceService] User ${userId} not found in database`);
        return false;
      }

      // Get current user info if exists
      const currentUserInfo = this.activeUsers.get(userId);

      // Check if this is a new connection or just an activity update
      const isNewConnection =
        !currentUserInfo || currentUserInfo.status !== "online";

      // Update user status in database only for new connections or after significant time
      if (
        isNewConnection ||
        !currentUserInfo.lastDbUpdate ||
        now - currentUserInfo.lastDbUpdate > 5 * 60 * 1000
      ) {
        await User.findByIdAndUpdate(userId, {
          isOnline: true,
          lastActive: new Date(now),
        });

        logger.debug(
          `[PresenceService] Updated user ${userId} status in database`
        );
      }

      // Store user information in memory
      this.activeUsers.set(userId, {
        lastActivity: now,
        status: "online",
        device: deviceData,
        lastDbUpdate: isNewConnection
          ? now
          : currentUserInfo?.lastDbUpdate || now,
        connections:
          (currentUserInfo?.connections || 0) + (isNewConnection ? 1 : 0),
      });

      // Setup heartbeat for this user
      this.setupHeartbeat(userId);

      // Publish status change only for new connections
      if (isNewConnection) {
        // Get user details for the notification
        const user = await User.findById(userId, "username email image");

        pubsub.publish("USER_STATUS_CHANGED", {
          userStatusChanged: {
            userId,
            status: "online",
            lastActive: new Date(now),
            user: user
              ? {
                  id: userId,
                  username: user.username,
                  email: user.email,
                  image: user.image,
                }
              : null,
          },
        });

        // Also publish to user-specific channel
        pubsub.publish(`USER_STATUS_${userId}`, {
          userStatus: {
            userId,
            status: "online",
            lastActive: new Date(now),
          },
        });

        logger.info(
          `[PresenceService] User ${userId} connected from ${
            deviceData.type || "unknown device"
          }`
        );
      } else {
        logger.debug(
          `[PresenceService] User ${userId} activity recorded from ${
            deviceData.type || "unknown device"
          }`
        );
      }

      return true;
    } catch (error) {
      logger.error(
        `[PresenceService] Error in userConnected: ${error.message}`,
        error
      );
      return false;
    }
  }

  /**
   * Enregistre la déconnexion d'un utilisateur
   * @param {string} userId - ID de l'utilisateur
   * @param {Object} options - Options supplémentaires
   * @param {boolean} options.force - Forcer la déconnexion même si l'utilisateur a plusieurs connexions
   * @param {string} options.reason - Raison de la déconnexion
   * @returns {Promise<boolean>} - Succès de l'opération
   */
  async userDisconnected(userId, options = {}) {
    try {
      if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
        logger.warn(`[PresenceService] Invalid user ID: ${userId}`);
        return false;
      }

      const now = Date.now();
      const userInfo = this.activeUsers.get(userId);

      // If user is not in active users list, nothing to do
      if (!userInfo) {
        logger.debug(
          `[PresenceService] User ${userId} already disconnected or not found in active users`
        );
        return true;
      }

      // Check if user has multiple connections and this is not a forced disconnect
      if (!options.force && userInfo.connections && userInfo.connections > 1) {
        // Decrement connection count but keep user online
        userInfo.connections -= 1;
        userInfo.lastActivity = now;
        this.activeUsers.set(userId, userInfo);

        logger.debug(
          `[PresenceService] User ${userId} still has ${userInfo.connections} active connections`
        );
        return true;
      }

      // Get user details for the notification
      const user = await User.findById(userId, "username email image");

      // Update offline status in database
      await User.findByIdAndUpdate(userId, {
        isOnline: false,
        lastActive: new Date(now),
      });

      // Remove user from active users list
      this.activeUsers.delete(userId);

      // Stop heartbeat for this user
      this.stopHeartbeat(userId);

      // Publish status change
      pubsub.publish("USER_STATUS_CHANGED", {
        userStatusChanged: {
          userId,
          status: "offline",
          lastActive: new Date(now),
          reason: options.reason || "disconnected",
          user: user
            ? {
                id: userId,
                username: user.username,
                email: user.email,
                image: user.image,
              }
            : null,
        },
      });

      // Also publish to user-specific channel
      pubsub.publish(`USER_STATUS_${userId}`, {
        userStatus: {
          userId,
          status: "offline",
          lastActive: new Date(now),
          reason: options.reason || "disconnected",
        },
      });

      logger.info(
        `[PresenceService] User ${userId} disconnected${
          options.reason ? ` (${options.reason})` : ""
        }`
      );
      return true;
    } catch (error) {
      logger.error(
        `[PresenceService] Error in userDisconnected: ${error.message}`,
        error
      );
      return false;
    }
  }

  /**
   * Enregistre l'activité d'un utilisateur
   * @param {string} userId - ID de l'utilisateur
   * @param {Object|string} deviceInfo - Informations sur l'appareil
   * @returns {Promise<boolean>} - Succès de l'opération
   */
  async recordActivity(userId, deviceInfo = {}) {
    try {
      if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
        logger.warn(`[PresenceService] Invalid user ID: ${userId}`);
        return false;
      }

      const now = Date.now();
      const userInfo = this.activeUsers.get(userId);

      // Normalize deviceInfo
      let deviceData = deviceInfo;
      if (typeof deviceInfo === "string") {
        deviceData = { type: deviceInfo };
      }

      if (userInfo) {
        // Update in memory for frequent activities
        userInfo.lastActivity = now;

        // Update device info if provided
        if (deviceData && Object.keys(deviceData).length > 0) {
          userInfo.device = deviceData;
        }

        this.activeUsers.set(userId, userInfo);

        // Update database occasionally (not for every activity)
        const lastDbUpdate = userInfo.lastDbUpdate || 0;
        if (now - lastDbUpdate > 5 * 60 * 1000) {
          // 5 minutes
          await User.updateOne(
            { _id: userId },
            {
              lastActive: new Date(now),
              isOnline: true, // Ensure user is marked as online
            }
          );
          userInfo.lastDbUpdate = now;
          this.activeUsers.set(userId, userInfo);
          logger.debug(
            `[PresenceService] Updated lastActive in DB for user ${userId}`
          );
        }

        return true;
      }

      // If user is not in active users list, reconnect them
      logger.info(
        `[PresenceService] User ${userId} not in active users list, reconnecting`
      );
      return await this.userConnected(userId, deviceData);
    } catch (error) {
      logger.error(
        `[PresenceService] Error in recordActivity: ${error.message}`,
        error
      );
      return false;
    }
  }

  /**
   * Configure un heartbeat pour un utilisateur
   * @param {string} userId - ID de l'utilisateur
   * @private
   */
  setupHeartbeat(userId) {
    // Arrêter l'ancien heartbeat s'il existe
    this.stopHeartbeat(userId);

    // Créer un nouveau heartbeat
    const intervalId = setInterval(async () => {
      const userInfo = this.activeUsers.get(userId);
      if (userInfo) {
        const now = Date.now();
        const inactiveTime = now - userInfo.lastActivity;

        if (inactiveTime > this.OFFLINE_THRESHOLD) {
          await this.userDisconnected(userId);
          logger.info(
            `Heartbeat: User ${userId} marked as offline due to inactivity`
          );
        }
      } else {
        this.stopHeartbeat(userId);
      }
    }, this.HEARTBEAT_INTERVAL);

    this.heartbeatIntervals.set(userId, intervalId);
  }

  /**
   * Arrête le heartbeat pour un utilisateur
   * @param {string} userId - ID de l'utilisateur
   * @private
   */
  stopHeartbeat(userId) {
    const intervalId = this.heartbeatIntervals.get(userId);
    if (intervalId) {
      clearInterval(intervalId);
      this.heartbeatIntervals.delete(userId);
    }
  }

  /**
   * Obtient le statut en ligne d'un utilisateur
   * @param {string} userId - ID de l'utilisateur
   * @returns {Promise<Object>} - Statut de l'utilisateur
   */
  async getUserStatus(userId) {
    try {
      if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
        throw new Error(`[PresenceService] Invalid user ID: ${userId}`);
      }

      // Check in-memory cache first
      const userInfo = this.activeUsers.get(userId);

      if (userInfo) {
        // Check if user is actually active based on last activity time
        const now = Date.now();
        const inactiveTime = now - userInfo.lastActivity;

        if (inactiveTime > this.OFFLINE_THRESHOLD) {
          // User has been inactive for too long, mark as offline
          await this.userDisconnected(userId, {
            force: true,
            reason: "inactivity_threshold_exceeded",
          });

          // Get user from database for accurate last active time
          const user = await User.findById(
            userId,
            "isOnline lastActive username email image"
          );

          if (!user) {
            throw new Error(`[PresenceService] User ${userId} not found`);
          }

          return {
            userId,
            isOnline: false,
            lastActive: user.lastActive || null,
            device: null,
            user: {
              id: userId,
              username: user.username,
              email: user.email,
              image: user.image,
            },
          };
        }

        // User is active
        return {
          userId,
          isOnline: true,
          status: userInfo.status || "online",
          lastActive: new Date(userInfo.lastActivity),
          device: userInfo.device,
          connections: userInfo.connections || 1,
        };
      }

      // If user is not in memory, check the database
      const user = await User.findById(
        userId,
        "isOnline lastActive username email image"
      );

      if (!user) {
        throw new Error(`[PresenceService] User ${userId} not found`);
      }

      return {
        userId,
        isOnline: false, // If not in activeUsers, considered offline
        lastActive: user.lastActive || null,
        device: null,
        user: {
          id: userId,
          username: user.username,
          email: user.email,
          image: user.image,
        },
      };
    } catch (error) {
      logger.error(
        `[PresenceService] Error in getUserStatus: ${error.message}`,
        error
      );
      throw error;
    }
  }

  /**
   * Obtient la liste des utilisateurs en ligne
   * @param {Object} options - Options de filtrage
   * @param {number} options.limit - Nombre maximum d'utilisateurs à retourner
   * @param {number} options.skip - Nombre d'utilisateurs à sauter
   * @param {string} options.search - Terme de recherche pour filtrer les utilisateurs
   * @returns {Promise<Array>} - Liste des utilisateurs en ligne
   */
  async getOnlineUsers(options = {}) {
    try {
      // Clean up inactive users first
      await this.cleanupInactiveUsers();

      // Get user IDs from active users map
      const userIds = Array.from(this.activeUsers.keys());

      if (userIds.length === 0) {
        return {
          users: [],
          total: 0,
        };
      }

      // Build query
      let query = { _id: { $in: userIds } };

      // Add search filter if provided
      if (options.search) {
        const searchRegex = new RegExp(options.search, "i");
        query.$or = [{ username: searchRegex }, { email: searchRegex }];
      }

      // Get total count
      const total = await User.countDocuments(query);

      // Get users with pagination
      let usersQuery = User.find(query, "username email image lastActive role");

      // Apply pagination if provided
      if (options.limit) {
        usersQuery = usersQuery.limit(options.limit);
      }

      if (options.skip) {
        usersQuery = usersQuery.skip(options.skip);
      }

      // Execute query
      const users = await usersQuery.exec();

      // Map users with online status and additional info
      const onlineUsers = users.map((user) => {
        const userId = user.id.toString();
        const userInfo = this.activeUsers.get(userId);

        return {
          ...user.toObject(),
          id: userId,
          isOnline: true,
          status: userInfo?.status || "online",
          lastActive: userInfo?.lastActivity
            ? new Date(userInfo.lastActivity)
            : user.lastActive,
          device: userInfo?.device || null,
          connections: userInfo?.connections || 1,
        };
      });

      return {
        users: onlineUsers,
        total,
      };
    } catch (error) {
      logger.error(
        `[PresenceService] Error in getOnlineUsers: ${error.message}`,
        error
      );
      throw error;
    }
  }
}

// Exporter une instance singleton
module.exports = new PresenceService();
