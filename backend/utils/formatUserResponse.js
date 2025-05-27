/**
 * Utility function to format user response with proper profile image URL
 */

/**
 * Format a user object to include the full profile image URL
 * @param {Object} user - Mongoose user document or plain object
 * @param {Object} req - Express request object (needed for protocol and host)
 * @returns {Object} Formatted user object with profileImageURL
 */
exports.formatUserResponse = (user, req) => {
  // Convert to plain object if it's a Mongoose document
  const userObj = user.toObject ? user.toObject() : { ...user };

  // Add the full URL for the profile image
  if (userObj.profileImage) {
    // Remove any leading slash to avoid double slashes in the URL
    const imagePath = userObj.profileImage.startsWith('/') ? userObj.profileImage.substring(1) : userObj.profileImage;
    userObj.profileImageURL = `${req.protocol}://${req.get('host')}/${imagePath}`;
    console.log(`Generated profile image URL: ${userObj.profileImageURL}`);
  } else {
    // Set a default profile image URL if none exists
    userObj.profileImageURL = `${req.protocol}://${req.get('host')}/uploads/default-avatar.png`;
    console.log(`Using default profile image URL: ${userObj.profileImageURL}`);
  }

  return userObj;
};

/**
 * Format an array of user objects to include the full profile image URL
 * @param {Array} users - Array of Mongoose user documents or plain objects
 * @param {Object} req - Express request object (needed for protocol and host)
 * @returns {Array} Array of formatted user objects with profileImageURL
 */
exports.formatUsersResponse = (users, req) => {
  return users.map(user => exports.formatUserResponse(user, req));
};
