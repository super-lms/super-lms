import { useEffect, useMemo, useState } from "react";
import EditUserDrawer from "./user-management/EditUserDrawer.jsx";
import authFetch from "../services/authFetch";

const emptyTeacherForm = {
  name: "",
  email: "",
};

const emptyStudentForm = {
  name: "",
  email: "",
  student_id: "",
  parent_email: "",
  current_grade: "",
};

const emptyObserverForm = {
  name: "",
  email: "",
  relationship: "parent",
};

const emptyObserverDraft = {
  relationship: "parent",
  studentSearch: "",
  selectedStudentIds: [],
  message: "",
};

const userTabs = [
  { key: "all", label: "All" },
  { key: "teacher", label: "Teachers" },
  { key: "student", label: "Students" },
  { key: "admin", label: "Administrators" },
  { key: "observer", label: "Observers" },
];

function getDisplayName(user, fallback = "Unnamed user") {
  return (
    user.name ||
    `${user.first_name || ""} ${user.last_name || ""}`.trim() ||
    fallback
  );
}

function getUserStatus(user) {
  return user.is_active === false ? "Inactive" : "Active";
}

function getUserRole(user) {
  return String(user?.role || "").trim().toLowerCase();
}

function isObserverUser(user) {
  const role = getUserRole(user);
  return role === "observer" || role === "parent";
}

function normalizeId(value) {
  return String(value ?? "");
}

