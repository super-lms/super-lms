export default function AssignmentHealthCheck({
  title,
  selectedCategory,
  selectedSubcategory,
  rubric,
  assignmentSections,
}) {
  const checks = [
    {
      label: "Assignment title completed",
      passed: Boolean(String(title || "").trim()),
    },
    {
      label: "Assessment group selected",
      passed: Boolean(selectedCategory),
    },
    {
      label: "Evidence tier selected",
      passed: Boolean(selectedSubcategory),
    },
    {
      label: "KDU rubric created",
      passed: Boolean(rubric),
    },
    {
      label: "Exam/raw-mark sections available",
      passed: Array.isArray(assignmentSections) && assignmentSections.length > 0,
    },
  ];

  const passedCount = checks.filter((check) => check.passed).length;
  const score = passedCount * 20;

  let label = "Setup Just Started";

  if (score === 100) {
    label = "Ready To Assess";
  } else if (score >= 80) {
    label = "Almost Ready";
  } else if (score >= 60) {
    label = "Needs A Few More Steps";
  } else if (score >= 40) {
    label = "Basic Setup Started";
  }

  return (
    <div
      style={{
        border: "2px solid #111827",
        borderRadius: "16px",
        padding: "18px",
        background: "#ffffff",
        marginBottom: "20px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "16px",
          flexWrap: "wrap",
          alignItems: "flex-start",
        }}
      >
        <div>
          <h2 style={{ marginTop: 0, marginBottom: "8px" }}>
            Assignment Health Check
          </h2>
          <p style={{ margin: 0, color: "#4b5563", lineHeight: 1.5 }}>
            Checks whether this assignment is ready for teacher grading and KDU evidence collection.
          </p>
        </div>

        <div
          style={{
            border: "1px solid #9ca3af",
            borderRadius: "12px",
            padding: "12px 16px",
            minWidth: "180px",
            background: "#f8fafc",
          }}
        >
          <div style={{ fontSize: "28px", fontWeight: 800 }}>{score}%</div>
          <div style={{ fontWeight: 700 }}>{label}</div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "10px",
          marginTop: "16px",
        }}
      >
        {checks.map((check) => (
          <div
            key={check.label}
            style={{
              border: "1px solid #d7dce5",
              borderRadius: "12px",
              padding: "12px",
              background: check.passed ? "#ffffff" : "#f8fafc",
            }}
          >
            <strong>{check.passed ? "✓" : "○"} {check.label}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}
