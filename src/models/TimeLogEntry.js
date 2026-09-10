import mongoose from 'mongoose';
import { SHIFTS } from '../config/masterData.js';
import {
  activityLineDrilledMeters,
  activityLineHours,
  entryMetersDrilled,
  entryMetersRecovered,
  entryMileageTotal,
  entryRecoveryPercent,
  entryTotalHours,
  startOfUtcDay
} from '../utils/timeLog.js';

const activityLineSchema = new mongoose.Schema(
  {
    boreholeRef: { type: String, trim: true, default: '' },
    description: { type: String, trim: true, default: '' },
    activityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Activity', default: null },
    comments: { type: String, trim: true, default: '' },
    depth: { type: Number, default: null },
    depthFrom: { type: Number, default: null },
    depthTo: { type: Number, default: null },
    recoveryMeters: { type: Number, default: null },
    timeFrom: { type: String, trim: true, default: '' },
    timeTo: { type: String, trim: true, default: '' },
    chargeTime: { type: Number, default: null },
    ncTime: { type: Number, default: null }
  },
  { _id: false }
);

activityLineSchema.virtual('drilledMeters').get(function drilledMeters() {
  return activityLineDrilledMeters(this);
});

activityLineSchema.virtual('hours').get(function hours() {
  return activityLineHours(this);
});

activityLineSchema.set('toJSON', { virtuals: true });

const consumableUsageSchema = new mongoose.Schema(
  {
    itemName: { type: String, trim: true, default: '' },
    qtyTaken: { type: Number, default: null },
    qtyReturned: { type: Number, default: null },
    qtyUsed: { type: Number, default: null }
  },
  { _id: false }
);

const crewMemberSchema = new mongoose.Schema(
  {
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    timeIn: { type: String, trim: true, default: '' },
    timeOut: { type: String, trim: true, default: '' }
  },
  { _id: false }
);

const timeLogEntrySchema = new mongoose.Schema(
  {
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: Date, required: true },
    shift: { type: String, enum: SHIFTS, required: true },
    crew: { type: [crewMemberSchema], default: [] },
    timeIn: { type: String, trim: true, default: '' },
    timeOut: { type: String, trim: true, default: '' },
    timeStarted: { type: String, trim: true, default: '' },
    timeFinished: { type: String, trim: true, default: '' },
    hoursOnSite: { type: Number, default: null },
    standbyHours: { type: Number, default: null },
    otherHours: { type: Number, default: null },
    mileageStart: { type: Number, default: null },
    mileageEnd: { type: Number, default: null },
    wellTag: {
      installed: { type: Boolean, default: false },
      decommissioned: { type: Boolean, default: false },
      locatesProvidedBy: { type: String, trim: true, default: '' }
    },
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

timeLogEntrySchema.pre('validate', function normalizeDate(next) {
  if (this.date) {
    this.date = startOfUtcDay(this.date);
  }
  next();
});

timeLogEntrySchema.index({ userId: 1, date: -1 });
timeLogEntrySchema.index({ jobId: 1, date: 1, shift: 1 }, { unique: true });

timeLogEntrySchema.virtual('metersDrilled').get(function metersDrilled() {
  return entryMetersDrilled(this);
});

timeLogEntrySchema.virtual('metersRecovered').get(function metersRecovered() {
  return entryMetersRecovered(this);
});

timeLogEntrySchema.virtual('totalHours').get(function totalHours() {
  return entryTotalHours(this);
});

timeLogEntrySchema.virtual('recoveryPercent').get(function recoveryPercent() {
  return entryRecoveryPercent(this);
});

timeLogEntrySchema.virtual('mileageTotal').get(function mileageTotal() {
  return entryMileageTotal(this);
});

timeLogEntrySchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    delete ret.__v;
    return ret;
  }
});

export default mongoose.model('TimeLogEntry', timeLogEntrySchema);
