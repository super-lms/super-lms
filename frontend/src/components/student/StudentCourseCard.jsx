export default function StudentCourseCard({ course, isSelected, onOpen }) {
  const title = course?.title || course?.class_name || "Untitled Course"
  const teacher =
    course?.teacher_name ||
    course?.teacher ||
    course?.teacher_email ||
    "Teacher not listed"

  const year =
    course?.school_year ||
    course?.year ||
    course?.academic_year ||
    "Year not listed"

  const semester =
    course?.semester ||
    course?.term ||
    "Semester not listed"

  return (
    <div style={cardStyle(isSelected)}>
      <div style={titleStyle}>{title}</div>

      <div style={metaGridStyle}>
        <div>
          <div style={labelStyle}>Teacher</div>
          <div style={valueStyle}>{teacher}</div>
        </div>

        <div>
          <div style={labelStyle}>Year</div>
          <div style={valueStyle}>{year}</div>
        </div>

        <div>
          <div style={labelStyle}>Semester</div>
          <div style={valueStyle}>{semester}</div>
        </div>
      </div>

      <button type="button" onClick={() => onOpen(String(course.id))} style={buttonStyle}>
        Open Course →
      </button>
    </div>
  )
}

function cardStyle(isSelected) {
  return {
    border: "1px solid #d7dce5",
    borderRadius: "14px",
    padding: "16px",
    background: isSelected ? "#f8fafc" : "#ffffff",
    boxShadow: "0 1px 2px rgba(16, 24, 40, 0.04)",
  }
}

const titleStyle = {
  fontSize: "1.05rem",
  fontWeight: 900,
  marginBottom: "12px",
  lineHeight: 1.3,
}

const metaGridStyle = {
  display: "grid",
  gap: "10px",
  marginBottom: "14px",
}

const labelStyle = {
  fontSize: "0.78rem",
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  color: "#6b7280",
  marginBottom: "3px",
}

const valueStyle = {
  fontSize: "0.95rem",
  color: "#111827",
  lineHeight: 1.4,
}

const buttonStyle = {
  width: "100%",
  padding: "10px 14px",
  borderRadius: "10px",
  border: "1px solid #d7dce5",
  background: "#f3f4f6",
  font: "inherit",
  fontWeight: 800,
  cursor: "pointer",
}
