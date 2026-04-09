import React, { useState } from 'react';
import { api, getToken } from '../api.js';

export default function OCRUploader() {
  const [file, setFile] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [table, setTable] = useState(null);
  const [editedTable, setEditedTable] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Validate file type
    if (selectedFile.type !== 'application/pdf') {
      setError('Please select a PDF file');
      return;
    }

    setFile(selectedFile);
    setError('');
    setSuccess('');
    setTable(null);
    setEditedTable(null);
  };

  const handleProcessPDF = async () => {
    if (!file) {
      setError('Please select a PDF file');
      return;
    }

    setProcessing(true);
    setProgress(0);
    setError('');
    setSuccess('');
    setTable(null);

    try {
      const formData = new FormData();
      formData.append('pdf', file);

      const response = await fetch('/api/ocr/process-and-export', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${getToken()}`
        },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      // For direct binary download, we need a different approach
      // Instead, let's call the /process endpoint first to get table data
      setSuccess('Processing complete! Generating Excel...');

      // Re-process to get table preview
      const formData2 = new FormData();
      formData2.append('pdf', file);

      const tableResponse = await fetch('/api/ocr/process', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${getToken()}`
        },
        body: formData2
      });

      if (!tableResponse.ok) {
        const errorData = await tableResponse.json();
        throw new Error(errorData.error || 'Failed to process PDF');
      }

      const data = await tableResponse.json();
      setTable(data.table);
      setEditedTable(JSON.parse(JSON.stringify(data.table))); // Deep copy for editing

      // Download Excel
      downloadExcel(data.table);
    } catch (err) {
      setError(err.message || 'Failed to process PDF');
      setTable(null);
    } finally {
      setProcessing(false);
      setProgress(0);
    }
  };

  const downloadExcel = async (tableData) => {
    try {
      const response = await fetch('/api/ocr/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`
        },
        body: JSON.stringify({ table: tableData })
      });

      if (!response.ok) {
        throw new Error('Failed to generate Excel');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ocr_output_${Date.now()}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setSuccess('Excel file downloaded successfully!');
    } catch (err) {
      setError(`Download failed: ${err.message}`);
    }
  };

  const handleCellEdit = (rowIdx, colIdx, value) => {
    if (!editedTable) return;
    const newTable = editedTable.map((row, i) =>
      i === rowIdx
        ? row.map((cell, j) => (j === colIdx ? value : cell))
        : row
    );
    setEditedTable(newTable);
  };

  const handleDownloadEdited = () => {
    if (!editedTable) return;
    downloadExcel(editedTable);
  };

  return (
    <div style={styles.container}>
      <h2>PDF to Excel Converter</h2>
      <p style={styles.subtitle}>
        Upload a PDF (scanned form, handwritten form, or printed document) to extract text and
        convert it to an editable Excel spreadsheet.
      </p>

      {/* Upload Section */}
      <div style={styles.uploadSection}>
        <label style={styles.fileInputLabel}>
          <input
            type="file"
            accept=".pdf"
            onChange={handleFileSelect}
            disabled={processing}
            style={styles.fileInput}
          />
          <span style={styles.fileInputSpan}>Choose PDF File</span>
        </label>

        {file && <p style={styles.fileName}>Selected: {file.name}</p>}

        <button
          onClick={handleProcessPDF}
          disabled={!file || processing}
          style={{
            ...styles.button,
            ...((!file || processing) && styles.buttonDisabled)
          }}
        >
          {processing ? `Processing... (${progress}%)` : 'Process PDF'}
        </button>
      </div>

      {/* Progress Bar */}
      {processing && (
        <div style={styles.progressContainer}>
          <div style={styles.progressBar}>
            <div style={{ ...styles.progressFill, width: `${progress}%` }} />
          </div>
          <p style={styles.progressText}>Processing PDF... {progress}%</p>
        </div>
      )}

      {/* Error Message */}
      {error && <div style={styles.errorBox}>{error}</div>}

      {/* Success Message */}
      {success && <div style={styles.successBox}>{success}</div>}

      {/* Table Preview */}
      {table && editedTable && (
        <div style={styles.tableSection}>
          <h3>Detected Data (Edit if needed)</h3>
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <tbody>
                {editedTable.map((row, rowIdx) => (
                  <tr key={rowIdx} style={rowIdx === 0 ? styles.headerRow : {}}>
                    {row.map((cell, colIdx) => (
                      <td key={`${rowIdx}-${colIdx}`} style={styles.tableCell}>
                        <input
                          type="text"
                          value={cell}
                          onChange={(e) => handleCellEdit(rowIdx, colIdx, e.target.value)}
                          style={styles.cellInput}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={styles.tableInfo}>
            <p>Rows: {editedTable.length}</p>
            <p>Columns: {editedTable[0]?.length || 0}</p>
          </div>

          <button onClick={handleDownloadEdited} style={styles.downloadButton}>
            Download as Excel
          </button>
        </div>
      )}

      {/* Info Box */}
      <div style={styles.infoBox}>
        <h4>How to use:</h4>
        <ul>
          <li>Upload a PDF file (max 50MB)</li>
          <li>The app will extract text from the PDF</li>
          <li>Review and edit the detected data if needed</li>
          <li>Download as an Excel spreadsheet</li>
        </ul>
        <p style={styles.note}>
          <strong>Note:</strong> OCR accuracy depends on PDF quality. Clear printed text works
          best. Handwritten or low-resolution documents may require manual corrections.
        </p>
      </div>
    </div>
  );
}

const styles = {
  container: {
    maxWidth: '900px',
    margin: '0 auto',
    padding: '20px',
    fontFamily: 'Arial, sans-serif'
  },
  subtitle: {
    color: '#666',
    marginBottom: '20px'
  },
  uploadSection: {
    border: '2px dashed #007BFF',
    borderRadius: '8px',
    padding: '20px',
    marginBottom: '20px',
    textAlign: 'center',
    backgroundColor: '#f9f9f9'
  },
  fileInputLabel: {
    display: 'inline-block',
    cursor: 'pointer',
    marginBottom: '15px'
  },
  fileInput: {
    display: 'none'
  },
  fileInputSpan: {
    display: 'inline-block',
    padding: '10px 20px',
    backgroundColor: '#007BFF',
    color: 'white',
    borderRadius: '5px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold'
  },
  fileName: {
    color: '#28a745',
    marginBottom: '15px',
    fontSize: '14px'
  },
  button: {
    padding: '10px 30px',
    backgroundColor: '#007BFF',
    color: 'white',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: 'bold'
  },
  buttonDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed'
  },
  progressContainer: {
    marginBottom: '20px'
  },
  progressBar: {
    width: '100%',
    height: '20px',
    backgroundColor: '#e9ecef',
    borderRadius: '10px',
    overflow: 'hidden',
    marginBottom: '10px'
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#28a745',
    transition: 'width 0.3s'
  },
  progressText: {
    textAlign: 'center',
    color: '#666',
    fontSize: '14px'
  },
  errorBox: {
    backgroundColor: '#f8d7da',
    border: '1px solid #f5c6cb',
    color: '#721c24',
    padding: '12px',
    borderRadius: '5px',
    marginBottom: '20px'
  },
  successBox: {
    backgroundColor: '#d4edda',
    border: '1px solid #c3e6cb',
    color: '#155724',
    padding: '12px',
    borderRadius: '5px',
    marginBottom: '20px'
  },
  tableSection: {
    marginBottom: '30px'
  },
  tableWrapper: {
    overflowX: 'auto',
    border: '1px solid #ddd',
    borderRadius: '5px',
    marginBottom: '15px'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    backgroundColor: 'white'
  },
  headerRow: {
    backgroundColor: '#f8f9fa'
  },
  tableCell: {
    border: '1px solid #ddd',
    padding: '0'
  },
  cellInput: {
    width: '100%',
    padding: '8px',
    border: 'none',
    fontFamily: 'Arial, sans-serif',
    fontSize: '13px'
  },
  tableInfo: {
    display: 'flex',
    gap: '20px',
    marginBottom: '15px',
    color: '#666',
    fontSize: '14px'
  },
  downloadButton: {
    padding: '12px 30px',
    backgroundColor: '#28a745',
    color: 'white',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: 'bold'
  },
  infoBox: {
    backgroundColor: '#e7f3ff',
    border: '1px solid #b3d9ff',
    padding: '15px',
    borderRadius: '5px',
    color: '#004085'
  },
  note: {
    marginTop: '10px',
    fontSize: '13px',
    color: '#004085'
  }
};
