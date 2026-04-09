#!/usr/bin/env python3
"""
PaddleOCR-based PDF text extraction.
Reads PDF from stdin, outputs structured table JSON to stdout.
"""

import sys
import json
import io
from pathlib import Path

try:
    from paddleocr import PaddleOCR
    import fitz  # PyMuPDF for PDF handling
except ImportError as e:
    print(json.dumps({"error": f"Missing dependency: {e}"}), file=sys.stderr)
    sys.exit(1)


def extract_text_from_pdf_pages(pdf_buffer):
    """Extract text from PDF using PaddleOCR on rendered pages."""
    try:
        # Open PDF from buffer
        pdf = fitz.open(stream=pdf_buffer, filetype="pdf")

        # Initialize PaddleOCR (English only for speed)
        ocr = PaddleOCR(use_angle_cls=True, lang='en')

        all_text = []

        # Process first 5 pages (limit for performance)
        for page_num in range(min(5, pdf.page_count)):
            page = pdf[page_num]

            # Render page to image (PNG)
            pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))  # 2x scale for better OCR
            img_data = pix.tobytes("ppm")

            # Run PaddleOCR
            result = ocr.ocr(img_data, cls=True)

            # Extract text lines
            if result:
                for line in result:
                    if line:
                        texts = [char[1][0] for char in line]  # Get text from each char
                        line_text = ''.join(texts)
                        if line_text.strip():
                            all_text.append(line_text.strip())

        pdf.close()
        return '\n'.join(all_text)

    except Exception as e:
        raise Exception(f"PaddleOCR extraction failed: {str(e)}")


def parse_check_sheet_text(text):
    """Parse check-sheet structured text into table format."""
    lines = [l.strip() for l in text.split('\n') if l.strip()]

    if not lines:
        return []

    # Detect check-sheet structure
    row_numbers = [l for l in lines if l.isdigit() or (l and l[0].isdigit() and len(l) <= 2)]
    is_check_sheet = len(row_numbers) >= 2

    if is_check_sheet:
        return parse_numbered_check_sheet(lines)
    else:
        return parse_generic_text(lines)


def parse_numbered_check_sheet(lines):
    """Parse numbered check-sheet (1-9 items) into structured table."""
    # Find header
    header_idx = next((i for i, l in enumerate(lines) if 'S.No' in l or 'Check' in l), 0)

    table = [['S.No', 'Check Point', 'Standard', 'Method', 'Status', 'Remarks']]

    # Group lines by check number
    current_item = None
    items = []

    for line in lines[header_idx + 1:]:
        if line.isdigit() or (line and line[0].isdigit() and len(line.split()[0]) <= 2):
            if current_item:
                items.append(current_item)
            current_item = {'sno': line, 'lines': []}
        elif current_item is not None:
            current_item['lines'].append(line)

    if current_item:
        items.append(current_item)

    # Convert items to rows
    for item in items:
        sno = item['sno']
        item_lines = item['lines']

        # Find method/status line (usually has Visual, OK, NG, etc.)
        method_idx = -1
        for i in range(len(item_lines) - 1, -1, -1):
            if any(kw in item_lines[i] for kw in ['Visual', 'OK', 'NG', 'NA']):
                method_idx = i
                break

        if method_idx >= 0:
            before = item_lines[:method_idx]
            method_line = item_lines[method_idx]

            # Split method and status
            method, status = split_method_status(method_line)

            # Split remaining lines into check-point and standard
            mid = len(before) // 2
            check_point = ' '.join(before[:mid]).strip()
            standard = ' '.join(before[mid:]).strip()
        else:
            mid = len(item_lines) // 2
            check_point = ' '.join(item_lines[:mid]).strip()
            standard = ' '.join(item_lines[mid:]).strip()
            method = ''
            status = ''

        table.append([sno, check_point, standard, method, status, ''])

    return table


def split_method_status(text):
    """Split 'VisualOK' into 'Visual' and 'OK'."""
    import re

    # Look for status keywords at the end
    match = re.search(r'(OK|NG|NA|N\.A\.?|Not\s*OK)\s*$', text, re.IGNORECASE)
    if match:
        status = match.group(1).upper().replace(' ', '')
        method = text[:match.start()].strip()
        return [method or 'Visual', status]

    return [text.strip(), '']


def parse_generic_text(lines):
    """Generic text-to-table parser."""
    table = []
    for line in lines:
        # Split by multiple spaces or tabs
        cells = line.split()
        if cells:
            table.append(cells)

    if not table:
        return []

    # Normalize columns
    max_cols = max(len(row) for row in table)
    return [row + [''] * (max_cols - len(row)) for row in table]


def main():
    """Main entry point."""
    try:
        # Read PDF from stdin (binary)
        pdf_data = sys.stdin.buffer.read()

        # Extract text using PaddleOCR
        text = extract_text_from_pdf_pages(pdf_data)

        # Parse into table structure
        table = parse_check_sheet_text(text)

        # Output JSON
        print(json.dumps({"success": True, "table": table}))

    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}), file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
