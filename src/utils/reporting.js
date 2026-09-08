import {
  entryMetersDrilled,
  entryMetersRecovered,
  entryRecoveryPercent,
  entryTotalHours
} from './timeLog.js';

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

export const DEFAULT_RECOVERY_THRESHOLD = 85;

export const computeRecoveryPercent = (entry) => entryRecoveryPercent(entry);

export const bonusEligibility = (recoveryPercent, threshold = DEFAULT_RECOVERY_THRESHOLD) => {
  if (recoveryPercent === null || recoveryPercent === undefined) {
    return 'not-available';
  }
  return recoveryPercent >= threshold ? 'eligible' : 'not-eligible';
};

export const computeUserBonus = (entries, employeeType, bonusConfig) => {
  const threshold = bonusConfig?.recoveryThreshold ?? DEFAULT_RECOVERY_THRESHOLD;

  const eligibleMeters = round2(
    entries.reduce((sum, entry) => {
      const recoveryPercent = computeRecoveryPercent(entry);
      if (recoveryPercent !== null && recoveryPercent >= threshold) {
        return sum + entryMetersDrilled(entry);
      }
      return sum;
    }, 0)
  );

  if (!employeeType) {
    return { eligibleMeters, amount: null, note: 'No employee type is set for this user' };
  }

  const table = (bonusConfig?.tierTables || []).find(
    (tier) => tier.employeeType === employeeType
  );
  const bands = [...(table?.bands || [])].sort((a, b) => a.fromMeters - b.fromMeters);

  if (bands.length === 0) {
    return {
      eligibleMeters,
      amount: null,
      note: `No bonus tier table is configured for ${employeeType}`
    };
  }

  if (eligibleMeters <= 0) {
    return { eligibleMeters: 0, amount: 0, note: 'No recovery-eligible meters in this period' };
  }

  let matched = bands.find(
    (band) => eligibleMeters >= band.fromMeters && eligibleMeters <= band.toMeters
  );
  let aboveTopBand = false;

  if (!matched) {
    const topBand = bands[bands.length - 1];
    if (eligibleMeters > topBand.toMeters) {
      matched = topBand;
      aboveTopBand = true;
    }
  }

  if (!matched) {
    return {
      eligibleMeters,
      amount: null,
      note: 'Eligible meters fall outside every configured band'
    };
  }

  const amount =
    matched.rateType === 'flat' ? matched.value : round2(eligibleMeters * matched.value);

  return {
    eligibleMeters,
    amount,
    rateType: matched.rateType,
    rate: matched.value,
    band: { fromMeters: matched.fromMeters, toMeters: matched.toMeters },
    aboveTopBand,
    note: aboveTopBand
      ? 'Eligible meters exceed the highest band; the top band was applied'
      : null
  };
};

