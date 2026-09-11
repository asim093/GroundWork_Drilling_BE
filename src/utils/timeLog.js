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

export const formatClockHours = (value) => {
  let hours = Math.floor(value);
  let minutes = Math.round((value - hours) * 60);
  if (minutes === 60) {
    hours += 1;
    minutes = 0;
  }
  hours %= 24;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
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

export const crewMemberHours = (member) => {
  const from = parseClockHours(member?.timeIn);
  const to = parseClockHours(member?.timeOut);

  if (from === null || to === null) {
    return 0;
  }

  let diff = to - from;
  if (diff < 0) {
    diff += 24;
  }

  return round2(diff);
};

export const isWithinShift = (lineTime, timeIn, timeOut) => {
  const point = parseClockHours(lineTime);
  const start = parseClockHours(timeIn);
  let end = parseClockHours(timeOut);

  if (point === null || start === null || end === null) {
    return true;
  }
  if (end <= start) {
    end += 24;
  }
  let normalized = point;
  if (normalized < start) {
    normalized += 24;
  }
  return normalized >= start && normalized <= end;
};

export const entryTotalHours = (entry) => {
  const lines = entry?.activityLines || [];
  return round2(lines.reduce((sum, line) => sum + (activityLineHours(line) ?? 0), 0));
};

/**
 * Normalizes each line's [timeFrom,timeTo) into a 0..48 minute-resolution range
 * relative to the shift's Time In, so an overnight shift (Time Out <= Time In)
 * and overnight lines resolve consistently. Lines with unparsable times are skipped.
 */
const normalizeLineRanges = (lines, timeIn, timeOut) => {
  const start = parseClockHours(timeIn);
  let end = parseClockHours(timeOut);
  if (start === null || end === null) {
    return null;
  }
  if (end <= start) {
    end += 24;
  }

  const ranges = [];
  lines.forEach((line, index) => {
    const from = parseClockHours(line?.timeFrom);
    const to = parseClockHours(line?.timeTo);
    if (from === null || to === null) {
      return;
    }
    let normFrom = from < start ? from + 24 : from;
    let normTo = to <= normFrom ? to + 24 : to;
    ranges.push({ index, from: normFrom, to: normTo });
  });

  return { start, end, ranges };
};

export const findActivityLineOverlap = (lines, timeIn, timeOut) => {
  const normalized = normalizeLineRanges(lines || [], timeIn, timeOut);
  if (!normalized) {
    return null;
  }
  const { ranges } = normalized;
  const sorted = [...ranges].sort((a, b) => a.from - b.from);

  for (let i = 0; i < sorted.length; i += 1) {
    const line = sorted[i];
    if (line.to <= line.from) {
      return { type: 'reversed', index: line.index };
    }
  }

  for (let i = 1; i < sorted.length; i += 1) {
    const prev = sorted[i - 1];
    const current = sorted[i];
    if (current.from < prev.to) {
      return { type: 'overlap', indexA: prev.index, indexB: current.index };
    }
  }

  return null;
};

export const findActivityCoverageGap = (lines, timeIn, timeOut) => {
  const normalized = normalizeLineRanges(lines || [], timeIn, timeOut);
  if (!normalized) {
    return null;
  }
  const { start, end, ranges } = normalized;
  const sorted = [...ranges].sort((a, b) => a.from - b.from);

  let cursor = start;
  for (const range of sorted) {
    if (range.from > cursor) {
      return { from: formatClockHours(cursor % 24), to: formatClockHours(range.from % 24) };
    }
    if (range.to > cursor) {
      cursor = range.to;
    }
  }

  if (cursor < end) {
    return { from: formatClockHours(cursor % 24), to: formatClockHours(end % 24) };
  }

  return null;
};
