# Patient Intake Demo

Functional demo: fill in a web form, then download the Patient Intake as a Word (.docx) or PDF file, generated from a template.

## Requirements

- Node.js 18+
- LibreOffice (for PDF output). Default path on Windows: `C:\Program Files\LibreOffice\program\soffice.exe`. Set `SOFFICE_PATH` to use a different one.

## Run it

```bash
npm install
npm run template   # builds templates/patient-intake.docx
npm start          # http://localhost:3000
```

## How it works

1. `scripts/create-template.js` builds a Word template with placeholders such as `{patientName}`.
2. `public/index.html` is the form. It posts JSON to `/api/generate/docx` or `/api/generate/pdf`.
3. `server.js` validates the input, fills the template with docxtemplater, and returns the file. PDF is made by converting the filled DOCX with LibreOffice headless.

## API

`POST /api/generate/:format` where `:format` is `docx` or `pdf`. Body is JSON with the form fields. Returns the file, or `400` with `{ "errors": [...] }`.

## Next steps (not in this demo)

- Master templates designed in InDesign, with version control
- Conditional sections and dynamic content blocks
- Branding, localization and user accounts
