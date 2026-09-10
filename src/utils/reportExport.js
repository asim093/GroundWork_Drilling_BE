import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

const dateLabel = (value) => (value ? new Date(value).toISOString().slice(0, 10) : '');

const isBlank = (value) => value === null || value === undefined || value === '' || value === '—';

const formatNumber = (value) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return String(value);
  }
  return Number.isInteger(value)
    ? value.toLocaleString('en-US')
    : value.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
};

const num = (value) => (isBlank(value) ? '—' : value);

const pct = (value) => (isBlank(value) ? '—' : `${value}%`);

const pdfNum = (value) => (isBlank(value) ? '—' : formatNumber(value));

const pdfPct = (value) => (isBlank(value) ? '—' : `${formatNumber(value)}%`);

const pdfMoney = (value) => (isBlank(value) ? '$0' : `$${formatNumber(value)}`);

const ELIGIBILITY_LABEL = {
  eligible: 'Eligible',
  'not-eligible': 'Not eligible',
  'not-available': 'Not available'
};

const bonusText = (bonus) => {
  if (!bonus || typeof bonus.amount !== 'number' || !bonus.band) {
    return bonus?.note || 'Not available';
  }
  const rate =
    bonus.rateType === 'flat'
      ? `flat ${bonus.band.fromMeters}-${bonus.band.toMeters} m`
      : `$${bonus.rate}/m ${bonus.band.fromMeters}-${bonus.band.toMeters} m`;
  return `$${formatNumber(bonus.amount)} (${rate}${bonus.aboveTopBand ? ', above top band' : ''})`;
};

const kpiRows = (report) => [
  ['Total hours logged', num(report.totals.totalLoggedHours)],
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

const HEADER_FILL = 'FF1971C2';

const styleHeaderRow = (row) => {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
  row.alignment = { vertical: 'middle' };
  row.height = 18;
};

export const buildReportWorkbookBuffer = async (report, meta) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Groundwork Drilling';
  workbook.created = new Date();

  const summary = workbook.addWorksheet('Summary');
  summary.columns = [
    { header: 'Metric', key: 'metric', width: 26 },
    { header: 'Value', key: 'value', width: 26 }
  ];
  summary.addRow({ metric: 'Report scope', value: meta.scope });
  summary.addRow({ metric: 'Date range', value: `${dateLabel(meta.from)} to ${dateLabel(meta.to)}` });
  summary.addRow({});
  kpiRows(report).forEach(([metric, value]) => summary.addRow({ metric, value }));
  styleHeaderRow(summary.getRow(1));
  summary.views = [{ state: 'frozen', ySplit: 1 }];

  const consumables = workbook.addWorksheet('Consumables');
  consumables.columns = [
    { header: 'Item', key: 'item', width: 32 },
    { header: 'Total qty used', key: 'qty', width: 16 }
  ];
  report.consumables.forEach((item) => consumables.addRow({ item: item.itemName, qty: item.qtyUsed }));
  styleHeaderRow(consumables.getRow(1));
  consumables.views = [{ state: 'frozen', ySplit: 1 }];

  if (Array.isArray(report.groups) && report.groups.length) {
    const isUser = report.groupBy === 'user';
    const sheet = workbook.addWorksheet(isUser ? 'By user' : 'By job');
    sheet.columns = [
      { header: isUser ? 'Site manager' : 'Job', key: 'label', width: 30 },
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
        hours: group.totals.totalLoggedHours,
        drilled: group.totals.metersDrilled,
        recovered: group.totals.metersRecovered,
        eligible: group.bonusEligibility.eligible,
        notEligible: group.bonusEligibility['not-eligible'],
        notAvailable: group.bonusEligibility['not-available'],
        eligibleMeters: group.bonus?.eligibleMeters ?? 0,
        bonus: bonusText(group.bonus)
      });
    });
    styleHeaderRow(sheet.getRow(1));
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
  }

  const entries = workbook.addWorksheet('Entries');
  entries.columns = [
    { header: 'Date', key: 'date', width: 12 },
    { header: 'Shift', key: 'shift', width: 8 },
    { header: 'Job #', key: 'jobNumber', width: 14 },
    { header: 'Client', key: 'client', width: 20 },
    { header: 'Site manager', key: 'operator', width: 20 },
    { header: 'Hours', key: 'hours', width: 12 },
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
      hours: num(entry.totalLoggedHours),
      drilled: num(entry.metersDrilled),
      recovered: num(entry.metersRecovered),
      recovery: pct(entry.recoveryPercent),
      eligibility: ELIGIBILITY_LABEL[entry.eligibility] || entry.eligibility
    });
  });
  styleHeaderRow(entries.getRow(1));
  entries.views = [{ state: 'frozen', ySplit: 1 }];

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
};

