const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Import the User model
const User = require('../src/models/User');

// Connect to MongoDB Atlas
const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/project_management';
    await mongoose.connect(mongoURI);
    console.log('✅ MongoDB Atlas Connected Successfully!');
    console.log(`🌐 Connected to: ${mongoose.connection.host}`);
    console.log(`📊 Database: ${mongoose.connection.name}`);
    console.log('');
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  }
};

// Default users data
const defaultUsers = [
  {
    fullName: 'DevBridge Admin',
    email: 'admin@devbridge.com',
    password: 'admin123',
    role: 'admin',
    department: 'Administration',
    position: 'System Administrator',
    bio: 'System administrator with full access to manage the DevBridge platform.'
  },
  {
    fullName: 'DevBridge Student',
    email: 'student@devbridge.com',
    password: 'student123',
    role: 'student',
    profession: 'etudiant',
    department: 'Computer Science',
    bio: 'Default student account for testing and demonstration purposes.'
  },
  {
    fullName: 'DevBridge Teacher',
    email: 'teacher@devbridge.com',
    password: 'teacher123',
    role: 'teacher',
    profession: 'professeur',
    department: 'Computer Science',
    position: 'Professor',
    bio: 'Default teacher account for managing courses and students.'
  }
];

// Create a single user
const createUser = async (userData) => {
  try {
    // Check if user already exists
    const existingUser = await User.findOne({ email: userData.email });
    if (existingUser) {
      console.log(`⚠️  User already exists: ${userData.email}`);
      console.log(`   Name: ${existingUser.fullName}`);
      console.log(`   Role: ${existingUser.role}`);
      console.log(`   Status: ${existingUser.isActive ? 'Active' : 'Inactive'}`);
      return existingUser;
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(userData.password, 10);

    // Create user object
    const newUser = new User({
      fullName: userData.fullName,
      email: userData.email,
      password: hashedPassword,
      role: userData.role,
      profession: userData.profession || '',
      department: userData.department || '',
      position: userData.position || '',
      bio: userData.bio || '',
      verified: true,
      isActive: true,
      isOnline: false,
      profileImage: process.env.DEFAULT_IMAGE || 'uploads/default.png',
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Save to database
    await newUser.save();

    console.log(`✅ User created successfully: ${userData.email}`);
    console.log(`   Name: ${userData.fullName}`);
    console.log(`   Role: ${userData.role}`);
    console.log(`   Password: ${userData.password}`);
    console.log('');

    return newUser;

  } catch (error) {
    console.error(`❌ Error creating user ${userData.email}:`, error.message);
    return null;
  }
};

// Create all default users
const createAllUsers = async () => {
  console.log('👥 Creating default users...\n');
  
  const createdUsers = [];
  
  for (const userData of defaultUsers) {
    const user = await createUser(userData);
    if (user) {
      createdUsers.push(user);
    }
  }
  
  return createdUsers;
};

// Display summary
const displaySummary = async () => {
  console.log('📊 SUMMARY OF DEFAULT USERS:');
  console.log('=' .repeat(50));
  
  const users = await User.find({ 
    email: { $in: ['admin@devbridge.com', 'student@devbridge.com', 'teacher@devbridge.com'] }
  }).select('-password -verificationCode -resetCode');
  
  users.forEach(user => {
    console.log(`👤 ${user.fullName}`);
    console.log(`   📧 Email: ${user.email}`);
    console.log(`   🎭 Role: ${user.role}`);
    console.log(`   ✅ Status: ${user.isActive ? 'Active' : 'Inactive'}`);
    console.log(`   🔐 Verified: ${user.verified ? 'Yes' : 'No'}`);
    console.log(`   📅 Created: ${user.createdAt?.toLocaleDateString()}`);
    console.log('');
  });
  
  console.log('🔑 DEFAULT PASSWORDS:');
  console.log('   admin@devbridge.com → admin123');
  console.log('   student@devbridge.com → student123');
  console.log('   teacher@devbridge.com → teacher123');
  console.log('');
  console.log('⚠️  IMPORTANT: Change these passwords after first login!');
  console.log('🔗 Login URL: http://localhost:4200/login');
};

// Main function
const main = async () => {
  console.log('🚀 DevBridge Default Users Setup');
  console.log('=' .repeat(50));
  console.log('Creating admin, student, and teacher accounts...\n');
  
  try {
    // Connect to database
    await connectDB();
    
    // Create users
    const createdUsers = await createAllUsers();
    
    // Display summary
    await displaySummary();
    
    console.log(`\n🎉 Setup completed! Created ${createdUsers.length} new users.`);
    console.log('✨ All default users are now available in MongoDB Atlas!');
    
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
  } finally {
    // Close database connection
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed.');
    process.exit(0);
  }
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Promise Rejection:', err.message);
  process.exit(1);
});

// Run the script
main();
