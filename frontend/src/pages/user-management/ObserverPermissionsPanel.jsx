import { useMemo, useState } from "react";

function getDisplayName(user, fallback = "Unnamed student") {
  return (
    user.name ||
    `${user.first_name || ""} ${user.last_name || ""}`.trim() ||
    fallback
  );
}

function normalizeId(value) {
  return String(value ?? "");
}

function ObserverPermissionsPanel({
  students = [],
  observerDraft,
  onUpdateDraft,
  onToggleStudent,
  onRemoveStudent,
  onSelectStudents,
  onClearStudents,
  onCancel,
  onSave,
}) {
  const [groupType, setGroupType] = useState("all");
  const [groupValue, setGroupValue] = useState("");

  const groupOptions = useMemo(() => {
    const values = new Map();

    students.forEach((student) => {
      if (groupType === "grade") {
        const grade = student.current_grade ?? student.grade;
        if (grade !== null && grade !== undefined && String(grade).trim()) {
          values.set(String(grade), `Grade ${grade}`);
        }
      }

      if (groupType === "homeroom") {
        const homeform = String(student.current_homeform || "").trim();
        if (homeform) values.set(homeform, homeform);
      }

      if (groupType === "course") {
        (Array.isArray(student.courses) ? student.courses : []).forEach((course) => {
          if (course?.id) values.set(String(course.id), course.title || `Course ${course.id}`);
        });
      }
    });

    return [...values.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
  }, [groupType, students]);

  const availableStudents = useMemo(() => {
    const cleanSearch = String(observerDraft.studentSearch || "")
      .trim()
      .toLowerCase();

    const sortedStudents = [...students].sort((a, b) =>
      getDisplayName(a).localeCompare(getDisplayName(b))
    );

    return sortedStudents.filter((student) => {
      if (groupType === "grade" && groupValue) {
        const grade = student.current_grade ?? student.grade;
        if (String(grade ?? "") !== groupValue) return false;
      }

      if (groupType === "homeroom" && groupValue) {
        if (String(student.current_homeform || "") !== groupValue) return false;
      }

      if (groupType === "course" && groupValue) {
        const matchesCourse = (Array.isArray(student.courses) ? student.courses : [])
          .some((course) => String(course?.id ?? "") === groupValue);
        if (!matchesCourse) return false;
      }

      if (!cleanSearch) return true;

      const searchableText = [
        getDisplayName(student),
        student.email,
        student.current_grade ?? student.grade,
        student.current_homeform,
        student.student_number,
        student.student_id,
        student.pen,
        ...(Array.isArray(student.courses)
          ? student.courses.map((course) => course?.title || "")
          : []),
      ]
        .join(" ")
        .toLowerCase();

      return searchableText.includes(cleanSearch);
    });
  }, [groupType, groupValue, observerDraft.studentSearch, students]);

  const linkedStudents = useMemo(() => {
    const selectedIds = new Set(
      (observerDraft.selectedStudentIds || []).map(normalizeId)
    );

    return students
      .filter((student) => selectedIds.has(normalizeId(student.id)))
      .sort((a, b) => getDisplayName(a).localeCompare(getDisplayName(b)));
  }, [observerDraft.selectedStudentIds, students]);

  return (
    <div style={panelStyle}>
      <div style={headerStyle}>
        <div>
          <h4 style={{ marginTop: 0, marginBottom: "8px" }}>
            Student Access Permissions
          </h4>
          <p style={{ margin: 0, lineHeight: 1.5 }}>
            Choose the observer type and assign the students this account may view.
          </p>
        </div>

        <div style={countBadgeStyle}>{linkedStudents.length} assigned</div>
      </div>

      <div style={blockStyle}>
        <div className="form-label" style={{ marginBottom: "10px" }}>
          Observer Type
        </div>

        <div style={relationshipGridStyle}>
          <label style={radioCardStyle}>
            <input
              type="radio"
              name="observer-type"
              value="parent"
              checked={observerDraft.relationship === "parent"}
              onChange={(event) =>
                onUpdateDraft("relationship", event.target.value)
              }
            />
            <span>
              <strong>Parent</strong>
              <small style={helpTextStyle}>
                Family observer account with access to linked student progress.
              </small>
            </span>
          </label>

          <label style={radioCardStyle}>
            <input
              type="radio"
              name="observer-type"
              value="chinese_homeroom_teacher"
              checked={observerDraft.relationship === "chinese_homeroom_teacher"}
              onChange={(event) =>
                onUpdateDraft("relationship", event.target.value)
              }
            />
            <span>
              <strong>Chinese Homeroom Teacher</strong>
              <small style={helpTextStyle}>
                Homeroom observer account for assigned student monitoring.
              </small>
            </span>
          </label>

          <label style={radioCardStyle}>
            <input
              type="radio"
              name="observer-type"
              value="observer"
              checked={observerDraft.relationship === "observer"}
              onChange={(event) =>
                onUpdateDraft("relationship", event.target.value)
              }
            />
            <span>
              <strong>Observer</strong>
              <small style={helpTextStyle}>
                Read-only access for support staff or another designated observer.
              </small>
            </span>
          </label>
        </div>
      </div>

      <div style={blockStyle}>
        <div className="form-label" style={{ marginBottom: "10px" }}>
          Assign Students by Group
        </div>

        <div style={filterGridStyle}>
          <div>
            <label htmlFor="student-group-type" style={compactLabelStyle}>
              Group Type
            </label>
            <select
              id="student-group-type"
              className="form-input"
              value={groupType}
              onChange={(event) => {
                setGroupType(event.target.value);
                setGroupValue("");
              }}
            >
              <option value="all">All Students</option>
              <option value="grade">Grade</option>
              <option value="homeroom">Homeroom Group</option>
              <option value="course">Course / Class</option>
            </select>
          </div>

          <div>
            <label htmlFor="student-group-value" style={compactLabelStyle}>
              Group
            </label>
            <select
              id="student-group-value"
              className="form-input"
              value={groupValue}
              onChange={(event) => setGroupValue(event.target.value)}
              disabled={groupType === "all"}
            >
              <option value="">
                {groupType === "all" ? "All students" : `Select ${groupType === "course" ? "course / class" : groupType}`}
              </option>
              {groupOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={bulkActionStyle}>
          <button
            type="button"
            style={primaryButtonStyle}
            onClick={() => onSelectStudents(availableStudents.map((student) => student.id))}
            disabled={availableStudents.length === 0 || (groupType !== "all" && !groupValue)}
          >
            Select All Filtered ({availableStudents.length})
          </button>
          <button
            type="button"
            style={secondaryButtonStyle}
            onClick={onClearStudents}
            disabled={linkedStudents.length === 0}
          >
            Clear Selection
          </button>
        </div>

        <p style={bulkHelpStyle}>
          Choose a group, optionally narrow it with search, then select all matching students. You can still add or remove individual students before saving.
        </p>
      </div>

      <div style={blockStyle}>
        <label htmlFor="student-access-search" className="form-label">
          Search Students
        </label>
        <input
          id="student-access-search"
          type="text"
          className="form-input"
          value={observerDraft.studentSearch}
          onChange={(event) => onUpdateDraft("studentSearch", event.target.value)}
          placeholder="Search by name, email, grade, student number, or PEN..."
        />
      </div>

      <div style={studentGridStyle}>
        <div style={studentPanelStyle}>
          <div style={studentPanelHeaderStyle}>
            <strong>Available Students</strong>
            <p style={subtitleStyle}>
              Showing {availableStudents.length} of {students.length}
            </p>
          </div>

          <div style={studentListStyle}>
            {availableStudents.length === 0 ? (
              <div style={emptyStateStyle}>No students match this search.</div>
            ) : (
              availableStudents.map((student) => {
                const studentId = normalizeId(student.id);
                const checked = (observerDraft.selectedStudentIds || [])
                  .map(normalizeId)
                  .includes(studentId);

                return (
                  <label key={student.id} style={checkboxRowStyle}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onToggleStudent(student.id)}
                    />
                    <span>
                      <strong>{getDisplayName(student)}</strong>
                      <small style={metaStyle}>
                        {student.email || "No email recorded"}
                      </small>
                      <small style={metaStyle}>
                        {[
                          student.current_grade ? `Grade ${student.current_grade}` : "",
                          student.current_homeform ? `Homeroom ${student.current_homeform}` : "",
                        ].filter(Boolean).join(" • ") || "No grade or homeroom recorded"}
                      </small>
                    </span>
                  </label>
                );
              })
            )}
          </div>
        </div>

        <div style={studentPanelStyle}>
          <div style={studentPanelHeaderStyle}>
            <strong>Assigned Students</strong>
            <p style={subtitleStyle}>Live selected count: {linkedStudents.length}</p>
          </div>

          <div style={studentListStyle}>
            {linkedStudents.length === 0 ? (
              <div style={emptyStateStyle}>
                No students assigned yet. Select students from the available list.
              </div>
            ) : (
              linkedStudents.map((student) => (
                <div key={student.id} style={linkedRowStyle}>
                  <div>
                    <strong>{getDisplayName(student)}</strong>
                    <small style={metaStyle}>
                      {student.email || "No email recorded"}
                    </small>
                  </div>
                  <button
                    type="button"
                    style={removeButtonStyle}
                    onClick={() => onRemoveStudent(student.id)}
                  >
                    Remove
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {observerDraft.message ? (
        <p className="form-message" style={{ marginTop: "12px" }}>
          {observerDraft.message}
        </p>
      ) : null}

      <div style={footerStyle}>
        <button type="button" style={secondaryButtonStyle} onClick={onCancel}>
          Cancel
        </button>
        <button type="button" style={primaryButtonStyle} onClick={onSave}>
          Save
        </button>
      </div>
    </div>
  );
}

const panelStyle = {
  border: "1px solid #cbd5e1",
  borderRadius: "14px",
  padding: "16px",
  background: "#f8fafc",
};

const headerStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "14px",
  marginBottom: "16px",
};

const countBadgeStyle = {
  border: "1px solid #111827",
  borderRadius: "999px",
  padding: "7px 11px",
  background: "#ffffff",
  color: "#111827",
  fontWeight: 900,
  whiteSpace: "nowrap",
};

const blockStyle = {
  marginTop: "14px",
};

const relationshipGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
  gap: "10px",
};

const filterGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
  gap: "10px",
};

const compactLabelStyle = {
  display: "block",
  marginBottom: "6px",
  color: "#334155",
  fontSize: "0.9rem",
  fontWeight: 800,
};

const bulkActionStyle = {
  display: "flex",
  flexWrap: "wrap",
  gap: "10px",
  marginTop: "12px",
};

const bulkHelpStyle = {
  margin: "10px 0 0",
  color: "#475569",
  fontSize: "0.9rem",
  lineHeight: 1.45,
};

const radioCardStyle = {
  display: "flex",
  alignItems: "flex-start",
  gap: "10px",
  border: "1px solid #cbd5e1",
  borderRadius: "12px",
  background: "#ffffff",
  padding: "12px",
  cursor: "pointer",
};

const helpTextStyle = {
  display: "block",
  marginTop: "4px",
  color: "#475569",
  lineHeight: 1.35,
};

const studentGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: "14px",
  marginTop: "14px",
};

const studentPanelStyle = {
  border: "1px solid #cbd5e1",
  borderRadius: "14px",
  background: "#ffffff",
  overflow: "hidden",
};

const studentPanelHeaderStyle = {
  borderBottom: "1px solid #e2e8f0",
  padding: "12px",
  background: "#f8fafc",
};

const subtitleStyle = {
  margin: "4px 0 0 0",
  color: "#475569",
  fontSize: "0.9rem",
};

const studentListStyle = {
  maxHeight: "260px",
  overflowY: "auto",
  padding: "8px",
};

const checkboxRowStyle = {
  display: "flex",
  alignItems: "flex-start",
  gap: "10px",
  padding: "10px",
  borderRadius: "10px",
  cursor: "pointer",
};

const linkedRowStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "10px",
  padding: "10px",
  borderBottom: "1px solid #e2e8f0",
};

const metaStyle = {
  display: "block",
  color: "#475569",
  marginTop: "3px",
  lineHeight: 1.35,
};

const emptyStateStyle = {
  padding: "14px",
  color: "#475569",
  lineHeight: 1.45,
};

const removeButtonStyle = {
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#111827",
  borderRadius: "8px",
  padding: "6px 9px",
  fontWeight: 800,
  cursor: "pointer",
};

const footerStyle = {
  display: "flex",
  justifyContent: "flex-end",
  gap: "10px",
  marginTop: "16px",
  paddingTop: "14px",
  borderTop: "1px solid #cbd5e1",
};

const secondaryButtonStyle = {
  border: "1px solid #111827",
  background: "#ffffff",
  color: "#111827",
  borderRadius: "8px",
  padding: "9px 13px",
  fontWeight: 900,
  cursor: "pointer",
};

const primaryButtonStyle = {
  border: "1px solid #111827",
  background: "#111827",
  color: "#ffffff",
  borderRadius: "8px",
  padding: "9px 13px",
  fontWeight: 900,
  cursor: "pointer",
};

export default ObserverPermissionsPanel;
