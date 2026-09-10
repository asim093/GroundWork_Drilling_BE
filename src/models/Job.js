import mongoose from 'mongoose';
import { SHIFTS } from '../config/masterData.js';

const jobSiteManagerSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    shift: { type: String, enum: SHIFTS, required: true }
  },
  { _id: false }
);

const jobSchema = new mongoose.Schema(
  {
    jobNumber: { type: String, required: true, unique: true, trim: true },
    clientName: { type: String, required: true, trim: true },
    jobLocation: { type: String, trim: true },
    clientJobNumber: { type: String, trim: true },
    drillNumber: { type: mongoose.Schema.Types.ObjectId, ref: 'DrillNumber', default: null },
    rigNumber: { type: mongoose.Schema.Types.ObjectId, ref: 'RigNumber', default: null },
    scheduledDate: { type: Date },
    assignedUserIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    siteManagers: { type: [jobSiteManagerSchema], default: [] },
    rosterEmployeeIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Employee' }],
    status: {
      type: String,
      enum: ['scheduled', 'in-progress', 'submitted', 'archived'],
      default: 'scheduled'
    },
    previousStatus: { type: String, default: null }
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
