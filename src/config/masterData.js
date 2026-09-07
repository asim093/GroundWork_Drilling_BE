export const EMPLOYEE_TYPES = [
  'Project Manager',
  'Foreman',
  'Supervisor',
  'Driller',
  'Driller Trainee',
  'Helper',
  '5th Man'
];

export const EMPLOYEE_CATEGORIES = ['Local', 'Expat'];

export const SHIFTS = ['Day', 'Night'];

export const RATE_TYPES = ['flat', 'perMeter'];

export const SEED_LOCATIONS = [
  'Lower Antino',
  'Froyo',
  'Di Vinci',
  'Van Gogh',
  'Buese',
  'Lawa',
  'Maria Geralda',
  'Parbo',
  'Monet',
  'Boms North',
  'Boms East'
];

export const SEED_RIG_NUMBERS = ['1', '2', '3', '4', '5', '6'];

export const SEED_CONSUMABLES = [
  'Screens',
  'Riser',
  'J-Plugs',
  'Slip Caps',
  'Bottom Caps',
  'Flush Protectors',
  'Above Grade Protectors',
  'Locks',
  'Holeplug',
  'Silica Sand',
  'Stone Mix',
  'Quickgel',
  'Portland/Portland Cement',
  'Benseal',
  'Auger Teeth',
  'Spoon Tips',
  'Concrete',
  'Couplings',
  'Drums',
  'Flushmounts',
  'Geo-probe Liners',
  'Bailers',
  'Well/Pad Locks',
  'Auger Plugs'
];

export const SEED_BONUS_CONFIG = {
  recoveryThreshold: 85,
  tierTables: [
    {
      employeeType: 'Supervisor',
      bands: [
        { fromMeters: 0, toMeters: 6000, rateType: 'flat', value: 750 },
        { fromMeters: 6001, toMeters: 7000, rateType: 'flat', value: 1000 },
        { fromMeters: 7001, toMeters: 1000000, rateType: 'flat', value: 1500 }
      ]
    },
    {
      employeeType: 'Driller',
      bands: [
        { fromMeters: 0, toMeters: 700, rateType: 'perMeter', value: 0.9 },
        { fromMeters: 701, toMeters: 1000, rateType: 'perMeter', value: 1.1 },
        { fromMeters: 1001, toMeters: 1500, rateType: 'perMeter', value: 1.5 },
        { fromMeters: 1501, toMeters: 1000000, rateType: 'perMeter', value: 3 }
      ]
    },
    {
      employeeType: 'Helper',
      bands: [
        { fromMeters: 0, toMeters: 700, rateType: 'perMeter', value: 0.5 },
        { fromMeters: 701, toMeters: 1000, rateType: 'perMeter', value: 0.7 },
        { fromMeters: 1001, toMeters: 1500, rateType: 'perMeter', value: 1 },
        { fromMeters: 1501, toMeters: 1000000, rateType: 'perMeter', value: 1.5 }
      ]
    }
  ]
};
