import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

const API_BASE = "http://localhost:3000";

function ActionButton({
  children,
  onClick,
  type = "button",
  disabled = false,
  quiet = false,
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "10px 14px",
        borderRadius: "10px",
        border: "1px solid #d7dce5",
        background: quiet ? "#ffffff" : "#f3f4f6",
        font: "inherit",
        fontWeight: 700,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.7 : 1,
      }}
    >
      {children}
    </button>
  );
}

function StatusBanner({ filteredRows, selectedRow, searchText }) {
  let text = "Ready to grade.";

  if (!filteredRows || filteredRows.length === 0) {
    if (String(searchText || "").trim() !== "") {
      text = "No students match your search.";
    } else {
      text = "No students found for this assignment.";
    }
  } else if (!selectedRow) {
    text = "Select a student to begin grading.";
  } else if (
    !selectedRow.submission_status ||
    selectedRow.submission_status === "None"
  ) {
    text = "This student has not submitted work yet.";
  }

  return (
    <div
      style={{
        padding: "12px 14px",
        border: "1px solid #d7dce5",
        borderRadius: "10px",
        marginBottom: "16px",
        fontWeight: 700,
        background: "#f8fafc",
      }}
    >
      {text}
    </div>
  );
}

function KduScoreInput({ label, weight, value, onChange, helper }) {
  return (
    <div
      style={{
        border: "1px solid #d7dce5",
        borderRadius: "12px",
        padding: "14px",
        background: "#ffffff",
      }}
    >
      <div style={{ fontWeight: 800, marginBottom: "6px" }}>
        {label} ({weight}%)
      </div>

      <div
        style={{
          fontSize: "0.92rem",
          lineHeight: 1.45,
          color: "#4b5563",
          marginBottom: "10px",
        }}
      >
        {helper}
      </div>

      <input
        type="number"
        min="1"
        max="6"
        step="0.1"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "120px",
          padding: "10px 12px",
          borderRadius: "10px",
          border: "1px solid #cbd5e1",
          font: "inherit",
          fontWeight: 700,
          boxSizing: "border-box",
        }}
      />

      <span style={{ marginLeft: "8px", fontWeight: 700 }}>/ 6</span>
    </div>
  );
}

function toSafeScore(value) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  if (parsed < 1) {
    return 1;
  }

  if (parsed > 6) {
    return 6;
  }

  return parsed;
}

function getKduPercent(scoreOutOfSix) {
  return (scoreOutOfSix / 6) * 100;
}

function getProficiencyLabel(scoreOutOfSix) {
  if (scoreOutOfSix >= 5.5) return "Extending";
  if (scoreOutOfSix >= 4) return "Proficient";
  if (scoreOutOfSix >= 2.5) return "Developing";
  return "Emerging";
}

