import mongoose from 'mongoose';

const rigNumberSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    active: { type: Boolean, default: true }
  },
  { timestamps: true }
);

rigNumberSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    delete ret.__v;
    return ret;
  }
});

export default mongoose.model('RigNumber', rigNumberSchema);