const C = {
  brand: '#1971c2',
  blue: '#228be6',
  teal: '#0c8599',
  green: '#2f9e44',
  amber: '#f08c00',
  slate: '#868e96',
  heading: '#1a1b1e',
  body: '#343a40',
  muted: '#868e96',
  cardFill: '#f8f9fb',
  cardBorder: '#e9ecef',
  headerFill: '#1971c2',
  headerText: '#ffffff',
  zebra: '#f1f3f5',
  gridLine: '#e9ecef',
  subtitle: '#cfe2f8'
};

const ELIGIBILITY_COLOR = {
  Eligible: C.green,
  'Not eligible': C.amber,
  'Not available': C.slate
};

const contentWidth = (doc) => doc.page.width - doc.page.margins.left - doc.page.margins.right;

const contentBottom = (doc) => doc.page.height - doc.page.margins.bottom;

const drawSummary = (doc, report) => {
  const startX = doc.page.margins.left;
  const usableWidth = contentWidth(doc);
  const gap = 14;
  const heroW = Math.round(usableWidth * 0.46);
  const rightW = usableWidth - heroW - gap;
  const blockH = 104;
  const top = doc.y;

  doc.save();
  doc.roundedRect(startX, top, heroW, blockH, 7).fill(C.blue);
  doc.restore();
  doc
    .fillColor('#ffffff')
    .font('Helvetica-Bold')
    .fontSize(8)
    .text('Total bonus amount', startX + 16, top + 20, { width: heroW - 32, lineBreak: false });
  doc
    .font('Helvetica-Bold')
    .fontSize(24)
    .text(pdfMoney(report.bonusTotalAmount), startX + 16, top + 37, {
      width: heroW - 32,
      lineBreak: false
    });
  doc
    .font('Helvetica')
    .fontSize(7.5)
    .fillColor('#dce9f9')
    .text(
      `Across ${pdfNum(report.entryCount)} submitted ${
        report.entryCount === 1 ? 'entry' : 'entries'
      }`,
      startX + 16,
      top + 74,
      { width: heroW - 32, lineBreak: false }
    );

  const mediumH = (blockH - gap) / 2;
  const mediums = [
    {
      label: 'Overall recovery',
      value: pdfPct(report.recoveryPercentOverall),
      sub: `Bonus threshold ${pdfPct(report.recoveryThreshold)}`
    },
    {
      label: 'Total hours logged',
      value: pdfNum(report.totals.totalLoggedHours),
      sub: 'On-site, standby and other'
    }
  ];
  mediums.forEach((medium, index) => {
    const mx = startX + heroW + gap;
    const my = top + index * (mediumH + gap);
    doc.save();
    doc.roundedRect(mx, my, rightW, mediumH, 6).fillAndStroke(C.cardFill, C.cardBorder);
    doc.restore();
    doc
      .fillColor(C.muted)
      .font('Helvetica-Bold')
      .fontSize(7)
      .text(medium.label, mx + 12, my + 10, { width: rightW - 24, lineBreak: false });
    doc
      .fillColor(C.heading)
      .font('Helvetica-Bold')
      .fontSize(13)
      .text(medium.value, mx + 12, my + 21, { width: rightW - 24, lineBreak: false });
    doc
      .fillColor(C.muted)
      .font('Helvetica')
      .fontSize(6.5)
      .text(medium.sub, mx + 12, my + 38, { width: rightW - 24, lineBreak: false });
  });

  doc.fillColor('#000000');

  const listRows = [
    ['Total drilled', `${pdfNum(report.totals.metersDrilled)} m`],
    ['Total recovered', `${pdfNum(report.totals.metersRecovered)} m`],
    ['Bonus-eligible shifts', pdfNum(report.bonusEligibility.eligible)],
    ['Not-eligible shifts', pdfNum(report.bonusEligibility['not-eligible'])],
    ['Not-available shifts', pdfNum(report.bonusEligibility['not-available'])],
    ['Submitted entries', pdfNum(report.entryCount)]
  ];
  const listTop = top + blockH + 14;
  const listRowH = 18;
  const listH = listRowH * listRows.length;
  doc.save();
  doc
    .roundedRect(startX, listTop, usableWidth, listH, 6)
    .strokeColor(C.cardBorder)
    .lineWidth(1)
    .stroke();
  doc.restore();
  listRows.forEach(([label, value], index) => {
    const ry = listTop + index * listRowH;
    if (index > 0) {
      doc
        .save()
        .moveTo(startX + 12, ry)
        .lineTo(startX + usableWidth - 12, ry)
        .strokeColor(C.gridLine)
        .lineWidth(0.5)
        .stroke()
        .restore();
    }
    doc
      .fillColor(C.body)
      .font('Helvetica')
      .fontSize(8.5)
      .text(label, startX + 14, ry + 5.5, { width: usableWidth / 2, lineBreak: false });
    doc
      .fillColor(C.heading)
      .font('Helvetica-Bold')
      .fontSize(8.5)
      .text(String(value), startX + usableWidth / 2, ry + 5.5, {
        width: usableWidth / 2 - 14,
        align: 'right',
        lineBreak: false
      });
  });

  doc.fillColor('#000000');
  doc.y = listTop + listH + 8;
};

