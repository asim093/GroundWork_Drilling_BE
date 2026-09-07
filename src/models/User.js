import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    password: { type: String, required: true, select: false },
    role: {
      type: String,
      enum: ['admin', 'operator'],
      default: 'operator'
    },
    phone: { type: String, trim: true },
    active: { type: Boolean, default: true }
  },
  { timestamps: true }
);

userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) {
    next();
    return;
  }
  this.password = await bcrypt.hash(this.password, SALT_ROUNDS);
  next();
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    delete ret.password;
    delete ret.__v;
    return ret;
  }
});

export default mongoose.model('User', userSchema);
