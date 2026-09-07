import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

const dateLabel = (value) => (value ? new Date(value).toISOString().slice(0, 10) : '');

const num = (value) => (value === null || value === undefined ? '—' : value);

const pct = (value) => (value === null || value === undefined ? '—' : `${value}%`);

const ELIGIBILITY_LABEL = {
  eligible: 'Eligible',
  'not-eligible': 'Not eligible',
  'not-available': 'Not available'
};

const bonusText = (bonus) => {
  if (!bonus || typeof bonus.amount !== 'number') {
    return bonus?.note || 'Not available';
  }
  const rate =
    bonus.rateType === 'flat'
      ? `flat ${bonus.band.fromMeters}-${bonus.band.toMeters} m`
      : `$${bonus.rate}/m ${bonus.band.fromMeters}-${bonus.band.toMeters} m`;
  return `$${bonus.amount} (${rate}${bonus.aboveTopBand ? ', above top band' : ''})`;
};

const kpiRows = (report) => [
  ['Total hours', num(report.totals.totalHours)],
  ['Total drilled (m)', num(report.totals.metersDrilled)],
  ['Total recovered (m)', num(report.totals.metersRecovered)],
  ['Overall recovery %', pct(report.recoveryPercentOverall)],
  ['Bonus-eligible shifts', num(report.bonusEligibility.eligible)],
  ['Not-eligible shifts', num(report.bonusEligibility['not-eligible'])],
  ['Not-available shifts', num(report.bonusEligibility['not-available'])],
  ['Total bonus amount', `$${num(report.bonusTotalAmount)}`],
  ['Submitted entries', num(report.entryCount)],
  ['Recovery threshold', pct(report.recoveryThreshold)]
];

export const buildReportWorkbookBuffer = async (report, meta) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Groundwork Drilling';
  workbook.created = new Date();

  const summary = workbook.addWorksheet('Summary');
  summary.columns = [
    { header: 'Metric', key: 'metric', width: 26 },
    { header: 'Value', key: 'value', width: 24 }
  ];
  summary.addRow({ metric: 'Report scope', value: meta.scope });
  summary.addRow({ metric: 'Date range', value: `${dateLabel(meta.from)} to ${dateLabel(meta.to)}` });
  summary.addRow({});
  kpiRows(report).forEach(([metric, value]) => summary.addRow({ metric, value }));
  summary.getRow(1).font = { bold: true };

  const consumables = workbook.addWorksheet('Consumables');
  consumables.columns = [
    { header: 'Item', key: 'item', width: 32 },
    { header: 'Total qty used', key: 'qty', width: 16 }
  ];
  report.consumables.forEach((item) => consumables.addRow({ item: item.itemName, qty: item.qtyUsed }));
  consumables.getRow(1).font = { bold: true };

  if (Array.isArray(report.groups) && report.groups.length) {
    const isUser = report.groupBy === 'user';
    const sheet = workbook.addWorksheet(isUser ? 'By user' : 'By job');
    sheet.columns = [
      { header: isUser ? 'Operator' : 'Job', key: 'label', width: 30 },
      ...(isUser ? [{ header: 'Employee type', key: 'employeeType', width: 18 }] : []),
      { header: 'Entries', key: 'entries', width: 10 },
      { header: 'Hours', key: 'hours', width: 10 },
      { header: 'Drilled (m)', key: 'drilled', width: 12 },
      { header: 'Recovered (m)', key: 'recovered', width: 14 },
      { header: 'Eligible', key: 'eligible', width: 10 },
      { header: 'Not eligible', key: 'notEligible', width: 12 },
      { header: 'Not available', key: 'notAvailable', width: 13 },
      ...(isUser
        ? [
            { header: 'Eligible meters', key: 'eligibleMeters', width: 15 },
            { header: 'Bonus', key: 'bonus', width: 34 }
          ]
        : [])
    ];
    report.groups.forEach((group) => {
      sheet.addRow({
        label: group.label,
        employeeType: group.employeeType || '—',
        entries: group.entryCount,
        hours: group.totals.totalHours,
        drilled: group.totals.metersDrilled,
        recovered: group.totals.metersRecovered,
        eligible: group.bonusEligibility.eligible,
        notEligible: group.bonusEligibility['not-eligible'],
        notAvailable: group.bonusEligibility['not-available'],
        eligibleMeters: group.bonus?.eligibleMeters ?? 0,
        bonus: bonusText(group.bonus)
      });
    });
    sheet.getRow(1).font = { bold: true };
  }

  const entries = workbook.addWorksheet('Entries');
  entries.columns = [
    { header: 'Date', key: 'date', width: 12 },
    { header: 'Shift', key: 'shift', width: 8 },
    { header: 'Job #', key: 'jobNumber', width: 14 },
    { header: 'Client', key: 'client', width: 20 },
    { header: 'Operator', key: 'operator', width: 20 },
    { header: 'Hours (calc)', key: 'hours', width: 12 },
    { header: 'Drilled (m)', key: 'drilled', width: 12 },
    { header: 'Recovered (m)', key: 'recovered', width: 14 },
    { header: 'Recovery %', key: 'recovery', width: 12 },
    { header: 'Eligibility', key: 'eligibility', width: 14 }
  ];
  report.entries.forEach((entry) => {
    entries.addRow({
      date: dateLabel(entry.date),
      shift: entry.shift || '—',
      jobNumber: entry.jobNumber || '—',
      client: entry.clientName || '—',
      operator: entry.operator || '—',
      hours: num(entry.totalHours),
      drilled: num(entry.metersDrilled),
      recovered: num(entry.metersRecovered),
      recovery: pct(entry.recoveryPercent),
      eligibility: ELIGIBILITY_LABEL[entry.eligibility] || entry.eligibility
    });
  });
  entries.getRow(1).font = { bold: true };

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
};

