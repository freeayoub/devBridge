const express = require("express");
const router = express.Router();
const { auth, authorizeRoles } = require("../middlewares/auth");
const {
  createGroup,
  getAllGroups,
  getGroupById,
  updateGroup,
  deleteGroup,
  addUserToGroup,
  removeUserFromGroup,
  getGroupUsers,
} = require("../controllers/groupController");

// Create a new group (teachers and admins only)
router.post("/", auth, authorizeRoles("teacher", "admin"), createGroup);

// Get all groups
router.get("/", auth, getAllGroups);

// Get a specific group
router.get("/:id", auth, getGroupById);

// Update a group (creator or admin only)
router.put("/:id", auth, updateGroup);

// Delete a group (creator or admin only)
router.delete("/:id", auth, deleteGroup);

// Add a user to a group (teachers and admins only)
router.post(
  "/:id/users",
  auth,
  authorizeRoles("teacher", "admin"),
  addUserToGroup
);

// Remove a user from a group (teachers and admins only)
router.delete(
  "/:id/users",
  auth,
  authorizeRoles("teacher", "admin"),
  removeUserFromGroup
);

// Get all users in a group
router.get("/:id/users", auth, getGroupUsers);

module.exports = router;
