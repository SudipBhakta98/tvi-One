import mongoose from "mongoose";

/**
 * Single shared MongoDB connection for the entire application, including
 * the integrated finance module. Deliberately NOT creating a second
 * connection/database for finance — one small/shared-tier cluster keeps
 * hosting cost down (one deployment to pay for, one set of connections).
 *
 * maxPoolSize is capped low on purpose: cheap shared-tier Mongo instances
 * (e.g. Atlas M0/M2/M5) have small connection limits, and a small pool is
 * plenty for a single Node.js process serving this app.
 */
const connectDB = async () => {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    throw new Error("MONGO_URI is missing from .env");
  }
  await mongoose.connect(mongoUri, {
    maxPoolSize: Number(process.env.MONGO_MAX_POOL_SIZE || 8),
    minPoolSize: 0,
    serverSelectionTimeoutMS: 8000,
    autoIndex: process.env.NODE_ENV !== "production"
  });
  console.log("MongoDB connected");
};

export default connectDB;
