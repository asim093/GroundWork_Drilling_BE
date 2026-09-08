import mongoose from 'mongoose';

const activitySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'ActivityCategory', default: null },
    active: { type: Boolean, default: true }
  },
  { timestamps: true }
);

activitySchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    delete ret.__v;
    return ret;
  }
});

export default mongoose.model('Activity', activitySchema);
