const ExcelJS = require('exceljs');

/**
 * Generate Excel workbook from 2D table array
 * table: Array<Array<string>> - rows and columns
 * Returns: Promise<Buffer> - Excel file as binary buffer
 */
async function generateExcelFromTable(table) {
  try {
    if (!Array.isArray(table) || table.length === 0) {
      throw new Error('Table is empty or invalid');
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('OCR Data');

    // Add rows to worksheet
    for (const row of table) {
      if (Array.isArray(row)) {
        worksheet.addRow(row);
      }
    }

    // Format the worksheet
    // Auto-size columns
    for (const col of worksheet.columns) {
      let maxLength = 0;
      col.eachCell((cell) => {
        if (cell.value) {
          maxLength = Math.max(maxLength, String(cell.value).length);
        }
      });
      col.width = Math.min(maxLength + 2, 50); // Cap at 50
    }

    // Style header row (first row) if it exists
    if (worksheet.rowCount > 0) {
      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFC0C0C0' } // Light gray
      };
      headerRow.alignment = { horizontal: 'center', vertical: 'center', wrapText: true };
    }

    // Align all cells with word wrapping
    worksheet.eachRow((row) => {
      row.eachCell((cell) => {
        cell.alignment = { horizontal: 'left', vertical: 'top', wrapText: true };
      });
    });

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;
  } catch (err) {
    throw new Error(`Excel generation failed: ${err.message}`);
  }
}

/**
 * Generate Excel from table with custom formatting options
 */
async function generateExcelFromTableWithOptions(table, options = {}) {
  const {
    sheetName = 'OCR Data',
    boldHeader = true,
    headerColor = 'FFC0C0C0',
    autoSize = true,
    wrapText = true
  } = options;

  try {
    if (!Array.isArray(table) || table.length === 0) {
      throw new Error('Table is empty or invalid');
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(sheetName);

    // Add rows
    for (const row of table) {
      if (Array.isArray(row)) {
        worksheet.addRow(row);
      }
    }

    // Apply formatting
    if (worksheet.rowCount > 0) {
      const headerRow = worksheet.getRow(1);
      if (boldHeader) {
        headerRow.font = { bold: true };
      }
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: headerColor }
      };
      headerRow.alignment = { horizontal: 'center', vertical: 'center', wrapText: true };
    }

    // Auto-size columns
    if (autoSize) {
      for (const col of worksheet.columns) {
        let maxLength = 0;
        col.eachCell((cell) => {
          if (cell.value) {
            maxLength = Math.max(maxLength, String(cell.value).length);
          }
        });
        col.width = Math.min(maxLength + 2, 50);
      }
    }

    // Word wrap all cells
    if (wrapText) {
      worksheet.eachRow((row) => {
        row.eachCell((cell) => {
          cell.alignment = { horizontal: 'left', vertical: 'top', wrapText: true };
        });
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;
  } catch (err) {
    throw new Error(`Excel generation failed: ${err.message}`);
  }
}

module.exports = {
  generateExcelFromTable,
  generateExcelFromTableWithOptions
};
