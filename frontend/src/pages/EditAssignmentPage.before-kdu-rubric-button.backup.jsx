import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  EditAssignmentActionButton,
  EditAssignmentDetailCard,
  EditAssignmentFieldLabel,
  EditAssignmentNoticeBox,
} from "./editAssignmentComponents.jsx";

const API_BASE = "http://localhost:3000";

function formatPercent(value) {
  if (value === null || value === undefined || value === "") {
    return "Not calculated";
  }

  const numericValue = Number(value);

  if (Number.isNaN(numericValue)) {
    return "Not calculated";
  }

  return `${numericValue.toFixed(2)}%`;
}

function formatDate(value) {
  if (!value) {
    return "No due date";
  }

  return String(value).slice(0, 10);
}

export default function EditAssignmentPage() {
  const { assignmentId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [bucketLoading, setBucketLoading] = useState(false);

  const [assignment, setAssignment] = useState(null);
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState("");

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedCategory = useMemo(() => {
    return (
      categories.find(
        (category) => String(category.id) === String(selectedCategoryId)
      ) || null
    );
  }, [categories, selectedCategoryId]);

  const selectedSubcategory = useMemo(() => {
    return (
      subcategories.find(
        (subcategory) => String(subcategory.id) === String(selectedSubcategoryId)
      ) || null
    );
  }, [subcategories, selectedSubcategoryId]);

  useEffect(() => {
    loadAssignment();
  }, [assignmentId]);

  useEffect(() => {
    if (!selectedCategoryId) {
      setSubcategories([]);
      setSelectedSubcategoryId("");
      return;
    }

    loadSubcategories(selectedCategoryId);
  }, [selectedCategoryId]);

  async function loadAssignment() {
    try {
      setLoading(true);
      setError("");
      setMessage("");

      const res = await fetch(`${API_BASE}/api/assignments`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error("Failed to load assignments");
      }

      const safeAssignments = Array.isArray(data) ? data : [];
      const foundAssignment =
        safeAssignments.find(
          (item) => String(item.id) === String(assignmentId)
        ) || null;

      if (!foundAssignment) {
        throw new Error("Assignment not found");
      }

      setAssignment(foundAssignment);
      setTitle(foundAssignment.title || "");
      setDescription(foundAssignment.description || "");
      setDueDate(
        foundAssignment.due_date
          ? String(foundAssignment.due_date).slice(0, 10)
          : ""
      );

      await loadCategoriesForAssignment(foundAssignment);
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to load assignment");
    } finally {
      setLoading(false);
    }
  }

  async function loadCategoriesForAssignment(foundAssignment) {
    if (!foundAssignment?.class_id) {
      setCategories([]);
      setSelectedCategoryId("");
      setSubcategories([]);
      setSelectedSubcategoryId("");
      return;
    }

    try {
      setBucketLoading(true);

      const categoriesRes = await fetch(
        `${API_BASE}/api/courses/${foundAssignment.class_id}/categories`
      );
      const categoriesData = await categoriesRes.json();

      if (!categoriesRes.ok) {
        throw new Error("Failed to load categories");
      }

      const safeCategories = Array.isArray(categoriesData) ? categoriesData : [];
      setCategories(safeCategories);

      const matchedCategory =
        safeCategories.find(
          (category) =>
            String(category.name || "").trim().toLowerCase() ===
            String(foundAssignment.category_name || "").trim().toLowerCase()
        ) || null;

      if (!matchedCategory) {
        setSelectedCategoryId("");
        setSubcategories([]);
        setSelectedSubcategoryId("");
        return;
      }

      setSelectedCategoryId(String(matchedCategory.id));

      const subcategoriesRes = await fetch(
        `${API_BASE}/api/categories/${matchedCategory.id}/subcategories`
      );
      const subcategoriesData = await subcategoriesRes.json();

      if (!subcategoriesRes.ok) {
        throw new Error("Failed to load subcategories");
      }

      const safeSubcategories = Array.isArray(subcategoriesData)
        ? subcategoriesData
        : [];

      setSubcategories(safeSubcategories);

      const matchedSubcategory =
        safeSubcategories.find(
          (subcategory) =>
            String(subcategory.id) === String(foundAssignment.subcategory_id)
        ) || null;

      if (matchedSubcategory) {
        setSelectedSubcategoryId(String(matchedSubcategory.id));
      } else {
        setSelectedSubcategoryId("");
      }
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to load assignment bucket options");
      setCategories([]);
      setSelectedCategoryId("");
      setSubcategories([]);
      setSelectedSubcategoryId("");
    } finally {
      setBucketLoading(false);
    }
  }

  async function loadSubcategories(categoryId) {
    try {
      setBucketLoading(true);
      setError("");

      const res = await fetch(
        `${API_BASE}/api/categories/${categoryId}/subcategories`
      );
      const data = await res.json();

      if (!res.ok) {
        throw new Error("Failed to load subcategories");
      }

      const safeSubcategories = Array.isArray(data) ? data : [];
      setSubcategories(safeSubcategories);

      if (
        selectedSubcategoryId &&
        !safeSubcategories.some(
          (subcategory) =>
            String(subcategory.id) === String(selectedSubcategoryId)
        )
      ) {
        setSelectedSubcategoryId("");
      }
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to load subcategories");
      setSubcategories([]);
      setSelectedSubcategoryId("");
    } finally {
      setBucketLoading(false);
    }
  }

  async function handleSave() {
    if (!String(title || "").trim()) {
      setError("Assignment title is required");
      return;
    }

    if (!selectedCategoryId) {
      setError("Category selection is required");
      return;
    }

    if (!selectedSubcategoryId) {
      setError("Subcategory selection is required");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setMessage("");

      const cleanTitle = String(title || "").trim();
      const cleanDescription = String(description || "").trim();
      const cleanDueDate = dueDate || null;

      const res = await fetch(`${API_BASE}/api/assignments/${assignmentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: cleanTitle,
          description: cleanDescription,
          due_date: cleanDueDate,
          subcategory_id: Number(selectedSubcategoryId),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to update assignment");
      }

      const refreshedAssignment = {
        ...(assignment || {}),
        ...data,
        id: assignment?.id || Number(assignmentId),
        title: cleanTitle,
        description: cleanDescription,
        due_date: cleanDueDate,
        subcategory_id: Number(selectedSubcategoryId),
        category_name: selectedCategory
          ? selectedCategory.name
          : assignment?.category_name,
        subcategory_name: selectedSubcategory
          ? selectedSubcategory.name
          : assignment?.subcategory_name,
      };

      setAssignment(refreshedAssignment);
      setTitle(cleanTitle);
      setDescription(cleanDescription);
      setDueDate(cleanDueDate ? String(cleanDueDate).slice(0, 10) : "");
      setMessage(
        `Assignment updated successfully. Current calculated weight: ${formatPercent(
          data.calculated_weight
        )}`
      );
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to update assignment");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this assignment?"
    );

    if (!confirmDelete) {
      return;
    }

    try {
      setDeleting(true);
      setError("");
      setMessage("");

      const res = await fetch(`${API_BASE}/api/assignments/${assignmentId}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to delete assignment");
      }

      navigate("/assignments");
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to delete assignment");
    } finally {
      setDeleting(false);
    }
  }

  function openGradePage() {
    navigate(`/assignments/${assignmentId}/grade`);
  }

  if (loading) {
    return (
      <div className="content-area">
        <section className="panel">
          <div style={{ marginBottom: "16px" }}>
            <EditAssignmentActionButton quiet onClick={() => navigate("/assignments")}>
              ← Back to Assignments
            </EditAssignmentActionButton>
          </div>
          <p>Loading assignment...</p>
        </section>
      </div>
    );
  }

  return (
    <div className="content-area">
      <section className="panel">
        <div style={{ marginBottom: "16px" }}>
          <EditAssignmentActionButton quiet onClick={() => navigate("/assignments")}>
            ← Back to Assignments
          </EditAssignmentActionButton>
        </div>

        <h1 style={{ marginTop: 0 }}>Edit Assignment</h1>
        <p style={{ color: "#4b5563", lineHeight: 1.5 }}>
          Update the assignment title, description, due date, and grading
          bucket. Teachers can now reassign the assignment to the correct
          category and subcategory before saving.
        </p>

        {message ? <EditAssignmentNoticeBox>{message}</EditAssignmentNoticeBox> : null}
        {error ? (
          <EditAssignmentNoticeBox type="error">{error}</EditAssignmentNoticeBox>
        ) : null}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: "14px",
            marginBottom: "20px",
          }}
        >
          <EditAssignmentDetailCard title="Assignment ID">
            <div>{assignment?.id || assignmentId}</div>
          </EditAssignmentDetailCard>

          <EditAssignmentDetailCard title="Class ID">
            <div>{assignment?.class_id || "—"}</div>
          </EditAssignmentDetailCard>

          <EditAssignmentDetailCard title="Current Due Date">
            <div>{formatDate(assignment?.due_date)}</div>
          </EditAssignmentDetailCard>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: "14px",
            marginBottom: "20px",
          }}
        >
          <EditAssignmentDetailCard title="Category">
            <div>{selectedCategory?.name || assignment?.category_name || "Not linked"}</div>
          </EditAssignmentDetailCard>

          <EditAssignmentDetailCard title="Subcategory">
            <div>
              {selectedSubcategory?.name || assignment?.subcategory_name || "Not linked"}
            </div>
          </EditAssignmentDetailCard>

          <EditAssignmentDetailCard title="Calculated Weight">
            <div>{formatPercent(assignment?.calculated_weight)}</div>
          </EditAssignmentDetailCard>
        </div>

        <div style={{ display: "grid", gap: "16px", maxWidth: "760px" }}>
          <div>
            <EditAssignmentFieldLabel>Title</EditAssignmentFieldLabel>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={inputStyle}
            />
          </div>

          <div>
            <EditAssignmentFieldLabel>Description</EditAssignmentFieldLabel>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows="6"
              style={textareaStyle}
            />
          </div>

          <div>
            <EditAssignmentFieldLabel>Due Date</EditAssignmentFieldLabel>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              style={inputStyle}
            />
          </div>

          <div>
            <EditAssignmentFieldLabel>Category</EditAssignmentFieldLabel>
            <select
              value={selectedCategoryId}
              onChange={(e) => {
                setSelectedCategoryId(e.target.value);
                setSelectedSubcategoryId("");
                setMessage("");
                setError("");
              }}
              style={inputStyle}
              disabled={bucketLoading || categories.length === 0}
            >
              <option value="">Select a category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name} ({formatPercent(category.weight_percent)})
                </option>
              ))}
            </select>
          </div>

          <div>
            <EditAssignmentFieldLabel>Subcategory</EditAssignmentFieldLabel>
            <select
              value={selectedSubcategoryId}
              onChange={(e) => {
                setSelectedSubcategoryId(e.target.value);
                setMessage("");
                setError("");
              }}
              style={inputStyle}
              disabled={bucketLoading || !selectedCategoryId || subcategories.length === 0}
            >
              <option value="">Select a subcategory</option>
              {subcategories.map((subcategory) => (
                <option key={subcategory.id} value={subcategory.id}>
                  {subcategory.name} ({formatPercent(subcategory.weight_percent_of_parent)})
                </option>
              ))}
            </select>
          </div>

          <EditAssignmentNoticeBox>
            Category and subcategory reassignment is supported here. Save Changes
            updates the assignment text, due date, and selected grading bucket.
          </EditAssignmentNoticeBox>

          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <EditAssignmentActionButton
              onClick={handleSave}
              disabled={saving || deleting || bucketLoading}
            >
              {saving ? "Saving..." : "Save Changes"}
            </EditAssignmentActionButton>

            <EditAssignmentActionButton
              quiet
              onClick={openGradePage}
              disabled={saving || deleting || bucketLoading}
            >
              Open Grade Page
            </EditAssignmentActionButton>

            <EditAssignmentActionButton
              quiet
              onClick={() => navigate("/assignments")}
              disabled={saving || deleting}
            >
              Back to Assignments
            </EditAssignmentActionButton>

            <EditAssignmentActionButton
              quiet
              onClick={handleDelete}
              disabled={saving || deleting}
            >
              {deleting ? "Deleting..." : "Delete Assignment"}
            </EditAssignmentActionButton>
          </div>
        </div>
      </section>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  padding: "12px",
  borderRadius: "8px",
  border: "1px solid #ccc",
  boxSizing: "border-box",
  font: "inherit",
  background: "#ffffff",
};

const textareaStyle = {
  width: "100%",
  padding: "12px",
  borderRadius: "8px",
  border: "1px solid #ccc",
  boxSizing: "border-box",
  font: "inherit",
  background: "#ffffff",
  resize: "vertical",
};