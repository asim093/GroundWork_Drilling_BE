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

export const bonusEligibility = (recoveryPercent) => {
  if (recoveryPercent === null || recoveryPercent === undefined) {
    return 'not-available';
  }
  return recoveryPercent >= 85 ? 'eligible' : 'not-eligible';
};

export const computeSchedulingRows = (jobs, entries) =>
  jobs.map((job) => {
    const scheduledKey = dayKey(job.scheduledDate);
    const jobEntries = entries.filter(
      (entry) => entry.jobId.equals(job._id) && dayKey(entry.date) === scheduledKey
    );

    const operators = job.assignedUserIds.map((operator) => {
      const operatorEntries = jobEntries.filter((entry) => entry.userId.equals(operator._id));
      const operatorStatus = operatorEntries.some((entry) => entry.status === 'submitted')
        ? 'submitted'
        : operatorEntries.length > 0
          ? 'draft'
          : 'missing';
      return { id: operator.id, name: operator.name, status: operatorStatus };
    });

    let status;
    if (jobEntries.length === 0) {
      status = 'missing';
    } else if (
      operators.length > 0
        ? operators.every((operator) => operator.status === 'submitted')
        : jobEntries.every((entry) => entry.status === 'submitted')
    ) {
      status = 'submitted';
    } else {
      status = 'draft';
    }

    return {
      jobId: job.id,
      jobNumber: job.jobNumber,
      clientName: job.clientName,
      jobLocation: job.jobLocation || null,
      date: job.scheduledDate,
      operators,
      status
    };
  });

export const buildTotals = (entries) => {
  const totals = { hoursOnSite: 0, standbyHours: 0, otherHours: 0 };
  const consumableMap = new Map();
  const bonus = { eligible: 0, 'not-eligible': 0, 'not-available': 0 };

  entries.forEach((entry) => {
    totals.hoursOnSite += entry.hoursOnSite || 0;
    totals.standbyHours += entry.standbyHours || 0;
    totals.otherHours += entry.otherHours || 0;

    (entry.consumables || []).forEach((item) => {
      if (!item.itemName) {
        return;
      }
      const current = consumableMap.get(item.itemName) || 0;
      consumableMap.set(item.itemName, current + (item.qtyUsed || 0));
    });

    bonus[bonusEligibility(entry.recoveryPercent)] += 1;
  });

  return {
    entryCount: entries.length,
    totals: {
      hoursOnSite: round2(totals.hoursOnSite),
      standbyHours: round2(totals.standbyHours),
      otherHours: round2(totals.otherHours)
    },
    consumables: [...consumableMap.entries()]
      .map(([itemName, qtyUsed]) => ({ itemName, qtyUsed: round2(qtyUsed) }))
      .sort((a, b) => a.itemName.localeCompare(b.itemName)),
    bonusEligibility: bonus
  };
};

export const buildEntryBreakdown = (entries) =>
  entries.map((entry) => ({
    entryId: entry._id,
    date: entry.date,
    jobNumber: entry.jobId?.jobNumber || null,
    clientName: entry.jobId?.clientName || null,
    operator: entry.userId?.name || null,
    recoveryPercent: entry.recoveryPercent ?? null,
    eligibility: bonusEligibility(entry.recoveryPercent),
    hoursOnSite: entry.hoursOnSite ?? null,
    standbyHours: entry.standbyHours ?? null
  }));

export const buildGroups = (entries, groupBy) => {
  const groups = new Map();

  entries.forEach((entry) => {
    const source = groupBy === 'user' ? entry.userId : entry.jobId;
    const key = source?._id ? source._id.toString() : 'unknown';
    const label =
      groupBy === 'user'
        ? source?.name || 'Unknown operator'
        : source
          ? `${source.jobNumber} — ${source.clientName}`
          : 'Unknown job';

    if (!groups.has(key)) {
      groups.set(key, { key, label, entries: [] });
    }
    groups.get(key).entries.push(entry);
  });

  return [...groups.values()]
    .map((group) => ({ key: group.key, label: group.label, ...buildTotals(group.entries) }))
    .sort((a, b) => a.label.localeCompare(b.label));
};
