const { User } = require("../models/Models");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const privatekey = process.env.JWT_SECRET;

// Registration Handler
const register = async (req, res) => {
  try {
    const { username, password, email, role } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create a new user
    const newUser = new User({
      username,
      email,
      password: hashedPassword,
      role:role || 'student',
    });

    await newUser.save();

    res
      .status(201)
      .json({ message: "User registered successfully", user: newUser });
  } catch (err) {
    console.error("Error in register:", err);
    res
      .status(500)
      .json({ message: "Error registering user", error: err.message });
  }
};
// Login Handler
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json( "Invalid password and email");
    }

    // Validate the password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json("Invalid password and email" );
    }

    // Generate a JWT token
    const token = jwt.sign(
      { id: user._id, username: user.username, role: user.role ,email: user.email},
      privatekey,
      { expiresIn: "200h" }
    );

    res.json({
      message: "Login successful",
      token,
      role: user.role,
    });
  } catch (err) {
    res.status(500).json({ message: "Error logging in", error: err.message });
  }
};
// Get all users
const getAllUsers = async (req, res) => {
  try {
      const users = await User.find();  // Fetch all users from MongoDB
      res.json(users);
  } catch (error) {
      res.status(500).json({ message: 'Error fetching users', error: error.message });
  }
};
// Get one user by ID
const getOneUser = async (req, res) => {
  try {
      const user = await User.findById(req.params.id);  // Find user by ID
      if (!user) return res.status(404).json({ message: 'User not found' });
      res.json(user);
  } catch (error) {
      res.status(500).json({ message: 'Error fetching user', error: error.message });
  }
};
// Create a new user
const createUser = async (req, res) => {
  try {
      const { username, email, password, role } = req.body;

      // Check if user with the same email already exists
      const existingUser = await User.findOne({ email });
      if (existingUser) {
          return res.status(400).json({ message: 'User with this email already exists' });
      }

      // Hash the password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create new user
      const newUser = new User({
          username,
          email,
          password: hashedPassword,
          role
      });

      // Save user to the database
      await newUser.save();

      // Respond with the created user data
      res.status(201).json({
          message: 'User created successfully',
          user: newUser
      });
  } catch (error) {
      res.status(500).json({ message: 'Error creating user', error: error.message });
  }
};
// Update a user by ID
const updateUser = async (req, res) => {
  try {
      const { username, email, role } = req.body;
      const user = await User.findById(req.params.id);  
      if (!user) return res.status(404).json({ message: 'User not found' });

      // Update user fields if provided
      if (username) user.username = username;
      if (email) user.email = email;
      if (role) user.role = role;

      await user.save();  // Save updated user data to MongoDB
      res.json({ message: 'User updated successfully', user });
  } catch (error) {
      res.status(500).json({ message: 'Error updating user', error: error.message });
  }
};
// Delete a user by ID
const deleteUser = async (req, res) => {
  try {
      const user = await User.findByIdAndDelete(req.params.id);  // Delete user by ID
      if (!user) return res.status(404).json({ message: 'User not found' });
      res.json({ message: 'User deleted successfully' });
  } catch (error) {
      res.status(500).json({ message: 'Error deleting user', error: error.message });
  }
};
module.exports = {
  register,
  login,
  getAllUsers,
  getOneUser,
  createUser,
  updateUser,
  deleteUser,
};
