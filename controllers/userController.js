const User = require('../models/User'); 
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const SECRET_KEY = process.env.SECRET_KEY;

// Registration Handler
const register = async (req, res) => {
    try {
        const { username, password, email } = req.body;

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create a new user
        const newUser = new User({
            username,
            email,
            password: hashedPassword,
        });

        await newUser.save();

        res.status(201).json({ message: 'User registered successfully', user: newUser });
    } catch (err) {
        console.error('Error in register:', err);
        res.status(500).json({ message: 'Error registering user', error: err.message });
    }
};
// Login Handler
const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Check if user exists
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: 'User not found' });
        }

        // Validate the password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid password' });
        }

        // Generate a JWT token
        const token = jwt.sign({ id: user._id, username: user.username }, SECRET_KEY, { expiresIn: '200h' });

        res.json({ message: 'Login successful', token });
    } catch (err) {
        console.error('Error in login:', err);
        res.status(500).json({ message: 'Error logging in', error: err.message });
    }
};

module.exports = {
    register,
    login,
};

