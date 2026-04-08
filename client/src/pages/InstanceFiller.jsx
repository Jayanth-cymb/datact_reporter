import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';

const HIGHLIGHT_BG = '#fff3cd';

const STATUS_COLORS = {
  draft: '#888', pending: '#e8a317', approved: '#2e9e4d', rejected: '#d93025'
};
const STATUS_LABELS = {
  draft: 'Draft', pending: 'Pending Approval', approved: 'Approved', rejected: 'Rejected'
};

export default function InstanceFiller({ id, user, onBack }) {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('Loading...');
  const [approvals, setApprovals] = useState([]);
  const [rule, setRule] = useState(null);
  const [showDecisionModal, setShowDecisionModal] = useState(null); // 'approve' | 'reject'
  const [decisionComment, setDecisionComment] = useState('');
  const initRef = useRef(false);
  const inputCellsRef = useRef([]);

  // Editable when draft or rejected, and you're the creator
  const isEditable = data && (data.instance.status === 'draft' || data.instance.status === 'rejected')
                     && data.instance.created_by === user.id;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const resp = await api(`/instances/${id}`);
        if (cancelled) return;
        setData(resp);
        inputCellsRef.current = resp.template.input_cells || [];
        setStatus('');
        // Load approvals + rule in parallel
        try {
          const [{ approvals }, { rule }] = await Promise.all([
            api(`/approvals/instance/${id}`),
            api(`/approvals/rules/${resp.template.id}`)
          ]);
          if (!cancelled) {
            setApprovals(approvals || []);
            setRule(rule);
          }
        } catch {}
        setTimeout(() => initLuckysheet(resp), 50);
      } catch (e) { setStatus('Error: ' + e.message); }
    })();
    return () => {
      cancelled = true;
      try { window.luckysheet.destroy(); } catch {}
      initRef.current = false;
    };
  }, [id]);

  const initLuckysheet = (resp) => {
    if (initRef.current) return;
    initRef.current = true;

    // Apply previously filled values back into the sheet data
    const sheets = JSON.parse(JSON.stringify(resp.template.sheet_json));
    const filled = resp.instance.filled_data || {};
    Object.entries(filled).forEach(([key, value]) => {
      const [sIdx, r, c] = key.split(':').map(Number);
      const sheet = sheets[sIdx] || sheets[0];
      if (!sheet) return;
      sheet.celldata = sheet.celldata || [];
      // Find or create celldata entry
      const existing = sheet.celldata.find(cd => cd.r === r && cd.c === c);
      if (existing) {
        existing.v = { ...(existing.v || {}), v: value, m: String(value) };
      } else {
        sheet.celldata.push({ r, c, v: { v: value, m: String(value), bg: HIGHLIGHT_BG } });
      }
    });

    const editable = (resp.instance.status === 'draft' || resp.instance.status === 'rejected')
                     && resp.instance.created_by === user.id;

    const inputSet = new Set(
      (resp.template.input_cells || []).map(ic => `${ic.sheetIndex || 0}:${ic.row}:${ic.col}`)
    );

    window.luckysheet.create({
      container: 'luckysheet',
      lang: 'en',
      showinfobar: false,
      allowEdit: editable,
      data: sheets,
      hook: {
        cellEditBefore: (range) => {
          if (!editable) return false;
          const sheetIndex = window.luckysheet.getSheet().order || 0;
          for (const rng of range || []) {
            for (let r = rng.row[0]; r <= rng.row[1]; r++) {
              for (let c = rng.column[0]; c <= rng.column[1]; c++) {
                if (!inputSet.has(`${sheetIndex}:${r}:${c}`)) {
                  return false;
                }
              }
            }
          }
        },
        cellUpdateBefore: (r, c, value) => {
          if (!editable) return false;
          const sheetIndex = window.luckysheet.getSheet().order || 0;
          if (!inputSet.has(`${sheetIndex}:${r}:${c}`)) return false;
        }
      }
    });

    // Highlight input cells
    setTimeout(() => {
      (resp.template.input_cells || []).forEach(ic => {
        try {
          window.luckysheet.setCellFormat(ic.row, ic.col, 'bg', HIGHLIGHT_BG, { order: ic.sheetIndex || 0 });
        } catch {}
      });
    }, 400);
  };

  const collectFilledData = () => {
    const filled = {};
    const sheets = window.luckysheet.getAllSheets();
    inputCellsRef.current.forEach(ic => {
      const sIdx = ic.sheetIndex || 0;
      const sheet = sheets[sIdx];
      if (!sheet || !sheet.data) return;
      const row = sheet.data[ic.row];
      if (!row) return;
      const cell = row[ic.col];
      if (cell && cell.v !== undefined && cell.v !== null && cell.v !== '') {
        filled[`${sIdx}:${ic.row}:${ic.col}`] = cell.v;
      }
    });
    return filled;
  };

  const validateRequired = () => {
    const filled = collectFilledData();
    const missing = inputCellsRef.current
      .filter(ic => ic.required && !(`${ic.sheetIndex || 0}:${ic.row}:${ic.col}` in filled))
      .map(ic => ic.label);
    return missing;
  };

  const handleSave = async () => {
    setStatus('Saving...');
    try {
      const filled_data = collectFilledData();
      await api(`/instances/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ filled_data })
      });
      setStatus('Saved');
      setTimeout(() => setStatus(''), 1500);
    } catch (e) { setStatus('Error: ' + e.message); }
  };

  const canApprove = data && data.instance.status === 'pending'
    && rule && rule.approver_user_ids.includes(user.id)
    && !approvals.some(a => a.approver_user_id === user.id);

  const submitDecision = async (decision) => {
    try {
      await api(`/approvals/instance/${id}/${decision}`, {
        method: 'POST',
        body: JSON.stringify({ comment: decisionComment })
      });
      setShowDecisionModal(null);
      setDecisionComment('');
      setStatus(decision === 'approve' ? 'Approved' : 'Rejected');
      setTimeout(() => onBack(), 800);
    } catch (e) { setStatus('Error: ' + e.message); }
  };

  const handleSubmit = async () => {
    const missing = validateRequired();
    if (missing.length) {
      alert('Required fields missing:\n• ' + missing.join('\n• '));
      return;
    }
    if (!confirm('Submit this check sheet for approval? You will not be able to edit it after.')) return;
    setStatus('Submitting...');
    try {
      const filled_data = collectFilledData();
      await api(`/instances/${id}/submit`, {
        method: 'POST',
        body: JSON.stringify({ filled_data })
      });
      setStatus('Submitted');
      setTimeout(() => onBack(), 800);
    } catch (e) { setStatus('Error: ' + e.message); }
  };

  return (
    <div style={{ height: 'calc(100vh - 60px)', display: 'flex', flexDirection: 'column' }}>
      <div style={{
        padding: '10px 16px', background: '#f5f5f5', borderBottom: '1px solid #ddd',
        display: 'flex', gap: 10, alignItems: 'center'
      }}>
        <button onClick={onBack} style={btnStyle}>← Back</button>
        <strong>{data?.template?.name || '...'}</strong>
        {data && (
          <span style={badge(STATUS_COLORS[data.instance.status])}>
            {STATUS_LABELS[data.instance.status]}
          </span>
        )}
        {!isEditable && data && (
          <span style={{ color: '#888', fontSize: 12 }}>(read-only)</span>
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          {isEditable && (
            <>
              <button onClick={handleSave} style={btnStyle}>Save Draft</button>
              <button onClick={handleSubmit} style={{ ...btnStyle, background: '#2e9e4d' }}>
                Submit for Approval
              </button>
            </>
          )}
          {canApprove && (
            <>
              <button onClick={() => setShowDecisionModal('approve')}
                style={{ ...btnStyle, background: '#2e9e4d' }}>Approve</button>
              <button onClick={() => setShowDecisionModal('reject')}
                style={{ ...btnStyle, background: '#d93025' }}>Reject</button>
            </>
          )}
          <span style={{ color: '#555', fontSize: 12, marginLeft: 8 }}>{status}</span>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <div id="luckysheet" style={{ flex: 1, position: 'relative' }} />
        <aside style={{
          width: 240, background: '#fafafa', borderLeft: '1px solid #e0e0e0',
          padding: 12, overflow: 'auto'
        }}>
          <h4 style={{ marginTop: 0, marginBottom: 8 }}>Input Fields</h4>
          {(data?.template?.input_cells || []).length === 0 ? (
            <p style={{ fontSize: 12, color: '#999' }}>No input fields defined for this template.</p>
          ) : (
            (data.template.input_cells || [])
              .sort((a, b) => a.row - b.row || a.col - b.col)
              .map((f, i) => (
                <div key={i} style={fieldRow}>
                  <div style={{ fontWeight: 500, fontSize: 13 }}>
                    {f.label}{f.required && <span style={{ color: '#d93025' }}> *</span>}
                  </div>
                  <div style={{ fontSize: 11, color: '#666' }}>
                    R{f.row + 1}C{f.col + 1} • {f.type}
                  </div>
                </div>
              ))
          )}
          <p style={{ fontSize: 11, color: '#aaa', marginTop: 16 }}>
            Only the highlighted cells can be edited. Click a cell to fill it in.
          </p>

          {rule && (
            <>
              <h4 style={{ marginTop: 20, marginBottom: 6 }}>Approvals</h4>
              <div style={{ fontSize: 12, color: '#555', marginBottom: 8 }}>
                {approvals.filter(a => a.decision === 'approved').length} of {rule.required_count} approved
              </div>
              {approvals.length === 0 ? (
                <p style={{ fontSize: 11, color: '#999' }}>No decisions yet.</p>
              ) : (
                approvals.map(a => (
                  <div key={a.id} style={{
                    padding: 8, background: 'white', borderRadius: 4,
                    marginBottom: 6, border: '1px solid #eee', fontSize: 12
                  }}>
                    <div style={{
                      fontWeight: 600,
                      color: a.decision === 'approved' ? '#2e9e4d' : '#d93025'
                    }}>
                      {a.decision === 'approved' ? '✓ Approved' : '✗ Rejected'}
                    </div>
                    <div>{a.approver_name}</div>
                    <div style={{ color: '#888', fontSize: 11 }}>
                      {new Date(a.decided_at).toLocaleString()}
                    </div>
                    {a.comment && <div style={{ marginTop: 4, fontStyle: 'italic' }}>"{a.comment}"</div>}
                  </div>
                ))
              )}
            </>
          )}
        </aside>
      </div>

      {showDecisionModal && (
        <div style={modalBg} onClick={(e) => e.target === e.currentTarget && setShowDecisionModal(null)}>
          <div style={modal}>
            <h3 style={{ marginTop: 0 }}>
              {showDecisionModal === 'approve' ? 'Approve' : 'Reject'} Check Sheet
            </h3>
            <label style={{ display: 'block', fontSize: 12, color: '#555', marginBottom: 4 }}>
              Comment (optional)
            </label>
            <textarea
              value={decisionComment}
              onChange={(e) => setDecisionComment(e.target.value)}
              rows={4}
              style={{ width: '100%', padding: 10, border: '1px solid #ddd', borderRadius: 6, fontSize: 13, fontFamily: 'inherit' }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button onClick={() => submitDecision(showDecisionModal)} style={{
                padding: '8px 16px',
                background: showDecisionModal === 'approve' ? '#2e9e4d' : '#d93025',
                color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 14
              }}>
                Confirm {showDecisionModal === 'approve' ? 'Approval' : 'Rejection'}
              </button>
              <button onClick={() => setShowDecisionModal(null)}
                style={{ padding: '8px 14px', background: '#888', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 14 }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const modalBg = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 };
const modal = { background: 'white', padding: 24, borderRadius: 10, width: 420, boxShadow: '0 8px 30px rgba(0,0,0,0.2)' };

const btnStyle = { padding: '6px 14px', background: '#1a73e8', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13 };
const fieldRow = { padding: '8px 10px', background: 'white', borderRadius: 4, marginBottom: 6, border: '1px solid #eee' };
function badge(bg) {
  return {
    display: 'inline-block', padding: '3px 10px', borderRadius: 12, color: 'white',
    fontSize: 11, fontWeight: 600, textTransform: 'uppercase', background: bg
  };
}
