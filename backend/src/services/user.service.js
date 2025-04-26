const User = require("../models/user.model");
const { GraphQLError } = require("graphql");
class UserService {
  async getAllUsers(search) {
    try {
      const filter = {};

      if (search) {
        filter.$or = [
          { username: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
        ];
      }

      const users = await User.find(filter)
        .sort({ createdAt: -1 })
        .lean();

      return users.map((user) => ({
        ...user,
        id: user._id.toString(),
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
        lastActive: user.lastActive?.toISOString() || null,
      }));
    } catch (error) {
      console.error("Error fetching users:", error);
      throw new Error(`Failed to fetch users: ${error.message}`);
    }
  }

  async getOneUser(id) {
    try {
      const user = await User.findById(id).lean();
      if (!user) throw new Error("User not found");

      return {
        ...user,
        id: user._id.toString(),
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
        lastActive: user.lastActive?.toISOString() || null,
      };
    } catch (error) {
      console.error("Error fetching user:", error);
      throw new Error(`Failed to fetch user: ${error.message}`);
    }
  }

  async setUserOnline(userId) {
    try {
      const now = new Date();
      const user = await User.findByIdAndUpdate(
        userId,
        {
          isOnline: true,
          lastActive: now,
        },
        { new: true, lean: true }
      );

      if (!user) throw new Error("User not found");

      return {
        ...user,
        id: user._id.toString(),
        createdAt: this.safeToISOString(user.createdAt),
        updatedAt: this.safeToISOString(user.updatedAt),
        lastActive: this.safeToISOString(user.lastActive),
      };
    } catch (error) {
      console.error("Error setting user online:", error);
      throw new Error(`Failed to set user online: ${error.message}`);
    }
  }

  async setUserOffline(userId) {
    try {
      const now = new Date();
      const user = await User.findByIdAndUpdate(
        userId,
        {
          isOnline: false,
          lastActive: now,
        },
        { new: true, lean: true }
      );

      if (!user) throw new Error("User not found");

      return {
        ...user,
        id: user._id.toString(),
        createdAt: this.safeToISOString(user.createdAt),
        updatedAt: this.safeToISOString(user.updatedAt),
        lastActive: this.safeToISOString(user.lastActive),
      };
    } catch (error) {
      console.error("Error setting user offline:", error);
      throw new Error(`Failed to set user offline: ${error.message}`);
    }
  }

  safeToISOString(date) {
    if (!date) return null;
    try {
      return date instanceof Date ? date.toISOString() : new Date(date).toISOString();
    } catch {
      return null;
    }
  }
}

module.exports = new UserService();