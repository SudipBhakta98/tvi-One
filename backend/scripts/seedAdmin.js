import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import connectDB from "../config/dbConfig.js";
import User from "../modules/auth/userModel.js";
dotenv.config();

await connectDB();
const email = (process.env.ADMIN_EMAIL || "admin@tvione.local").toLowerCase();
const existing = await User.findOne({ email });
if (existing) {
  console.log(`Admin already exists: ${email}`);
  process.exit(0);
}
const user = await User.create({
  name: process.env.ADMIN_NAME || "TVI One Admin",
  email,
  passwordHash: await bcrypt.hash(process.env.ADMIN_PASSWORD || "ChangeMe123!", 12),
  role: "ADMIN",
  department: "ADMIN"
});
console.log(`Admin created: ${user.email}`);
process.exit(0);
