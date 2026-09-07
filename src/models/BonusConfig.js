import mongoose from 'mongoose';
import { EMPLOYEE_TYPES, RATE_TYPES } from '../config/masterData.js';

const bandSchema = new mongoose.Schema(
  {
    fromMeters: { type: Number, required: true },
    toMeters: { type: Number, required: true },
    rateType: { type: String, enum: RATE_TYPES, required: true },
    value: { type: Number, required: true }
  },
  { _id: false }
);

const tierTableSchema = new mongoose.Schema(
  {
    employeeType: { type: String, enum: EMPLOYEE_TYPES, required: true },
    bands: { type: [bandSchema], default: [] }
  },
  { _id: false }
);

const bonusConfigSchema = new mongoose.Schema(
  {
    recoveryThreshold: { type: Number, default: 85 },
    tierTables: { type: [tierTableSchema], default: [] }
  },
  { timestamps: true }
);

bonusConfigSchema.statics.getSingleton = async function getSingleton() {
  const existing = await this.findOne();
  return existing || this.create({});
};

bonusConfigSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    delete ret.__v;
    return ret;
  }
});

export default mongoose.model('BonusConfig', bonusConfigSchema);