export const computeSchedulingRows = (jobs, entries) =>
  jobs.map((job) => {
    const jobEntries = entries.filter((entry) => entry.jobId.equals(job._id));

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

export const buildTotals = (entries, threshold = DEFAULT_RECOVERY_THRESHOLD) => {
  const totals = {
    hoursOnSite: 0,
    standbyHours: 0,
    otherHours: 0,
    metersDrilled: 0,
    metersRecovered: 0,
    totalHours: 0
  };
  const consumableMap = new Map();
  const bonus = { eligible: 0, 'not-eligible': 0, 'not-available': 0 };

  entries.forEach((entry) => {
    totals.hoursOnSite += entry.hoursOnSite || 0;
    totals.standbyHours += entry.standbyHours || 0;
    totals.otherHours += entry.otherHours || 0;
    totals.metersDrilled += entryMetersDrilled(entry);
    totals.metersRecovered += entryMetersRecovered(entry) || 0;
    totals.totalHours += entryTotalHours(entry);

    (entry.consumables || []).forEach((item) => {
      if (!item.itemName) {
        return;
      }
      const current = consumableMap.get(item.itemName) || 0;
      consumableMap.set(item.itemName, current + (item.qtyUsed || 0));
    });

    bonus[bonusEligibility(computeRecoveryPercent(entry), threshold)] += 1;
  });

  return {
    entryCount: entries.length,
    totals: {
      hoursOnSite: round2(totals.hoursOnSite),
      standbyHours: round2(totals.standbyHours),
      otherHours: round2(totals.otherHours),
      totalLoggedHours: round2(totals.hoursOnSite + totals.standbyHours + totals.otherHours),
      metersDrilled: round2(totals.metersDrilled),
      metersRecovered: round2(totals.metersRecovered),
      totalHours: round2(totals.totalHours)
    },
    consumables: [...consumableMap.entries()]
      .map(([itemName, qtyUsed]) => ({ itemName, qtyUsed: round2(qtyUsed) }))
      .sort((a, b) => a.itemName.localeCompare(b.itemName)),
    bonusEligibility: bonus
  };
};

export const buildEntryBreakdown = (entries, threshold = DEFAULT_RECOVERY_THRESHOLD) =>
  entries.map((entry) => {
    const recoveryPercent = computeRecoveryPercent(entry);
    return {
      entryId: entry._id,
      date: entry.date,
      shift: entry.shift || null,
      jobId: entry.jobId?._id ? String(entry.jobId._id) : null,
      jobNumber: entry.jobId?.jobNumber || null,
      clientName: entry.jobId?.clientName || null,
      operator: entry.userId?.name || null,
      userId: entry.userId?._id ? String(entry.userId._id) : null,
      metersDrilled: entryMetersDrilled(entry),
      metersRecovered: entryMetersRecovered(entry),
      recoveryPercent,
      eligibility: bonusEligibility(recoveryPercent, threshold),
      totalHours: entryTotalHours(entry),
      totalLoggedHours: round2(
        (entry.hoursOnSite || 0) + (entry.standbyHours || 0) + (entry.otherHours || 0)
      ),
      hoursOnSite: entry.hoursOnSite ?? null,
      standbyHours: entry.standbyHours ?? null
    };
  });

export const buildReportData = (entries, bonusConfig, { groupBy } = {}) => {
  const threshold = bonusConfig?.recoveryThreshold ?? DEFAULT_RECOVERY_THRESHOLD;
  const base = buildTotals(entries, threshold);
  const userGroups = buildGroups(entries, 'user', threshold, bonusConfig);

  const bonusTotalAmount = round2(
    userGroups.reduce(
      (sum, group) => sum + (typeof group.bonus?.amount === 'number' ? group.bonus.amount : 0),
      0
    )
  );

  const recoveryPercentOverall =
    base.totals.metersDrilled > 0
      ? round2((base.totals.metersRecovered / base.totals.metersDrilled) * 100)
      : null;

  let groups;
  if (groupBy === 'user') {
    groups = userGroups;
  } else if (groupBy === 'job') {
    groups = buildGroups(entries, 'job', threshold, bonusConfig);
  }

  return {
    recoveryThreshold: threshold,
    entryCount: base.entryCount,
    totals: base.totals,
    consumables: base.consumables,
    bonusEligibility: base.bonusEligibility,
    recoveryPercentOverall,
    bonusTotalAmount,
    entries: buildEntryBreakdown(entries, threshold),
    groupBy: groupBy || null,
    groups
  };
};

export const buildGroups = (entries, groupBy, threshold, bonusConfig) => {
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
      groups.set(key, {
        key,
        label,
        employeeType: groupBy === 'user' ? source?.employeeType || null : null,
        entries: []
      });
    }
    groups.get(key).entries.push(entry);
  });

  return [...groups.values()]
    .map((group) => {
      const result = {
        key: group.key,
        label: group.label,
        ...buildTotals(group.entries, threshold)
      };
      if (groupBy === 'user') {
        result.employeeType = group.employeeType;
        result.bonus = computeUserBonus(group.entries, group.employeeType, bonusConfig);
      }
      return result;
    })
    .sort((a, b) => a.label.localeCompare(b.label));
};
