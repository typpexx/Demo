const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

// Pure-JS PDF renderer. Runs anywhere Node runs (incl. Vercel serverless),
// with no LibreOffice or font files needed. Layout mirrors the Word template.

const NAVY = rgb(0.043, 0.145, 0.271);
const BLUE = rgb(0.051, 0.416, 0.659);
const TEXT = rgb(0.086, 0.129, 0.173);
const MUTED = rgb(0.353, 0.416, 0.478);
const LINE = rgb(0.839, 0.867, 0.898);
const SHADE = rgb(0.949, 0.961, 0.973);
const WHITE = rgb(1, 1, 1);

const PAGE = { width: 612, height: 792 }; // US Letter
const MARGIN = 54;

// Standard PDF fonts only cover WinAnsi; swap anything else for '?' instead of failing.
function safe(font, text) {
  return [...String(text)].map((ch) => {
    try { font.encodeText(ch); return ch; } catch { return '?'; }
  }).join('');
}

function wrap(font, size, text, maxWidth) {
  const lines = [];
  for (const paragraph of safe(font, text).split(/\r?\n/)) {
    let line = '';
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        line = candidate;
        continue;
      }
      if (line) lines.push(line);
      // Break words that are longer than the whole column.
      line = '';
      for (const ch of word) {
        if (font.widthOfTextAtSize(line + ch, size) > maxWidth) { lines.push(line); line = ''; }
        line += ch;
      }
    }
    lines.push(line);
  }
  return lines;
}

/**
 * @param {Array<[string, string]>} rows  label/value pairs, in display order
 * @param {{ clinic: string, generatedOn: string }} meta
 */
async function renderPdf(rows, meta) {
  const pdf = await PDFDocument.create();
  pdf.setTitle('Patient Intake Form');
  pdf.setCreator('Patient Intake Portal (demo)');
  const page = pdf.addPage([PAGE.width, PAGE.height]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const contentWidth = PAGE.width - MARGIN * 2;

  // Header band
  const bandHeight = 84;
  page.drawRectangle({ x: 0, y: PAGE.height - bandHeight, width: PAGE.width, height: bandHeight, color: NAVY });
  page.drawRectangle({ x: 0, y: PAGE.height - bandHeight - 4, width: PAGE.width, height: 4, color: BLUE });
  page.drawText('PATIENT INTAKE FORM', { x: MARGIN, y: PAGE.height - 46, size: 20, font: bold, color: WHITE });
  page.drawText(safe(regular, meta.clinic), { x: MARGIN, y: PAGE.height - 66, size: 10.5, font: regular, color: rgb(0.78, 0.84, 0.91) });
  const dateLabel = `Generated ${meta.generatedOn}`;
  page.drawText(dateLabel, {
    x: PAGE.width - MARGIN - regular.widthOfTextAtSize(dateLabel, 10),
    y: PAGE.height - 46, size: 10, font: regular, color: rgb(0.78, 0.84, 0.91),
  });

  // Section title
  let y = PAGE.height - bandHeight - 40;
  page.drawText('Patient details', { x: MARGIN, y, size: 13, font: bold, color: NAVY });
  y -= 12;

  // Label/value table
  const labelWidth = 170;
  const pad = 9;
  const valueSize = 11;
  const lineHeight = 14.5;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: MARGIN + contentWidth, y }, thickness: 0.8, color: LINE });

  for (const [label, value] of rows) {
    const lines = wrap(regular, valueSize, value, contentWidth - labelWidth - pad * 2);
    const rowHeight = Math.max(1, lines.length) * lineHeight + pad * 2 - 3;
    page.drawRectangle({ x: MARGIN, y: y - rowHeight, width: labelWidth, height: rowHeight, color: SHADE });
    page.drawText(label, { x: MARGIN + pad, y: y - pad - 9, size: 9.5, font: bold, color: MUTED });
    lines.forEach((line, i) => {
      page.drawText(line, { x: MARGIN + labelWidth + pad, y: y - pad - 9.5 - i * lineHeight, size: valueSize, font: regular, color: TEXT });
    });
    y -= rowHeight;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: MARGIN + contentWidth, y }, thickness: 0.8, color: LINE });
  }

  // Acknowledgement + signature lines
  y -= 34;
  page.drawText('Acknowledgement', { x: MARGIN, y, size: 13, font: bold, color: NAVY });
  y -= 18;
  for (const line of wrap(regular, 10, 'I confirm that the information above is accurate and complete to the best of my knowledge.', contentWidth)) {
    page.drawText(line, { x: MARGIN, y, size: 10, font: regular, color: TEXT });
    y -= 14;
  }
  y -= 34;
  const sigWidth = contentWidth * 0.6;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: MARGIN + sigWidth, y }, thickness: 0.8, color: TEXT });
  page.drawLine({ start: { x: MARGIN + sigWidth + 24, y }, end: { x: MARGIN + contentWidth, y }, thickness: 0.8, color: TEXT });
  page.drawText('Patient or guardian signature', { x: MARGIN, y: y - 13, size: 9, font: regular, color: MUTED });
  page.drawText('Date', { x: MARGIN + sigWidth + 24, y: y - 13, size: 9, font: regular, color: MUTED });

  // Footer
  const footY = 40;
  page.drawLine({ start: { x: MARGIN, y: footY + 14 }, end: { x: PAGE.width - MARGIN, y: footY + 14 }, thickness: 0.6, color: LINE });
  page.drawText('Demonstration document. Sample data only. Not for clinical use.', { x: MARGIN, y: footY, size: 8.5, font: regular, color: MUTED });
  const pageLabel = 'Page 1 of 1';
  page.drawText(pageLabel, { x: PAGE.width - MARGIN - regular.widthOfTextAtSize(pageLabel, 8.5), y: footY, size: 8.5, font: regular, color: MUTED });

  return Buffer.from(await pdf.save());
}

module.exports = { renderPdf };
