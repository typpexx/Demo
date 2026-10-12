const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, AlignmentType, ShadingType,
} = require('docx');

// Each {tag} is replaced with the matching value by docxtemplater in server.js
const ROWS = [
  ['Patient Name', '{patientName}'],
  ['Date of Birth', '{dateOfBirth}'],
  ['Address', '{address}'],
  ['Phone Number', '{phone}'],
  ['Emergency Contact', '{emergencyContact}'],
  ['Insurance Provider', '{insuranceProvider}'],
  ['Reason for Visit', '{reasonForVisit}'],
];

const labelCell = (text) => new TableCell({
  width: { size: 35, type: WidthType.PERCENTAGE },
  shading: { type: ShadingType.CLEAR, fill: 'F2F2F2', color: 'auto' },
  children: [new Paragraph({ children: [new TextRun({ text, bold: true })] })],
});

const valueCell = (tag) => new TableCell({
  width: { size: 65, type: WidthType.PERCENTAGE },
  children: [new Paragraph({ children: [new TextRun({ text: tag })] })],
});

async function main() {
  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 80 },
          children: [new TextRun({ text: 'Demo Clinic', bold: true, size: 28 })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 300 },
          children: [new TextRun({ text: 'PATIENT INTAKE FORM', bold: true, size: 36 })],
        }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: ROWS.map(([label, tag]) => new TableRow({ children: [labelCell(label), valueCell(tag)] })),
        }),
        new Paragraph({
          spacing: { before: 300 },
          children: [new TextRun({ text: 'Date generated: {generatedOn}', italics: true, size: 18 })],
        }),
      ],
    }],
  });

  const outDir = path.join(__dirname, '..', 'templates');
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, 'patient-intake.docx');
  fs.writeFileSync(outFile, await Packer.toBuffer(doc));
  console.log(`Template written to ${path.relative(process.cwd(), outFile)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