export default function AssignmentSpeedGradingPage() {
  const { assignmentId } = useParams();
  const navigate = useNavigate();

  const [rows, setRows] = useState([]);
  const [selectedRow, setSelectedRow] = useState(null);
  const [searchText, setSearchText] = useState("");

  const [doScore, setDoScore] = useState("4");
  const [knowScore, setKnowScore] = useState("4");
  const [understandScore, setUnderstandScore] = useState("4");

  useEffect(() => {
    loadGradebook();
  }, [assignmentId]);

  async function loadGradebook() {
    try {
      const res = await fetch(
        `${API_BASE}/api/assignments/${assignmentId}/gradebook`
      );

      const data = await res.json();

      if (res.ok && Array.isArray(data.rows)) {
        setRows(data.rows);
        setSelectedRow(data.rows.length > 0 ? data.rows[0] : null);
      } else {
        setRows([]);
        setSelectedRow(null);
      }
    } catch (error) {
      console.error("Failed to load gradebook:", error);
      setRows([]);
      setSelectedRow(null);
    }
  }

  const filteredRows = useMemo(() => {
    const term = String(searchText || "").trim().toLowerCase();

    if (!term) {
      return rows;
    }

    return rows.filter((row) => {
      const name = String(row.student_name || "").toLowerCase();
      return name.includes(term);
    });
  }, [rows, searchText]);

  useEffect(() => {
    if (filteredRows.length === 0) {
      setSelectedRow(null);
      return;
    }

    const selectedStillExists = filteredRows.some(
      (row) => row.student_email === selectedRow?.student_email
    );

    if (!selectedStillExists) {
      setSelectedRow(filteredRows[0]);
    }
  }, [filteredRows, selectedRow]);

  const kduFinalScore = useMemo(() => {
    const doValue = toSafeScore(doScore);
    const knowValue = toSafeScore(knowScore);
    const understandValue = toSafeScore(understandScore);

    return doValue * 0.5 + knowValue * 0.25 + understandValue * 0.25;
  }, [doScore, knowScore, understandScore]);

  const kduPercent = getKduPercent(kduFinalScore);
  const proficiencyLabel = getProficiencyLabel(kduFinalScore);

  return (
    <div className="content-area">
      <section className="panel">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            flexWrap: "wrap",
            marginBottom: "16px",
          }}
        >
          <ActionButton quiet onClick={() => navigate("/assignments")}>
            ← Back to Assignments
          </ActionButton>

          <div
            style={{
              fontSize: "0.95rem",
              fontWeight: 700,
            }}
          >
            Assignment ID: {assignmentId}
          </div>
        </div>

        <h1 style={{ marginTop: 0, marginBottom: "8px" }}>Speed Grading</h1>

        <div
          style={{
            marginBottom: "16px",
            fontSize: "1rem",
          }}
        >
          Review student submission status, score, feedback, and KDU competency
          scoring in one place.
        </div>

        <StatusBanner
          filteredRows={filteredRows}
          selectedRow={selectedRow}
          searchText={searchText}
        />

        <div style={{ marginBottom: "16px" }}>
          <input
            placeholder="Search student..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{
              padding: "12px",
              width: "100%",
              maxWidth: "375px",
              borderRadius: "10px",
              border: "1px solid #ccc",
              boxSizing: "border-box",
              font: "inherit",
              background: "#ffffff",
            }}
          />
        </div>

        {filteredRows.length === 0 ? (
          <div
            style={{
              border: "1px solid #d7dce5",
              borderRadius: "10px",
              padding: "16px",
              background: "#ffffff",
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: "10px" }}>
              No students to display.
            </div>
            <ActionButton quiet onClick={() => navigate("/assignments")}>
              ← Back to Assignments
            </ActionButton>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "375px minmax(0, 1fr)",
              gap: "28px",
              alignItems: "start",
            }}
          >
            <div>
              {filteredRows.map((row) => {
                const isSelected =
                  selectedRow?.student_email === row.student_email;

                return (
                  <button
                    key={row.student_email}
                    type="button"
                    onClick={() => setSelectedRow(row)}
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      padding: "16px",
                      borderRadius: "0",
                      border: "1px solid #cbd5e1",
                      marginBottom: "10px",
                      cursor: "pointer",
                      font: "inherit",
                      fontWeight: isSelected ? 700 : 500,
                      background: isSelected ? "#eef2f7" : "#ffffff",
                    }}
                  >
                    <div style={{ marginBottom: "6px" }}>
                      {row.student_name}
                    </div>
                    <div style={{ fontSize: "0.95rem" }}>
                      Status: {row.submission_status || "None"}
                    </div>
                  </button>
                );
              })}
            </div>

            <div>
              {!selectedRow ? (
                <div
                  style={{
                    border: "1px solid #d7dce5",
                    borderRadius: "10px",
                    padding: "16px",
                    background: "#ffffff",
                  }}
                >
                  Select a student.
                </div>
              ) : (
                <>
                  <h2
                    style={{
                      marginTop: 0,
                      marginBottom: "16px",
                      fontSize: "3rem",
                      fontWeight: 800,
                    }}
                  >
                    {selectedRow.student_name}
                  </h2>

                  <div style={{ marginBottom: "14px", fontSize: "1rem" }}>
                    <strong>Submission:</strong>{" "}
                    {selectedRow.submission_status || "None"}
                  </div>

                  <div style={{ marginBottom: "14px", fontSize: "1rem" }}>
                    <strong>Existing Score:</strong> {selectedRow.score ?? "—"}
                  </div>

                  <div style={{ marginBottom: "20px", fontSize: "1rem" }}>
                    <strong>Existing Feedback:</strong>
                    <div>{selectedRow.feedback || "No feedback yet."}</div>
                  </div>

                  <div
                    style={{
                      border: "1px solid #d7dce5",
                      borderRadius: "14px",
                      padding: "18px",
                      background: "#f8fafc",
                      marginBottom: "18px",
                    }}
                  >
                    <h3 style={{ marginTop: 0, marginBottom: "8px" }}>
                      KDU Competency Rubric Draft
                    </h3>

                    <div
                      style={{
                        fontSize: "0.95rem",
                        lineHeight: 1.5,
                        color: "#4b5563",
                        marginBottom: "16px",
                      }}
                    >
                      This is a demo-safe scoring layer only. Scores calculate
                      locally for now and do not save yet.
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gap: "12px",
                        marginBottom: "16px",
                      }}
                    >
                      <KduScoreInput
                        label="DO / Content Learning Standards"
                        weight={50}
                        value={doScore}
                        onChange={setDoScore}
                        helper="What the student produces or demonstrates through the assignment."
                      />

                      <KduScoreInput
                        label="KNOW / Curricular Competencies"
                        weight={25}
                        value={knowScore}
                        onChange={setKnowScore}
                        helper="What the student knows, identifies, applies, or uses accurately."
                      />

                      <KduScoreInput
                        label="UNDERSTAND / Core Competencies"
                        weight={25}
                        value={understandScore}
                        onChange={setUnderstandScore}
                        helper="How well the student explains the why/how behind their choices and learning."
                      />
                    </div>

                    <div
                      style={{
                        border: "1px solid #cbd5e1",
                        borderRadius: "12px",
                        padding: "14px",
                        background: "#ffffff",
                        display: "grid",
                        gap: "8px",
                      }}
                    >
                      <div>
                        <strong>Weighted KDU Score:</strong>{" "}
                        {kduFinalScore.toFixed(2)} / 6
                      </div>

                      <div>
                        <strong>Percentage Equivalent:</strong>{" "}
                        {kduPercent.toFixed(1)}%
                      </div>

                      <div>
                        <strong>Proficiency:</strong> {proficiencyLabel}
                      </div>

                      <div style={{ color: "#4b5563", lineHeight: 1.5 }}>
                        Formula: DO × 50%, KNOW × 25%, UNDERSTAND × 25%.
                      </div>
                    </div>
                  </div>

                  <ActionButton quiet onClick={() => navigate("/assignments")}>
                    ← Back to Assignments
                  </ActionButton>
                </>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}