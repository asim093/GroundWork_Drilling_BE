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

const pdfNum = (value) => (isBlank(value) ? '—' : formatNumber(value));

const HEADER_FILL = 'FF1971C2';

const styleHeaderRow = (row) => {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
  row.alignment = { vertical: 'middle' };
  row.height = 18;
};

const C = {
  brand: '#1971c2',
  heading: '#1a1b1e',
  body: '#343a40',
  muted: '#868e96',
  cardBorder: '#e9ecef',
  headerFill: '#1971c2',
  headerText: '#ffffff',
  zebra: '#f1f3f5',
  gridLine: '#e9ecef',
  subtitle: '#cfe2f8'
};

const contentWidth = (doc) => doc.page.width - doc.page.margins.left - doc.page.margins.right;
const contentBottom = (doc) => doc.page.height - doc.page.margins.bottom;

const drawHeaderBand = (doc, meta) => {
  const bandHeight = 66;
  const startX = doc.page.margins.left;
  doc.save().rect(0, 0, doc.page.width, bandHeight).fill(C.brand).restore();
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(16).text(meta.title, startX, 16, { lineBreak: false });
  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor(C.subtitle)
    .text(`${dateLabel(meta.from)} – ${dateLabel(meta.to)}`, startX, 40, { lineBreak: false });
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
      height = Math.max(height, doc.heightOfString(String(value), { width: widths[index] - padX * 2 }));
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
      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor(C.body)
        .text(String(value), x + padX, y + rowPad, { width: widths[index] - padX * 2, align: columns[index].align || 'left' });
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

const startDoc = () => {
  const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true });
  const chunks = [];
  doc.on('data', (chunk) => chunks.push(chunk));
  const promise = new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
  return { doc, promise };
};

const generatedLabel = () => `${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`;

// ---------- Hours report ----------

export const buildHoursReportWorkbookBuffer = async (report, meta) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Groundwork Drilling';
  workbook.created = new Date();

  if (report.scope === 'employee') {
    const sheet = workbook.addWorksheet('By employee');
    sheet.columns = [
      { header: 'Employee', key: 'name', width: 26 },
      { header: 'Type', key: 'employeeType', width: 18 },
      { header: 'Days worked', key: 'days', width: 12 },
      { header: 'Total paid hours', key: 'hours', width: 16 }
    ];
    (report.employees || []).forEach((employee) =>
      sheet.addRow({
        name: employee.name,
        employeeType: employee.employeeType || '—',
        days: employee.days.length,
        hours: employee.totalHours
      })
    );
    styleHeaderRow(sheet.getRow(1));

    const daily = workbook.addWorksheet('Daily entries');
    daily.columns = [
      { header: 'Employee', key: 'name', width: 26 },
      { header: 'Date', key: 'date', width: 12 },
      { header: 'Job #', key: 'jobNumber', width: 14 },
      { header: 'Client', key: 'client', width: 20 },
      { header: 'Time in', key: 'timeIn', width: 10 },
      { header: 'Time out', key: 'timeOut', width: 10 },
      { header: 'Hours', key: 'hours', width: 10 }
    ];
    (report.employees || []).forEach((employee) => {
      employee.days.forEach((day) => {
        daily.addRow({
          name: employee.name,
          date: dateLabel(day.date),
          jobNumber: day.jobNumber || '—',
          client: day.clientName || '—',
          timeIn: day.timeIn || '—',
          timeOut: day.timeOut || '—',
          hours: day.hours
        });
      });
    });
    styleHeaderRow(daily.getRow(1));
  } else if (report.scope === 'manager') {
    const sheet = workbook.addWorksheet('By manager');
    sheet.columns = [
      { header: 'Manager', key: 'name', width: 26 },
      { header: 'Days worked', key: 'days', width: 12 },
      { header: 'Total paid hours', key: 'hours', width: 16 }
    ];
    (report.managers || []).forEach((manager) =>
      sheet.addRow({ name: manager.name, days: manager.days.length, hours: manager.totalHours })
    );
    styleHeaderRow(sheet.getRow(1));
  } else {
    const sheet = workbook.addWorksheet('By client');
    sheet.columns = [
      { header: 'Job #', key: 'jobNumber', width: 16 },
      { header: 'Client', key: 'client', width: 24 },
      { header: 'Shifts', key: 'entries', width: 10 },
      { header: 'Billable hours', key: 'billable', width: 16 },
      { header: 'Paid hours', key: 'paid', width: 14 }
    ];
    (report.jobs || []).forEach((job) =>
      sheet.addRow({
        jobNumber: job.jobNumber || '—',
        client: job.clientName || '—',
        entries: job.entryCount,
        billable: job.billableHours,
        paid: job.paidHours
      })
    );
    sheet.addRow({});
    sheet.addRow({
      jobNumber: 'Total',
      client: '',
      entries: '',
      billable: report.totals?.billableHours ?? 0,
      paid: report.totals?.paidHours ?? 0
    });
    styleHeaderRow(sheet.getRow(1));
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
};

