const express = require('express');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFile } = require('child_process');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');

const app = express();
const PORT = process.env.PORT || 3000;
const TEMPLATE_PATH = path.join(__dirname, 'templates', 'patient-intake.docx');

// LibreOffice is used to convert the generated DOCX to PDF.
// Set SOFFICE_PATH if it is not in the default location.
const SOFFICE_PATH = process.env.SOFFICE_PATH ||
  (process.platform === 'win32'
    ? 'C:\\Program Files\\LibreOffice\\program\\soffice.exe'
    : 'soffice');

const FORMATS = {
  docx: {
    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ext: 'docx',
  },
  pdf: {
    mime: 'application/pdf',
    ext: 'pdf',
  },
};

// Form fields -> template placeholders. Add new fields here and in the template later.
const FIELDS = [
  { key: 'patientName', label: 'Patient Name', required: true },
  { key: 'dateOfBirth', label: 'Date of Birth', required: true },
  { key: 'address', label: 'Address', required: true },
  { key: 'phone', label: 'Phone Number', required: true },
  { key: 'emergencyContact', label: 'Emergency Contact', required: true },
  { key: 'insuranceProvider', label: 'Insurance Provider', required: false },
  { key: 'reasonForVisit', label: 'Reason for Visit', required: true },
];

app.use(express.json({ limit: '50kb' }));
app.use(express.static(path.join(__dirname, 'public')));

function validate(input) {
  const errors = [];
  const data = {};

  for (const field of FIELDS) {
    const value = String(input[field.key] ?? '').trim();
    if (field.required && !value) errors.push(`${field.label} is required.`);
    if (value.length > 200) errors.push(`${field.label} must be 200 characters or fewer.`);
    data[field.key] = value || 'Not provided';
  }

  if (data.dateOfBirth !== 'Not provided' && !/^\d{4}-\d{2}-\d{2}$/.test(data.dateOfBirth)) {
    errors.push('Date of Birth must be a valid date.');
  }
  if (data.phone !== 'Not provided' && !/^[+\d\s()-]{7,20}$/.test(data.phone)) {
    errors.push('Phone Number looks invalid.');
  }

  return { errors, data };
}

function todayLabel() {
  return new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function fileSafe(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'patient';
}

function renderDocx(data) {
  const zip = new PizZip(fs.readFileSync(TEMPLATE_PATH));
  const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
  doc.render({ ...data, generatedOn: todayLabel() });
  return doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' });
}

// Converts a DOCX buffer to PDF with LibreOffice headless.
// Each run gets its own temp profile so conversions can run without locking each other.
function docxToPdf(docxBuffer) {
  return new Promise((resolve, reject) => {
    const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'intake-'));
    const inFile = path.join(workDir, 'document.docx');
    const profileDir = path.join(workDir, 'profile');
    fs.writeFileSync(inFile, docxBuffer);

    const args = [
      `-env:UserInstallation=${new URL('file:///' + profileDir.replace(/\\/g, '/')).href}`,
      '--headless',
      '--convert-to', 'pdf',
      '--outdir', workDir,
      inFile,
    ];

    execFile(SOFFICE_PATH, args, { timeout: 120000 }, (err, stdout, stderr) => {
      try {
        if (err) return reject(new Error(`LibreOffice failed: ${stderr || err.message}`));
        resolve(fs.readFileSync(path.join(workDir, 'document.pdf')));
      } catch (readErr) {
        reject(readErr);
      } finally {
        fs.rmSync(workDir, { recursive: true, force: true });
      }
    });
  });
}

app.post('/api/generate/:format', async (req, res) => {
  const format = FORMATS[req.params.format];
  if (!format) return res.status(404).json({ errors: ['Unknown output format.'] });

  const { errors, data } = validate(req.body || {});
  if (errors.length) return res.status(400).json({ errors });

  try {
    const docxBuffer = renderDocx(data);
    const output = req.params.format === 'pdf' ? await docxToPdf(docxBuffer) : docxBuffer;
    const fileName = `intake-${fileSafe(data.patientName)}.${format.ext}`;

    res.set({
      'Content-Type': format.mime,
      'Content-Disposition': `attachment; filename="${fileName}"`,
    });
    res.send(output);
  } catch (err) {
    console.error(err);
    res.status(500).json({ errors: ['Document generation failed. Check the server log.'] });
  }
});

// Express 5 passes listen errors (e.g. port already in use) to this callback.
app.listen(PORT, (err) => {
  if (err) {
    console.error(`Could not start server on port ${PORT}: ${err.message}`);
    process.exit(1);
  }
  console.log(`Patient intake demo running at http://localhost:${PORT}`);
});
