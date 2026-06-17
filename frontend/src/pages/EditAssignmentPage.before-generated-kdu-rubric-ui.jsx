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

function getBucketLabel(bucket) {
  if (bucket === "DO") return "DO / Content Learning Standards";
  if (bucket === "KNOW") return "KNOW / Curricular Competencies";
  if (bucket === "UNDERSTAND") return "UNDERSTAND / Core Competencies";
  return bucket || "Criterion";
}

function WorkflowStep({ number, title, children }) {
  return (
    <div
      style={{
        border: "1px solid #d7dce5",
        borderRadius: "14px",
        padding: "18px",
        background: "#ffffff",
      }}
    >
      <h2 style={{ marginTop: 0, marginBottom: "10px" }}>
        Step {number}: {title}
      </h2>
      {children}
    </div>
  );
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

  const [rubricBuilding, setRubricBuilding] = useState(false);
  const [rubricLoading, setRubricLoading] = useState(false);
  const [rubricSaving, setRubricSaving] = useState(false);
  const [rubric, setRubric] = useState(null);
  const [rubricCriteria, setRubricCriteria] = useState([]);

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
        safeAssignments.find((item) => String(item.id) === String(assignmentId)) ||
        null;

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
      await loadKduRubric();
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

      setSelectedSubcategoryId(
        matchedSubcategory ? String(matchedSubcategory.id) : ""
      );
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

  async function loadKduRubric() {
    try {
      setRubricLoading(true);

      const res = await fetch(
        `${API_BASE}/api/assignments/${assignmentId}/kdu-rubric`
      );
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to load KDU rubric");
      }

      setRubric(data.rubric || null);
      setRubricCriteria(Array.isArray(data.criteria) ? data.criteria : []);
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to load KDU rubric");
      setRubric(null);
      setRubricCriteria([]);
    } finally {
      setRubricLoading(false);
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

  async function buildKduRubric() {
    try {
      setRubricBuilding(true);
      setError("");
      setMessage("");

      const res = await fetch(
        `${API_BASE}/api/assignments/${assignmentId}/build-kdu-rubric`,
        { method: "POST" }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to build KDU rubric");
      }

      setRubric(data.rubric || null);
      setRubricCriteria(Array.isArray(data.criteria) ? data.criteria : []);
      setMessage(
        "KDU rubric built successfully. You can now edit the DO, KNOW, and UNDERSTAND criteria below."
      );
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to build KDU rubric");
    } finally {
      setRubricBuilding(false);
    }
  }

  async function saveKduRubric() {
    if (rubricCriteria.length === 0) {
      setError("Build the KDU rubric before saving criteria.");
      return;
    }

    const hasBlankCriterion = rubricCriteria.some(
      (criterion) => !String(criterion.criterion_text || "").trim()
    );

    if (hasBlankCriterion) {
      setError("Each rubric criterion needs text before saving.");
      return;
    }

    try {
      setRubricSaving(true);
      setError("");
      setMessage("");

      const res = await fetch(
        `${API_BASE}/api/assignments/${assignmentId}/kdu-rubric`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ criteria: rubricCriteria }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to save KDU rubric");
      }

      setRubric(data.rubric || rubric);
      setRubricCriteria(Array.isArray(data.criteria) ? data.criteria : []);
      setMessage("KDU rubric criteria saved successfully.");
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to save KDU rubric");
    } finally {
      setRubricSaving(false);
    }
  }

  function updateRubricCriterion(criterionId, nextText) {
    setRubricCriteria((currentCriteria) =>
      currentCriteria.map((criterion) =>
        String(criterion.id) === String(criterionId)
          ? { ...criterion, criterion_text: nextText }
          : criterion
      )
    );
  }

  function openGradePage() {
    navigate(`/assignments/${assignmentId}/grade`);
  }

  if (loading) {
    return (
      <div className="content-area">
        <section className="panel">
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
          Follow the teacher workflow: set up the assignment, choose its assessment group,
          build the KDU rubric, then grade students.
        </p>

        {message ? <EditAssignmentNoticeBox>{message}</EditAssignmentNoticeBox> : null}
        {error ? (
          <EditAssignmentNoticeBox type="error">{error}</EditAssignmentNoticeBox>
        ) : null}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
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

          <EditAssignmentDetailCard title="Assessment Group">
            <div>{selectedCategory?.name || assignment?.category_name || "Not linked"}</div>
          </EditAssignmentDetailCard>

          <EditAssignmentDetailCard title="Current Weight">
            <div>{formatPercent(assignment?.calculated_weight)}</div>
          </EditAssignmentDetailCard>
        </div>

        <div style={{ display: "grid", gap: "18px", maxWidth: "960px" }}>
          <WorkflowStep number="1" title="Assignment Details">
            <div style={{ display: "grid", gap: "14px" }}>
              <div>
                <EditAssignmentFieldLabel>Title</EditAssignmentFieldLabel>
                <input value={title} onChange={(e) => setTitle(e.target.value)} style={inputStyle} />
              </div>

              <div>
                <EditAssignmentFieldLabel>Description</EditAssignmentFieldLabel>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows="5"
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
            </div>
          </WorkflowStep>

          <WorkflowStep number="2" title="Assessment Group">
            <p style={{ color: "#4b5563", lineHeight: 1.5 }}>
              Choose where this assignment belongs in the course grading structure.
              This controls how the saved KDU score feeds into the course grade.
            </p>

            <div style={{ display: "grid", gap: "14px" }}>
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
                Current path: <strong>{selectedCategory?.name || "No category"}</strong> →{" "}
                <strong>{selectedSubcategory?.name || "No subcategory"}</strong>
              </EditAssignmentNoticeBox>
            </div>
          </WorkflowStep>

          <WorkflowStep number="3" title="KDU Rubric Builder">
            <div style={{ display: "grid", gap: "14px" }}>
              <p style={{ lineHeight: 1.5, color: "#4b5563", marginTop: 0 }}>
                Build and edit the teacher-controlled rubric for this assignment.
                DO = 50%, KNOW = 25%, UNDERSTAND = 25%.
              </p>

              {rubricLoading ? <div>Loading KDU rubric...</div> : null}

              {!rubric && !rubricLoading ? (
                <EditAssignmentNoticeBox>
                  No KDU rubric is attached yet. Click <strong>Build KDU Rubric</strong> to create
                  editable DO, KNOW, and UNDERSTAND criteria.
                </EditAssignmentNoticeBox>
              ) : null}

              {rubric ? (
                <div style={{ display: "grid", gap: "12px" }}>
                  <div>
                    <strong>Rubric:</strong> {rubric.title || "KDU Competency Rubric"}
                  </div>

                  {rubricCriteria.map((criterion) => (
                    <div
                      key={criterion.id}
                      style={{
                        border: "1px solid #d7dce5",
                        borderRadius: "12px",
                        padding: "14px",
                        background: "#ffffff",
                      }}
                    >
                      <EditAssignmentFieldLabel>
                        {getBucketLabel(criterion.competency_bucket)} (
                        {formatPercent(criterion.bucket_weight_percent)})
                      </EditAssignmentFieldLabel>
                      <textarea
                        value={criterion.criterion_text || ""}
                        onChange={(e) =>
                          updateRubricCriterion(criterion.id, e.target.value)
                        }
                        rows="4"
                        style={textareaStyle}
                      />
                    </div>
                  ))}
                </div>
              ) : null}

              <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                <EditAssignmentActionButton
                  quiet
                  onClick={buildKduRubric}
                  disabled={saving || deleting || bucketLoading || rubricBuilding}
                >
                  {rubricBuilding ? "Building Rubric..." : "Build KDU Rubric"}
                </EditAssignmentActionButton>

                <EditAssignmentActionButton
                  quiet
                  onClick={saveKduRubric}
                  disabled={
                    saving ||
                    deleting ||
                    bucketLoading ||
                    rubricBuilding ||
                    rubricSaving ||
                    rubricCriteria.length === 0
                  }
                >
                  {rubricSaving ? "Saving Rubric..." : "Save KDU Rubric"}
                </EditAssignmentActionButton>
              </div>
            </div>
          </WorkflowStep>

          <WorkflowStep number="4" title="Save and Grade">
            <p style={{ color: "#4b5563", lineHeight: 1.5, marginTop: 0 }}>
              Save assignment changes first, then open the grading screen to enter student KDU scores.
            </p>

            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
              <EditAssignmentActionButton
                onClick={handleSave}
                disabled={saving || deleting || bucketLoading}
              >
                {saving ? "Saving..." : "Save Assignment"}
              </EditAssignmentActionButton>

              <EditAssignmentActionButton
                quiet
                onClick={openGradePage}
                disabled={saving || deleting || bucketLoading || rubricBuilding || rubricSaving}
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

              <EditAssignmentActionButton quiet onClick={handleDelete} disabled={saving || deleting}>
                {deleting ? "Deleting..." : "Delete Assignment"}
              </EditAssignmentActionButton>
            </div>
          </WorkflowStep>
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
