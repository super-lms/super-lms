import { useMemo } from "react";

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
  onCancel,
  onSave,
}) {
  const availableStudents = useMemo(() => {
    const cleanSearch = String(observerDraft.studentSearch || "")
      .trim()
      .toLowerCase();

    const sortedStudents = [...students].sort((a, b) =>
      getDisplayName(a).localeCompare(getDisplayName(b))
    );

    if (!cleanSearch) return sortedStudents;

    return sortedStudents.filter((student) => {
      const searchableText = [
        getDisplayName(student),
        student.email,
        student.grade,
        student.student_number,
        student.pen,
      ]
        .join(" ")
        .toLowerCase();

      return searchableText.includes(cleanSearch);
    });
  }, [observerDraft.studentSearch, students]);

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
        </div>
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