function UsersPage() {
  const [users, setUsers] = useState([]);
  const [status, setStatus] = useState("Loading users...");
  const [activeTab, setActiveTab] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [editingUser, setEditingUser] = useState(null);

  const [teacherForm, setTeacherForm] = useState(emptyTeacherForm);
  const [teacherMessage, setTeacherMessage] = useState("");
  const [teacherError, setTeacherError] = useState("");
  const [savingTeacher, setSavingTeacher] = useState(false);

  const [studentForm, setStudentForm] = useState(emptyStudentForm);
  const [studentMessage, setStudentMessage] = useState("");
  const [studentError, setStudentError] = useState("");
  const [savingStudent, setSavingStudent] = useState(false);

  const [observerForm, setObserverForm] = useState(emptyObserverForm);
  const [observerMessage, setObserverMessage] = useState("");
  const [observerError, setObserverError] = useState("");
  const [savingObserver, setSavingObserver] = useState(false);

  const [observerDraft, setObserverDraft] = useState(emptyObserverDraft);

  async function loadUsers() {
    setStatus("Loading users...");

    try {
      const response = await authFetch("/api/users");

      if (!response.ok) {
        throw new Error("Server error");
      }

      const data = await response.json();
      setUsers(Array.isArray(data) ? data : []);
      setStatus("Users loaded");
    } catch (error) {
      console.error(error);
      setUsers([]);
      setStatus("Could not load users");
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  function updateTeacherForm(field, value) {
    setTeacherForm((current) => ({
      ...current,
      [field]: value,
    }));
    setTeacherMessage("");
    setTeacherError("");
  }

  function updateStudentForm(field, value) {
    setStudentForm((current) => ({
      ...current,
      [field]: value,
    }));
    setStudentMessage("");
    setStudentError("");
  }

  function updateObserverForm(field, value) {
    setObserverForm((current) => ({
      ...current,
      [field]: value,
    }));
    setObserverMessage("");
    setObserverError("");
  }

  async function handleAddTeacher(event) {
    event.preventDefault();

    const cleanTeacher = {
      name: String(teacherForm.name || "").trim(),
      email: String(teacherForm.email || "").trim().toLowerCase(),
    };

    if (!cleanTeacher.name) {
      setTeacherError("Teacher name is required.");
      return;
    }

    if (!cleanTeacher.email) {
      setTeacherError("Teacher email is required.");
      return;
    }

    setSavingTeacher(true);
    setTeacherMessage("");
    setTeacherError("");

    try {
      const response = await authFetch("/api/teachers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(cleanTeacher),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.error || "Could not add teacher");
      }

      setTeacherForm(emptyTeacherForm);

      if (data?.action === "updated_existing_user_to_teacher") {
        setTeacherMessage("Existing user promoted/updated as a teacher.");
      } else {
        setTeacherMessage("Teacher added successfully.");
      }

      await loadUsers();
    } catch (error) {
      console.error(error);
      setTeacherError(error.message || "Could not add teacher.");
    } finally {
      setSavingTeacher(false);
    }
  }

  async function handleAddStudent(event) {
    event.preventDefault();

    const cleanStudent = {
      name: String(studentForm.name || "").trim(),
      email: String(studentForm.email || "").trim().toLowerCase(),
      student_id: String(studentForm.student_id || "").trim(),
      parent_email: String(studentForm.parent_email || "").trim().toLowerCase(),
      current_grade: studentForm.current_grade ? Number(studentForm.current_grade) : null,
    };

    if (!cleanStudent.name) {
      setStudentError("Student name is required.");
      return;
    }

    if (!cleanStudent.email) {
      setStudentError("Student email is required.");
      return;
    }

    if (!cleanStudent.current_grade) {
      setStudentError("Current grade is required for observer grade lists.");
      return;
    }

    setSavingStudent(true);
    setStudentMessage("");
    setStudentError("");

    try {
      const response = await authFetch("/api/students", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(cleanStudent),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.error || "Could not add student");
      }

      setStudentForm(emptyStudentForm);

      if (data?.action === "updated_existing_user_to_student") {
        setStudentMessage("Existing user promoted/updated as a student.");
      } else {
        setStudentMessage("Student added successfully.");
      }

      await loadUsers();
    } catch (error) {
      console.error(error);
      setStudentError(error.message || "Could not add student.");
    } finally {
      setSavingStudent(false);
    }
  }

  async function handleAddObserver(event) {
    event.preventDefault();

    const cleanObserver = {
      name: String(observerForm.name || "").trim(),
      email: String(observerForm.email || "").trim().toLowerCase(),
      relationship: String(observerForm.relationship || "parent").trim(),
    };

    if (!cleanObserver.name) {
      setObserverError("Observer name is required.");
      return;
    }

    if (!cleanObserver.email) {
      setObserverError("Observer email is required.");
      return;
    }

    setSavingObserver(true);
    setObserverMessage("");
    setObserverError("");

    try {
      const response = await authFetch("/api/observers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(cleanObserver),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.error || "Could not add observer");
      }

      setObserverForm(emptyObserverForm);
      setObserverMessage("Observer added successfully. Link student access in the edit panel.");
      setActiveTab("observer");
      await loadUsers();

      if (data?.observer?.id) {
        openEditDrawer(data.observer);
      }
    } catch (error) {
      console.error(error);
      setObserverError(error.message || "Could not add observer.");
    } finally {
      setSavingObserver(false);
    }
  }

  const teachers = useMemo(() => {
    return users.filter((user) => getUserRole(user) === "teacher");
  }, [users]);

  const students = useMemo(() => {
    return users.filter((user) => getUserRole(user) === "student");
  }, [users]);

  const admins = useMemo(() => {
    return users.filter((user) => getUserRole(user) === "admin");
  }, [users]);

  const observers = useMemo(() => {
    return users.filter((user) => isObserverUser(user));
  }, [users]);

  const filteredUsers = useMemo(() => {
    const cleanSearch = String(searchTerm || "").trim().toLowerCase();

    const tabFilteredUsers = (() => {
      if (activeTab === "all") return users;

      if (activeTab === "observer") {
        return users.filter((user) => isObserverUser(user));
      }

      return users.filter((user) => getUserRole(user) === activeTab);
    })();

    if (!cleanSearch) return tabFilteredUsers;

    return tabFilteredUsers.filter((user) => {
      const searchableText = [
        getDisplayName(user),
        user.email,
        user.role,
        getUserStatus(user),
      ]
        .join(" ")
        .toLowerCase();

      return searchableText.includes(cleanSearch);
    });
  }, [activeTab, searchTerm, users]);

  const activeTabLabel =
    userTabs.find((tab) => tab.key === activeTab)?.label || "Users";

  async function loadObserverLinks(user, message = "") {
    if (!user?.id) return;

    setObserverDraft({
      relationship: "parent",
      studentSearch: "",
      selectedStudentIds: [],
      message: "Loading saved student access permissions...",
    });

    try {
      const response = await authFetch(`/api/admin/observer-links/${user.id}`);
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.error || "Could not load observer links");
      }

      setObserverDraft({
        relationship: data?.relationship || "parent",
        studentSearch: "",
        selectedStudentIds: Array.isArray(data?.studentIds)
          ? data.studentIds.map(normalizeId)
          : [],
        message,
      });
    } catch (error) {
      console.error(error);
      setObserverDraft({
        relationship: "parent",
        studentSearch: "",
        selectedStudentIds: [],
        message: error.message || "Could not load saved student access permissions.",
      });
    }
  }

  function openEditDrawer(user) {
    setEditingUser(user);

    if (isObserverUser(user)) {
      loadObserverLinks(user);
    } else {
      setObserverDraft(emptyObserverDraft);
    }
  }

  function closeEditDrawer() {
    setEditingUser(null);
    setObserverDraft(emptyObserverDraft);
  }

  async function handleUserUpdated() {
    await loadUsers();
    closeEditDrawer();
  }

  async function handleUserDeleted() {
    await loadUsers();
    closeEditDrawer();
  }

  function updateObserverDraft(field, value) {
    setObserverDraft((current) => ({
      ...current,
      [field]: value,
      message: "",
    }));
  }

  function toggleLinkedStudent(studentId) {
    const cleanStudentId = normalizeId(studentId);

    setObserverDraft((current) => {
      const currentIds = (current.selectedStudentIds || []).map(normalizeId);
      const alreadySelected = currentIds.includes(cleanStudentId);

      return {
        ...current,
        selectedStudentIds: alreadySelected
          ? currentIds.filter((id) => id !== cleanStudentId)
          : [...currentIds, cleanStudentId],
        message: "",
      };
    });
  }

  function removeLinkedStudent(studentId) {
    const cleanStudentId = normalizeId(studentId);

    setObserverDraft((current) => ({
      ...current,
      selectedStudentIds: (current.selectedStudentIds || [])
        .map(normalizeId)
        .filter((id) => id !== cleanStudentId),
      message: "",
    }));
  }

  function cancelObserverChanges() {
    if (!editingUser) return;
    loadObserverLinks(editingUser, "Student access changes were cancelled.");
  }

  async function saveObserverChanges() {
    if (!editingUser) return;

    const cleanSelectedIds = (observerDraft.selectedStudentIds || [])
      .map(Number)
      .filter(Boolean);

    setObserverDraft((current) => ({
      ...current,
      message: "Saving student access permissions...",
    }));

    try {
      const response = await authFetch(`/api/admin/observer-links/${editingUser.id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          relationship: observerDraft.relationship || "parent",
          studentIds: cleanSelectedIds,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.error || "Could not save observer links");
      }

      setObserverDraft((current) => ({
        ...current,
        selectedStudentIds: Array.isArray(data?.studentIds)
          ? data.studentIds.map(normalizeId)
          : cleanSelectedIds.map(normalizeId),
        message: `Student access permissions saved. ${data?.linkedCount ?? cleanSelectedIds.length} student(s) assigned.`,
      }));
    } catch (error) {
      console.error(error);
      setObserverDraft((current) => ({
        ...current,
        message: error.message || "Could not save student access permissions.",
      }));
    }
  }

  return (
    <div className="content-area">
      <section className="panel">
        <div className="section-header">
          <div>
            <h2>Users</h2>
            <p className="section-subtitle">
              Manage teacher accounts and review current users, including observer accounts for parents and Chinese Homeroom Teachers.
            </p>
          </div>
        </div>

        <div className="summary-grid">
          <div className="summary-card">
            <strong>Total Users:</strong> {users.length}
          </div>
          <div className="summary-card">
            <strong>Teachers:</strong> {teachers.length}
          </div>
          <div className="summary-card">
            <strong>Students:</strong> {students.length}
          </div>
          <div className="summary-card">
            <strong>Admins:</strong> {admins.length}
          </div>
          <div className="summary-card">
            <strong>Observers:</strong> {observers.length}
          </div>
        </div>

        <p className="form-message">{status}</p>
      </section>

      <section className="panel">
        <div className="section-header">
          <div>
            <h3>Add Teacher Manually</h3>
            <p className="section-subtitle">
              Create a teacher account or promote an existing user to teacher.
            </p>
          </div>
        </div>

        <form onSubmit={handleAddTeacher} className="form-stack">
          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="teacher-name" className="form-label">
                Teacher Name
              </label>
              <input
                id="teacher-name"
                type="text"
                className="form-input"
                value={teacherForm.name}
                onChange={(event) => updateTeacherForm("name", event.target.value)}
                placeholder="Example: Jennifer Boyd"
                disabled={savingTeacher}
              />
            </div>

            <div className="form-field">
              <label htmlFor="teacher-email" className="form-label">
                Teacher Email
              </label>
              <input
                id="teacher-email"
                type="email"
                className="form-input"
                value={teacherForm.email}
                onChange={(event) => updateTeacherForm("email", event.target.value)}
                placeholder="teacher@school.ca"
                disabled={savingTeacher}
              />
            </div>
          </div>

          <div>
            <button type="submit" className="primary-btn" disabled={savingTeacher}>
              {savingTeacher ? "Adding Teacher..." : "Add Teacher"}
            </button>
          </div>

          {teacherMessage ? <p className="form-message">{teacherMessage}</p> : null}
          {teacherError ? <p className="form-message">{teacherError}</p> : null}
        </form>
      </section>

      <section className="panel">
        <div className="section-header">
          <div>
            <h3>Add Student Manually</h3>
            <p className="section-subtitle">
              Create a student account for immediate August pilot access, timetable setup, course enrollment, and observer linking.
            </p>
          </div>
        </div>

        <form onSubmit={handleAddStudent} className="form-stack">
          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="student-name" className="form-label">
                Student Name
              </label>
              <input
                id="student-name"
                type="text"
                className="form-input"
                value={studentForm.name}
                onChange={(event) => updateStudentForm("name", event.target.value)}
                placeholder="Example: Alex Chen"
                disabled={savingStudent}
              />
            </div>

            <div className="form-field">
              <label htmlFor="student-email" className="form-label">
                Student Email
              </label>
              <input
                id="student-email"
                type="email"
                className="form-input"
                value={studentForm.email}
                onChange={(event) => updateStudentForm("email", event.target.value)}
                placeholder="student@school.ca"
                disabled={savingStudent}
              />
            </div>

            <div className="form-field">
              <label htmlFor="student-id" className="form-label">
                Student ID
              </label>
              <input
                id="student-id"
                type="text"
                className="form-input"
                value={studentForm.student_id}
                onChange={(event) => updateStudentForm("student_id", event.target.value)}
                placeholder="Optional student ID"
                disabled={savingStudent}
              />
            </div>

            <div className="form-field">
              <label htmlFor="student-current-grade" className="form-label">
                Current Grade
              </label>
              <select
                id="student-current-grade"
                className="form-input"
                value={studentForm.current_grade}
                onChange={(event) => updateStudentForm("current_grade", event.target.value)}
                disabled={savingStudent}
              >
                <option value="">Select grade</option>
                <option value="10">Grade 10</option>
                <option value="11">Grade 11</option>
                <option value="12">Grade 12</option>
              </select>
            </div>

            <div className="form-field">
              <label htmlFor="student-parent-email" className="form-label">
                Parent Email
              </label>
              <input
                id="student-parent-email"
                type="email"
                className="form-input"
                value={studentForm.parent_email}
                onChange={(event) => updateStudentForm("parent_email", event.target.value)}
                placeholder="Optional parent email"
                disabled={savingStudent}
              />
            </div>
          </div>

          <div>
            <button type="submit" className="primary-btn" disabled={savingStudent}>
              {savingStudent ? "Adding Student..." : "Add Student"}
            </button>
          </div>

          {studentMessage ? <p className="form-message">{studentMessage}</p> : null}
          {studentError ? <p className="form-message">{studentError}</p> : null}
        </form>
      </section>

      <section className="panel">
        <div className="section-header">
          <div>
            <h3>Add Observer Manually</h3>
            <p className="section-subtitle">
              Create a parent or Chinese Homeroom Teacher observer account, then link student access in the edit panel.
            </p>
          </div>
        </div>

        <form onSubmit={handleAddObserver} className="form-stack">
          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="observer-name" className="form-label">
                Observer Name
              </label>
              <input
                id="observer-name"
                type="text"
                className="form-input"
                value={observerForm.name}
                onChange={(event) => updateObserverForm("name", event.target.value)}
                placeholder="Example: Mrs. Chen"
                disabled={savingObserver}
              />
            </div>

            <div className="form-field">
              <label htmlFor="observer-email" className="form-label">
                Observer Email
              </label>
              <input
                id="observer-email"
                type="email"
                className="form-input"
                value={observerForm.email}
                onChange={(event) => updateObserverForm("email", event.target.value)}
                placeholder="parent@family.com"
                disabled={savingObserver}
              />
            </div>

            <div className="form-field">
              <label htmlFor="observer-relationship" className="form-label">
                Observer Type
              </label>
              <select
                id="observer-relationship"
                className="form-input"
                value={observerForm.relationship}
                onChange={(event) => updateObserverForm("relationship", event.target.value)}
                disabled={savingObserver}
              >
                <option value="parent">Parent</option>
                <option value="chinese_homeroom_teacher">Chinese Homeroom Teacher</option>
              </select>
            </div>
          </div>

          <div>
            <button type="submit" className="primary-btn" disabled={savingObserver}>
              {savingObserver ? "Adding Observer..." : "Add Observer"}
            </button>
          </div>

          {observerMessage ? <p className="form-message">{observerMessage}</p> : null}
          {observerError ? <p className="form-message">{observerError}</p> : null}
        </form>
      </section>

      <section className="panel">
        <div className="section-header">
          <div>
            <h3>User Directory</h3>
            <p className="section-subtitle">
              Use the filters to review teachers, students, administrators, and observers from one table.
            </p>
          </div>
        </div>

        <div style={{ marginBottom: "14px" }}>
          <label htmlFor="user-search" className="form-label">
            Search Users
          </label>
          <input
            id="user-search"
            type="text"
            className="form-input"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search by name, email, role, or status..."
          />
        </div>

        <div style={tabRowStyle}>
          {userTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              style={activeTab === tab.key ? activeTabButtonStyle : tabButtonStyle}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{ marginBottom: "12px", fontWeight: 800 }}>
          Showing {filteredUsers.length} {activeTabLabel}
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan="5">No users found for this filter.</td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id}>
                    <td>{getDisplayName(user)}</td>
                    <td>{user.email || "No email"}</td>
                    <td>{user.role || "Not recorded"}</td>
                    <td>{getUserStatus(user)}</td>
                    <td>
                      <button
                        type="button"
                        style={smallActionButtonStyle}
                        onClick={() => openEditDrawer(user)}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <EditUserDrawer
        editingUser={editingUser}
        onUserUpdated={handleUserUpdated}
        onUserDeleted={handleUserDeleted}
        students={students}
        observerDraft={observerDraft}
        getDisplayName={getDisplayName}
        getUserStatus={getUserStatus}
        isObserverUser={isObserverUser}
        updateObserverDraft={updateObserverDraft}
        toggleLinkedStudent={toggleLinkedStudent}
        removeLinkedStudent={removeLinkedStudent}
        cancelObserverChanges={cancelObserverChanges}
        saveObserverChanges={saveObserverChanges}
        closeEditDrawer={closeEditDrawer}
      />
    </div>
  );
}

const modalBackdropStyle = {
  position: "fixed",
  inset: 0,
  background: "rgba(15, 23, 42, 0.45)",
  display: "flex",
  justifyContent: "flex-end",
  zIndex: 1000,
};

const modalPanelStyle = {
  width: "min(720px, 100%)",
  height: "100%",
  background: "#ffffff",
  padding: "24px",
  overflowY: "auto",
  boxShadow: "-8px 0 24px rgba(15, 23, 42, 0.18)",
};

const modalHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "16px",
  marginBottom: "18px",
};

const smallActionButtonStyle = {
  border: "1px solid #111827",
  background: "#ffffff",
  color: "#111827",
  borderRadius: "8px",
  padding: "7px 10px",
  fontWeight: 800,
  cursor: "pointer",
};

const tabRowStyle = {
  display: "flex",
  gap: "10px",
  flexWrap: "wrap",
  marginBottom: "16px",
};

const tabButtonStyle = {
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#111827",
  borderRadius: "999px",
  padding: "9px 14px",
  fontWeight: 800,
  cursor: "pointer",
};

const activeTabButtonStyle = {
  ...tabButtonStyle,
  border: "2px solid #111827",
  background: "#111827",
  color: "#ffffff",
};

export default UsersPage;
