import mongoose from 'mongoose';

const activityLineSchema = new mongoose.Schema(
  {
    boreholeRef: { type: String, trim: true, default: '' },
    description: { type: String, trim: true, default: '' },
    depth: { type: Number, default: null },
    timeFrom: { type: String, trim: true, default: '' },
    timeTo: { type: String, trim: true, default: '' },
    chargeTime: { type: Number, default: null },
    ncTime: { type: Number, default: null }
  },
  { _id: false }
);

const consumableUsageSchema = new mongoose.Schema(
  {
    itemName: { type: String, trim: true, default: '' },
    qtyTaken: { type: Number, default: null },
    qtyReturned: { type: Number, default: null },
    qtyUsed: { type: Number, default: null }
  },
  { _id: false }
);

const timeLogEntrySchema = new mongoose.Schema(
  {
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: Date, required: true },
    timeIn: { type: String, trim: true, default: '' },
    timeOut: { type: String, trim: true, default: '' },
    assistantName: { type: String, trim: true, default: '' },
    assistantTimeIn: { type: String, trim: true, default: '' },
    assistantTimeOut: { type: String, trim: true, default: '' },
    timeStarted: { type: String, trim: true, default: '' },
    timeFinished: { type: String, trim: true, default: '' },
    hoursOnSite: { type: Number, default: null },
    standbyHours: { type: Number, default: null },
    otherHours: { type: Number, default: null },
    mileageStart: { type: Number, default: null },
    mileageEnd: { type: Number, default: null },
    mileageTotal: { type: Number, default: null },
    wellTag: {
      installed: { type: Boolean, default: false },
      decommissioned: { type: Boolean, default: false },
      locatesProvidedBy: { type: String, trim: true, default: '' }
    },
    recoveryPercent: { type: Number, default: null },
    activityLines: { type: [activityLineSchema], default: [] },
    fuel: {
      dyedLt: { type: Number, default: null },
      dieselLt: { type: Number, default: null },
      gasolineLt: { type: Number, default: null }
    },
    consumables: { type: [consumableUsageSchema], default: [] },
    status: { type: String, enum: ['draft', 'submitted'], default: 'draft' }
  },
  { timestamps: true }
);

timeLogEntrySchema.index({ jobId: 1, userId: 1, status: 1 });
timeLogEntrySchema.index({ userId: 1, date: -1 });

timeLogEntrySchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    delete ret.__v;
    return ret;
  }
});

export default mongoose.model('TimeLogEntry', timeLogEntrySchema);
