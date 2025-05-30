const mongoose = require("mongoose");
const mongoURI = process.env.MONGO_URI || "mongodb://localhost:27017/devbridge";

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(mongoURI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
};
module.exports = connectDB;
