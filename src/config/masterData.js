export const EMPLOYEE_TYPES = [
  'Project Manager',
  'Foreman',
  'Supervisor',
  'Driller',
  'Driller Trainee',
  'Helper',
  'Assistant',
  '5th Man'
];

export const SEED_ASSISTANTS = [
  'Alex Rivera',
  'Priya Nair',
  'Marcus Bell',
  'Lena Fischer',
  'Diego Santos'
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

export const SEED_ACTIVITY_CATEGORIES = [
  'Drilling',
  'Grouting',
  'Maintenance',
  'Other',
  'Reaming And Casing',
  'Re-Entry Into Established (Old) Drillhole',
  'Rig Move And Setup/Tear Down',
  'Rod Pulls',
  'Safety Meetings',
  'Stabilize/Hole Conditioning',
  'Standby',
  'Survey/Orientations',
  'Travel',
  'Wedging And Controlled Drilling'
];

export const SEED_ACTIVITIES = [
  { activity: 'Prestart checks', category: 'Safety Meetings' },
  { activity: 'Rig inductions', category: 'Safety Meetings' },
  { activity: 'Rig inspections,', category: 'Safety Meetings' },
  { activity: 'Safety meetings', category: 'Safety Meetings' },
  { activity: 'Shutdown; safety breach + incident investigation', category: 'Safety Meetings' },
  { activity: 'Site inductions', category: 'Safety Meetings' },
  { activity: 'Standby; safety breach and incidents', category: 'Safety Meetings' },
  { activity: 'Training; drilling team', category: 'Safety Meetings' },
  { activity: 'Travel to and from drillsite', category: 'Travel' },
  { activity: 'Shift change', category: 'Travel' },
  { activity: 'Coring (Drilling)', category: 'Drilling' },
  { activity: 'Pulling & Pumping down the inner tube', category: 'Drilling' },
  { activity: 'Controlled drilling due to deviation greater than limits', category: 'Drilling' },
  { activity: 'Controlled drilling to avoid Navi/Wedging', category: 'Drilling' },
  { activity: 'Tricone open hole', category: 'Drilling' },
  { activity: 'Shingle shot downhole survey', category: 'Survey/Orientations' },
  { activity: 'Multi shot downhole survey', category: 'Survey/Orientations' },
  { activity: 'Orientation/Break core', category: 'Survey/Orientations' },
  { activity: 'Downhole geophysics', category: 'Survey/Orientations' },
  { activity: 'Maintenance of camera/orientation devices', category: 'Survey/Orientations' },
  { activity: 'Hole conditioning', category: 'Stabilize/Hole Conditioning' },
  { activity: 'Hole conditioning or flushing', category: 'Stabilize/Hole Conditioning' },
  { activity: 'mixing mud', category: 'Stabilize/Hole Conditioning' },
  { activity: 'Pull and run casing to change barrel', category: 'Rod Pulls' },
  { activity: 'Pull and run rods to change core size/Reduce to NQ', category: 'Rod Pulls' },
  { activity: 'Pull and run rods to change core size(reduce)', category: 'Rod Pulls' },
  { activity: 'Pull and run in rods for bit change less than 2hrs', category: 'Rod Pulls' },
  { activity: 'Pull and run in rods for bit change greater than 2hrs', category: 'Rod Pulls' },
  { activity: 'Pull run rods and reaming; burnt bit', category: 'Rod Pulls' },
  { activity: 'Pull run rods +reaming rods parted or damaged', category: 'Rod Pulls' },
  { activity: 'Pull; run rods +reaming; core stuck in barrel', category: 'Rod Pulls' },
  { activity: 'Pull; run rods and reaming; other', category: 'Rod Pulls' },
  { activity: 'Pull and run rods to grease rods', category: 'Rod Pulls' },
  { activity: 'Pull out rods at EOH / Multishot', category: 'Rod Pulls' },
  { activity: 'Freeing drill rods due to stuck in the hole less than 2hrs', category: 'Rod Pulls' },
  { activity: 'Freeing drill rods due to stuck in hole greater than 2hrs', category: 'Rod Pulls' },
  { activity: 'Fishing less than 2hrs', category: 'Rod Pulls' },
  { activity: 'Fishing greater than 2hrs', category: 'Rod Pulls' },
  { activity: 'Fishing; where a result of Driller error', category: 'Rod Pulls' },
  { activity: 'Dropped rods', category: 'Rod Pulls' },
  { activity: 'Collaring drill hole + installing collar pipe', category: 'Reaming And Casing' },
  { activity: 'Install casing for re-entry', category: 'Reaming And Casing' },
  { activity: 'Reaming and back reaming of casing and rods', category: 'Reaming And Casing' },
  { activity: 'Reaming HWT Casing', category: 'Reaming And Casing' },
  { activity: 'Tricone open hole for HWT Casing', category: 'Reaming And Casing' },
  { activity: 'Over reaming casing to preserve primary hole', category: 'Reaming And Casing' },
  { activity: 'Reaming; as a result of bit change less than 2hrs', category: 'Reaming And Casing' },
  {
    activity: 'Reaming; as a result of bit change greater than 2hrs',
    category: 'Reaming And Casing'
  },
  { activity: 'Reaming; as a result of greasing rods', category: 'Reaming And Casing' },
  { activity: 'Pull out casing at EOH', category: 'Reaming And Casing' },
  { activity: 'Freeing stuck casing at EOH less than 2hrs', category: 'Reaming And Casing' },
  { activity: 'Freeing stuck casing at EOH greater than 2hrs', category: 'Reaming And Casing' },
  { activity: 'Casing operations MR to DD', category: 'Reaming And Casing' },
  { activity: 'Rig move less than 2hrs', category: 'Rig Move And Setup/Tear Down' },
  { activity: 'Rig move greater than 2 hrs', category: 'Rig Move And Setup/Tear Down' },
  { activity: 'Set up rig at commencement of a drill hole', category: 'Rig Move And Setup/Tear Down' },
  { activity: 'Site preparation', category: 'Rig Move And Setup/Tear Down' },
  {
    activity: 'Line up of drill site upon hole completion',
    category: 'Rig Move And Setup/Tear Down'
  },
  {
    activity: 'Line up over an already established drill hole',
    category: 'Rig Move And Setup/Tear Down'
  },
  { activity: 'Tear down rig after hole completion', category: 'Rig Move And Setup/Tear Down' },
  {
    activity: 'Clearing safe access and preparing drill pads',
    category: 'Rig Move And Setup/Tear Down'
  },
  { activity: 'Establishing water lines', category: 'Rig Move And Setup/Tear Down' },
  { activity: 'Sump works', category: 'Rig Move And Setup/Tear Down' },
  { activity: 'Repair to water lines less than 2hrs', category: 'Rig Move And Setup/Tear Down' },
  { activity: 'Repair to water lines, more than 2 hrs', category: 'Rig Move And Setup/Tear Down' },
  {
    activity: 'Reaming for re-entry into previous drill hole',
    category: 'Re-Entry Into Established (Old) Drillhole'
  },
  {
    activity: 'Running rods for re-entry',
    category: 'Re-Entry Into Established (Old) Drillhole'
  },
  {
    activity: 'Other activities associated with re-entry',
    category: 'Re-Entry Into Established (Old) Drillhole'
  },
  { activity: 'Cementing for drill hole stabilization', category: 'Grouting' },
  { activity: 'Cementing for wedging operations', category: 'Grouting' },
  { activity: 'Drilling out cement', category: 'Grouting' },
  { activity: 'Grout hole upon completion', category: 'Grouting' },
  { activity: 'Standby for cement to cure', category: 'Grouting' },
  { activity: 'Standby for collar cement to set', category: 'Grouting' },
  { activity: 'Planned wedge & activities', category: 'Wedging And Controlled Drilling' },
  { activity: 'Unplanned wedge off hole', category: 'Wedging And Controlled Drilling' },
  {
    activity: 'Navi drilling; Lip cutting + directional work',
    category: 'Wedging And Controlled Drilling'
  },
  { activity: 'Waiting on Navi tool', category: 'Wedging And Controlled Drilling' },
  {
    activity: 'Pull + run casing to change barrel for wedging',
    category: 'Wedging And Controlled Drilling'
  },
  { activity: 'Use of casing shoe', category: 'Wedging And Controlled Drilling' },
  { activity: 'Resource shortage; equipment', category: 'Standby' },
  { activity: 'Resourse shortage; personal', category: 'Standby' },
  { activity: 'Stand down of crews at Geoligist request', category: 'Standby' },
  { activity: 'Standby for Geoligist instructions', category: 'Standby' },
  { activity: 'Standby on drill contractor', category: 'Standby' },
  { activity: 'Standby; cyclone that prevents drilling', category: 'Standby' },
  { activity: 'Standby; Force Majeure', category: 'Standby' },
  { activity: 'Standby; inclement weather', category: 'Standby' },
  { activity: 'Standby; Long term', category: 'Standby' },
  { activity: 'Standby; other', category: 'Standby' },
  { activity: 'Standby; result of drill site not ready', category: 'Standby' },
  { activity: 'Waiting for Sumps to fill', category: 'Standby' },
  { activity: 'General maintenance', category: 'Maintenance' },
  { activity: 'Repairs to the Rig', category: 'Maintenance' },
  { activity: 'Service Rig/Oil, Fuel and Air filters', category: 'Maintenance' },
  { activity: 'House Keeping', category: 'Maintenance' },
  { activity: 'Breakdown', category: 'Maintenance' },
  { activity: 'Project work', category: 'Other' },
  { activity: 'Mobilization', category: 'Other' },
  { activity: 'Day Off; 12 Hrs Drilling Team resting in the camp', category: 'Other' },
  { activity: 'Demobilization from site', category: 'Other' }
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