const decodeChartImage = (dataUrl) => {
  const match = /^data:image\/png;base64,(.+)$/.exec(String(dataUrl || ''));
  if (!match) {
    return null;
  }
  try {
    return Buffer.from(match[1], 'base64');
  } catch {
    return null;
  }
};

const pngSize = (buffer) => {
  if (buffer.length > 24 && buffer.toString('ascii', 1, 4) === 'PNG') {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }
  return null;
};

const drawCharts = (doc, charts) => {
  const startX = doc.page.margins.left;
  const usableWidth = contentWidth(doc);
  const gap = 18;
  const cap = 200;
  const colWidth = Math.floor((usableWidth - gap) / 2);

  const slots = [
    { chart: charts[0], x: startX, width: colWidth },
    { chart: charts[1], x: startX + colWidth + gap, width: colWidth }
  ].filter((slot) => slot.chart);

  if (!slots.length) {
    return;
  }

  if (doc.y + cap + 34 > contentBottom(doc)) {
    doc.addPage();
  }

  const titleTop = doc.y;
  slots.forEach((slot) => {
    doc
      .fillColor(C.heading)
      .font('Helvetica-Bold')
      .fontSize(9)
      .text(slot.chart.title || 'Chart', slot.x, titleTop, {
        width: slot.width,
        lineBreak: false,
        ellipsis: true
      });
  });

  const imageTop = titleTop + 15;
  let rowHeight = 0;

  slots.forEach((slot) => {
    const buffer = decodeChartImage(slot.chart.dataUrl);
    if (!buffer) {
      return;
    }
    const size = pngSize(buffer);
    const drawHeight = size
      ? Math.min(cap, Math.round((slot.width * size.height) / size.width))
      : cap;
    rowHeight = Math.max(rowHeight, drawHeight);
    try {
      doc.image(buffer, slot.x, imageTop, { fit: [slot.width, cap], align: 'center', valign: 'top' });
    } catch {
      doc
        .fillColor(C.muted)
        .font('Helvetica-Oblique')
        .fontSize(8)
        .text('Chart image could not be rendered.', slot.x, imageTop, { width: slot.width });
      rowHeight = Math.max(rowHeight, 14);
    }
  });

  doc.y = imageTop + Math.max(rowHeight, 60) + 10;
  doc.fillColor('#000000');
};

