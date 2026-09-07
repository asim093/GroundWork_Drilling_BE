import BonusConfig from '../models/BonusConfig.js';
import { EMPLOYEE_TYPES, RATE_TYPES } from '../config/masterData.js';

const normalize = (doc) => {
  const data = doc.toJSON();
  const bandsByType = new Map((data.tierTables || []).map((tier) => [tier.employeeType, tier.bands]));

  data.tierTables = EMPLOYEE_TYPES.map((employeeType) => ({
    employeeType,
    bands: bandsByType.get(employeeType) || []
  }));

  return data;
};

const sanitizeBand = (band) => ({
  fromMeters: Number(band.fromMeters) || 0,
  toMeters: Number(band.toMeters) || 0,
  rateType: RATE_TYPES.includes(band.rateType) ? band.rateType : 'perMeter',
  value: Number(band.value) || 0
});

export const getBonusConfig = async (req, res) => {
  const doc = await BonusConfig.getSingleton();
  res.json({ data: normalize(doc) });
};

export const updateBonusConfig = async (req, res) => {
  const doc = await BonusConfig.getSingleton();

  if (req.body.recoveryThreshold !== undefined) {
    doc.recoveryThreshold = Number(req.body.recoveryThreshold);
  }

  if (Array.isArray(req.body.tierTables)) {
    doc.tierTables = req.body.tierTables
      .filter((tier) => EMPLOYEE_TYPES.includes(tier.employeeType))
      .map((tier) => ({
        employeeType: tier.employeeType,
        bands: (Array.isArray(tier.bands) ? tier.bands : []).map(sanitizeBand)
      }));
  }

  await doc.save();
  res.json({ data: normalize(doc) });
};
