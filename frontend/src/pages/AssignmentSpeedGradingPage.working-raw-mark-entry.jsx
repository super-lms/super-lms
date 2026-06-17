import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import RawMarkEntryPanel from "./RawMarkEntryPanel";

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
          whiteSpace: "pre-wrap",
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

function getRubricCriterion(criteria, bucket, fallback) {
  const match =
    criteria.find(
      (criterion) =>
        String(criterion.competency_bucket || "").trim().toUpperCase() === bucket
    ) || null;

  return match?.criterion_text || fallback;
}

function getSavedKduSummary(row) {
  const rubricSelection = row?.rubric_selection || {};

  const hasRubricSelection =
    rubricSelection.DO !== undefined ||
    rubricSelection.KNOW !== undefined ||
    rubricSelection.UNDERSTAND !== undefined ||
    rubricSelection.doScore !== undefined ||
    rubricSelection.knowScore !== undefined ||
    rubricSelection.understandScore !== undefined;

  if (!hasRubricSelection) {
    return {
      isGraded: false,
      label: "Not scored",
      percent: null,
      scoreOutOfSix: null,
    };
  }

  const doValue = toSafeScore(
    rubricSelection.DO ?? rubricSelection.doScore ?? rubricSelection.do_score
  );
  const knowValue = toSafeScore(
    rubricSelection.KNOW ?? rubricSelection.knowScore ?? rubricSelection.know_score
  );
  const understandValue = toSafeScore(
    rubricSelection.UNDERSTAND ??
      rubricSelection.understandScore ??
      rubricSelection.understand_score
  );

  const scoreOutOfSix = doValue * 0.5 + knowValue * 0.25 + understandValue * 0.25;
  const percent = getKduPercent(scoreOutOfSix);

  return {
    isGraded: true,
    label: `${getProficiencyLabel(scoreOutOfSix)} (${percent.toFixed(1)}%)`,
    percent,
    scoreOutOfSix,
  };
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
  const [savingKduScores, setSavingKduScores] = useState(false);
  const [kduSaveMessage, setKduSaveMessage] = useState("");
  const [kduLastSavedAt, setKduLastSavedAt] = useState("");

  const [rubricLoading, setRubricLoading] = useState(false);
  const [rubric, setRubric] = useState(null);
  const [rubricCriteria, setRubricCriteria] = useState([]);
  const [fullRubricLoading, setFullRubricLoading] = useState(false);
  const [fullRubricTitle, setFullRubricTitle] = useState("");
  const [fullRubricRows, setFullRubricRows] = useState([]);
  const [showFullRubric, setShowFullRubric] = useState(true);
  const [saveToastTarget, setSaveToastTarget] = useState(null);
  const [shortcutBucket, setShortcutBucket] = useState(null);
  const [showQuickDemo, setShowQuickDemo] = useState(false);
  const [sectionScoreRows, setSectionScoreRows] = useState([]);
  const [sectionScoresLoading, setSectionScoresLoading] = useState(false);
  const [sectionScoresMessage, setSectionScoresMessage] = useState("");

  useEffect(() => {
    loadGradebook();
    loadKduRubric();
    loadFullKduRubric();
    loadSectionScores();
  }, [assignmentId]);

  async function loadGradebook(nextSelectedEmail = null) {
    try {
      const res = await fetch(
        `${API_BASE}/api/assignments/${assignmentId}/gradebook`
      );

      const data = await res.json();

      if (res.ok && Array.isArray(data.rows)) {
        setRows(data.rows);

        const preferredEmail =
          nextSelectedEmail || selectedRow?.student_email || data.rows[0]?.student_email || null;

        const preferredRow =
          data.rows.find((row) => row.student_email === preferredEmail) || data.rows[0] || null;

        setSelectedRow(preferredRow);
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

  async function loadKduRubric() {
    try {
      setRubricLoading(true);

      const res = await fetch(
        `${API_BASE}/api/assignments/${assignmentId}/kdu-rubric`
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to load KDU rubric");
      }

      setRubric(data.rubric || null);
      setRubricCriteria(Array.isArray(data.criteria) ? data.criteria : []);
    } catch (error) {
      console.error("Failed to load KDU rubric:", error);
      setRubric(null);
      setRubricCriteria([]);
    } finally {
      setRubricLoading(false);
    }
  }

  async function loadFullKduRubric() {
    try {
      setFullRubricLoading(true);

      const res = await fetch(
        `${API_BASE}/api/assignments/${assignmentId}/full-kdu-rubric`
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to load full KDU rubric");
      }

      if (data.rubric === null) {
        setFullRubricTitle("");
        setFullRubricRows([]);
        return;
      }

      setFullRubricTitle(data.title || "Saved 6-Level KDU Rubric");
      setFullRubricRows(Array.isArray(data.rows) ? data.rows : []);
    } catch (error) {
      console.error("Failed to load full KDU rubric:", error);
      setFullRubricTitle("");
      setFullRubricRows([]);
    } finally {
      setFullRubricLoading(false);
    }
  }


  async function loadSectionScores() {
    try {
      setSectionScoresLoading(true);
      setSectionScoresMessage("");

      const res = await fetch(`${API_BASE}/api/assignments/${assignmentId}/section-scores`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to load raw mark sections");
      }

      setSectionScoreRows(Array.isArray(data.rows) ? data.rows : []);
    } catch (error) {
      console.error("Failed to load section scores:", error);
      setSectionScoreRows([]);
      setSectionScoresMessage(error.message || "Failed to load raw mark sections.");
    } finally {
      setSectionScoresLoading(false);
    }
  }

  async function reloadAfterRawMarkSave(nextSelectedEmail = null) {
    await loadSectionScores();
    await loadGradebook(nextSelectedEmail);
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

  const gradedSummary = useMemo(() => {
    const summaries = rows.map((row) => ({
      row,
      summary: getSavedKduSummary(row),
    }));

    const graded = summaries.filter((item) => item.summary.isGraded);
    const gradedCount = graded.length;
    const totalCount = rows.length;

    const averagePercent =
      gradedCount > 0
        ? graded.reduce((sum, item) => sum + Number(item.summary.percent || 0), 0) / gradedCount
        : null;

    const distribution = {
      Extending: graded.filter((item) => item.summary.scoreOutOfSix >= 5.5).length,
      Proficient: graded.filter(
        (item) => item.summary.scoreOutOfSix >= 4 && item.summary.scoreOutOfSix < 5.5
      ).length,
      Developing: graded.filter(
        (item) => item.summary.scoreOutOfSix >= 2.5 && item.summary.scoreOutOfSix < 4
      ).length,
      Emerging: graded.filter((item) => item.summary.scoreOutOfSix < 2.5).length,
      Unscored: totalCount - gradedCount,
    };

    const sortedByPercent = [...graded].sort(
      (a, b) => Number(b.summary.percent || 0) - Number(a.summary.percent || 0)
    );

    const topStudents = sortedByPercent.slice(0, 3).map((item) => ({
      name: item.row.student_name,
      percent: item.summary.percent,
      label: getProficiencyLabel(item.summary.scoreOutOfSix),
    }));

    const needsSupport = [...sortedByPercent].reverse().slice(0, 3).map((item) => ({
      name: item.row.student_name,
      percent: item.summary.percent,
      label: getProficiencyLabel(item.summary.scoreOutOfSix),
    }));

    return {
      gradedCount,
      totalCount,
      averagePercent,
      distribution,
      topStudents,
      needsSupport,
    };
  }, [rows]);

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

  function loadKduScoresFromSelectedStudent(row) {
    const rubricSelection = row?.rubric_selection || {};

    const nextDoScore =
      rubricSelection.DO ?? rubricSelection.doScore ?? rubricSelection.do_score ?? "4";
    const nextKnowScore =
      rubricSelection.KNOW ?? rubricSelection.knowScore ?? rubricSelection.know_score ?? "4";
    const nextUnderstandScore =
      rubricSelection.UNDERSTAND ??
      rubricSelection.understandScore ??
      rubricSelection.understand_score ??
      "4";

    setDoScore(String(nextDoScore));
    setKnowScore(String(nextKnowScore));
    setUnderstandScore(String(nextUnderstandScore));
    setKduSaveMessage("");
  }

  useEffect(() => {
    loadKduScoresFromSelectedStudent(selectedRow);
  }, [selectedRow?.student_email]);

  useEffect(() => {
    function handleKeyboardShortcut(event) {
      const activeTagName = String(document.activeElement?.tagName || "").toLowerCase();

      if (activeTagName === "input" || activeTagName === "textarea" || activeTagName === "select") {
        return;
      }

      const key = String(event.key || "").toUpperCase();

      if (key === "K") {
        setShortcutBucket("KNOW");
        setKduSaveMessage("Keyboard shortcut ready: press 1–6 for KNOW.");
        return;
      }

      if (key === "D") {
        setShortcutBucket("DO");
        setKduSaveMessage("Keyboard shortcut ready: press 1–6 for DO.");
        return;
      }

      if (key === "U") {
        setShortcutBucket("UNDERSTAND");
        setKduSaveMessage("Keyboard shortcut ready: press 1–6 for UNDERSTAND.");
        return;
      }

      if (!["1", "2", "3", "4", "5", "6"].includes(key)) {
        return;
      }

      const nextScore = key;

      if (shortcutBucket === "KNOW") {
        setKnowScore(nextScore);
        setKduSaveMessage(`KNOW set to Level ${nextScore}. Saving...`);
        saveKduScores(
          { knowScore: nextScore },
          { bucket: "KNOW", level: nextScore },
          { advanceToNextStudent: true }
        );
        setShortcutBucket(null);
        return;
      }

      if (shortcutBucket === "DO") {
        setDoScore(nextScore);
        setKduSaveMessage(`DO set to Level ${nextScore}. Saving...`);
        saveKduScores(
          { doScore: nextScore },
          { bucket: "DO", level: nextScore },
          { advanceToNextStudent: true }
        );
        setShortcutBucket(null);
        return;
      }

      if (shortcutBucket === "UNDERSTAND") {
        setUnderstandScore(nextScore);
        setKduSaveMessage(`UNDERSTAND set to Level ${nextScore}. Saving...`);
        saveKduScores(
          { understandScore: nextScore },
          { bucket: "UNDERSTAND", level: nextScore },
          { advanceToNextStudent: true }
        );
        setShortcutBucket(null);
        return;
      }

      setDoScore(nextScore);
      setKnowScore(nextScore);
      setUnderstandScore(nextScore);
      setKduSaveMessage(`DO, KNOW, and UNDERSTAND set to Level ${nextScore}. Saving...`);
      saveKduScores(
        {
          doScore: nextScore,
          knowScore: nextScore,
          understandScore: nextScore,
        },
        { bucket: "ALL", level: nextScore },
        { advanceToNextStudent: true }
      );
    }

    window.addEventListener("keydown", handleKeyboardShortcut);

    return () => {
      window.removeEventListener("keydown", handleKeyboardShortcut);
    };
  }, [shortcutBucket, selectedRow?.student_email, doScore, knowScore, understandScore]);

  function getNextStudentEmail() {
    if (!selectedRow?.student_email || filteredRows.length === 0) {
      return null;
    }

    const currentIndex = filteredRows.findIndex(
      (row) => row.student_email === selectedRow.student_email
    );

    if (currentIndex === -1) {
      return filteredRows[0]?.student_email || null;
    }

    const nextRow = filteredRows[currentIndex + 1];

    return nextRow?.student_email || selectedRow.student_email;
  }

  async function saveKduScores(scoreOverrides = {}, toastTarget = null, options = {}) {
    if (!selectedRow?.student_email) {
      setKduSaveMessage("Select a student before saving KDU scores.");
      return;
    }

    const nextDoScore = scoreOverrides.doScore ?? doScore;
    const nextKnowScore = scoreOverrides.knowScore ?? knowScore;
    const nextUnderstandScore = scoreOverrides.understandScore ?? understandScore;

    try {
      setSavingKduScores(true);
      setKduSaveMessage("Saving...");
      if (toastTarget) {
        setSaveToastTarget({ ...toastTarget, status: "Saving..." });
      }

      const res = await fetch(`${API_BASE}/api/assignments/${assignmentId}/kdu-scores`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_email: selectedRow.student_email,
          doScore: toSafeScore(nextDoScore),
          knowScore: toSafeScore(nextKnowScore),
          understandScore: toSafeScore(nextUnderstandScore),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to save KDU scores");
      }

      const now = new Date();
      const formattedTime = now.toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      });

      setKduLastSavedAt(formattedTime);
      setKduSaveMessage(`Saved ✓ at ${formattedTime}`);
      if (toastTarget) {
        setSaveToastTarget({ ...toastTarget, status: "Saved ✓" });
        window.setTimeout(() => {
          setSaveToastTarget((current) =>
            current &&
            current.bucket === toastTarget.bucket &&
            String(current.level) === String(toastTarget.level)
              ? null
              : current
          );
        }, 1400);
      }
      const nextSelectedEmail = options.advanceToNextStudent ? getNextStudentEmail() : selectedRow?.student_email;
      await loadGradebook(nextSelectedEmail);

      if (options.goToDashboard) {
        navigate("/dashboard");
      }
    } catch (error) {
      console.error("Failed to save KDU scores:", error);
      setKduSaveMessage(error.message || "Failed to save KDU scores.");
    } finally {
      setSavingKduScores(false);
    }
  }

  async function saveAndBackToDashboard() {
    if (!selectedRow?.student_email) {
      navigate("/dashboard");
      return;
    }

    await saveKduScores({}, null, { goToDashboard: true });
  }

  const doCriterionText = getRubricCriterion(
    rubricCriteria,
    "DO",
    "What the student produces or demonstrates through the assignment."
  );

  const knowCriterionText = getRubricCriterion(
    rubricCriteria,
    "KNOW",
    "What the student knows, identifies, applies, or uses accurately."
  );

  const understandCriterionText = getRubricCriterion(
    rubricCriteria,
    "UNDERSTAND",
    "How well the student explains the why/how behind their choices and learning."
  );

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
      <div style={floatingDashboardButtonWrapStyle}>
        <ActionButton
          onClick={saveAndBackToDashboard}
          disabled={savingKduScores}
        >
          {savingKduScores ? "Saving..." : "Save & Back to Dashboard"}
        </ActionButton>
      </div>

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

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            flexWrap: "wrap",
            marginBottom: "8px",
          }}
        >
          <h1 style={{ marginTop: 0, marginBottom: 0 }}>Speed Grading</h1>

          <ActionButton quiet onClick={() => setShowQuickDemo(true)}>
            ▶ Quick Demo
          </ActionButton>
        </div>

        <div
          style={{
            marginBottom: "16px",
            fontSize: "1rem",
          }}
        >
          Review student submission status, score, feedback, and KDU competency
          scoring in one place.
        </div>

        <div
          style={{
            border: "1px solid #d7dce5",
            borderRadius: "10px",
            padding: "10px 12px",
            background: "#ffffff",
            marginBottom: "16px",
            lineHeight: 1.5,
          }}
        >
          <strong>Keyboard shortcuts:</strong> Press <strong>1–6</strong> to set all KDU scores.
          Press <strong>K</strong>, <strong>D</strong>, or <strong>U</strong>, then <strong>1–6</strong>,
          to set only KNOW, DO, or UNDERSTAND. Decimal scores still work in the input boxes.
          {shortcutBucket ? (
            <div style={{ marginTop: "6px", fontWeight: 800 }}>
              Shortcut ready: {shortcutBucket}. Press 1–6.
            </div>
          ) : null}
        </div>

        {showQuickDemo ? (
          <div style={quickDemoOverlayStyle}>
            <div style={quickDemoModalStyle}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "start",
                  gap: "12px",
                  marginBottom: "12px",
                }}
              >
                <div>
                  <h2 style={{ marginTop: 0, marginBottom: "6px" }}>
                    Quick Demo: Speed Grading
                  </h2>
                  <div style={{ color: "#4b5563", lineHeight: 1.5 }}>
                    Built-in help works without YouTube or VPN. Later this can become a local video or animated clip.
                  </div>
                </div>

                <ActionButton quiet onClick={() => setShowQuickDemo(false)}>
                  Close
                </ActionButton>
              </div>

              <div style={{ display: "grid", gap: "12px", lineHeight: 1.55 }}>
                <div style={quickDemoStepStyle}>
                  <strong>1. Fast score:</strong> Press <strong>1–6</strong> to set DO, KNOW, and UNDERSTAND together.
                </div>

                <div style={quickDemoStepStyle}>
                  <strong>2. Score one competency:</strong> Press <strong>K</strong>, <strong>D</strong>, or <strong>U</strong>, then press <strong>1–6</strong>.
                </div>

                <div style={quickDemoStepStyle}>
                  <strong>3. Use the rubric:</strong> Click any <strong>Set KNOW / DO / UNDERSTAND</strong> button inside the saved 6-level rubric.
                </div>

                <div style={quickDemoStepStyle}>
                  <strong>4. Use decimals:</strong> Click inside a score box and type scores like <strong>4.3</strong> or <strong>5.6</strong>.
                </div>

                <div style={quickDemoStepStyle}>
                  <strong>5. Move quickly:</strong> Use <strong>Save & Next Student</strong>, or use keyboard shortcuts to save and advance.
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <StatusBanner
          filteredRows={filteredRows}
          selectedRow={selectedRow}
          searchText={searchText}
        />

        <div style={gradeSummaryPanelStyle}>
          <div>
            <div style={gradeSummaryTitleStyle}>Class Grade Snapshot</div>
            <div style={{ color: "#4b5563", lineHeight: 1.5 }}>
              Live summary from saved KDU scores for this assignment.
            </div>
          </div>

          <div style={gradeSummaryCardsGridStyle}>
            <div style={gradeSummaryCardStyle}>
              <div style={gradeSummaryLabelStyle}>Class Average</div>
              <div style={gradeSummaryValueStyle}>
                {gradedSummary.averagePercent === null
                  ? "—"
                  : `${gradedSummary.averagePercent.toFixed(1)}%`}
              </div>
            </div>

            <div style={gradeSummaryCardStyle}>
              <div style={gradeSummaryLabelStyle}>Scored</div>
              <div style={gradeSummaryValueStyle}>
                {gradedSummary.gradedCount} / {gradedSummary.totalCount}
              </div>
            </div>

            {Object.entries(gradedSummary.distribution).map(([label, count]) => (
              <div key={label} style={gradeSummaryCardStyle}>
                <div style={gradeSummaryLabelStyle}>{label}</div>
                <div style={gradeSummaryValueStyle}>{count}</div>
              </div>
            ))}
          </div>

          <div style={gradeInsightGridStyle}>
            <div style={gradeInsightBoxStyle}>
              <div style={gradeInsightTitleStyle}>Top Performing</div>
              {gradedSummary.topStudents.length === 0 ? (
                <div style={{ color: "#4b5563" }}>No scored students yet.</div>
              ) : (
                <div style={{ display: "grid", gap: "8px" }}>
                  {gradedSummary.topStudents.map((student) => (
                    <div key={student.name} style={gradeInsightRowStyle}>
                      <strong>{student.name}</strong>
                      <span>
                        {student.percent.toFixed(1)}% ({student.label})
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={gradeInsightBoxStyle}>
              <div style={gradeInsightTitleStyle}>Needs Support</div>
              {gradedSummary.needsSupport.length === 0 ? (
                <div style={{ color: "#4b5563" }}>No scored students yet.</div>
              ) : (
                <div style={{ display: "grid", gap: "8px" }}>
                  {gradedSummary.needsSupport.map((student) => (
                    <div key={student.name} style={gradeInsightRowStyle}>
                      <strong>{student.name}</strong>
                      <span>
                        {student.percent.toFixed(1)}% ({student.label})
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

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
              <div
                style={{
                  border: "1px solid #d7dce5",
                  borderRadius: "12px",
                  padding: "12px",
                  background: "#f8fafc",
                  marginBottom: "12px",
                  fontWeight: 800,
                }}
              >
                KDU Scores Saved: {gradedSummary.gradedCount} /{" "}
                {gradedSummary.totalCount}
              </div>

              {filteredRows.map((row) => {
                const isSelected =
                  selectedRow?.student_email === row.student_email;
                const savedSummary = getSavedKduSummary(row);

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
                    <div style={{ marginBottom: "6px", fontWeight: 800 }}>
                      {row.student_name}
                    </div>

                    <div style={{ fontSize: "0.95rem", marginBottom: "6px" }}>
                      Status: {row.submission_status || "None"}
                    </div>

                    <div
                      style={{
                        fontSize: "0.95rem",
                        fontWeight: 800,
                        lineHeight: 1.4,
                      }}
                    >
                      KDU: {savedSummary.label}
                    </div>

                    {savedSummary.isGraded ? (
                      <div
                        style={{
                          fontSize: "0.88rem",
                          color: "#4b5563",
                          marginTop: "4px",
                        }}
                      >
                        Saved score: {savedSummary.scoreOutOfSix.toFixed(2)} / 6
                      </div>
                    ) : null}
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
                    <h2
                      style={{
                        marginTop: 0,
                        marginBottom: 0,
                        fontSize: "3rem",
                        fontWeight: 800,
                      }}
                    >
                      {selectedRow.student_name}
                    </h2>

                    {kduSaveMessage ? (
                      <div
                        style={{
                          border: "2px solid #111",
                          borderRadius: "999px",
                          padding: "8px 14px",
                          fontWeight: 900,
                          background: "#ffffff",
                        }}
                      >
                        {kduSaveMessage}
                      </div>
                    ) : null}
                  </div>

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

                  <RawMarkEntryPanel
                    assignmentId={assignmentId}
                    selectedRow={selectedRow}
                    sectionScoreRows={sectionScoreRows}
                    onReload={reloadAfterRawMarkSave}
                  />

                  {sectionScoresLoading ? (
                    <div style={{ marginBottom: "18px", fontWeight: 800 }}>
                      Loading raw mark sections...
                    </div>
                  ) : null}

                  {sectionScoresMessage ? (
                    <div style={{ marginBottom: "18px", color: "#4b5563" }}>
                      {sectionScoresMessage}
                    </div>
                  ) : null}

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
                      KDU Competency Rubric
                    </h3>

                    <div
                      style={{
                        fontSize: "0.95rem",
                        lineHeight: 1.5,
                        color: "#4b5563",
                        marginBottom: "16px",
                      }}
                    >
                      {rubricLoading
                        ? "Loading teacher-built rubric criteria..."
                        : rubric
                          ? "Scores save to this student and use the teacher-built rubric criteria below."
                          : "No teacher-built rubric was found yet. You can still score here, or go back to Edit Assignment and build the KDU rubric."}
                    </div>

                    <div
                      style={{
                        border: "1px solid #cbd5e1",
                        borderRadius: "12px",
                        padding: "14px",
                        background: "#ffffff",
                        marginBottom: "16px",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: "12px",
                          flexWrap: "wrap",
                          marginBottom: "10px",
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 800 }}>
                            Saved Full 6-Level Rubric
                          </div>
                          <div style={{ color: "#4b5563", lineHeight: 1.4 }}>
                            {fullRubricTitle || "Use this as the provincial-style descriptor guide while scoring 1–6."}
                          </div>
                        </div>

                        <ActionButton
                          quiet
                          onClick={() => setShowFullRubric((current) => !current)}
                          disabled={fullRubricRows.length === 0}
                        >
                          {showFullRubric ? "Hide Rubric" : "View Rubric"}
                        </ActionButton>
                      </div>

                      {fullRubricLoading ? (
                        <div>Loading saved full rubric...</div>
                      ) : null}

                      {!fullRubricLoading && fullRubricRows.length === 0 ? (
                        <div style={{ color: "#4b5563", lineHeight: 1.5 }}>
                          No saved full 6-level rubric is attached yet. Go back to Edit Assignment,
                          generate the full rubric, and click Save Full Rubric.
                        </div>
                      ) : null}

                      {showFullRubric && fullRubricRows.length > 0 ? (
                        <div style={{ display: "grid", gap: "12px" }}>
                          {fullRubricRows.map((row) => (
                            <div key={row.level} style={fullRubricLevelCardStyle}>
                              <div style={{ fontWeight: 900, fontSize: "1.1rem" }}>
                                Level {row.level}
                              </div>

                              <div style={fullRubricDescriptorGridStyle}>
                                <div
                                  style={{
                                    ...fullRubricDescriptorBoxStyle,
                                    border: String(knowScore) === String(row.level) ? "2px solid #111" : fullRubricDescriptorBoxStyle.border,
                                    background:
                                      saveToastTarget &&
                                      saveToastTarget.bucket === "KNOW" &&
                                      String(saveToastTarget.level) === String(row.level)
                                        ? "#f3f4f6"
                                        : fullRubricDescriptorBoxStyle.background,
                                    position: "relative",
                                  }}
                                >
                                  {saveToastTarget &&
                                  saveToastTarget.bucket === "KNOW" &&
                                  String(saveToastTarget.level) === String(row.level) ? (
                                    <div style={floatingSaveToastStyle}>
                                      {saveToastTarget.status}
                                    </div>
                                  ) : null}
                                  <div style={{ fontWeight: 800, marginBottom: "6px" }}>
                                    KNOW
                                  </div>
                                  <div style={{ lineHeight: 1.45, marginBottom: "10px" }}>
                                    {row.know || ""}
                                  </div>
                                  <ActionButton
                                    quiet
                                    onClick={() => {
                                      const nextScore = String(row.level);
                                      setKnowScore(nextScore);
                                      setKduSaveMessage(`KNOW set to Level ${row.level}. Saving...`);
                                      saveKduScores({ knowScore: nextScore }, { bucket: "KNOW", level: row.level });
                                    }}
                                  >
                                    Set KNOW to {row.level}
                                  </ActionButton>
                                </div>

                                <div
                                  style={{
                                    ...fullRubricDescriptorBoxStyle,
                                    border: String(doScore) === String(row.level) ? "2px solid #111" : fullRubricDescriptorBoxStyle.border,
                                    background:
                                      saveToastTarget &&
                                      saveToastTarget.bucket === "DO" &&
                                      String(saveToastTarget.level) === String(row.level)
                                        ? "#f3f4f6"
                                        : fullRubricDescriptorBoxStyle.background,
                                    position: "relative",
                                  }}
                                >
                                  {saveToastTarget &&
                                  saveToastTarget.bucket === "DO" &&
                                  String(saveToastTarget.level) === String(row.level) ? (
                                    <div style={floatingSaveToastStyle}>
                                      {saveToastTarget.status}
                                    </div>
                                  ) : null}
                                  <div style={{ fontWeight: 800, marginBottom: "6px" }}>
                                    DO
                                  </div>
                                  <div style={{ lineHeight: 1.45, marginBottom: "10px" }}>
                                    {row.do || ""}
                                  </div>
                                  <ActionButton
                                    quiet
                                    onClick={() => {
                                      const nextScore = String(row.level);
                                      setDoScore(nextScore);
                                      setKduSaveMessage(`DO set to Level ${row.level}. Saving...`);
                                      saveKduScores({ doScore: nextScore }, { bucket: "DO", level: row.level });
                                    }}
                                  >
                                    Set DO to {row.level}
                                  </ActionButton>
                                </div>

                                <div
                                  style={{
                                    ...fullRubricDescriptorBoxStyle,
                                    border: String(understandScore) === String(row.level) ? "2px solid #111" : fullRubricDescriptorBoxStyle.border,
                                    background:
                                      saveToastTarget &&
                                      saveToastTarget.bucket === "UNDERSTAND" &&
                                      String(saveToastTarget.level) === String(row.level)
                                        ? "#f3f4f6"
                                        : fullRubricDescriptorBoxStyle.background,
                                    position: "relative",
                                  }}
                                >
                                  {saveToastTarget &&
                                  saveToastTarget.bucket === "UNDERSTAND" &&
                                  String(saveToastTarget.level) === String(row.level) ? (
                                    <div style={floatingSaveToastStyle}>
                                      {saveToastTarget.status}
                                    </div>
                                  ) : null}
                                  <div style={{ fontWeight: 800, marginBottom: "6px" }}>
                                    UNDERSTAND
                                  </div>
                                  <div style={{ lineHeight: 1.45, marginBottom: "10px" }}>
                                    {row.understand || ""}
                                  </div>
                                  <ActionButton
                                    quiet
                                    onClick={() => {
                                      const nextScore = String(row.level);
                                      setUnderstandScore(nextScore);
                                      setKduSaveMessage(`UNDERSTAND set to Level ${row.level}. Saving...`);
                                      saveKduScores({ understandScore: nextScore }, { bucket: "UNDERSTAND", level: row.level });
                                    }}
                                  >
                                    Set UNDERSTAND to {row.level}
                                  </ActionButton>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : null}
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
                        helper={doCriterionText}
                      />

                      <KduScoreInput
                        label="KNOW / Curricular Competencies"
                        weight={25}
                        value={knowScore}
                        onChange={setKnowScore}
                        helper={knowCriterionText}
                      />

                      <KduScoreInput
                        label="UNDERSTAND / Core Competencies"
                        weight={25}
                        value={understandScore}
                        onChange={setUnderstandScore}
                        helper={understandCriterionText}
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

                      <div style={{ marginTop: "8px" }}>
                        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                          <ActionButton onClick={() => saveKduScores()} disabled={savingKduScores}>
                            {savingKduScores ? "Saving KDU Scores..." : "Save KDU Scores"}
                          </ActionButton>

                          <ActionButton
                            quiet
                            onClick={() => saveKduScores({}, null, { advanceToNextStudent: true })}
                            disabled={savingKduScores}
                          >
                            {savingKduScores ? "Saving..." : "Save & Next Student"}
                          </ActionButton>
                        </div>
                      </div>

                      {kduSaveMessage ? (
                        <div style={{ color: "#4b5563", lineHeight: 1.5 }}>
                          {kduSaveMessage}
                        </div>
                      ) : null}

                      {kduLastSavedAt ? (
                        <div style={kduTimestampStyle}>
                          Last KDU save: {kduLastSavedAt}
                        </div>
                      ) : null}
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


const fullRubricLevelCardStyle = {
  border: "1px solid #d7dce5",
  borderRadius: "12px",
  padding: "14px",
  background: "#f8fafc",
  display: "grid",
  gap: "10px",
};

const fullRubricDescriptorGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "10px",
};

const fullRubricDescriptorBoxStyle = {
  border: "1px solid #d7dce5",
  borderRadius: "10px",
  padding: "12px",
  background: "#ffffff",
};


const floatingSaveToastStyle = {
  position: "absolute",
  top: "8px",
  right: "8px",
  border: "2px solid #111",
  borderRadius: "999px",
  padding: "6px 10px",
  background: "#ffffff",
  fontWeight: 900,
  zIndex: 2,
};


const quickDemoOverlayStyle = {
  position: "fixed",
  inset: 0,
  background: "rgba(0, 0, 0, 0.35)",
  zIndex: 20,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "20px",
};

const quickDemoModalStyle = {
  width: "min(720px, 100%)",
  border: "2px solid #111",
  borderRadius: "16px",
  padding: "20px",
  background: "#ffffff",
  boxShadow: "0 20px 60px rgba(0, 0, 0, 0.25)",
};

const quickDemoStepStyle = {
  border: "1px solid #d7dce5",
  borderRadius: "12px",
  padding: "12px",
  background: "#f8fafc",
};


const gradeSummaryPanelStyle = {
  border: "2px solid #111",
  borderRadius: "16px",
  padding: "16px",
  background: "#ffffff",
  marginBottom: "18px",
  display: "grid",
  gap: "14px",
};

const gradeSummaryTitleStyle = {
  fontSize: "1.2rem",
  fontWeight: 900,
  marginBottom: "4px",
};

const gradeSummaryCardsGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
  gap: "10px",
};

const gradeSummaryCardStyle = {
  border: "1px solid #d7dce5",
  borderRadius: "12px",
  padding: "12px",
  background: "#f8fafc",
};

const gradeSummaryLabelStyle = {
  fontSize: "0.9rem",
  color: "#4b5563",
  fontWeight: 800,
  marginBottom: "6px",
};

const gradeSummaryValueStyle = {
  fontSize: "1.6rem",
  fontWeight: 900,
};


const gradeInsightGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: "12px",
};

const gradeInsightBoxStyle = {
  border: "1px solid #d7dce5",
  borderRadius: "12px",
  padding: "12px",
  background: "#ffffff",
};

const gradeInsightTitleStyle = {
  fontWeight: 900,
  marginBottom: "10px",
};

const gradeInsightRowStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: "12px",
  flexWrap: "wrap",
  border: "1px solid #d7dce5",
  borderRadius: "10px",
  padding: "10px",
  background: "#f8fafc",
};


const floatingDashboardButtonWrapStyle = {
  position: "fixed",
  left: "14px",
  top: "45%",
  zIndex: 15,
  maxWidth: "190px",
  display: "grid",
  gap: "8px",
};


const kduTimestampStyle = {
  marginTop: "8px",
  fontSize: "13px",
  fontWeight: 800,
  color: "#444",
  lineHeight: 1.4,
};
