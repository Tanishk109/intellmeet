import dotenv from "dotenv";
import { connectDB } from "../config/db.js";
import User from "../models/User.js";
import Meeting from "../models/Meeting.js";
import Notification from "../models/Notification.js";
import mongoose from "mongoose";

dotenv.config();

// Seeds a demo account + the two meetings the frontend currently hardcodes,
// so the live demo (PDF requirement: usable without sign-up) has real data.
async function seed() {
  await connectDB(process.env.MONGO_URI);

  await Promise.all([User.deleteMany({}), Meeting.deleteMany({}), Notification.deleteMany({})]);

  const admin = await User.create({
    name: "Demo Admin",
    email: "demo@intellmeet.io",
    password: "demo1234",
    role: "Admin",
  });

  await Meeting.create([
    {
      code: "MT-1001",
      title: "Frontend Team Discussion",
      date: "2026-05-25",
      time: "11:00",
      type: "Team Meeting",
      host: admin._id,
      participants: [admin._id],
    },
    {
      code: "MT-1002",
      title: "Client Project Demo",
      date: "2026-05-28",
      time: "15:30",
      type: "Client Meeting",
      host: admin._id,
      participants: [admin._id],
    },
  ]);

  await Notification.create({
    user: admin._id,
    title: "Welcome to IntellMeet",
    message: "Your demo workspace is ready.",
    type: "system",
  });

  console.log("[seed] Done. Login: demo@intellmeet.io / demo1234");
  await mongoose.disconnect();
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
