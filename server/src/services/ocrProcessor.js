const pdfParse = require('pdf-parse');
const Tesseract = require('tesseract.js');
const pdfjsLib = require('pdfjs-dist');

// Set up pdf.js worker
try {
  pdfjsLib.GlobalWorkerOptions.workerSrc = require('pdfjs-dist/build/pdf.worker.min.js');
} catch (err) {
  console.warn('Could not load pdfjs worker');
}

/**
 * Run OCR on a PDF buffer
 * Strategy:
 * 1. Try multiple text extraction methods
 * 2. Parse text into structured table format
 * Returns structured table data
 */
async function ocrPDFBuffer(pdfBuffer, onProgress = null) {
  try {
    let extractedText = '';

    // Method 1: Try pdf-parse for quick text extraction
    try {
      console.log('Attempting text extraction with pdf-parse...');
      const data = await pdfParse(pdfBuffer);
      extractedText = data.text;
      console.log(`pdf-parse extracted ${extractedText.length} characters`);
    } catch (err) {
      console.warn('pdf-parse failed:', err.message);
    }

    // Method 2: Try pdfjs text layer extraction
    if (!extractedText || extractedText.trim().length < 100) {
      try {
        console.log('Attempting text extraction with pdfjs...');
        const pdf = await pdfjsLib.getDocument({ data: pdfBuffer }).promise;

        if (pdf.numPages === 0) {
          throw new Error('PDF has no pages');
        }

        const allText = [];

        // Process all pages (limit to 5 for performance)
        const pagesToProcess = Math.min(5, pdf.numPages);
        for (let pageNum = 1; pageNum <= pagesToProcess; pageNum++) {
          try {
            const page = await pdf.getPage(pageNum);
            const textContent = await page.getTextContent();

            if (textContent && textContent.items && textContent.items.length > 0) {
              const pageText = textContent.items
                .map((item) => item.str)
                .join(' ');

              if (pageText.trim().length > 0) {
                allText.push(pageText);
              }
            }
          } catch (pageErr) {
            console.warn(`Failed to extract text from page ${pageNum}:`, pageErr.message);
          }

          if (onProgress) {
            onProgress(Math.round((pageNum / pagesToProcess) * 100));
          }
        }

        extractedText = allText.join('\n\n');
        console.log(`pdfjs extracted ${extractedText.length} characters from ${pagesToProcess} pages`);
      } catch (err) {
        console.warn('pdfjs extraction failed:', err.message);
      }
    }

    // If we got text, parse it into table
    if (extractedText && extractedText.trim().length > 0) {
      const table = parseTextToTable(extractedText);
      if (table && table.length > 0) {
        console.log(`Successfully parsed table: ${table.length} rows`);
        return table;
      }
    }

    // If all extraction methods failed
    throw new Error(
      'No text detected in PDF. This appears to be a scanned image-based document. ' +
        'Please try: 1) Convert the PDF to images (JPG/PNG) and upload individual images, ' +
        '2) Use an online PDF-to-image converter, or 3) Use OCR software to add a text layer to the PDF.'
    );
  } catch (err) {
    throw new Error(`PDF processing failed: ${err.message}`);
  }
}

/**
 * Parse raw text/OCR output into structured table
 * Algorithm:
 * 1. Split by newlines to get rows
 * 2. Split each row by multiple spaces, tabs, or alignment patterns
 * 3. Normalize column counts
 * 4. Filter empty rows
 */
function parseTextToTable(text) {
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return [];
  }

  // Split into lines and clean
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    return [];
  }

  // Convert lines to rows by splitting on whitespace
  // Try to be smart: look for 2+ spaces or tabs as column separators
  const table = lines.map((line) => {
    // Split by 2+ spaces or tabs (indicates column boundary)
    let cells = line.split(/\s{2,}|\t+/);

    // If that didn't work well (too few cells), try single space split
    if (cells.length <= 1 && line.length > 20) {
      cells = line.split(/\s+/);
    }

    return cells.filter((c) => c.trim().length > 0);
  });

  if (table.length === 0) {
    return [];
  }

  // Normalize table: ensure all rows have same number of columns
  const maxCols = Math.max(...table.map((row) => row.length), 1);

  const normalized = table
    .map((row) => {
      // Pad with empty cells if needed
      while (row.length < maxCols) {
        row.push('');
      }
      // Trim to max columns
      return row.slice(0, maxCols);
    })
    .filter((row) => row.some((cell) => cell.trim().length > 0)); // Remove all-empty rows

  return normalized.length > 0 ? normalized : [];
}

/**
 * Parse OCR output with bounding boxes
 * (Advanced: for when using Tesseract.js with image-based OCR)
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
