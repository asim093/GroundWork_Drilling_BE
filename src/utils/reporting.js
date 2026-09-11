import { crewMemberHours, parseClockHours } from './timeLog.js';

export const round2 = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

export const dayKey = (value) => new Date(value).toISOString().slice(0, 10);

export const startOfUtcMonth = (year, monthIndex) => new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0, 0));

export const endOfUtcMonth = (year, monthIndex) =>
  new Date(Date.UTC(year, monthIndex + 1, 0, 23, 59, 59, 999));

export const monthLabel = (date) =>
  date.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });

export const resolveDateRange = (query) => {
  const now = new Date();

  if (query.from || query.to) {
    const from = query.from
      ? new Date(query.from)
      : startOfUtcMonth(now.getUTCFullYear(), now.getUTCMonth());
    const to = query.to
      ? new Date(query.to)
      : endOfUtcMonth(now.getUTCFullYear(), now.getUTCMonth());
    to.setUTCHours(23, 59, 59, 999);
    return { from, to };
  }

  return {
    from: startOfUtcMonth(now.getUTCFullYear(), now.getUTCMonth()),
    to: endOfUtcMonth(now.getUTCFullYear(), now.getUTCMonth())
  };
};

const clockDuration = (from, to) => {
  const start = parseClockHours(from);
  const end = parseClockHours(to);
  if (start === null || end === null) {
    return 0;
  }
  let diff = end - start;
  if (diff < 0) {
    diff += 24;
  }
  return round2(diff);
};

/**
 * Client-billable hours = the actual work window (Time Started/Finished).
 * Employee-paid hours = the full on-site window (Time In/Out), always >= billable.
 */
export const entryHours = (entry) => ({
  billableHours: clockDuration(entry.timeStarted, entry.timeFinished),
  paidHours:
    typeof entry.hoursOnSite === 'number' ? entry.hoursOnSite : clockDuration(entry.timeIn, entry.timeOut)
});

const jobLabel = (job) => (job ? `${job.jobNumber || '—'} — ${job.clientName || 'Unknown client'}` : 'Unknown job');

export const buildPeriodSummary = (entries) => {
  let billableHours = 0;
  let paidHours = 0;
  const consumableMap = new Map();

  entries.forEach((entry) => {
    const hours = entryHours(entry);
    billableHours += hours.billableHours;
    paidHours += hours.paidHours;

    (entry.consumables || []).forEach((item) => {
      if (!item.itemName) {
        return;
      }
      const current = consumableMap.get(item.itemName) || 0;
      consumableMap.set(item.itemName, current + (item.qtyUsed || 0));
    });
  });

  return {
    entryCount: entries.length,
    totals: { billableHours: round2(billableHours), paidHours: round2(paidHours) },
    consumables: [...consumableMap.entries()]
      .map(([itemName, qtyUsed]) => ({ itemName, qtyUsed: round2(qtyUsed) }))
      .sort((a, b) => a.itemName.localeCompare(b.itemName))
  };
};

export const buildEntryHoursBreakdown = (entries) =>
  entries.map((entry) => {
    const hours = entryHours(entry);
    return {
      entryId: entry._id,
      date: entry.date,
      shift: entry.shift || null,
      jobId: entry.jobId?._id ? String(entry.jobId._id) : null,
      jobNumber: entry.jobId?.jobNumber || null,
      clientName: entry.jobId?.clientName || null,
      manager: entry.userId?.name || null,
      userId: entry.userId?._id ? String(entry.userId._id) : null,
      timeIn: entry.timeIn || null,
      timeOut: entry.timeOut || null,
      timeStarted: entry.timeStarted || null,
      timeFinished: entry.timeFinished || null,
      billableHours: hours.billableHours,
      paidHours: hours.paidHours
    };
  });

/** Hours report — "by client": one row per job within range, billable+paid totals. */
export const buildClientHoursReport = (entries) => {
  const jobs = new Map();

  entries.forEach((entry) => {
    const job = entry.jobId;
    const key = job?._id ? String(job._id) : 'unknown';
    if (!jobs.has(key)) {
      jobs.set(key, {
        jobId: key,
        jobNumber: job?.jobNumber || null,
        clientName: job?.clientName || null,
        entryCount: 0,
        billableHours: 0,
        paidHours: 0
      });
    }
    const hours = entryHours(entry);
    const row = jobs.get(key);
    row.entryCount += 1;
    row.billableHours = round2(row.billableHours + hours.billableHours);
    row.paidHours = round2(row.paidHours + hours.paidHours);
  });

  const jobRows = [...jobs.values()].sort((a, b) => (a.jobNumber || '').localeCompare(b.jobNumber || ''));
  const totals = jobRows.reduce(
    (acc, row) => ({
      billableHours: round2(acc.billableHours + row.billableHours),
      paidHours: round2(acc.paidHours + row.paidHours)
    }),
    { billableHours: 0, paidHours: 0 }
  );

  return { jobs: jobRows, totals, entryCount: entries.length };
};