const drawTable = (doc, columns, rows) => {
  const startX = doc.page.margins.left;
  const usableWidth = contentWidth(doc);
  const totalWeight = columns.reduce((sum, col) => sum + col.weight, 0);
  const widths = columns.map((col) => (col.weight / totalWeight) * usableWidth);
  const padX = 6;
  const rowPad = 6;

  const measure = (values) => {
    doc.font('Helvetica').fontSize(8);
    let height = 0;
    values.forEach((value, index) => {
      height = Math.max(
        height,
        doc.heightOfString(String(value), { width: widths[index] - padX * 2 })
      );
    });
    return height + rowPad * 2;
  };

  const drawHeader = () => {
    const height = 22;
    const y = doc.y;
    doc.save().rect(startX, y, usableWidth, height).fill(C.headerFill).restore();
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor(C.headerText);
    let x = startX;
    columns.forEach((col, index) => {
      doc.text(String(col.header), x + padX, y + 7.5, {
        width: widths[index] - padX * 2,
        align: col.align || 'left',
        lineBreak: false,
        ellipsis: true
      });
      x += widths[index];
    });
    doc.fillColor('#000000');
    doc.y = y + height;
  };

  const firstRowHeight = rows.length ? measure(rows[0]) : 24;
  if (doc.y + 22 + firstRowHeight > contentBottom(doc) - 24) {
    doc.addPage();
  }
  drawHeader();

  rows.forEach((values, rowIndex) => {
    const height = measure(values);
    if (doc.y + height > contentBottom(doc) - 24) {
      doc.addPage();
      drawHeader();
    }
    const y = doc.y;
    if (rowIndex % 2 === 1) {
      doc.save().rect(startX, y, usableWidth, height).fill(C.zebra).restore();
    }
    let x = startX;
    values.forEach((value, index) => {
      const col = columns[index];
      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor(col.color ? col.color(String(value)) : C.body)
        .text(String(value), x + padX, y + rowPad, {
          width: widths[index] - padX * 2,
          align: col.align || 'left'
        });
      x += widths[index];
    });
    doc.fillColor('#000000');
    doc.y = y + height;
    doc
      .save()
      .moveTo(startX, doc.y)
      .lineTo(startX + usableWidth, doc.y)
      .strokeColor(C.gridLine)
      .lineWidth(0.5)
      .stroke()
      .restore();
  });

  doc.moveDown(1.2);
};

const sectionTitle = (doc, text, reserve = 48) => {
  if (doc.y + reserve > contentBottom(doc)) {
    doc.addPage();
  }
  const startX = doc.page.margins.left;
  const usableWidth = contentWidth(doc);
  doc.moveDown(0.4);
  doc.font('Helvetica-Bold').fontSize(11).fillColor(C.heading).text(text, startX, doc.y);
  doc.moveDown(0.25);
  doc
    .save()
    .moveTo(startX, doc.y)
    .lineTo(startX + usableWidth, doc.y)
    .strokeColor(C.gridLine)
    .lineWidth(1)
    .stroke()
    .restore();
  doc.moveDown(0.5);
  doc.fillColor('#000000');
};

const emptyNote = (doc, text) => {
  doc.font('Helvetica-Oblique').fontSize(9).fillColor(C.muted).text(text);
  doc.fillColor('#000000');
  doc.moveDown(0.6);
};

const drawHeaderBand = (doc, meta) => {
  const bandHeight = 66;
  const startX = doc.page.margins.left;
  doc.save().rect(0, 0, doc.page.width, bandHeight).fill(C.brand).restore();
  doc
    .fillColor('#ffffff')
    .font('Helvetica-Bold')
    .fontSize(16)
    .text(meta.title, startX, 16, { lineBreak: false });
  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor(C.subtitle)
    .text(
      `${meta.scope}     ${dateLabel(meta.from)} – ${dateLabel(meta.to)}`,
      startX,
      40,
      { lineBreak: false }
    );
  doc.fillColor('#000000');
  doc.x = startX;
  doc.y = bandHeight + 22;
};

