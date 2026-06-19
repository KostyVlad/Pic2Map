import mongoose from 'mongoose';

/**
 * User — Mongoose schema for an authenticated user account.
 *
 * Design:
 * - email: unique, lowercase, trimmed, indexed (primary lookup key)
 * - passwordHash: argon2id hash — NEVER store or log plaintext password
 * - resetToken: SHA-256 hash of the raw token sent by email (plan 02-03)
 * - resetTokenExpiresAt: TTL for the reset token (1 hour)
 * - timestamps: createdAt / updatedAt managed by Mongoose
 */
const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    // Password reset — token stored as SHA-256 hash; raw token sent in reset email link
    // Both fields are undefined when no active reset is in progress.
    resetToken: {
      type: String,
      default: undefined,
      index: true, // looked up by hashed token at reset time
    },
    resetTokenExpiresAt: {
      type: Date,
      default: undefined,
    },
  },
  { timestamps: true }
);

export default mongoose.model('User', userSchema);
