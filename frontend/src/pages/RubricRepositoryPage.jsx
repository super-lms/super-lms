import { useEffect, useState } from "react";
import API_BASE from "../apiBase";

export default function RubricRepositoryPage() {
  const [rubrics, setRubrics] = useState([]);
  const [scopeFilter, setScopeFilter] = useState("ALL");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadRubrics() {
    try {
      setError("");
      const response = await fetch(`${API_BASE}/api/rubric-repository`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to load rubric repository.");
      }

      setRubrics(Array.isArray(data.rubrics) ? data.rubrics : []);
    } catch (err) {
      setError(err.message || "Failed to load rubric repository.");
    }
  }

  useEffect(() => {
    loadRubrics();
  }, []);

  const filteredRubrics =
    scopeFilter === "ALL"
      ? rubrics
      : rubrics.filter((rubric) => rubric.scope === scopeFilter);

  return (
    <div style={pageStyle}>
      <div>
        <h1 style={{ margin: 0 }}>Rubric Repository</h1>
        <p style={subtitleStyle}>
          Personal, Department, and School rubric resources. Master rubrics are
          copied before use so the original stays protected.
        </p>
      </div>

      {message ? <div style={successStyle}>{message}</div> : null}
      {error ? <div style={errorStyle}>{error}</div> : null}

      <div style={toolbarStyle}>
        <button type="button" className="secondary-button" onClick={loadRubrics}>
          Refresh
        </button>

        <select
          value={scopeFilter}
          onChange={(event) => setScopeFilter(event.target.value)}
          style={selectStyle}
        >
          <option value="ALL">All Rubrics</option>
          <option value="PERSONAL">Personal</option>
          <option value="DEPARTMENT">Department</option>
          <option value="SCHOOL">School</option>
        </select>
      </div>

      <div style={gridStyle}>
        {filteredRubrics.length === 0 ? (
          <div style={emptyStyle}>No repository rubrics found.</div>
        ) : (
          filteredRubrics.map((rubric) => (
            <div key={rubric.id} style={cardStyle}>
              <div>
                <h3 style={{ margin: 0 }}>{rubric.title}</h3>
                <div style={metaStyle}>
                  {rubric.scope} · {rubric.status} · Version {rubric.version || "1.0"}
                </div>
              </div>

              <div style={detailsStyle}>
                <div><strong>Department:</strong> {rubric.department || "—"}</div>
                <div><strong>Course:</strong> {rubric.course || "—"}</div>
                <div><strong>Grade:</strong> {rubric.grade || "—"}</div>
                <div><strong>Subject:</strong> {rubric.subject || "—"}</div>
                <div><strong>Levels:</strong> {rubric.level_count || 4}</div>
                <div>
                  <strong>Criteria:</strong>{" "}
                  {Array.isArray(rubric.criteria_json)
                    ? rubric.criteria_json.length
                    : 0}
                </div>
              </div>

              <div style={criteriaPreviewStyle}>
                {Array.isArray(rubric.criteria_json) && rubric.criteria_json.length > 0
                  ? rubric.criteria_json.slice(0, 4).map((criterion) => (
                      <div key={criterion.id || criterion.name} style={criterionLineStyle}>
                        {criterion.name}
                      </div>
                    ))
                  : "No criteria preview available."}
              </div>

              <button
                type="button"
                className="secondary-button"
                onClick={() =>
                  setMessage("Copy to assignment will be connected in the next step.")
                }
              >
                Copy / Use Rubric
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

const pageStyle = {
  display: "grid",
  gap: "18px",
};

const subtitleStyle = {
  margin: "8px 0 0",
  color: "#4b5563",
  lineHeight: 1.5,
};

const toolbarStyle = {
  display: "flex",
  gap: "12px",
  alignItems: "center",
  flexWrap: "wrap",
};

const selectStyle = {
  padding: "10px",
  border: "1px solid #cbd5e1",
  borderRadius: "10px",
  fontWeight: 800,
};

const gridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: "16px",
};

const cardStyle = {
  border: "1px solid #d7dce5",
  borderRadius: "16px",
  background: "#ffffff",
  padding: "16px",
  display: "grid",
  gap: "14px",
};

const metaStyle = {
  marginTop: "6px",
  color: "#4b5563",
  fontWeight: 800,
};

const detailsStyle = {
  display: "grid",
  gap: "6px",
  color: "#111827",
};

const criteriaPreviewStyle = {
  border: "1px solid #d7dce5",
  borderRadius: "12px",
  background: "#f8fafc",
  padding: "12px",
  display: "grid",
  gap: "6px",
  color: "#4b5563",
};

const criterionLineStyle = {
  fontWeight: 800,
  color: "#111827",
};

const emptyStyle = {
  border: "1px solid #d7dce5",
  borderRadius: "14px",
  background: "#f8fafc",
  padding: "16px",
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
