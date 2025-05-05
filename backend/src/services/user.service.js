const User = require("../models/user.model");
const { GraphQLError } = require("graphql");

class UserService {

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

  async updateProfile(userId, input) {
    const updates = {};
    
    if (input.username) {
      updates.username = input.username;
    }
    
    if (input.email) {
      updates.email = input.email;
    }
    
    if (input.image) {
      const { createReadStream, filename } = await input.image;
      const stream = createReadStream();
      updates.image = await uploadFile(stream, filename, 'user-profiles');
    }
    
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updates,
      { new: true }
    ).lean();
    
    return {
      ...updatedUser,
      id: updatedUser._id.toString(),
      createdAt: updatedUser.createdAt.toISOString(),
      updatedAt: updatedUser.updatedAt.toISOString()
    };
  }

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
  
  safeToISOString(date) {
    if (!date) return null;
    try {
      return date instanceof Date ? date.toISOString() : new Date(date).toISOString();
    } catch {
      return null;
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

 
}

module.exports = new UserService();