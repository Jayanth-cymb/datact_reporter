const pdfParse = require('pdf-parse');
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');

// pdfjs worker is handled by the legacy build automatically

/**
 * Run OCR on a PDF buffer
 * Strategy:
 * 1. Try pdf-parse (works for embedded-text PDFs)
 * 2. Fall back to pdfjs text layer extraction
 * Returns structured 2D table array
 */
async function ocrPDFBuffer(pdfBuffer, onProgress = null) {
  try {
    let extractedText = '';

    // Convert Buffer to Uint8Array for pdfjs compatibility
    const uint8Array = new Uint8Array(pdfBuffer);

    // Method 1: pdf-parse (fast, works for text-based PDFs)
    try {
      console.log('Attempting text extraction with pdf-parse...');
      const data = await pdfParse(pdfBuffer);
      if (data && data.text) {
        extractedText = data.text;
        console.log(`pdf-parse extracted ${extractedText.length} characters`);
      }
    } catch (err) {
      console.warn('pdf-parse failed:', err.message);
    }

    // Method 2: pdfjs text layer (works for more PDF types)
    if (!extractedText || extractedText.trim().length < 100) {
      try {
        console.log('Attempting text extraction with pdfjs...');
        const pdf = await pdfjsLib.getDocument({ data: uint8Array }).promise;

        if (pdf.numPages === 0) throw new Error('PDF has no pages');

        const allLines = [];
        const pagesToProcess = Math.min(5, pdf.numPages);

        for (let pageNum = 1; pageNum <= pagesToProcess; pageNum++) {
          const page = await pdf.getPage(pageNum);
          const textContent = await page.getTextContent();

          if (textContent && textContent.items && textContent.items.length > 0) {
            // Sort by Y position then X to preserve reading order
            const items = textContent.items.sort((a, b) =>
              b.transform[5] !== a.transform[5]
                ? b.transform[5] - a.transform[5]
                : a.transform[4] - b.transform[4]
            );

            let currentY = null;
            let currentLine = '';
            for (const item of items) {
              const y = Math.round(item.transform[5]);
              if (currentY === null) currentY = y;
              if (Math.abs(y - currentY) > 3) {
                if (currentLine.trim()) allLines.push(currentLine.trim());
                currentLine = item.str;
                currentY = y;
              } else {
                currentLine += (item.str.startsWith(' ') ? '' : ' ') + item.str;
              }
            }
            if (currentLine.trim()) allLines.push(currentLine.trim());
          }

          if (onProgress) onProgress(Math.round((pageNum / pagesToProcess) * 100));
        }

        extractedText = allLines.join('\n');
        console.log(`pdfjs extracted ${extractedText.length} chars`);
      } catch (err) {
        console.warn('pdfjs extraction failed:', err.message);
      }
    }

    if (!extractedText || extractedText.trim().length === 0) {
      throw new Error(
        'No text detected. This appears to be a pure image-based scanned PDF with no text layer. ' +
        'Please convert the PDF pages to images (JPG/PNG) using an online tool, then upload the image instead.'
      );
    }

    if (onProgress) onProgress(80);

    // Parse into structured table
    const table = parseCheckSheetText(extractedText);
    if (!table || table.length === 0) {
      throw new Error('Could not parse PDF content into table format');
    }

    if (onProgress) onProgress(100);
    console.log(`Parsed table: ${table.length} rows × ${table[0].length} cols`);
    return table;

  } catch (err) {
    throw new Error(`PDF processing failed: ${err.message}`);
  }
}

/**
 * Smart parser for check-sheet style documents.
 * Handles:
 *  - Multi-line cells within the same logical row
 *  - Merged/concatenated column values (e.g. "VisualOK" → ["Visual","OK"])
 *  - Numbered row detection (1, 2, 3 … start new check-item)
 *  - Header metadata rows above the table
 */
function parseCheckSheetText(text) {
  const rawLines = text
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0);

  if (rawLines.length === 0) return [];

  // ── Detect if this is a numbered check-sheet ──────────────────────────────
  // Look for lines that are just a single digit (row numbers)
  const rowNumberLines = rawLines.filter(l => /^\d{1,2}$/.test(l.trim()));
  const isCheckSheet = rowNumberLines.length >= 2;

  if (isCheckSheet) {
    return parseNumberedCheckSheet(rawLines);
  }

  // ── Generic document: just make a clean 2-column table ────────────────────
  return parseGenericText(rawLines);
}

/**
 * Parse a numbered check-sheet into a clean table with columns:
 * [S.No, Check Point, Standard, Method, Status, Remarks]
 */