const drawTable = (doc, columns, rows) => {
  const startX = doc.page.margins.left;
  const usableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const totalWeight = columns.reduce((sum, col) => sum + col.weight, 0);
  const widths = columns.map((col) => (col.weight / totalWeight) * usableWidth);

  const writeRow = (values, bold) => {
    const y = doc.y;
    let heights = 0;
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8);
    let x = startX;
    values.forEach((value, index) => {
      const h = doc.heightOfString(String(value), { width: widths[index] - 4 });
      heights = Math.max(heights, h);
      doc.text(String(value), x + 2, y, { width: widths[index] - 4 });
      x += widths[index];
    });
    doc.y = y + heights + 4;
    doc
      .moveTo(startX, doc.y - 2)
      .lineTo(startX + usableWidth, doc.y - 2)
      .strokeColor('#dddddd')
      .lineWidth(0.5)
      .stroke();
  };

  writeRow(columns.map((col) => col.header), true);
  rows.forEach((row) => {
    if (doc.y > doc.page.height - doc.page.margins.bottom - 24) {
      doc.addPage();
    }
    writeRow(row, false);
  });
  doc.moveDown(1);
};

const sectionTitle = (doc, text) => {
  if (doc.y > doc.page.height - doc.page.margins.bottom - 60) {
    doc.addPage();
  }
  doc.moveDown(0.5).font('Helvetica-Bold').fontSize(12).fillColor('#111111').text(text);
  doc.moveDown(0.3).fillColor('#000000');
};

export const buildReportPdfBuffer = (report, meta) =>
  new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.font('Helvetica-Bold').fontSize(18).text(meta.title);
    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor('#555555')
      .text(meta.scope)
      .text(`${dateLabel(meta.from)} to ${dateLabel(meta.to)}`)
      .fillColor('#000000');
    doc.moveDown(0.5);

    sectionTitle(doc, 'Summary');
    kpiRows(report).forEach(([metric, value]) => {
      doc.font('Helvetica').fontSize(10).text(`${metric}: `, { continued: true });
      doc.font('Helvetica-Bold').text(String(value));
    });

    sectionTitle(doc, 'Consumables used');
    if (report.consumables.length) {
      drawTable(
        doc,
        [
          { header: 'Item', weight: 3 },
          { header: 'Total qty used', weight: 1 }
        ],
        report.consumables.map((item) => [item.itemName, item.qtyUsed])
      );
    } else {
      doc.font('Helvetica').fontSize(10).text('No consumables recorded in this period.');
    }

    if (Array.isArray(report.groups) && report.groups.length) {
      const isUser = report.groupBy === 'user';
      sectionTitle(doc, isUser ? 'Breakdown by user' : 'Breakdown by job');
      const columns = [
        { header: isUser ? 'Operator' : 'Job', weight: 3 },
        ...(isUser ? [{ header: 'Type', weight: 1.6 }] : []),
        { header: 'Entries', weight: 1 },
        { header: 'Hours', weight: 1 },
        { header: 'Drilled', weight: 1.2 },
        { header: 'Recov.', weight: 1.2 },
        { header: 'Elig.', weight: 0.9 },
        ...(isUser ? [{ header: 'Elig. m', weight: 1.3 }, { header: 'Bonus', weight: 3 }] : [])
      ];
      const bodyRows = report.groups.map((group) => [
        group.label,
        ...(isUser ? [group.employeeType || '—'] : []),
        group.entryCount,
        group.totals.totalHours,
        group.totals.metersDrilled,
        group.totals.metersRecovered,
        group.bonusEligibility.eligible,
        ...(isUser ? [group.bonus?.eligibleMeters ?? 0, bonusText(group.bonus)] : [])
      ]);
      drawTable(doc, columns, bodyRows);
    }

    sectionTitle(doc, 'Submitted entries');
    if (report.entries.length) {
      drawTable(
        doc,
        [
          { header: 'Date', weight: 1.4 },
          { header: 'Job #', weight: 1.6 },
          { header: 'Operator', weight: 2.2 },
          { header: 'Hours', weight: 1 },
          { header: 'Drilled', weight: 1.1 },
          { header: 'Recov.', weight: 1.1 },
          { header: 'Rec. %', weight: 1.1 },
          { header: 'Eligibility', weight: 1.6 }
        ],
        report.entries.map((entry) => [
          dateLabel(entry.date),
          entry.jobNumber || '—',
          entry.operator || '—',
          num(entry.totalHours),
          num(entry.metersDrilled),
          num(entry.metersRecovered),
          pct(entry.recoveryPercent),
          ELIGIBILITY_LABEL[entry.eligibility] || entry.eligibility
        ])
      );
    } else {
      doc.font('Helvetica').fontSize(10).text('No submitted entries in this period.');
    }

    doc.end();
  });

export const exportFilename = (base, format, meta) => {
  const range = `${dateLabel(meta.from)}_${dateLabel(meta.to)}`;
  return `${base}-${range}.${format === 'pdf' ? 'pdf' : 'xlsx'}`;
};

export const EXPORT_CONTENT_TYPES = {
  pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
};
