const mongoose = require('mongoose');

const connectDB = async () => {
  const atlasUri = process.env.MONGO_URI;
  const localUri = 'mongodb://127.0.0.1:27017/smartattend';

  if (atlasUri) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const conn = await mongoose.connect(atlasUri, {
          serverSelectionTimeoutMS: 15000,
          socketTimeoutMS: 45000,
        });
        console.log(`MongoDB Atlas Connected: ${conn.connection.host}`);
        return;
      } catch (error) {
        console.error(`Atlas Connection Attempt ${attempt} Error: ${error.message}`);
        if (attempt < 2) {
          console.log('Retrying MongoDB Atlas connection in 2 seconds...');
          await new Promise((res) => setTimeout(res, 2000));
        }
      }
    }
  }

  try {
    console.log('Attempting local MongoDB fallback (mongodb://127.0.0.1:27017/smartattend)...');
    const localConn = await mongoose.connect(localUri, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`Local MongoDB Connected: ${localConn.connection.host}`);
  } catch (localErr) {
    console.error(`Local MongoDB Connection Error: ${localErr.message}`);
    console.warn('⚠️ Server will remain running, but DB operations will fail until MongoDB is accessible.');
  }
};

module.exports = connectDB;
