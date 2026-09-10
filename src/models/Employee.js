import mongoose from 'mongoose';
import { EMPLOYEE_TYPES } from '../config/masterData.js';

const employeeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    employeeType: { type: String, enum: EMPLOYEE_TYPES, required: true },
    employeeCategory: { type: String, trim: true, default: null },
    active: { type: Boolean, default: true }
  },
  { timestamps: true }
);

employeeSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    delete ret.__v;
    return ret;
  }
});

export default mongoose.model('Employee', employeeSchema);