export const buildHoursReportPdfBuffer = (report, meta) => {
  const { doc, promise } = startDoc();
  drawHeaderBand(doc, meta);

  if (report.scope === 'employee') {
    sectionTitle(doc, 'Hours by employee');
    if ((report.employees || []).length) {
      drawTable(
        doc,
        [
          { header: 'Employee', weight: 2.4 },
          { header: 'Type', weight: 1.4 },
          { header: 'Days', weight: 0.8, align: 'right' },
          { header: 'Paid hours', weight: 1.2, align: 'right' }
        ],
        report.employees.map((employee) => [
          employee.name,
          employee.employeeType || '—',
          pdfNum(employee.days.length),
          pdfNum(employee.totalHours)
        ])
      );
    } else {
      emptyNote(doc, 'No submitted entries in this period.');
    }
  } else if (report.scope === 'manager') {
    sectionTitle(doc, 'Hours by manager');
    if ((report.managers || []).length) {
      drawTable(
        doc,
        [
          { header: 'Manager', weight: 2.4 },
          { header: 'Days', weight: 0.8, align: 'right' },
          { header: 'Paid hours', weight: 1.2, align: 'right' }
        ],
        report.managers.map((manager) => [manager.name, pdfNum(manager.days.length), pdfNum(manager.totalHours)])
      );
    } else {
      emptyNote(doc, 'No submitted entries in this period.');
    }
  } else {
    sectionTitle(doc, 'Hours by client / job');
    if ((report.jobs || []).length) {
      drawTable(
        doc,
        [
          { header: 'Job #', weight: 1.4 },
          { header: 'Client', weight: 2 },
          { header: 'Shifts', weight: 0.9, align: 'right' },
          { header: 'Billable hrs', weight: 1.2, align: 'right' },
          { header: 'Paid hrs', weight: 1.2, align: 'right' }
        ],
        report.jobs.map((job) => [
          job.jobNumber || '—',
          job.clientName || '—',
          pdfNum(job.entryCount),
          pdfNum(job.billableHours),
          pdfNum(job.paidHours)
        ])
      );
      doc
        .font('Helvetica-Bold')
        .fontSize(9)
        .text(
          `Total — Billable: ${pdfNum(report.totals?.billableHours)}h   Paid: ${pdfNum(report.totals?.paidHours)}h`
        );
    } else {
      emptyNote(doc, 'No submitted entries in this period.');
    }
  }

  drawFooters(doc, generatedLabel());
  doc.end();
  return promise;
};

// ---------- Consumables report ----------

export const buildConsumablesReportWorkbookBuffer = async (report, meta) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Groundwork Drilling';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Consumables');
  sheet.columns = [
    { header: 'Item', key: 'item', width: 30 },
    { header: 'Total qty used', key: 'qty', width: 16 }
  ];
  report.items.forEach((item) => sheet.addRow({ item: item.itemName, qty: item.totalQtyUsed }));
  styleHeaderRow(sheet.getRow(1));

  const byJob = workbook.addWorksheet('By job');
  byJob.columns = [
    { header: 'Item', key: 'item', width: 30 },
    { header: 'Job', key: 'job', width: 30 },
    { header: 'Qty used', key: 'qty', width: 14 }
  ];
  report.items.forEach((item) => {
    item.jobs.forEach((job) => byJob.addRow({ item: item.itemName, job: job.label, qty: job.qtyUsed }));
  });
  styleHeaderRow(byJob.getRow(1));

  if (report.monthly.length) {
    const monthly = workbook.addWorksheet('By month');
    monthly.columns = [
      { header: 'Month', key: 'month', width: 20 },
      { header: 'Item', key: 'item', width: 30 },
      { header: 'Qty used', key: 'qty', width: 14 }
    ];
    report.monthly.forEach((month) => {
      month.items.forEach((item) => monthly.addRow({ month: month.label, item: item.itemName, qty: item.qtyUsed }));
    });
    styleHeaderRow(monthly.getRow(1));
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
};

