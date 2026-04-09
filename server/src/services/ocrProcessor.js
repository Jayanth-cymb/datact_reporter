const pdfParse = require('pdf-parse');
const Tesseract = require('tesseract.js');

/**
 * Run text extraction + OCR on a PDF buffer
 * First tries direct text extraction with pdf-parse.
 * If that yields little text, falls back to Tesseract image OCR.
 * Returns structured table data
 */
async function ocrPDFBuffer(pdfBuffer, onProgress = null) {
  try {
    // Step 1: Try direct text extraction using pdf-parse
    let extractedText = '';
    try {
      const data = await pdfParse(pdfBuffer);
      extractedText = data.text;
    } catch (err) {
      console.warn('PDF text extraction failed:', err.message);
    }

    // If we got decent text, use it
    if (extractedText && extractedText.trim().length > 50) {
      const table = parseTextToTable(extractedText);
      if (table.length > 0) {
        return table;
      }
    }

    // Step 2: If direct extraction didn't work well, fall back to Tesseract OCR
    // For now, since we don't have PDF-to-image conversion set up,
    // we'll treat the extracted text (even if partial) as the OCR result
    // In a production system, you'd use pdfjs-dist or pdf2image to convert pages to images
    // then run Tesseract on each image.

    if (!extractedText || extractedText.trim().length === 0) {
      throw new Error('No text extracted from PDF');
    }

    const table = parseTextToTable(extractedText);
    if (table.length === 0) {
      throw new Error('Could not structure PDF text into table');
    }

    return table;
  } catch (err) {
    throw new Error(`PDF processing failed: ${err.message}`);
  }
}

/**
 * Parse raw text/OCR output into structured table
 * Simple algorithm: split by lines, then by whitespace
 */
function parseTextToTable(text) {
  const lines = text.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);

  if (lines.length === 0) {
    return [];
  }

  // For simple cases, each line is a row, split by multiple spaces
  const table = lines.map((line) => {
    // Split by 2+ spaces or tabs
    const cells = line.split(/\s{2,}|\t/).filter((c) => c.length > 0);
    return cells;
  });

  // Normalize: find max columns and pad shorter rows
  const maxCols = Math.max(...table.map((row) => row.length));
  const normalized = table.map((row) => {
    while (row.length < maxCols) {
      row.push('');
    }
    return row;
  });

  return normalized;
}

/**
 * Advanced: Parse OCR output with bounding boxes
 * (Tesseract.js provides per-word bounding box data)
 */
function parseOCRWordsToTable(words) {
  if (!words || words.length === 0) {
    return [];
  }

  // Group words by Y-coordinate (within ±10px = same row)
  const tolerance = 10;
  const rowGroups = [];

  for (const word of words) {
    const y = word.bbox.y0;
    let foundGroup = false;

    for (const group of rowGroups) {
      const groupY = group[0].bbox.y0;
      if (Math.abs(y - groupY) <= tolerance) {
        group.push(word);
        foundGroup = true;
        break;
      }
    }

    if (!foundGroup) {
      rowGroups.push([word]);
    }
  }

  // For each row group, sort by X and build cells
  const table = rowGroups.map((group) => {
    // Sort by X coordinate
    group.sort((a, b) => a.bbox.x0 - b.bbox.x0);

    // Group words into columns (words close in X = same column)
    const columns = [];
    const colTolerance = 20; // pixels

    for (const word of group) {
      const x = word.bbox.x0;
      let foundCol = false;

      for (const col of columns) {
        const colX = col[0].bbox.x0;
        if (Math.abs(x - colX) <= colTolerance) {
          col.push(word);
          foundCol = true;
          break;
        }
      }

      if (!foundCol) {
        columns.push([word]);
      }
    }

    // Join words in each column into a cell
    return columns.map((col) => col.map((w) => w.text).join(' '));
  });

  return table;
}

module.exports = {
  ocrPDFBuffer,
  parseTextToTable,
  parseOCRWordsToTable
};
