import mongoose from 'mongoose';

const jobSchema = new mongoose.Schema(
  {
    jobNumber: { type: String, required: true, unique: true, trim: true },
    clientName: { type: String, required: true, trim: true },
    jobLocation: { type: String, trim: true },
    clientJobNumber: { type: String, trim: true },
    drillType: { type: String, trim: true },
    scheduledDate: { type: Date },
    assignedUserIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    status: {
      type: String,
      enum: ['scheduled', 'in-progress', 'submitted', 'archived'],
      default: 'scheduled'
    }
  },
  { timestamps: true }
);

jobSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    delete ret.__v;
    return ret;
  }
});

export default mongoose.model('Job', jobSchema);