export const buildConsumablesReportPdfBuffer = (report, meta) => {
  const { doc, promise } = startDoc();
  drawHeaderBand(doc, meta);

  sectionTitle(doc, 'Consumables used');
  if (report.items.length) {
    drawTable(
      doc,
      [
        { header: 'Item', weight: 2.6 },
        { header: 'Total qty used', weight: 1.2, align: 'right' }
      ],
      report.items.map((item) => [item.itemName, pdfNum(item.totalQtyUsed)])
    );
  } else {
    emptyNote(doc, 'No consumables recorded in this period.');
  }

  if (report.monthly.length) {
    sectionTitle(doc, 'Monthly breakdown', 110);
    report.monthly.forEach((month) => {
      doc.font('Helvetica-Bold').fontSize(9).fillColor(C.heading).text(month.label);
      doc.fillColor('#000000');
      drawTable(
        doc,
        [
          { header: 'Item', weight: 2.6 },
          { header: 'Qty used', weight: 1.2, align: 'right' }
        ],
        month.items.map((item) => [item.itemName, pdfNum(item.qtyUsed)])
      );
    });
  }

  drawFooters(doc, generatedLabel());
  doc.end();
  return promise;
};

// ---------- Fuel report ----------

export const buildFuelReportWorkbookBuffer = async (report, meta) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Groundwork Drilling';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Fuel');
  sheet.columns = [
    { header: 'Fuel type', key: 'type', width: 18 },
    { header: 'Total litres', key: 'qty', width: 16 }
  ];
  report.byType.forEach((type) => sheet.addRow({ type: type.type, qty: type.totalLt }));
  styleHeaderRow(sheet.getRow(1));

  const byJob = workbook.addWorksheet('By job');
  byJob.columns = [
    { header: 'Fuel type', key: 'type', width: 18 },
    { header: 'Job', key: 'job', width: 30 },
    { header: 'Litres', key: 'qty', width: 14 }
  ];
  report.byType.forEach((type) => {
    type.jobs.forEach((job) => byJob.addRow({ type: type.type, job: job.label, qty: job.qtyLt }));
  });
  styleHeaderRow(byJob.getRow(1));

  if (report.monthly.length) {
    const monthly = workbook.addWorksheet('By month');
    monthly.columns = [
      { header: 'Month', key: 'month', width: 20 },
      { header: 'Fuel type', key: 'type', width: 18 },
      { header: 'Litres', key: 'qty', width: 14 }
    ];
    report.monthly.forEach((month) => {
      month.byType.forEach((type) => monthly.addRow({ month: month.label, type: type.type, qty: type.totalLt }));
    });
    styleHeaderRow(monthly.getRow(1));
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
};

export const buildFuelReportPdfBuffer = (report, meta) => {
  const { doc, promise } = startDoc();
  drawHeaderBand(doc, meta);

  sectionTitle(doc, 'Fuel used');
  drawTable(
    doc,
    [
      { header: 'Fuel type', weight: 2 },
      { header: 'Total litres', weight: 1.2, align: 'right' }
    ],
    report.byType.map((type) => [type.type, pdfNum(type.totalLt)])
  );

  if (report.monthly.length) {
    sectionTitle(doc, 'Monthly breakdown', 110);
    report.monthly.forEach((month) => {
      doc.font('Helvetica-Bold').fontSize(9).fillColor(C.heading).text(`${month.label} — ${pdfNum(month.totalLt)} L`);
      doc.fillColor('#000000');
      drawTable(
        doc,
        [
          { header: 'Fuel type', weight: 2 },
          { header: 'Litres', weight: 1.2, align: 'right' }
        ],
        month.byType.map((type) => [type.type, pdfNum(type.totalLt)])
      );
    });
  }

  drawFooters(doc, generatedLabel());
  doc.end();
  return promise;
};

export const exportFilename = (base, format, meta) => {
  const range = `${dateLabel(meta.from)}_${dateLabel(meta.to)}`;
  return `${base}-${range}.${format === 'pdf' ? 'pdf' : 'xlsx'}`;
};

export const EXPORT_CONTENT_TYPES = {
  pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
};

