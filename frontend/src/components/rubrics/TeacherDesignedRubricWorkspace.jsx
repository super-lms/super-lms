import { useEffect, useState } from "react";
import authFetch from "../../services/authFetch";

export default function TeacherDesignedRubricWorkspace({ assignmentId }) {
  const [title, setTitle] = useState("");
  const [levelCount, setLevelCount] = useState("4");
  const [criteria, setCriteria] = useState([]);
  const [criterionName, setCriterionName] = useState("");
  const [criterionWeight, setCriterionWeight] = useState("");
  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [rawImportText, setRawImportText] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadRubric() {
    if (!assignmentId) return;

    try {
      setLoading(true);
      setError("");

      const response = await authFetch(`/api/assignments/${assignmentId}/teacher-designed-rubric`);
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

  async function importRubric() {
    if (!assignmentId) {
      setError("Assignment id is missing.");
      return;
    }

    if (!importFile) {
      setError("Choose a DOCX, PDF, or XLSX rubric file before importing.");
      return;
    }

    try {
      setImporting(true);
      setError("");
      setMessage("Importing rubric...");

      const formData = new FormData();
      formData.append("file", importFile);

      const response = await authFetch(
        `/api/assignments/${assignmentId}/teacher-designed-rubric/import`,
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to import rubric.");
      }

      const imported = data.imported || {};

      setTitle(imported.title || "Imported Teacher Rubric");
      setLevelCount(String(imported.level_count || 4));
      setCriteria(Array.isArray(imported.criteria) ? imported.criteria : []);
      setRawImportText(imported.raw_text || "");
      setMessage("Rubric imported. Review and edit the preview, then save.");
    } catch (err) {
      setError(err.message || "Failed to import rubric.");
    } finally {
      setImporting(false);
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

      const response = await authFetch(
        `/api/assignments/${assignmentId}/teacher-designed-rubric`,
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

      setMessage("Teacher Designed Rubric saved.");
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
        descriptors: {},
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

  function updateCriterion(id, field, value) {
    setCriteria((current) =>
      current.map((criterion) =>
        criterion.id === id ? { ...criterion, [field]: value } : criterion
      )
    );
  }

  function updateDescriptor(id, level, value) {
    setCriteria((current) =>
      current.map((criterion) => {
        if (criterion.id !== id) return criterion;

        return {
          ...criterion,
          descriptors: {
            ...(criterion.descriptors || {}),
            [`level_${level}`]: value,
          },
        };
      })
    );
  }

  useEffect(() => {
    loadRubric();
  }, [assignmentId]);

  const numericLevelCount = Number(levelCount || 4);

  const totalWeight = criteria.reduce((sum, criterion) => {
    const value = Number(criterion.weight || 0);
    return sum + (Number.isFinite(value) ? value : 0);
  }, 0);

  return (
    <div style={workspaceStyle}>
      <div>
        <h3 style={{ margin: 0 }}>Teacher Designed Rubric Workspace</h3>
        <p style={{ marginBottom: 0, color: "#4b5563", lineHeight: 1.5 }}>
          Build a teacher-created rubric manually or import an existing DOCX, PDF,
          or XLSX rubric. Imported rubrics can be reviewed and edited before saving.
        </p>
      </div>

      {loading ? <div style={noticeStyle}>Loading saved teacher rubric...</div> : null}
      {message ? <div style={successStyle}>{message}</div> : null}
      {error ? <div style={errorStyle}>{error}</div> : null}

      <div style={importBoxStyle}>
        <div style={sectionHeaderStyle}>Import Existing Rubric</div>
        <p style={{ margin: 0, color: "#4b5563", lineHeight: 1.5 }}>
          Upload a text-based DOCX, PDF, or XLSX rubric. The system will convert it
          into the editable Teacher Designed Rubric structure.
        </p>

        <input
          type="file"
          accept=".docx,.pdf,.xlsx"
          onChange={(event) => setImportFile(event.target.files?.[0] || null)}
          style={inputStyle}
        />

        <button
          type="button"
          className="secondary-button"
          onClick={importRubric}
          disabled={importing || loading}
        >
          {importing ? "Importing Rubric..." : "Import Rubric"}
        </button>
      </div>

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
        <div style={sectionHeaderStyle}>Editable Criteria Preview</div>

        {criteria.length === 0 ? (
          <div style={{ color: "#4b5563" }}>No criteria added yet.</div>
        ) : (
          <div style={{ display: "grid", gap: "14px" }}>
            {criteria.map((criterion) => (
              <div key={criterion.id} style={criterionCardStyle}>
                <div style={criterionEditGridStyle}>
                  <div>
                    <label style={labelStyle}>Criterion</label>
                    <input
                      type="text"
                      value={criterion.name || ""}
                      onChange={(event) =>
                        updateCriterion(criterion.id, "name", event.target.value)
                      }
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Weight %</label>
                    <input
                      type="number"
                      value={criterion.weight || ""}
                      onChange={(event) =>
                        updateCriterion(criterion.id, "weight", event.target.value)
                      }
                      style={inputStyle}
                    />
                  </div>
                </div>

                <div style={descriptorGridStyle}>
                  {Array.from({ length: numericLevelCount }, (_, index) => index + 1).map(
                    (level) => (
                      <div key={level}>
                        <label style={labelStyle}>Level {level}</label>
                        <textarea
                          value={(criterion.descriptors || {})[`level_${level}`] || ""}
                          onChange={(event) =>
                            updateDescriptor(criterion.id, level, event.target.value)
                          }
                          placeholder={`Descriptor for Level ${level}`}
                          style={textareaStyle}
                        />
                      </div>
                    )
                  )}
                </div>

                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => removeCriterion(criterion.id)}
                >
                  Remove Criterion
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

      {rawImportText ? (
        <details style={rawTextBoxStyle}>
          <summary style={{ fontWeight: 900 }}>View Raw Imported Text</summary>
          <pre style={rawPreStyle}>{rawImportText}</pre>
        </details>
      ) : null}

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

const importBoxStyle = {
  border: "1px solid #d7dce5",
  borderRadius: "14px",
  background: "#f8fafc",
  padding: "14px",
  display: "grid",
  gap: "12px",
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

const textareaStyle = {
  width: "100%",
  minHeight: "72px",
  padding: "10px",
  border: "1px solid #cbd5e1",
  borderRadius: "10px",
  fontSize: "0.95rem",
  boxSizing: "border-box",
  resize: "vertical",
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
  display: "grid",
  gap: "12px",
};

const criterionEditGridStyle = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 2fr) minmax(140px, 1fr)",
  gap: "12px",
};

const descriptorGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: "12px",
};

const addGridStyle = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 2fr) minmax(140px, 1fr)",
  gap: "12px",
};

const rawTextBoxStyle = {
  border: "1px solid #d7dce5",
  borderRadius: "12px",
  background: "#f8fafc",
  padding: "12px",
};

const rawPreStyle = {
  whiteSpace: "pre-wrap",
  fontSize: "0.85rem",
  lineHeight: 1.45,
  marginTop: "12px",
};

const summaryStyle = {
  border: "1px solid #d7dce5",
  borderRadius: "12px",
  background: "#f8fafc",
  padding: "12px",
};
