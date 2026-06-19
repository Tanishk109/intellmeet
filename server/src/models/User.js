import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    // Password is required only for local (email/password) accounts. OAuth
    // users (Google) authenticate with the provider and have no password.
    password: {
      type: String,
      minlength: 6,
      select: false,
      required: function () {
        return this.authProvider === "local";
      },
    },
    authProvider: { type: String, enum: ["local", "google"], default: "local" },
    googleId: { type: String, default: null, index: true, sparse: true },
    avatar: { type: String, default: "" },
    role: { type: String, enum: ["Admin", "Member"], default: "Member" },
    // Stored as a hash; rotated on logout / password change.
    refreshTokenHash: { type: String, default: null, select: false },
  },
  { timestamps: true }
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = function (candidate) {
  // OAuth accounts have no password — they can't log in via the local form.
  if (!this.password) return Promise.resolve(false);
  return bcrypt.compare(candidate, this.password);
};

// Shape returned to the frontend (no secrets).
userSchema.methods.toPublic = function () {
  return {
    id: this._id.toString(),
    name: this.name,
    email: this.email,
    avatar: this.avatar,
    role: this.role,
    createdAt: this.createdAt,
  };
};

export default mongoose.model("User", userSchema);
