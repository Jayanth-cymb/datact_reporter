const { Router } = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { requireAuth, requireRole } = require('../auth.js');
const { ocrPDFBuffer } = require('../services/ocrProcessor.js');
const { generateExcelFromTable } = require('../services/excelGenerator.js');

const router = Router();

// Middleware: require authentication
router.use(requireAuth);

// Configure multer for file upload
const upload = multer({
  storage: multer.memoryStorage(), // Keep file in memory
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    // Check MIME type
    if (file.mimetype !== 'application/pdf') {
      return cb(new Error('Only PDF files are accepted'), false);
    }
    // Check file extension
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.pdf') {
      return cb(new Error('File must have .pdf extension'), false);
    }
    cb(null, true);
  }
});

/**
 * POST /api/ocr/process-and-export
 * Upload PDF, run OCR, generate Excel, return as download
 * Requires: admin or operator role
 */
router.post(
  '/process-and-export',
  requireRole('admin', 'operator'),
  upload.single('pdf'),
  async (req, res) => {
    try {
      // Validate file was uploaded
      if (!req.file) {
        return res.status(400).json({ error: 'PDF file required' });
      }

      // Validate file size (multer should catch this, but double-check)
      if (req.file.size > 50 * 1024 * 1024) {
        return res.status(413).json({ error: 'File exceeds 50MB limit' });
      }

      // Validate PDF magic bytes
      const magicBytes = req.file.buffer.slice(0, 4).toString();
      if (!magicBytes.startsWith('%PDF')) {
        return res.status(400).json({ error: 'Invalid PDF file (bad magic bytes)' });
      }

      // Process OCR with progress callback
      let progressMsg = '';
      const table = await ocrPDFBuffer(req.file.buffer, (progress) => {
        progressMsg = `${progress}%`;
      });

      if (!table || table.length === 0) {
        return res.status(422).json({ error: 'No text detected in PDF' });
      }

      // Generate Excel from table
      const excelBuffer = await generateExcelFromTable(table);

      // Send as downloadable file
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="ocr_output_${Date.now()}.xlsx"`
      );
      res.send(excelBuffer);
    } catch (err) {
      console.error('OCR endpoint error:', err);

      // Categorize error
      if (err.message.includes('PDF parsing failed')) {
        return res.status(422).json({ error: 'PDF parsing failed: corrupted or invalid file' });
      }
      if (err.message.includes('No text detected')) {
        return res.status(422).json({ error: 'No text detected in PDF' });
      }
      if (err.message.includes('timeout') || err.message.includes('Timeout')) {
        return res.status(504).json({ error: 'OCR processing timeout (>5 minutes)' });
      }
      if (err.message.includes('Only PDF')) {
        return res.status(400).json({ error: 'Only PDF files are accepted' });
      }

      // Generic error
      res.status(500).json({ error: `OCR failed: ${err.message}` });
    }
  }
);

/**
 * POST /api/ocr/process
 * Just run OCR and return table data (no Excel generation)
 * Useful for preview before download
 */
router.post(
  '/process',
  requireRole('admin', 'operator'),
  upload.single('pdf'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'PDF file required' });
      }

      if (req.file.size > 50 * 1024 * 1024) {
        return res.status(413).json({ error: 'File exceeds 50MB limit' });
      }

      const magicBytes = req.file.buffer.slice(0, 4).toString();
      if (!magicBytes.startsWith('%PDF')) {
        return res.status(400).json({ error: 'Invalid PDF file' });
      }

      const table = await ocrPDFBuffer(req.file.buffer);

      if (!table || table.length === 0) {
        return res.status(422).json({ error: 'No text detected in PDF' });
      }

      res.json({
        success: true,
        table: table,
        rows: table.length,
        columns: table.length > 0 ? table[0].length : 0
      });
    } catch (err) {
      console.error('OCR process error:', err);

      if (err.message.includes('PDF parsing failed')) {
        return res.status(422).json({ error: 'PDF parsing failed' });
      }
      if (err.message.includes('No text detected')) {
        return res.status(422).json({ error: 'No text detected in PDF' });
      }

      res.status(500).json({ error: `OCR failed: ${err.message}` });
    }
  }
);

/**
 * POST /api/ocr/export
 * Generate Excel from existing table data (sent as JSON)
 * Used when user has edited the detected table
 */
router.post('/export', requireRole('admin', 'operator'), async (req, res) => {
  try {
    const { table } = req.body;

    if (!Array.isArray(table) || table.length === 0) {
      return res.status(400).json({ error: 'Valid table array required' });
    }

    const excelBuffer = await generateExcelFromTable(table);

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="ocr_output_${Date.now()}.xlsx"`
    );
    res.send(excelBuffer);
  } catch (err) {
    console.error('OCR export error:', err);
    res.status(500).json({ error: `Export failed: ${err.message}` });
  }
});

/**
 * Error handler for multer
 */
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'File exceeds 50MB limit' });
    }
    return res.status(400).json({ error: `Upload error: ${err.message}` });
  }
  if (err) {
    return res.status(400).json({ error: err.message });
  }
  next();
});

module.exports = router;
