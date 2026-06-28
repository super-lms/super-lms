import { useEffect, useMemo, useState } from "react";
import API_BASE from "../apiBase";


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

function getPercentLabel(earned, max) {
  const earnedNumber = Number(earned);
  const maxNumber = Number(max);

  if (!Number.isFinite(earnedNumber) || !Number.isFinite(maxNumber) || maxNumber <= 0) {
    return "Enter a score to preview.";
  }

  return `${((earnedNumber / maxNumber) * 100).toFixed(1)}%`;
}

function getPercentValue(earned, max) {
  const earnedNumber = Number(earned);
  const maxNumber = Number(max);

  if (!Number.isFinite(earnedNumber) || !Number.isFinite(maxNumber) || maxNumber <= 0) {
    return "";
  }

  return ((earnedNumber / maxNumber) * 100).toFixed(1);
}

function convertPercentInputToEarned(percent, max) {
  const percentNumber = Number(percent);
  const maxNumber = Number(max);

  if (!Number.isFinite(percentNumber) || !Number.isFinite(maxNumber) || maxNumber <= 0) {
    return "";
  }

  const boundedPercent = Math.max(0, Math.min(100, percentNumber));
  return ((boundedPercent / 100) * maxNumber).toFixed(2);
}

function getBucketAverage(sections, bucketName, getScoreValue) {
  const matching = sections.filter(
    (section) => String(section.competency_bucket || "").toUpperCase() === bucketName
  );

  const scored = matching
    .map((section) => {
      const level = convertPercentToLevel(getScoreValue(section), section.max_points);
      const weight = Number(section.section_weight || 1);

      return {
        level: Number(level),
        weight: Number.isFinite(weight) && weight > 0 ? weight : 1,
      };
    })
    .filter((item) => Number.isFinite(item.level));

  if (scored.length === 0) return "—";

  const totalWeight = scored.reduce((sum, item) => sum + item.weight, 0);
  if (totalWeight <= 0) return "—";

  const weightedTotal = scored.reduce((sum, item) => sum + item.level * item.weight, 0);
  return (weightedTotal / totalWeight).toFixed(2);
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

  function updateScore(sectionId, value) {
    setLocalScores((current) => ({
      ...current,
      [sectionId]: value,
    }));
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
        `Saved. Next step: review the KDU scores below, then continue to the next student. Converted KDU: DO ${data.rubric_selection?.DO ?? "—"}, KNOW ${data.rubric_selection?.KNOW ?? "—"}, UNDERSTAND ${data.rubric_selection?.UNDERSTAND ?? "—"}.`
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
        <h3 style={{ marginTop: 0 }}>Raw Mark Entry Wizard</h3>
        <div style={{ color: "#4b5563", lineHeight: 1.5 }}>
          No exam sections are attached to this assignment yet. Open Edit Assignment and save exam sections first.
        </div>
      </div>
    );
  }

  const knowPreview = getBucketAverage(studentSections, "KNOW", getScoreValue);
  const doPreview = getBucketAverage(studentSections, "DO", getScoreValue);
  const understandPreview = getBucketAverage(studentSections, "UNDERSTAND", getScoreValue);

  return (
    <div style={panelStyle}>
      <h3 style={{ marginTop: 0, marginBottom: "8px" }}>Raw Mark Entry Wizard</h3>

      <div style={stepBoxStyle}>
        <strong>Step 1: Enter this student's raw scores.</strong>
        <div style={{ marginTop: "6px" }}>
          Type the mark earned for each section. SUPER LMS shows the percent and KDU level immediately.
        </div>
      </div>

      <div style={{ display: "grid", gap: "12px" }}>
        {studentSections.map((section) => {
          const value = getScoreValue(section);
          const convertedLevel = convertPercentToLevel(value, section.max_points);
          const percentLabel = getPercentLabel(value, section.max_points);

          return (
            <div key={section.assignment_section_id} style={sectionCardStyle}>
              <div style={{ fontWeight: 800, marginBottom: "6px" }}>{section.section_name}</div>
              <div style={{ marginBottom: "10px", color: "#4b5563" }}>
                KDU Bucket: <strong>{section.competency_bucket}</strong>
              </div>

              <div style={{ display: "grid", gap: "10px" }}>
                <label style={labelStyle}>
                  Score earned
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", marginTop: "6px" }}>
                    <input
                      type="number"
                      min="0"
                      max={section.max_points}
                      step="0.5"
                      value={value}
                      onChange={(e) => updateScore(section.assignment_section_id, e.target.value)}
                      style={inputStyle}
                      aria-label={`Score earned for ${section.section_name}`}
                    />
                    <span>out of {section.max_points}</span>
                  </div>
                </label>

                <label style={labelStyle}>
                  Percentage
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", marginTop: "6px" }}>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={getPercentValue(value, section.max_points)}
                      onChange={(e) => updateScore(section.assignment_section_id, convertPercentInputToEarned(e.target.value, section.max_points))}
                      style={inputStyle}
                      aria-label={`Percentage for ${section.section_name}`}
                    />
                    <span>%</span>
                  </div>
                </label>
              </div>

              <div style={{ marginTop: "10px", lineHeight: 1.5 }}>
                <div><strong>Percent Preview:</strong> {percentLabel}</div>
                <div><strong>Converted KDU Level:</strong> {convertedLevel}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={stepBoxStyle}>
        <strong>Step 2: Review automatic KDU preview.</strong>
        <div style={{ marginTop: "8px", display: "grid", gap: "4px" }}>
          <div><strong>KNOW:</strong> {knowPreview}</div>
          <div><strong>DO:</strong> {doPreview}</div>
          <div><strong>UNDERSTAND:</strong> {understandPreview}</div>
        </div>
      </div>

      <div style={stepBoxStyle}>
        <strong>Step 3: Save and continue.</strong>
        <div style={{ marginTop: "6px" }}>
          After saving, SUPER LMS syncs these raw marks into the KDU rubric below.
        </div>
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

      {message ? <div style={messageStyle}>{message}</div> : null}
    </div>
  );
}

const panelStyle = {
  border: "2px solid #111827",
  borderRadius: "12px",
  padding: "12px",
  background: "#ffffff",
  marginBottom: "12px",
};

const stepBoxStyle = {
  border: "1px solid #d7dce5",
  borderRadius: "10px",
  padding: "9px",
  background: "#f8fafc",
  marginBottom: "9px",
  lineHeight: 1.35,
};

const sectionCardStyle = {
  border: "1px solid #d7dce5",
  borderRadius: "10px",
  padding: "10px",
  background: "#ffffff",
};

const labelStyle = {
  display: "block",
  fontWeight: 800,
};

const inputStyle = {
  width: "120px",
  padding: "8px",
  borderRadius: "8px",
  border: "1px solid #cbd5e1",
  font: "inherit",
};

const buttonStyle = {
  padding: "8px 12px",
  borderRadius: "9px",
  border: "1px solid #111827",
  background: "#ffffff",
  fontWeight: 800,
  cursor: "pointer",
};

const messageStyle = {
  marginTop: "9px",
  color: "#4b5563",
  lineHeight: 1.35,
  border: "1px solid #d7dce5",
  borderRadius: "10px",
  padding: "9px",
};
