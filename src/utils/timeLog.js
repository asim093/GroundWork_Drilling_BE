const round2 = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

export const startOfUtcDay = (value) => {
  const date = new Date(value);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
};

export const parseClockHours = (value) => {
  if (typeof value !== 'string') {
    return null;
  }

  const match = value.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3] || 0);

  if (hours > 23 || minutes > 59 || seconds > 59) {
    return null;
  }

  return hours + minutes / 60 + seconds / 3600;
};

export const activityLineDrilledMeters = (line) => {
  const from = line?.depthFrom;
  const to = line?.depthTo;

  if (from === null || from === undefined || from === '' || to === null || to === undefined || to === '') {
    return null;
  }

  const value = Number(to) - Number(from);
  return Number.isFinite(value) ? round2(value) : null;
};

export const activityLineHours = (line) => {
  const from = parseClockHours(line?.timeFrom);
  const to = parseClockHours(line?.timeTo);

  if (from === null || to === null) {
    return null;
  }

  let diff = to - from;
  if (diff < 0) {
    diff += 24;
  }

  return round2(diff);
};

export const entryMetersDrilled = (entry) => {
  const lines = entry?.activityLines || [];
  return round2(lines.reduce((sum, line) => sum + (activityLineDrilledMeters(line) ?? 0), 0));
};

export const entryMetersRecovered = (entry) => {
  const lines = entry?.activityLines || [];
  const hasAny = lines.some(
    (line) =>
      line?.recoveryMeters !== null && line?.recoveryMeters !== undefined && line?.recoveryMeters !== ''
  );

  if (!hasAny) {
    return null;
  }

  return round2(lines.reduce((sum, line) => sum + (Number(line?.recoveryMeters) || 0), 0));
};

export const entryTotalHours = (entry) => {
  const lines = entry?.activityLines || [];
  return round2(lines.reduce((sum, line) => sum + (activityLineHours(line) ?? 0), 0));
};

export const entryMileageTotal = (entry) => {
  const start = entry?.mileageStart;
  const end = entry?.mileageEnd;

  if (
    start === null ||
    start === undefined ||
    start === '' ||
    end === null ||
    end === undefined ||
    end === ''
  ) {
    return null;
  }

  const value = Number(end) - Number(start);
  return Number.isFinite(value) ? round2(value) : null;
};

export const entryRecoveryPercent = (entry) => {
  const drilled = entryMetersDrilled(entry);
  const recovered = entryMetersRecovered(entry);

  if (!drilled || drilled <= 0) {
    return null;
  }
  if (recovered === null || recovered === undefined) {
    return null;
  }

  return round2((recovered / drilled) * 100);
};
