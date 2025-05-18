const User = require("../models/User");
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
      updates.image = await uploadFile(stream, filename, "user-profiles");
    }

    const updatedUser = await User.findByIdAndUpdate(userId, updates, {
      new: true,
    }).lean();

    return {
      ...updatedUser,
      id: updatedUser._id.toString(),
      createdAt: updatedUser.createdAt.toISOString(),
      updatedAt: updatedUser.updatedAt.toISOString(),
    };
  }

  async getAllUsers(options = {}) {
    try {
      console.log("UserService.getAllUsers called with options:", options);

      const {
        search,
        page = 1,
        limit = 10,
        sortBy = "username",
        sortOrder = "asc",
        isOnline,
      } = options;

      // Build filter
      const filter = {};

      if (search) {
        // Check if search is a simple term or complex query
        if (
          search.length > 3 &&
          !search.includes("@") &&
          !search.includes(" ")
        ) {
          // Use text index for better performance with simple terms
          filter.$text = { $search: search };
        } else {
          // Fall back to regex for complex queries or short terms
          filter.$or = [
            { username: { $regex: search, $options: "i" } },
            { email: { $regex: search, $options: "i" } },
          ];
        }
      }

      // Add online status filter if specified
      if (isOnline !== undefined) {
        filter.isOnline = isOnline;
      }

      // Calculate pagination values
      const skip = (page - 1) * limit;

      // Determine sort direction
      const sortDirection = sortOrder.toLowerCase() === "desc" ? -1 : 1;

      // Create sort object
      let sort = {};

      // If using text search, sort by text score first for relevance
      if (filter.$text) {
        // Add text score field for sorting
        sort = { score: { $meta: "textScore" } };

        // If user specified a different sort field, use it as secondary sort
        if (sortBy !== "username") {
          sort[sortBy] = sortDirection;
        }
      } else {
        // Normal sort when not using text search
        sort[sortBy] = sortDirection;
      }

      console.log("Executing query with filter:", filter);
      console.log("Pagination: skip =", skip, "limit =", limit);
      console.log("Sorting by:", sortBy, "in", sortOrder, "order");

      // Execute query with pagination
      const [users, totalCount] = await Promise.all([
        filter.$text
          ? User.find(filter, { score: { $meta: "textScore" } }) // Include text score in projection
              .sort(sort)
              .skip(skip)
              .limit(limit)
              .lean()
          : User.find(filter).sort(sort).skip(skip).limit(limit).lean(),
        User.countDocuments(filter),
      ]);

      // Calculate pagination metadata
      const totalPages = Math.ceil(totalCount / limit);
      const hasNextPage = page < totalPages;
      const hasPreviousPage = page > 1;

      console.log(`Found ${users.length} users out of ${totalCount} total`);

      // Format user objects
      const formattedUsers = users.map((user) => ({
        ...user,
        id: user._id.toString(),
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
        lastActive: user.lastActive?.toISOString() || null,
      }));

      // Return paginated response
      return {
        users: formattedUsers,
        totalCount,
        totalPages,
        currentPage: page,
        hasNextPage,
        hasPreviousPage,
      };
    } catch (error) {
      console.error("Error fetching users:", error);
      throw new Error(`Failed to fetch users: ${error.message}`);
    }
  }

  safeToISOString(date) {
    if (!date) return null;
    try {
      return date instanceof Date
        ? date.toISOString()
        : new Date(date).toISOString();
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
