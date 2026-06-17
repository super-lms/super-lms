function hasText(value) {
  return Boolean(String(value || "").trim());
}

function getValidSections(assignmentSections) {
  if (!Array.isArray(assignmentSections)) {
    return [];
  }

  return assignmentSections.filter((section) => {
    const hasName = hasText(section.section_name);
    const maxPoints = Number(section.max_points);
    const sectionWeight = Number(section.section_weight || 1);

    return (
      hasName &&
      Number.isFinite(maxPoints) &&
      maxPoints > 0 &&
      Number.isFinite(sectionWeight) &&
      sectionWeight > 0
    );
  });
}

function getKduCoverage(validSections) {
  return {
    KNOW: validSections.some((section) => section.competency_bucket === "KNOW"),
    DO: validSections.some((section) => section.competency_bucket === "DO"),
    UNDERSTAND: validSections.some(
      (section) => section.competency_bucket === "UNDERSTAND"
    ),
  };
}

function getStatusLabel(score) {
  if (score === 100) {
    return "Ready To Assess";
  }

  if (score >= 80) {
    return "Almost Ready";
  }

  if (score >= 60) {
    return "Needs A Few More Steps";
  }

  if (score >= 40) {
    return "Basic Setup Started";
  }

  return "Setup Just Started";
}

export default function AssignmentHealthCheck({
  title,
  selectedCategory,
  selectedSubcategory,
  rubric,
  assignmentSections,
}) {
  const validSections = getValidSections(assignmentSections);
  const kduCoverage = getKduCoverage(validSections);
  const sectionCount = Array.isArray(assignmentSections) ? assignmentSections.length : 0;
  const hasInvalidSections = sectionCount > validSections.length;
  const hasAnyKduCoverage = kduCoverage.KNOW || kduCoverage.DO || kduCoverage.UNDERSTAND;
  const hasFullKduCoverage = kduCoverage.KNOW && kduCoverage.DO && kduCoverage.UNDERSTAND;

  const checks = [
    {
      label: "Assignment title completed",
      passed: hasText(title),
      recommendation: "Add a clear assignment title before grading.",
    },
    {
      label: "Assessment pathway selected",
      passed: Boolean(selectedCategory),
      recommendation: "Choose the assessment pathway this assignment belongs to.",
    },
    {
      label: "Evidence tier selected",
      passed: Boolean(selectedSubcategory),
      recommendation: "Choose the evidence tier for this assignment.",
    },
    {
      label: "KDU rubric created",
      passed: Boolean(rubric),
      recommendation: "Build the KDU rubric so grading connects to KNOW, DO, and UNDERSTAND.",
    },
    {
      label: "Valid exam/raw-mark section exists",
      passed: validSections.length > 0,
      recommendation: "Add at least one section with a name, out-of mark, KDU bucket, and weight.",
    },
    {
      label: "KNOW / DO / UNDERSTAND coverage checked",
      passed: hasAnyKduCoverage,
      recommendation: "Connect at least one section to KNOW, DO, or UNDERSTAND.",
    },
  ];

  const passedCount = checks.filter((check) => check.passed).length;
  const score = Math.round((passedCount / checks.length) * 100);
  const label = getStatusLabel(score);

  const recommendations = checks
    .filter((check) => !check.passed)
    .map((check) => check.recommendation);

  if (hasInvalidSections) {
    recommendations.push(
      "Review section names, out-of marks, and weights. One or more sections are incomplete."
    );
  }

  if (validSections.length > 0 && !hasFullKduCoverage) {
    const missingBuckets = Object.entries(kduCoverage)
      .filter(([, covered]) => !covered)
      .map(([bucket]) => bucket)
      .join(", ");

    recommendations.push(
      `Consider whether this assignment should include ${missingBuckets} evidence before grading.`
    );
  }

  const topRecommendation =
    recommendations[0] || "This assignment is ready for grading. Open the grade page when you are ready.";

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
          border: "1px solid #d7dce5",
          borderRadius: "12px",
          padding: "14px",
          background: "#f8fafc",
          marginTop: "16px",
        }}
      >
        <strong>SUPER LMS Recommendation:</strong>
        <div style={{ marginTop: "6px", lineHeight: 1.5 }}>{topRecommendation}</div>
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
            <strong>
              {check.passed ? "✓" : "○"} {check.label}
            </strong>
          </div>
        ))}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: "10px",
          marginTop: "16px",
        }}
      >
        <div style={summaryBoxStyle}>
          <strong>Valid Sections</strong>
          <div>{validSections.length}</div>
        </div>

        <div style={summaryBoxStyle}>
          <strong>KNOW</strong>
          <div>{kduCoverage.KNOW ? "Covered" : "Not covered"}</div>
        </div>

        <div style={summaryBoxStyle}>
          <strong>DO</strong>
          <div>{kduCoverage.DO ? "Covered" : "Not covered"}</div>
        </div>

        <div style={summaryBoxStyle}>
          <strong>UNDERSTAND</strong>
          <div>{kduCoverage.UNDERSTAND ? "Covered" : "Not covered"}</div>
        </div>
      </div>
    </div>
  );
}

const summaryBoxStyle = {
  border: "1px solid #d7dce5",
  borderRadius: "12px",
  padding: "12px",
  background: "#ffffff",
};
