import { useEffect, useState } from "react";
import ObserverPermissionsPanel from "./ObserverPermissionsPanel.jsx";
import authFetch from "../../services/authFetch";

function EditUserDrawer({
  editingUser,
  onUserUpdated,
  onUserDeleted,
  students,
  observerDraft,
  getDisplayName,
  getUserStatus,
  isObserverUser,
  updateObserverDraft,
  toggleLinkedStudent,
  removeLinkedStudent,
  cancelObserverChanges,
  saveObserverChanges,
  closeEditDrawer,
}) {
  const [formDraft, setFormDraft] = useState({
    name: "",
    email: "",
    role: "student",
    parent_email: "",
    student_id: "",
  });
  const [savingUser, setSavingUser] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [resettingPassword, setResettingPassword] = useState(false);
  const [resetPasswordMessage, setResetPasswordMessage] = useState("");
  const [deletingUser, setDeletingUser] = useState(false);
  const [deleteUserMessage, setDeleteUserMessage] = useState("");

  useEffect(() => {
    if (!editingUser) return;

    setFormDraft({
      name: getDisplayName(editingUser, ""),
      email: editingUser.email || "",
      role: String(editingUser.role || "student").trim().toLowerCase(),
      parent_email: editingUser.parent_email || "",
      student_id: editingUser.student_id || "",
    });

    setSaveMessage("");
    setResetPasswordMessage("");
    setDeleteUserMessage("");
  }, [editingUser, getDisplayName]);

  if (!editingUser) return null;

  function updateFormDraft(field, value) {
    setFormDraft((current) => ({
      ...current,
      [field]: value,
    }));
    setSaveMessage("");
  }

  async function handleSaveUser() {
    const name = String(formDraft.name || "").trim();
    const email = String(formDraft.email || "").trim().toLowerCase();
    const role = String(formDraft.role || "").trim().toLowerCase();

    if (!name) {
      setSaveMessage("User name is required.");
      return;
    }

    if (!email) {
      setSaveMessage("User email is required.");
      return;
    }

    if (!role) {
      setSaveMessage("User role is required.");
      return;
    }

    setSavingUser(true);
    setSaveMessage("Saving user changes...");

    try {
      const response = await authFetch(`/api/users/${editingUser.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          email,
          role,
          parent_email: String(formDraft.parent_email || "").trim(),
          student_id: String(formDraft.student_id || "").trim(),
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.error || "User update failed.");
      }

      setSaveMessage("User changes saved.");

      if (onUserUpdated) {
        await onUserUpdated(data?.user);
      }
    } catch (error) {
      console.error("Admin user update failed:", error);
      setSaveMessage(error.message || "User update failed.");
    } finally {
      setSavingUser(false);
    }
  }

  async function handleResetPassword() {
    const email = String(formDraft.email || editingUser.email || "")
      .trim()
      .toLowerCase();

    if (!email) {
      setResetPasswordMessage("User email is required before password reset.");
      return;
    }

    const confirmed = window.confirm(
      `Reset password access for ${email}? The user will be required to create a new password at next login.`
    );

    if (!confirmed) return;

    setResettingPassword(true);
    setResetPasswordMessage("Resetting password access...");

    try {
      const response = await authFetch("/api/auth/admin-reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.error || "Password reset failed.");
      }

      setResetPasswordMessage(
        "Password reset complete. The user must create a new password at next login."
      );
    } catch (error) {
      console.error("Admin password reset failed:", error);
      setResetPasswordMessage(error.message || "Password reset failed.");
    } finally {
      setResettingPassword(false);
    }
  }

  async function handleDeleteUser() {
    const role = String(editingUser.role || "").trim().toLowerCase();
    const displayName = getDisplayName(editingUser, "this user");

    if (role === "admin") {
      setDeleteUserMessage("Administrator accounts cannot be deleted.");
      return;
    }

    if (role === "teacher") {
      setDeleteUserMessage(
        "Teacher accounts cannot be deleted while instructional records may depend on them. Reassign their courses and academic records first."
      );
      return;
    }

    const confirmed = window.confirm(
      `Permanently delete ${displayName}? This action cannot be undone.`
    );

    if (!confirmed) return;

    setDeletingUser(true);
    setDeleteUserMessage("Deleting user...");

    try {
      const response = await authFetch(`/api/users/${editingUser.id}`, {
        method: "DELETE",
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.error || "User deletion failed.");
      }

      setDeleteUserMessage("User deleted successfully.");

      if (onUserDeleted) {
        await onUserDeleted(data?.user);
      }
    } catch (error) {
      console.error("Admin user deletion failed:", error);
      setDeleteUserMessage(error.message || "User deletion failed.");
    } finally {
      setDeletingUser(false);
    }
  }

  const editingRole = String(editingUser.role || "").trim().toLowerCase();
  const canDeleteUser = ["student", "observer", "parent"].includes(editingRole);

  return (
    <div style={modalBackdropStyle}>
      <div style={modalPanelStyle}>
        <div style={modalHeaderStyle}>
          <div>
            <h3 style={{ margin: 0 }}>Edit User</h3>
            <p className="section-subtitle" style={{ marginTop: "6px" }}>
              Update account information, role, student details, and account security.
            </p>
          </div>

          <button
            type="button"
            style={smallActionButtonStyle}
            onClick={closeEditDrawer}
            disabled={savingUser}
          >
            Close
          </button>
        </div>

        <div className="form-stack">
          <div className="form-grid">
            <div className="form-field">
              <label className="form-label">Name</label>
              <input
                type="text"
                className="form-input"
                value={formDraft.name}
                onChange={(event) => updateFormDraft("name", event.target.value)}
              />
            </div>

            <div className="form-field">
              <label className="form-label">Email</label>
              <input
                type="email"
                className="form-input"
                value={formDraft.email}
                onChange={(event) => updateFormDraft("email", event.target.value)}
              />
            </div>

            <div className="form-field">
              <label className="form-label">Role</label>
              <select
                className="form-input"
                value={formDraft.role}
                onChange={(event) => updateFormDraft("role", event.target.value)}
              >
                <option value="admin">Administrator</option>
                <option value="teacher">Teacher</option>
                <option value="student">Student</option>
                <option value="observer">Observer</option>
                <option value="parent">Parent</option>
              </select>
            </div>

            <div className="form-field">
              <label className="form-label">Status</label>
              <input
                type="text"
                className="form-input"
                value={getUserStatus(editingUser)}
                readOnly
              />
            </div>

            <div className="form-field">
              <label className="form-label">Parent Email</label>
              <input
                type="email"
                className="form-input"
                value={formDraft.parent_email}
                onChange={(event) =>
                  updateFormDraft("parent_email", event.target.value)
                }
              />
            </div>

            <div className="form-field">
              <label className="form-label">Student ID</label>
              <input
                type="text"
                className="form-input"
                value={formDraft.student_id}
                onChange={(event) =>
                  updateFormDraft("student_id", event.target.value)
                }
              />
            </div>
          </div>

          <div style={formActionsStyle}>
            <button
              type="button"
              style={smallActionButtonStyle}
              onClick={closeEditDrawer}
              disabled={savingUser}
            >
              Cancel
            </button>

            <button
              type="button"
              style={primaryActionButtonStyle}
              onClick={handleSaveUser}
              disabled={savingUser}
            >
              {savingUser ? "Saving..." : "Save Changes"}
            </button>
          </div>

          {saveMessage ? <p className="form-message">{saveMessage}</p> : null}

          <div style={accountSecurityStyle}>
            <div>
              <h4 style={accountSecurityTitleStyle}>Account Security</h4>
              <p className="section-subtitle" style={{ margin: "4px 0 0 0" }}>
                Reset password access so this user can create a new password at next login.
              </p>
            </div>

            <button
              type="button"
              style={warningActionButtonStyle}
              onClick={handleResetPassword}
              disabled={resettingPassword || savingUser}
            >
              {resettingPassword ? "Resetting..." : "Reset Password"}
            </button>
          </div>

          {resetPasswordMessage ? (
            <p className="form-message">{resetPasswordMessage}</p>
          ) : null}

          <div style={dangerZoneStyle}>
            <div>
              <h4 style={dangerZoneTitleStyle}>Danger Zone</h4>
              <p className="section-subtitle" style={{ margin: "4px 0 0 0" }}>
                {canDeleteUser
                  ? "Permanently delete this account and its permitted related records. This action cannot be undone."
                  : editingRole === "teacher"
                    ? "Teacher accounts must be reassigned before deletion because instructional records may depend on them."
                    : "Administrator accounts are protected from deletion."}
              </p>
            </div>

            {canDeleteUser ? (
              <button
                type="button"
                style={dangerActionButtonStyle}
                onClick={handleDeleteUser}
                disabled={deletingUser || savingUser || resettingPassword}
              >
                {deletingUser ? "Deleting..." : "Delete User"}
              </button>
            ) : null}
          </div>

          {deleteUserMessage ? (
            <p className="form-message">{deleteUserMessage}</p>
          ) : null}

          {isObserverUser(editingUser) ? (
            <ObserverPermissionsPanel
              students={students}
              observerDraft={observerDraft}
              onUpdateDraft={updateObserverDraft}
              onToggleStudent={toggleLinkedStudent}
              onRemoveStudent={removeLinkedStudent}
              onCancel={cancelObserverChanges}
              onSave={saveObserverChanges}
            />
          ) : null}
        </div>
      </div>
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

const formActionsStyle = {
  display: "flex",
  justifyContent: "flex-end",
  gap: "10px",
  flexWrap: "wrap",
};

const smallActionButtonStyle = {
  border: "1px solid #111827",
  background: "#ffffff",
  color: "#111827",
  borderRadius: "8px",
  padding: "9px 14px",
  fontWeight: 800,
  cursor: "pointer",
};

const primaryActionButtonStyle = {
  ...smallActionButtonStyle,
  background: "#111827",
  color: "#ffffff",
};

const warningActionButtonStyle = {
  ...smallActionButtonStyle,
  border: "1px solid #92400e",
  background: "#fffbeb",
  color: "#92400e",
};

const accountSecurityStyle = {
  border: "1px solid #f59e0b",
  background: "#fffbeb",
  borderRadius: "12px",
  padding: "14px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "14px",
  flexWrap: "wrap",
};

const accountSecurityTitleStyle = {
  margin: 0,
  fontSize: "16px",
  fontWeight: 800,
  color: "#111827",
};

const dangerZoneStyle = {
  border: "1px solid #b91c1c",
  background: "#fef2f2",
  borderRadius: "12px",
  padding: "14px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "14px",
  flexWrap: "wrap",
};

const dangerZoneTitleStyle = {
  margin: 0,
  fontSize: "16px",
  fontWeight: 800,
  color: "#7f1d1d",
};

const dangerActionButtonStyle = {
  ...smallActionButtonStyle,
  border: "1px solid #991b1b",
  background: "#991b1b",
  color: "#ffffff",
};

export default EditUserDrawer;