function parseNumberedCheckSheet(lines) {
  // Find where the table header is (line containing "S.No" or similar)
  const headerIdx = lines.findIndex(l =>
    /s\.?\s*no/i.test(l) || /check\s*point/i.test(l)
  );

  // Collect metadata rows (before table)
  const metaLines = headerIdx > 0 ? lines.slice(0, headerIdx) : [];

  // Build header row
  const tableHeader = ['S.No', 'Check Point', 'Standard', 'Method', 'Status', 'Remarks'];

  // Table body lines (after header, or from start)
  const bodyLines = lines.slice(headerIdx >= 0 ? headerIdx + 1 : 0);

  // Group body lines into numbered items
  // A new item starts when a line is purely a number (1, 2, 3 …)
  // Handle edge cases like "8Last shot (with runner)" → sno=8
  const items = [];
  let currentItem = null;

  for (const line of bodyLines) {
    // Check for new item start: line IS just a number
    const soloNum = line.match(/^(\d{1,2})$/);
    // Or starts with a number immediately followed by text (e.g. "8Last shot")
    const leadNum = line.match(/^(\d{1,2})([A-Za-z].+)/);

    if (soloNum) {
      if (currentItem) items.push(currentItem);
      currentItem = { sno: soloNum[1], lines: [] };
    } else if (leadNum) {
      if (currentItem) items.push(currentItem);
      currentItem = { sno: leadNum[1], lines: [leadNum[2].trim()] };
    } else {
      if (currentItem) {
        currentItem.lines.push(line);
      }
      // Lines before first number = ignored (part of header already handled)
    }
  }
  if (currentItem) items.push(currentItem);

  // Convert each item to a table row
  const rows = [tableHeader];

  for (const item of items) {
    const { sno, lines: itemLines } = item;

    // itemLines contains: check-point text, standard text, method, status, remarks
    // Split them heuristically:
    // - Lines at the end that look like "VisualOK" or "Visual & HearingOK" are method+status
    // - Other lines are split between check-point and standard

    // Detect "method+status" lines (short lines, often end in OK/NG/NA)
    const methodStatusIdx = findMethodStatusLine(itemLines);

    let checkPointLines, standardLines, methodStr, statusStr;

    if (methodStatusIdx >= 0) {
      const afterMethod = itemLines.slice(methodStatusIdx);
      const beforeMethod = itemLines.slice(0, methodStatusIdx);

      // Parse method+status from the detected line(s)
      const [m, s] = splitMethodStatus(afterMethod.join(' '));
      methodStr = m;
      statusStr = s;

      // Split remaining lines into check-point vs standard
      // Heuristic: roughly first half = check point, second half = standard
      const mid = Math.ceil(beforeMethod.length / 2);
      checkPointLines = beforeMethod.slice(0, mid);
      standardLines = beforeMethod.slice(mid);
    } else {
      // No method/status detected – put everything in check-point
      const mid = Math.ceil(itemLines.length / 2);
      checkPointLines = itemLines.slice(0, mid);
      standardLines = itemLines.slice(mid);
      methodStr = '';
      statusStr = '';
    }

    rows.push([
      sno,
      checkPointLines.join(' ').trim(),
      standardLines.join(' ').trim(),
      methodStr.trim(),
      statusStr.trim(),
      '' // Remarks – blank (user fills in)
    ]);
  }

  // Prepend metadata as a single-column header block if present
  const metaRows = metaLines.map(l => [l, '', '', '', '', '']);
  return [...metaRows, ...rows];
}

/**
 * Find the index of the line that contains method/status info
 * e.g. "VisualOK", "Visual & HearingOK", "Visual & Hearing"
 */
function findMethodStatusLine(lines) {
  // Search from the end – method/status is usually near the end of an item
  for (let i = lines.length - 1; i >= 0; i--) {
    const l = lines[i];
    if (
      /visual/i.test(l) ||
      /hearing/i.test(l) ||
      /\bOK\b/i.test(l) ||
      /\bNG\b/i.test(l) ||
      /\bNA\b/i.test(l)
    ) {
      return i;
    }
  }
  return -1;
}

/**
 * Split "VisualOK" or "Visual & HearingOK" into [method, status]
 * Note: no \b word-boundary – letters run together in scanned PDFs
 */
function splitMethodStatus(raw) {
  // Split on status keyword (even if directly concatenated with method)
  // e.g. "VisualOK" → "Visual" + "OK"
  const statusMatch = raw.match(/(OK|NG|NA|N\.A\.?|Not\s*OK)\s*$/i);
  if (statusMatch) {
    const status = statusMatch[1].toUpperCase().replace(/\s+/g, '');
    const method = raw.slice(0, raw.lastIndexOf(statusMatch[1])).trim();
    // Common cleanup: trim trailing punctuation from method
    return [method.replace(/[.,;:\s]+$/, '') || 'Visual', status];
  }
  return [raw.trim(), ''];
}

/**
 * Generic (non-numbered) document parser
 * Groups lines into rows, splits each row into cells by whitespace boundaries
 */
function parseGenericText(lines) {
  const table = lines.map(line => {
    // Split by 2+ spaces or tabs first
    let cells = line.split(/\s{2,}|\t+/).filter(c => c.trim().length > 0);
    // If line is one long word, try splitting by capital letters (CamelCase boundary)
    if (cells.length === 1 && line.length > 30) {
      cells = [line]; // keep as single cell
    }
    return cells;
  });

  if (table.length === 0) return [];

  // Normalise column count
  const maxCols = Math.max(...table.map(r => r.length));
  return table.map(row => {
    while (row.length < maxCols) row.push('');
    return row.slice(0, maxCols);
  });
}

/**
 * Parse Tesseract bounding-box word list into a table
 * (used when image-based OCR is available)
 */
function parseOCRWordsToTable(words) {
  if (!words || words.length === 0) return [];

  const tolerance = 10;
  const rowGroups = [];

  for (const word of words) {
    const y = word.bbox.y0;
    let placed = false;
    for (const g of rowGroups) {
      if (Math.abs(y - g[0].bbox.y0) <= tolerance) {
        g.push(word);
        placed = true;
        break;
      }
    }
    if (!placed) rowGroups.push([word]);
  }

  return rowGroups.map(g => {
    g.sort((a, b) => a.bbox.x0 - b.bbox.x0);
    const cols = [];
    for (const w of g) {
      const x = w.bbox.x0;
      let placed = false;
      for (const col of cols) {
        if (Math.abs(x - col[0].bbox.x0) <= 20) {
          col.push(w);
          placed = true;
          break;
        }
      }
      if (!placed) cols.push([w]);
    }
    return cols.map(col => col.map(w => w.text).join(' '));
  });
}

module.exports = { ocrPDFBuffer, parseCheckSheetText, parseOCRWordsToTable };
