import { useEffect, useState } from "react";
import API_BASE from "../../apiBase";

export default function TeacherDesignedRubricWorkspace({ assignmentId }) {
  const [title, setTitle] = useState("");
  const [levelCount, setLevelCount] = useState("4");
  const [criteria, setCriteria] = useState([]);
  const [criterionName, setCriterionName] = useState("");
  const [criterionWeight, setCriterionWeight] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadRubric() {
    if (!assignmentId) return;

    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `${API_BASE}/api/assignments/${assignmentId}/teacher-designed-rubric`
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to load teacher rubric.");
      }

      if (data.rubric) {
        setTitle(data.rubric.title || "");
        setLevelCount(String(data.rubric.level_count || 4));
        setCriteria(
          Array.isArray(data.rubric.criteria_json) ? data.rubric.criteria_json : []
        );
      }
    } catch (err) {
      setError(err.message || "Failed to load teacher rubric.");
    } finally {
      setLoading(false);
    }
  }

  async function saveRubric() {
    const cleanTitle = title.trim();

    if (!cleanTitle) {
      setError("Enter a rubric title before saving.");
      return;
    }

    if (criteria.length === 0) {
      setError("Add at least one criterion before saving.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setMessage("Saving teacher rubric...");

      const response = await fetch(
        `${API_BASE}/api/assignments/${assignmentId}/teacher-designed-rubric`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: cleanTitle,
            level_count: Number(levelCount || 4),
            criteria,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to save teacher rubric.");
      }

      setMessage("Teacher Designed Rubric (HO) saved.");
    } catch (err) {
      setError(err.message || "Failed to save teacher rubric.");
    } finally {
      setSaving(false);
    }
  }

  function addCriterion() {
    const cleanName = criterionName.trim();
    const cleanWeight = criterionWeight.trim();

    if (!cleanName) {
      setError("Enter a criterion name before adding it.");
      return;
    }

    setCriteria((current) => [
      ...current,
      {
        id: `criterion-${Date.now()}`,
        name: cleanName,
        weight: cleanWeight,
      },
    ]);

    setCriterionName("");
    setCriterionWeight("");
    setError("");
    setMessage("Criterion added.");
  }

  function removeCriterion(id) {
    setCriteria((current) => current.filter((criterion) => criterion.id !== id));
  }

  useEffect(() => {
    loadRubric();
  }, [assignmentId]);

  const totalWeight = criteria.reduce((sum, criterion) => {
    const value = Number(criterion.weight || 0);
    return sum + (Number.isFinite(value) ? value : 0);
  }, 0);

  return (
    <div style={workspaceStyle}>
      <div>
        <h3 style={{ margin: 0 }}>Teacher Designed Rubric Workspace</h3>
        <p style={{ marginBottom: 0, color: "#4b5563", lineHeight: 1.5 }}>
          Build a teacher-created rubric with custom criteria and weights. No preset
          criteria are used.
        </p>
      </div>

      {loading ? <div style={noticeStyle}>Loading saved teacher rubric...</div> : null}
      {message ? <div style={successStyle}>{message}</div> : null}
      {error ? <div style={errorStyle}>{error}</div> : null}

      <div>
        <label style={labelStyle}>Rubric Title</label>
        <input
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Enter rubric title..."
          style={inputStyle}
        />
      </div>

      <div>
        <label style={labelStyle}>Performance Levels</label>
        <div style={levelRowStyle}>
          {[4, 5, 6].map((level) => (
            <label key={level} style={radioLabelStyle}>
              <input
                type="radio"
                value={String(level)}
                checked={levelCount === String(level)}
                onChange={(event) => setLevelCount(event.target.value)}
              />
              {level} Levels
            </label>
          ))}
        </div>
      </div>

      <div style={criteriaBoxStyle}>
        <div style={sectionHeaderStyle}>Criteria</div>

        {criteria.length === 0 ? (
          <div style={{ color: "#4b5563" }}>No criteria added yet.</div>
        ) : (
          <div style={{ display: "grid", gap: "10px" }}>
            {criteria.map((criterion) => (
              <div key={criterion.id} style={criterionCardStyle}>
                <div>
                  <strong>{criterion.name}</strong>
                  <div style={{ marginTop: "4px", color: "#4b5563" }}>
                    Weight: {criterion.weight || "0"}%
                  </div>
                </div>

                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => removeCriterion(criterion.id)}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        <div style={addGridStyle}>
          <div>
            <label style={labelStyle}>Criterion Name</label>
            <input
              type="text"
              value={criterionName}
              onChange={(event) => setCriterionName(event.target.value)}
              placeholder="Enter criterion name..."
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Weight %</label>
            <input
              type="number"
              value={criterionWeight}
              onChange={(event) => setCriterionWeight(event.target.value)}
              placeholder="e.g. 25"
              style={inputStyle}
            />
          </div>
        </div>

        <button type="button" className="secondary-button" onClick={addCriterion}>
          + Add Criterion
        </button>
      </div>

      <div style={summaryStyle}>
        <strong>Total Weight:</strong> {totalWeight}%
      </div>

      <button
        type="button"
        className="primary-button"
        onClick={saveRubric}
        disabled={saving || loading}
      >
        {saving ? "Saving Teacher Rubric..." : "Save Teacher Rubric"}
      </button>
    </div>
  );
}

const workspaceStyle = {
  border: "2px solid #111827",
  borderRadius: "16px",
  background: "#ffffff",
  padding: "18px",
  display: "grid",
  gap: "16px",
};

const noticeStyle = {
  border: "1px solid #d7dce5",
  borderRadius: "12px",
  background: "#f8fafc",
  padding: "10px",
  color: "#4b5563",
};

const successStyle = {
  border: "1px solid #bbf7d0",
  borderRadius: "12px",
  background: "#f0fdf4",
  padding: "10px",
  color: "#166534",
  fontWeight: 800,
};

const errorStyle = {
  border: "1px solid #fecaca",
  borderRadius: "12px",
  background: "#fef2f2",
  padding: "10px",
  color: "#991b1b",
  fontWeight: 800,
};

const labelStyle = {
  display: "block",
  fontWeight: 800,
  marginBottom: "6px",
};

const inputStyle = {
  width: "100%",
  padding: "10px",
  border: "1px solid #cbd5e1",
  borderRadius: "10px",
  fontSize: "1rem",
  boxSizing: "border-box",
};

const levelRowStyle = {
  display: "flex",
  gap: "18px",
  flexWrap: "wrap",
};

const radioLabelStyle = {
  display: "flex",
  gap: "8px",
  alignItems: "center",
  fontWeight: 800,
};

const criteriaBoxStyle = {
  border: "1px solid #d7dce5",
  borderRadius: "14px",
  background: "#f8fafc",
  padding: "14px",
  display: "grid",
  gap: "14px",
};

const sectionHeaderStyle = {
  fontWeight: 900,
  fontSize: "1.05rem",
};

const criterionCardStyle = {
  border: "1px solid #d7dce5",
  borderRadius: "12px",
  background: "#ffffff",
  padding: "12px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "12px",
  flexWrap: "wrap",
};

const addGridStyle = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 2fr) minmax(140px, 1fr)",
  gap: "12px",
};

const summaryStyle = {
  border: "1px solid #d7dce5",
  borderRadius: "12px",
  background: "#f8fafc",
  padding: "12px",
};