/** Hours report — "by employee": crew member's daily entries + totals (their own paid hours). */
export const buildEmployeeHoursReport = (entries) => {
  const employees = new Map();

  entries.forEach((entry) => {
    (entry.crew || []).forEach((member) => {
      const employee = member.employeeId;
      const key = String(employee?._id || employee?.id || employee || 'unknown');
      if (!employees.has(key)) {
        employees.set(key, {
          employeeId: key,
          name: employee?.name || 'Unknown employee',
          employeeType: employee?.employeeType || null,
          days: [],
          totalHours: 0
        });
      }
      const hours = crewMemberHours(member);
      const record = employees.get(key);
      record.days.push({
        date: entry.date,
        jobId: entry.jobId?._id ? String(entry.jobId._id) : null,
        jobNumber: entry.jobId?.jobNumber || null,
        clientName: entry.jobId?.clientName || null,
        timeIn: member.timeIn || null,
        timeOut: member.timeOut || null,
        hours
      });
      record.totalHours = round2(record.totalHours + hours);
    });
  });

  return [...employees.values()]
    .map((record) => ({
      ...record,
      days: record.days.sort((a, b) => new Date(a.date) - new Date(b.date))
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
};

/** Hours report — manager's own on-site (paid) hours across the shifts they authored. */
export const buildManagerHoursReport = (entries) => {
  const managers = new Map();

  entries.forEach((entry) => {
    const manager = entry.userId;
    const key = String(manager?._id || manager?.id || manager || 'unknown');
    if (!managers.has(key)) {
      managers.set(key, {
        userId: key,
        name: manager?.name || 'Unknown manager',
        days: [],
        totalHours: 0
      });
    }
    const hours = entryHours(entry);
    const record = managers.get(key);
    record.days.push({
      date: entry.date,
      jobId: entry.jobId?._id ? String(entry.jobId._id) : null,
      jobNumber: entry.jobId?.jobNumber || null,
      clientName: entry.jobId?.clientName || null,
      timeIn: entry.timeIn || null,
      timeOut: entry.timeOut || null,
      hours: hours.paidHours
    });
    record.totalHours = round2(record.totalHours + hours.paidHours);
  });

  return [...managers.values()]
    .map((record) => ({ ...record, days: record.days.sort((a, b) => new Date(a.date) - new Date(b.date)) }))
    .sort((a, b) => a.name.localeCompare(b.name));
};

const CONSUMABLE_UNIT = 'qty';
const FUEL_TYPES = [
  { key: 'dyedLt', label: 'Dyed' },
  { key: 'dieselLt', label: 'Diesel' },
  { key: 'gasolineLt', label: 'Gasoline' }
];

/** Consumables ledger: item -> total qty used in range, drillable by job. */
export const buildConsumablesLedger = (entries) => {
  const items = new Map();

  entries.forEach((entry) => {
    (entry.consumables || []).forEach((item) => {
      if (!item.itemName || !item.qtyUsed) {
        return;
      }
      if (!items.has(item.itemName)) {
        items.set(item.itemName, { itemName: item.itemName, totalQtyUsed: 0, jobs: new Map() });
      }
      const record = items.get(item.itemName);
      record.totalQtyUsed = round2(record.totalQtyUsed + item.qtyUsed);

      const jobKey = entry.jobId?._id ? String(entry.jobId._id) : 'unknown';
      const prev = record.jobs.get(jobKey) || { jobId: jobKey, label: jobLabel(entry.jobId), qtyUsed: 0 };
      prev.qtyUsed = round2(prev.qtyUsed + item.qtyUsed);
      record.jobs.set(jobKey, prev);
    });
  });

  return [...items.values()]
    .map((record) => ({
      itemName: record.itemName,
      unit: CONSUMABLE_UNIT,
      totalQtyUsed: record.totalQtyUsed,
      jobs: [...record.jobs.values()].sort((a, b) => b.qtyUsed - a.qtyUsed)
    }))
    .sort((a, b) => a.itemName.localeCompare(b.itemName));
};

/** Fuel ledger: fuel type -> total litres used in range, drillable by job. */
export const buildFuelLedger = (entries) =>
  FUEL_TYPES.map(({ key, label }) => {
    const jobs = new Map();
    let totalLt = 0;

    entries.forEach((entry) => {
      const qty = entry.fuel?.[key];
      if (!qty) {
        return;
      }
      totalLt = round2(totalLt + qty);
      const jobKey = entry.jobId?._id ? String(entry.jobId._id) : 'unknown';
      const prev = jobs.get(jobKey) || { jobId: jobKey, label: jobLabel(entry.jobId), qtyLt: 0 };
      prev.qtyLt = round2(prev.qtyLt + qty);
      jobs.set(jobKey, prev);
    });

    return {
      type: label,
      totalLt,
      jobs: [...jobs.values()].sort((a, b) => b.qtyLt - a.qtyLt)
    };
  });

const groupEntriesByMonth = (entries) => {
  const months = new Map();

  entries.forEach((entry) => {
    const date = new Date(entry.date);
    const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
    if (!months.has(key)) {
      const from = startOfUtcMonth(date.getUTCFullYear(), date.getUTCMonth());
      months.set(key, {
        key,
        label: monthLabel(from),
        from,
        to: endOfUtcMonth(date.getUTCFullYear(), date.getUTCMonth()),
        entries: []
      });
    }
    months.get(key).entries.push(entry);
  });

  return [...months.values()].sort((a, b) => a.key.localeCompare(b.key));
};

export const buildConsumablesMonthlyBreakdown = (entries) =>
  groupEntriesByMonth(entries).map((month) => ({
    key: month.key,
    label: month.label,
    from: month.from,
    to: month.to,
    items: buildConsumablesLedger(month.entries).map((item) => ({
      itemName: item.itemName,
      qtyUsed: item.totalQtyUsed
    }))
  }));

export const buildFuelMonthlyBreakdown = (entries) =>
  groupEntriesByMonth(entries).map((month) => {
    const byType = buildFuelLedger(month.entries);
    return {
      key: month.key,
      label: month.label,
      from: month.from,
      to: month.to,
      totalLt: round2(byType.reduce((sum, type) => sum + type.totalLt, 0)),
      byType: byType.map((type) => ({ type: type.type, totalLt: type.totalLt }))
    };
  });

const crewShape = (crew = []) =>
  crew.map((member) => ({
    id: String(member.employeeId?._id || member.employeeId?.id || member.employeeId),
    name: member.employeeId?.name || null,
    employeeType: member.employeeId?.employeeType || null
  }));

const shiftStatus = (entry) => {
  if (!entry) {
    return 'missing';
  }
  return entry.status === 'submitted' ? 'submitted' : 'draft';
};

export const computeSchedulingRows = (jobs, entries) => {
  const rows = [];

  jobs.forEach((job) => {
    const jobId = job.id || String(job._id);
    const jobEntries = entries.filter((entry) => String(entry.jobId) === String(job._id));
    const base = {
      jobId,
      jobNumber: job.jobNumber,
      clientName: job.clientName,
      jobLocation: job.jobLocation || null,
      date: job.scheduledDate
    };

    const shifts = [...new Set((job.siteManagers || []).map((manager) => manager.shift))];

    if (shifts.length === 0) {
      const anyEntry = jobEntries[0];
      const status =
        jobEntries.length === 0
          ? 'missing'
          : jobEntries.every((entry) => entry.status === 'submitted')
            ? 'submitted'
            : 'draft';
      rows.push({
        ...base,
        key: `${jobId}-unassigned`,
        shift: null,
        manager: null,
        crew: crewShape(anyEntry?.crew),
        status
      });
      return;
    }

    shifts.forEach((shift) => {
      const manager = (job.siteManagers || []).find((entry) => entry.shift === shift);
      const entry = jobEntries.find((item) => item.shift === shift);
      rows.push({
        ...base,
        key: `${jobId}-${shift}`,
        shift,
        manager: manager?.userId
          ? {
              id: String(manager.userId?._id || manager.userId?.id || manager.userId),
              name: manager.userId?.name || null
            }
          : null,
        crew: crewShape(entry?.crew),
        status: shiftStatus(entry)
      });
    });
  });

  return rows;
};
