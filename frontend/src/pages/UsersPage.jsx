import { useEffect, useMemo, useState } from "react";

const emptyTeacherForm = {
  name: "",
  email: "",
};

function UsersPage() {
  const [users, setUsers] = useState([]);
  const [status, setStatus] = useState("Loading users...");
  const [teacherForm, setTeacherForm] = useState(emptyTeacherForm);
  const [teacherMessage, setTeacherMessage] = useState("");
  const [teacherError, setTeacherError] = useState("");
  const [savingTeacher, setSavingTeacher] = useState(false);

  async function loadUsers() {
    setStatus("Loading users...");

    try {
      const response = await fetch("/api/users");

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
      const response = await fetch("/api/teachers", {
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

  const teachers = useMemo(() => {
    return users.filter(
      (user) => String(user?.role || "").trim().toLowerCase() === "teacher"
    );
  }, [users]);

  const students = useMemo(() => {
    return users.filter(
      (user) => String(user?.role || "").trim().toLowerCase() === "student"
    );
  }, [users]);

  const admins = useMemo(() => {
    return users.filter(
      (user) => String(user?.role || "").trim().toLowerCase() === "admin"
    );
  }, [users]);

  return (
    <div className="content-area">
      <section className="panel">
        <div className="section-header">
          <div>
            <h2>Users</h2>
            <p className="section-subtitle">
              Manage teacher accounts and review current users.
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
            <h3>Teacher Accounts</h3>
            <p className="section-subtitle">
              Current users with teacher access.
            </p>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Teacher</th>
                <th>Email</th>
                <th>Role</th>
              </tr>
            </thead>
            <tbody>
              {teachers.length === 0 ? (
                <tr>
                  <td colSpan="3">No teacher accounts found.</td>
                </tr>
              ) : (
                teachers.map((teacher) => (
                  <tr key={teacher.id}>
                    <td>
                      {teacher.name ||
                        `${teacher.first_name || ""} ${teacher.last_name || ""}`.trim() ||
                        "Unnamed teacher"}
                    </td>
                    <td>{teacher.email || "No email"}</td>
                    <td>{teacher.role || "teacher"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="section-header">
          <div>
            <h3>All Users</h3>
            <p className="section-subtitle">
              Full user list for admin review.
            </p>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th>Email</th>
                <th>Role</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan="3">No users found.</td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id}>
                    <td>
                      {user.name ||
                        `${user.first_name || ""} ${user.last_name || ""}`.trim() ||
                        "Unnamed user"}
                    </td>
                    <td>{user.email || "No email"}</td>
                    <td>{user.role || "Not recorded"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default UsersPage;
