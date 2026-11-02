import mongoose from "mongoose";
import { redactMongoUris } from "../utils/dbTarget.js";

const describe = (error: unknown) =>
  error instanceof Error ? `${error.name}: ${redactMongoUris(error.message)}` : "unknown error";

let listenersAttached = false;

const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI;

    if (!mongoURI) {
      throw new Error("MONGODB_URI is not defined");
    }

    if (!listenersAttached) {
      listenersAttached = true;
      // Connection problems after startup must not pass silently. Messages are scrubbed of any connection string.
      mongoose.connection.on("error", (error: unknown) => console.error("MongoDB connection error:", describe(error)));
      mongoose.connection.on("disconnected", () => console.warn("MongoDB disconnected"));
      mongoose.connection.on("reconnected", () => console.log("MongoDB reconnected"));
    }

    await mongoose.connect(mongoURI);

    console.log("🍃 MongoDB connected successfully");
  } catch (error) {
    // The URI contains the password, so only a scrubbed message is logged.
    console.error("❌ MongoDB connection failed:", describe(error));
    process.exit(1);
  }
};

export default connectDB;
