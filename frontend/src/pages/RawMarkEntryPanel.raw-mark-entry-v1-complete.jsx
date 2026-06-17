import { useEffect, useMemo, useState } from "react";

const API_BASE = "http://localhost:3000";

function convertPercentToLevel(earned, max) {
  const earnedNumber = Number(earned);
  const maxNumber = Number(max);

  if (!Number.isFinite(earnedNumber) || !Number.isFinite(maxNumber) || maxNumber <= 0) {
    return "—";
  }

  const percent = (earnedNumber / maxNumber) * 100;

  if (percent >= 92) return 6;
  if (percent >= 80) return 5;
  if (percent >= 67) return 4;
  if (percent >= 50) return 3;
  if (percent >= 35) return 2;
  return 1;
}

export default function RawMarkEntryPanel({
  assignmentId,
  selectedRow,
  sectionScoreRows,
  onReload,
}) {
  const [saving, setSaving] = useState(false);
  const [localScores, setLocalScores] = useState({});
  const [message, setMessage] = useState("");

  const studentSections = useMemo(() => {
    if (!selectedRow?.student_email) return [];

    return sectionScoreRows.filter(
      (row) =>
        String(row.student_email).toLowerCase() ===
        String(selectedRow.student_email).toLowerCase()
    );
  }, [sectionScoreRows, selectedRow]);

  const studentUserId = studentSections[0]?.student_user_id || null;

  useEffect(() => {
    setLocalScores({});
    setMessage("");
  }, [selectedRow?.student_email]);

  function getScoreValue(section) {
    const key = String(section.assignment_section_id);
    if (localScores[key] !== undefined) return localScores[key];
    return section.earned_points ?? "";
  }

  async function saveRawMarks(options = {}) {
    if (!studentUserId) {
      setMessage("Missing student id from section scores. Reload the page and try again.");
      return;
    }

    const scores = studentSections.map((section) => ({
      assignment_section_id: section.assignment_section_id,
      earned_points: getScoreValue(section),
    }));

    try {
      setSaving(true);
      setMessage("Saving raw marks...");

      const res = await fetch(`${API_BASE}/api/assignments/${assignmentId}/section-scores`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_user_id: studentUserId,
          scores,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to save raw marks.");
      }

      setMessage(
        `Saved raw marks. Converted KDU: DO ${data.rubric_selection?.DO ?? "—"}, KNOW ${data.rubric_selection?.KNOW ?? "—"}, UNDERSTAND ${data.rubric_selection?.UNDERSTAND ?? "—"}.`
      );

      if (onReload) {
        await onReload(selectedRow.student_email, options);
      }
    } catch (err) {
      setMessage(err.message || "Failed to save raw marks.");
    } finally {
      setSaving(false);
    }
  }

  if (!selectedRow) return null;

  if (studentSections.length === 0) {
    return (
      <div style={panelStyle}>
        <h3 style={{ marginTop: 0 }}>Raw Mark Entry</h3>
        <div style={{ color: "#4b5563", lineHeight: 1.5 }}>
          No exam sections are attached to this assignment yet. Open Edit Assignment and save exam sections first.
        </div>
      </div>
    );
  }

  return (
    <div style={panelStyle}>
      <h3 style={{ marginTop: 0, marginBottom: "8px" }}>Raw Mark Entry</h3>
      <div style={{ color: "#4b5563", lineHeight: 1.5, marginBottom: "14px" }}>
        Enter earned marks. SUPER LMS converts each section to a 1–6 KDU level and syncs the final KDU score automatically.
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Section</th>
              <th style={thStyle}>Bucket</th>
              <th style={thStyle}>Earned</th>
              <th style={thStyle}>Out Of</th>
              <th style={thStyle}>Converted Level</th>
            </tr>
          </thead>
          <tbody>
            {studentSections.map((section) => {
              const value = getScoreValue(section);
              const convertedLevel = convertPercentToLevel(value, section.max_points);

              return (
                <tr key={section.assignment_section_id}>
                  <td style={tdStyle}>{section.section_name}</td>
                  <td style={tdStyle}>{section.competency_bucket}</td>
                  <td style={tdStyle}>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={value}
                      onChange={(e) =>
                        setLocalScores((current) => ({
                          ...current,
                          [section.assignment_section_id]: e.target.value,
                        }))
                      }
                      style={inputStyle}
                    />
                  </td>
                  <td style={tdStyle}>{section.max_points}</td>
                  <td style={tdStyle}>{convertedLevel}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "14px" }}>
        <button type="button" onClick={() => saveRawMarks()} disabled={saving} style={buttonStyle}>
          {saving ? "Saving..." : "Save Raw Marks"}
        </button>

        <button
          type="button"
          onClick={() => saveRawMarks({ advanceToNextStudent: true })}
          disabled={saving}
          style={buttonStyle}
        >
          {saving ? "Saving..." : "Save Raw Marks & Next Student"}
        </button>
      </div>

      {message ? <div style={{ marginTop: "10px", color: "#4b5563", lineHeight: 1.5 }}>{message}</div> : null}
    </div>
  );
}

const panelStyle = {
  border: "2px solid #111827",
  borderRadius: "14px",
  padding: "18px",
  background: "#ffffff",
  marginBottom: "18px",
};

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse",
  minWidth: "700px",
};

const thStyle = {
  border: "1px solid #d7dce5",
  padding: "10px",
  textAlign: "left",
  background: "#f8fafc",
};

const tdStyle = {
  border: "1px solid #d7dce5",
  padding: "10px",
  verticalAlign: "top",
};

const inputStyle = {
  width: "110px",
  padding: "10px",
  borderRadius: "8px",
  border: "1px solid #cbd5e1",
  font: "inherit",
};

const buttonStyle = {
  padding: "10px 14px",
  borderRadius: "10px",
  border: "2px solid #111827",
  background: "#ffffff",
  fontWeight: 800,
  cursor: "pointer",
};