const drawFooters = (doc, generatedLabel) => {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i += 1) {
    doc.switchToPage(i);
    doc.page.margins.bottom = 0;
    const startX = doc.page.margins.left;
    const usableWidth = contentWidth(doc);
    const y = doc.page.height - 26;
    doc
      .save()
      .moveTo(startX, y - 6)
      .lineTo(startX + usableWidth, y - 6)
      .strokeColor(C.gridLine)
      .lineWidth(0.5)
      .stroke()
      .restore();
    doc.font('Helvetica').fontSize(7.5).fillColor(C.muted);
    doc.text(`Groundwork Drilling  ·  Generated ${generatedLabel}`, startX, y, {
      width: usableWidth,
      align: 'left',
      lineBreak: false
    });
    doc.text(`Page ${i - range.start + 1} of ${range.count}`, startX, y, {
      width: usableWidth,
      align: 'right',
      lineBreak: false
    });
    doc.fillColor('#000000');
  }
};

export const buildReportPdfBuffer = (report, meta) =>
  new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const generatedLabel = `${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`;

    drawHeaderBand(doc, meta);

    sectionTitle(doc, 'Summary');
    drawSummary(doc, report);

    if (Array.isArray(meta.charts) && meta.charts.length) {
      sectionTitle(doc, 'Charts');
      drawCharts(doc, meta.charts);
    }

    sectionTitle(doc, 'Consumables used', 110);
    if (report.consumables.length) {
      drawTable(
        doc,
        [
          { header: 'Item', weight: 3 },
          { header: 'Total qty used', weight: 1, align: 'right' }
        ],
        report.consumables.map((item) => [item.itemName, pdfNum(item.qtyUsed)])
      );
    } else {
      emptyNote(doc, 'No consumables recorded in this period.');
    }

    if (Array.isArray(report.groups) && report.groups.length) {
      const isUser = report.groupBy === 'user';
      sectionTitle(doc, isUser ? 'Breakdown by user' : 'Breakdown by job', 110);
      const columns = [
        { header: isUser ? 'Site manager' : 'Job', weight: 2.6 },
        ...(isUser ? [{ header: 'Type', weight: 1.3 }] : []),
        { header: 'Ent.', weight: 0.85, align: 'right' },
        { header: 'Hrs', weight: 0.85, align: 'right' },
        { header: 'Drilled', weight: 1.15, align: 'right' },
        { header: 'Recov.', weight: 1.15, align: 'right' },
        { header: 'Elig.', weight: 0.9, align: 'right' },
        ...(isUser
          ? [
              { header: 'Elig. m', weight: 1.2, align: 'right' },
              { header: 'Bonus', weight: 2.6 }
            ]
          : [])
      ];
      const bodyRows = report.groups.map((group) => [
        group.label,
        ...(isUser ? [group.employeeType || '—'] : []),
        pdfNum(group.entryCount),
        pdfNum(group.totals.totalLoggedHours),
        pdfNum(group.totals.metersDrilled),
        pdfNum(group.totals.metersRecovered),
        pdfNum(group.bonusEligibility.eligible),
        ...(isUser ? [pdfNum(group.bonus?.eligibleMeters ?? 0), bonusText(group.bonus)] : [])
      ]);
      drawTable(doc, columns, bodyRows);
    }

    sectionTitle(doc, 'Submitted entries', 110);
    if (report.entries.length) {
      drawTable(
        doc,
        [
          { header: 'Date', weight: 1.4 },
          { header: 'Job #', weight: 1.6 },
          { header: 'Site manager', weight: 2.2 },
          { header: 'Hours', weight: 1, align: 'right' },
          { header: 'Drilled', weight: 1.1, align: 'right' },
          { header: 'Recov.', weight: 1.1, align: 'right' },
          { header: 'Rec. %', weight: 1.1, align: 'right' },
          {
            header: 'Eligibility',
            weight: 1.6,
            color: (value) => ELIGIBILITY_COLOR[value] || C.body
          }
        ],
        report.entries.map((entry) => [
          dateLabel(entry.date),
          entry.jobNumber || '—',
          entry.operator || '—',
          pdfNum(entry.totalLoggedHours),
          pdfNum(entry.metersDrilled),
          pdfNum(entry.metersRecovered),
          pdfPct(entry.recoveryPercent),
          ELIGIBILITY_LABEL[entry.eligibility] || entry.eligibility
        ])
      );
    } else {
      emptyNote(doc, 'No submitted entries in this period.');
    }

    drawFooters(doc, generatedLabel);

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
