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

  const [activityText, setActivityText] = useState("");
  const [teacherKnowCriteria, setTeacherKnowCriteria] = useState("");
  const [teacherDoCriteria, setTeacherDoCriteria] = useState("");
  const [teacherUnderstandCriteria, setTeacherUnderstandCriteria] = useState("");
  const [generatedRubric, setGeneratedRubric] = useState([]);
  const [generatedActivityType, setGeneratedActivityType] = useState("");
  const [generatedRubricTitle, setGeneratedRubricTitle] = useState("");
  const [generatedRubricLoading, setGeneratedRubricLoading] = useState(false);
  const [generatedRubricSaving, setGeneratedRubricSaving] = useState(false);
  const [savedFullRubricInfo, setSavedFullRubricInfo] = useState(null);

  const [assignmentSections, setAssignmentSections] = useState([]);
  const [sectionSaving, setSectionSaving] = useState(false);
  const [sectionSaveMessage, setSectionSaveMessage] = useState("");

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
      setGeneratedRubricTitle(`${foundAssignment.title || "Assignment"} KDU Rubric`);

      await loadCategoriesForAssignment(foundAssignment);
      await loadKduRubric();
      await loadFullKduRubric();
      await loadAssignmentSections();
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

  async function loadFullKduRubric() {
    try {
      const res = await fetch(
        `${API_BASE}/api/assignments/${assignmentId}/full-kdu-rubric`
      );
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to load saved full KDU rubric");
      }

      if (data.rubric === null) {
        setSavedFullRubricInfo(null);
        return;
      }

      setGeneratedRubricTitle(data.title || "Generated KDU Rubric");
      setGeneratedActivityType(data.activityType || "");
      setGeneratedRubric(Array.isArray(data.rows) ? data.rows : []);
      setSavedFullRubricInfo({
        savedAt: data.savedAt || null,
        rubricId: data.rubricId || null,
      });
    } catch (err) {
      console.error(err);
      setSavedFullRubricInfo(null);
    }
  }

  async function loadAssignmentSections() {
    try {
      const res = await fetch(`${API_BASE}/api/assignments/${assignmentId}/sections`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to load assignment sections");
      }

      const safeSections = Array.isArray(data.sections) ? data.sections : [];

      if (safeSections.length === 0) {
        setAssignmentSections([
          {
            section_name: "Multiple Choice / Knowledge Questions",
            competency_bucket: "KNOW",
            max_points: 10,
            section_weight: 1,
          },
          {
            section_name: "Performance / Skill Task",
            competency_bucket: "DO",
            max_points: 10,
            section_weight: 1,
          },
          {
            section_name: "Explanation / Big Idea Response",
            competency_bucket: "UNDERSTAND",
            max_points: 10,
            section_weight: 1,
          },
        ]);
        return;
      }

      setAssignmentSections(
        safeSections.map((section) => ({
          id: section.id,
          section_name: section.section_name || "",
          competency_bucket: section.competency_bucket || "KNOW",
          max_points: section.max_points || 0,
          section_weight: section.section_weight || 1,
        }))
      );
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to load assignment sections");
      setAssignmentSections([]);
    }
  }

  function updateAssignmentSection(index, field, value) {
    setAssignmentSections((currentSections) =>
      currentSections.map((section, sectionIndex) =>
        sectionIndex === index ? { ...section, [field]: value } : section
      )
    );
  }

  function addAssignmentSection() {
    setAssignmentSections((currentSections) => [
      ...currentSections,
      {
        section_name: "",
        competency_bucket: "KNOW",
        max_points: 10,
        section_weight: 1,
      },
    ]);
  }

  function removeAssignmentSection(index) {
    setAssignmentSections((currentSections) =>
      currentSections.filter((_, sectionIndex) => sectionIndex !== index)
    );
  }

  async function saveAssignmentSections() {
    if (assignmentSections.length === 0) {
      setError("Add at least one exam section before saving.");
      return;
    }

    const cleanSections = assignmentSections.map((section) => ({
      section_name: String(section.section_name || "").trim(),
      competency_bucket: String(section.competency_bucket || "").trim().toUpperCase(),
      max_points: Number(section.max_points),
      section_weight: Number(section.section_weight || 1),
    }));

    const hasInvalidSection = cleanSections.some(
      (section) =>
        !section.section_name ||
        !["KNOW", "DO", "UNDERSTAND"].includes(section.competency_bucket) ||
        !Number.isFinite(section.max_points) ||
        section.max_points <= 0 ||
        !Number.isFinite(section.section_weight) ||
        section.section_weight <= 0
    );

    if (hasInvalidSection) {
      setError(
        "Each section needs a name, KDU bucket, out-of mark greater than 0, and weight greater than 0."
      );
      return;
    }

    try {
      setSectionSaving(true);
      setError("");
      setMessage("");

      const res = await fetch(`${API_BASE}/api/assignments/${assignmentId}/sections`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sections: cleanSections }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to save exam sections");
      }

      setAssignmentSections(
        Array.isArray(data.sections)
          ? data.sections.map((section) => ({
              id: section.id,
              section_name: section.section_name || "",
              competency_bucket: section.competency_bucket || "KNOW",
              max_points: section.max_points || 0,
              section_weight: section.section_weight || 1,
            }))
          : cleanSections
      );

      setMessage("");
      setSectionSaveMessage("✓ Saved");
      window.setTimeout(() => {
        setSectionSaveMessage("");
      }, 2000);
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to save exam sections");
    } finally {
      setSectionSaving(false);
    }
  }

  async function handleSave(options = {}) {
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
      setGeneratedRubricTitle(`${cleanTitle || "Assignment"} KDU Rubric`);
      setMessage(
        `Assignment updated successfully. Current calculated weight: ${formatPercent(
          data.calculated_weight
        )}`
      );

      if (options.openGradePage) {
        navigate(`/assignments/${assignmentId}/grade`);
      }
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

  async function generateFullKduRubric() {
    const cleanActivityText = String(activityText || "").trim();
    const cleanKnow = String(teacherKnowCriteria || "").trim();
    const cleanDo = String(teacherDoCriteria || "").trim();
    const cleanUnderstand = String(teacherUnderstandCriteria || "").trim();

    if (!cleanActivityText) {
      setError("Paste the student activity or assignment instructions before generating the full rubric.");
      return;
    }

    try {
      setGeneratedRubricLoading(true);
      setError("");
      setMessage("");

      const teacherCriteriaText = [
        cleanKnow ? `KNOW teacher criteria: ${cleanKnow}` : "",
        cleanDo ? `DO teacher criteria: ${cleanDo}` : "",
        cleanUnderstand ? `UNDERSTAND teacher criteria: ${cleanUnderstand}` : "",
      ]
        .filter(Boolean)
        .join("\n");

      const res = await fetch(
        `${API_BASE}/api/assignments/${assignmentId}/generate-kdu-rubric`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            activityText: teacherCriteriaText
              ? `${cleanActivityText}\n\n${teacherCriteriaText}`
              : cleanActivityText,
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to generate full KDU rubric");
      }

      setGeneratedActivityType(data.activityType || "Assignment");
      setGeneratedRubric(Array.isArray(data.rubric) ? data.rubric : []);
      setMessage("Full six-level KDU rubric generated. You can edit every cell before saving or exporting.");
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to generate full KDU rubric");
    } finally {
      setGeneratedRubricLoading(false);
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

  function updateGeneratedRubricCell(level, bucket, nextText) {
    setGeneratedRubric((currentRubric) =>
      currentRubric.map((row) =>
        String(row.level) === String(level) ? { ...row, [bucket]: nextText } : row
      )
    );
  }

  function clearGeneratedRubricWorkspace() {
    setActivityText("");
    setTeacherKnowCriteria("");
    setTeacherDoCriteria("");
    setTeacherUnderstandCriteria("");
    setGeneratedRubric([]);
    setGeneratedActivityType("");
    setMessage("Generated rubric workspace cleared.");
    setError("");
  }

  async function copyGeneratedRubricText() {
    const rubricText = buildGeneratedRubricText();

    if (!rubricText) {
      setError("Generate a full rubric before copying.");
      return;
    }

    try {
      await navigator.clipboard.writeText(rubricText);
      setMessage("Generated rubric text copied.");
      setError("");
    } catch (err) {
      console.error(err);
      setError("Could not copy rubric text.");
    }
  }

  async function exportGeneratedRubricTable() {
    if (generatedRubric.length === 0) {
      setError("Generate a full rubric before exporting the table.");
      return;
    }

    const tableText = [
      ["Level", "KNOW", "DO", "UNDERSTAND"].join("\t"),
      ...generatedRubric.map((row) =>
        [
          row.level || "",
          row.know || "",
          row.do || "",
          row.understand || "",
        ].join("\t")
      ),
    ].join("\n");

    try {
      await navigator.clipboard.writeText(tableText);
      setMessage("Rubric table copied. You can paste it into a document or spreadsheet.");
      setError("");
    } catch (err) {
      console.error(err);
      setError("Could not export rubric table.");
    }
  }

  function buildGeneratedRubricText() {
    if (generatedRubric.length === 0) {
      return "";
    }

    return [
      generatedRubricTitle || "Generated KDU Rubric",
      generatedActivityType ? `Detected activity type: ${generatedActivityType}` : "",
      "",
      ...generatedRubric.flatMap((row) => [
        `Level ${row.level}`,
        `KNOW: ${row.know || ""}`,
        `DO: ${row.do || ""}`,
        `UNDERSTAND: ${row.understand || ""}`,
        "",
      ]),
    ]
      .filter((line, index, lines) => line !== "" || lines[index - 1] !== "")
      .join("\n");
  }

  async function exportGeneratedRubricWordDoc() {
    if (generatedRubric.length === 0) {
      setError("Generate a full rubric before exporting a Word document.");
      return;
    }

    try {
      setError("");
      setMessage("");

      const res = await fetch(
        `${API_BASE}/api/assignments/${assignmentId}/export-kdu-rubric-docx`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: generatedRubricTitle || "Generated KDU Rubric",
            activityType: generatedActivityType,
            rubric: generatedRubric,
          }),
        }
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to export Word document");
      }

      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      const safeTitle = String(generatedRubricTitle || "kdu-rubric")
        .replace(/[^a-z0-9]+/gi, "-")
        .replace(/^-+|-+$/g, "");

      link.href = downloadUrl;
      link.download = `${safeTitle || "kdu-rubric"}.docx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);

      setMessage("Word document exported.");
    } catch (err) {
      console.error(err);
      setError(err.message || "Could not export Word document.");
    }
  }

  async function saveFullGeneratedRubric() {
    if (generatedRubric.length === 0) {
      setError("Generate a full rubric before saving it.");
      return;
    }

    try {
      setGeneratedRubricSaving(true);
      setError("");
      setMessage("");

      const res = await fetch(
        `${API_BASE}/api/assignments/${assignmentId}/full-kdu-rubric`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: generatedRubricTitle || "Generated KDU Rubric",
            activityType: generatedActivityType,
            rubric: generatedRubric,
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to save full KDU rubric");
      }

      setSavedFullRubricInfo({
        savedAt: new Date().toISOString(),
        rubricId: data.rubricId || null,
      });
      setMessage("Full six-level KDU rubric saved to this assignment.");
    } catch (err) {
      console.error(err);
      setError(err.message || "Could not save full KDU rubric.");
    } finally {
      setGeneratedRubricSaving(false);
    }
  }

  function openGradePage() {
    navigate(`/assignments/${assignmentId}/grade`);
  }

  function backToAssignmentsPage() {
    const classId = assignment?.class_id || assignment?.course_id || assignment?.classId || "";
    navigate(classId ? `/assignments?classId=${classId}` : "/assignments");
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
          <EditAssignmentActionButton quiet onClick={backToAssignmentsPage}>
            ← Back to Assignments
          </EditAssignmentActionButton>
        </div>

        <h1 style={{ marginTop: 0 }}>Edit Assignment</h1>
        <p style={{ color: "#4b5563", lineHeight: 1.5 }}>
          Follow the teacher workflow: set up the assignment, choose its assessment group,
          build the KDU rubric, set up raw-mark sections if needed, then grade students.
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

        <div style={{ display: "grid", gap: "18px", maxWidth: "1120px" }}>
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
            <div style={{ display: "grid", gap: "18px" }}>
              <p style={{ lineHeight: 1.5, color: "#4b5563", marginTop: 0 }}>
                Build the grading criteria used by the gradebook, then generate a full six-level
                teacher-facing KDU rubric for classroom use.
              </p>

              <div
                style={{
                  border: "1px solid #d7dce5",
                  borderRadius: "14px",
                  padding: "16px",
                  background: "#f8fafc",
                  display: "grid",
                  gap: "14px",
                }}
              >
                <h3 style={{ margin: 0 }}>A. Gradebook KDU Criteria</h3>
                <p style={{ lineHeight: 1.5, color: "#4b5563", margin: 0 }}>
                  This section controls the actual DO, KNOW, and UNDERSTAND criteria used by the
                  SUPER LMS grading screen. DO = 50%, KNOW = 25%, UNDERSTAND = 25%.
                </p>

                {rubricLoading ? <div>Loading KDU rubric...</div> : null}

                {!rubric && !rubricLoading ? (
                  <EditAssignmentNoticeBox>
                    No KDU gradebook rubric is attached yet. Click{" "}
                    <strong>Build KDU Rubric</strong> to create editable DO, KNOW, and UNDERSTAND
                    criteria.
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

              <div
                style={{
                  border: "1px solid #d7dce5",
                  borderRadius: "14px",
                  padding: "16px",
                  background: "#ffffff",
                  display: "grid",
                  gap: "14px",
                }}
              >
                <h3 style={{ margin: 0 }}>B. Full Six-Level KDU Rubric Generator</h3>
                <p style={{ lineHeight: 1.5, color: "#4b5563", margin: 0 }}>
                  Paste the student-facing assignment or activity instructions. Optional teacher
                  criteria can guide the generated KNOW, DO, and UNDERSTAND rows. Save it here for
                  this assignment or export it as a Word document.
                </p>

                <div>
                  <EditAssignmentFieldLabel>Rubric Title</EditAssignmentFieldLabel>
                  <input
                    value={generatedRubricTitle}
                    onChange={(e) => setGeneratedRubricTitle(e.target.value)}
                    style={inputStyle}
                  />
                </div>

                <div>
                  <EditAssignmentFieldLabel>Student Activity / Assignment Instructions</EditAssignmentFieldLabel>
                  <textarea
                    value={activityText}
                    onChange={(e) => setActivityText(e.target.value)}
                    rows="7"
                    style={textareaStyle}
                    placeholder="Paste the student instructions, task sheet, project description, or assessment activity here."
                  />
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: "12px",
                  }}
                >
                  <div>
                    <EditAssignmentFieldLabel>Optional KNOW Criteria</EditAssignmentFieldLabel>
                    <textarea
                      value={teacherKnowCriteria}
                      onChange={(e) => setTeacherKnowCriteria(e.target.value)}
                      rows="4"
                      style={textareaStyle}
                      placeholder="Facts, concepts, vocabulary, content knowledge..."
                    />
                  </div>

                  <div>
                    <EditAssignmentFieldLabel>Optional DO Criteria</EditAssignmentFieldLabel>
                    <textarea
                      value={teacherDoCriteria}
                      onChange={(e) => setTeacherDoCriteria(e.target.value)}
                      rows="4"
                      style={textareaStyle}
                      placeholder="Skills, strategies, processes, evidence of performance..."
                    />
                  </div>

                  <div>
                    <EditAssignmentFieldLabel>Optional UNDERSTAND Criteria</EditAssignmentFieldLabel>
                    <textarea
                      value={teacherUnderstandCriteria}
                      onChange={(e) => setTeacherUnderstandCriteria(e.target.value)}
                      rows="4"
                      style={textareaStyle}
                      placeholder="Big ideas, transfer, insight, connection..."
                    />
                  </div>
                </div>

                <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                  <EditAssignmentActionButton
                    onClick={generateFullKduRubric}
                    disabled={generatedRubricLoading || saving || deleting}
                  >
                    {generatedRubricLoading ? "Generating..." : "Generate Full KDU Rubric"}
                  </EditAssignmentActionButton>

                  <EditAssignmentActionButton
                    quiet
                    onClick={clearGeneratedRubricWorkspace}
                    disabled={generatedRubricLoading || saving || deleting}
                  >
                    Clear Workspace
                  </EditAssignmentActionButton>

                  <EditAssignmentActionButton
                    quiet
                    onClick={copyGeneratedRubricText}
                    disabled={generatedRubric.length === 0}
                  >
                    Copy Rubric Text
                  </EditAssignmentActionButton>

                  <EditAssignmentActionButton
                    quiet
                    onClick={exportGeneratedRubricTable}
                    disabled={generatedRubric.length === 0}
                  >
                    Export Table
                  </EditAssignmentActionButton>

                  <EditAssignmentActionButton
                    quiet
                    onClick={exportGeneratedRubricWordDoc}
                    disabled={generatedRubric.length === 0}
                  >
                    Export Word Doc
                  </EditAssignmentActionButton>

                  <EditAssignmentActionButton
                    quiet
                    onClick={saveFullGeneratedRubric}
                    disabled={generatedRubric.length === 0 || generatedRubricSaving}
                  >
                    {generatedRubricSaving ? "Saving Full Rubric..." : "Save Full Rubric"}
                  </EditAssignmentActionButton>
                </div>

                {generatedActivityType ? (
                  <EditAssignmentNoticeBox>
                    Detected activity type: <strong>{generatedActivityType}</strong>
                  </EditAssignmentNoticeBox>
                ) : null}

                {savedFullRubricInfo ? (
                  <EditAssignmentNoticeBox>
                    Saved full rubric loaded for this assignment.
                  </EditAssignmentNoticeBox>
                ) : null}

                {generatedRubric.length > 0 ? (
                  <div style={{ overflowX: "auto" }}>
                    <table
                      style={{
                        width: "100%",
                        borderCollapse: "collapse",
                        minWidth: "900px",
                      }}
                    >
                      <thead>
                        <tr>
                          <th style={tableHeaderStyle}>Level</th>
                          <th style={tableHeaderStyle}>KNOW</th>
                          <th style={tableHeaderStyle}>DO</th>
                          <th style={tableHeaderStyle}>UNDERSTAND</th>
                        </tr>
                      </thead>
                      <tbody>
                        {generatedRubric.map((row) => (
                          <tr key={row.level}>
                            <td style={tableCellStyle}>
                              <strong>{row.level}</strong>
                            </td>
                            <td style={tableCellStyle}>
                              <textarea
                                value={row.know || ""}
                                onChange={(e) =>
                                  updateGeneratedRubricCell(row.level, "know", e.target.value)
                                }
                                rows="6"
                                style={smallTextareaStyle}
                              />
                            </td>
                            <td style={tableCellStyle}>
                              <textarea
                                value={row.do || ""}
                                onChange={(e) =>
                                  updateGeneratedRubricCell(row.level, "do", e.target.value)
                                }
                                rows="6"
                                style={smallTextareaStyle}
                              />
                            </td>
                            <td style={tableCellStyle}>
                              <textarea
                                value={row.understand || ""}
                                onChange={(e) =>
                                  updateGeneratedRubricCell(row.level, "understand", e.target.value)
                                }
                                rows="6"
                                style={smallTextareaStyle}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </div>
            </div>
          </WorkflowStep>

          <WorkflowStep number="4" title="Exam Section Builder">
            <div style={{ display: "grid", gap: "14px" }}>
              <p style={{ color: "#4b5563", lineHeight: 1.5, marginTop: 0 }}>
                Build raw-mark sections for exams, quizzes, essays, projects, or mixed assessments.
                Each section connects to KNOW, DO, or UNDERSTAND. Student raw marks will convert
                automatically into the 1–6 KDU scale in the next grading step.
              </p>

              <EditAssignmentNoticeBox>
                Conversion rule: 92–100% = 6, 80–91% = 5, 67–79% = 4, 50–66% = 3,
                35–49% = 2, below 35% = 1.
              </EditAssignmentNoticeBox>

              <div style={{ overflowX: "auto" }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    minWidth: "850px",
                  }}
                >
                  <thead>
                    <tr>
                      <th style={tableHeaderStyle}>Section Name</th>
                      <th style={tableHeaderStyle}>KDU Bucket</th>
                      <th style={tableHeaderStyle}>Out Of</th>
                      <th style={tableHeaderStyle}>Section Weight</th>
                      <th style={tableHeaderStyle}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assignmentSections.map((section, index) => (
                      <tr key={section.id || `section-${index}`}>
                        <td style={tableCellStyle}>
                          <input
                            value={section.section_name || ""}
                            onChange={(e) =>
                              updateAssignmentSection(index, "section_name", e.target.value)
                            }
                            style={inputStyle}
                            placeholder="Example: Essay Response"
                          />
                        </td>
                        <td style={tableCellStyle}>
                          <select
                            value={section.competency_bucket || "KNOW"}
                            onChange={(e) =>
                              updateAssignmentSection(index, "competency_bucket", e.target.value)
                            }
                            style={inputStyle}
                          >
                            <option value="KNOW">KNOW</option>
                            <option value="DO">DO</option>
                            <option value="UNDERSTAND">UNDERSTAND</option>
                          </select>
                        </td>
                        <td style={tableCellStyle}>
                          <input
                            type="number"
                            min="0"
                            step="0.5"
                            value={section.max_points}
                            onChange={(e) =>
                              updateAssignmentSection(index, "max_points", e.target.value)
                            }
                            style={inputStyle}
                          />
                        </td>
                        <td style={tableCellStyle}>
                          <input
                            type="number"
                            min="0.1"
                            step="0.1"
                            value={section.section_weight}
                            onChange={(e) =>
                              updateAssignmentSection(index, "section_weight", e.target.value)
                            }
                            style={inputStyle}
                          />
                        </td>
                        <td style={tableCellStyle}>
                          <EditAssignmentActionButton
                            quiet
                            onClick={() => removeAssignmentSection(index)}
                            disabled={sectionSaving || assignmentSections.length <= 1}
                          >
                            Remove
                          </EditAssignmentActionButton>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                <EditAssignmentActionButton
                  quiet
                  onClick={addAssignmentSection}
                  disabled={sectionSaving}
                >
                  Add Section
                </EditAssignmentActionButton>

                <EditAssignmentActionButton
                  onClick={saveAssignmentSections}
                  disabled={sectionSaving || saving || deleting}
                >
                  {sectionSaving ? "Saving Sections..." : "Save Exam Sections"}
                </EditAssignmentActionButton>

                {sectionSaveMessage ? (
                  <div
                    style={{
                      border: "1px solid #9ca3af",
                      borderRadius: "999px",
                      padding: "9px 14px",
                      fontWeight: 700,
                      background: "#ffffff",
                      boxShadow: "0 8px 20px rgba(0, 0, 0, 0.12)",
                    }}
                  >
                    {sectionSaveMessage}
                  </div>
                ) : null}
              </div>
            </div>
          </WorkflowStep>

          <WorkflowStep number="5" title="Save and Grade">
            <p style={{ color: "#4b5563", lineHeight: 1.5, marginTop: 0 }}>
              Save assignment changes first, then open the grading screen to enter student KDU scores.
            </p>

            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
              <EditAssignmentActionButton
                onClick={() => handleSave({ openGradePage: true })}
                disabled={saving || deleting || bucketLoading}
              >
                {saving ? "Saving..." : "Save & Open Grading"}
              </EditAssignmentActionButton>

              <EditAssignmentActionButton
                quiet
                onClick={() => handleSave()}
                disabled={saving || deleting || bucketLoading}
              >
                {saving ? "Saving..." : "Save Assignment"}
              </EditAssignmentActionButton>

              <EditAssignmentActionButton
                quiet
                onClick={openGradePage}
                disabled={
                  saving ||
                  deleting ||
                  bucketLoading ||
                  rubricBuilding ||
                  rubricSaving ||
                  generatedRubricLoading
                }
              >
                Open Grade Page
              </EditAssignmentActionButton>

              <EditAssignmentActionButton
                quiet
                onClick={backToAssignmentsPage}
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

const smallTextareaStyle = {
  width: "100%",
  minWidth: "220px",
  padding: "10px",
  borderRadius: "8px",
  border: "1px solid #ccc",
  boxSizing: "border-box",
  font: "inherit",
  background: "#ffffff",
  resize: "vertical",
};

const tableHeaderStyle = {
  border: "1px solid #d7dce5",
  padding: "10px",
  textAlign: "left",
  verticalAlign: "top",
  background: "#f8fafc",
};

const tableCellStyle = {
  border: "1px solid #d7dce5",
  padding: "10px",
  verticalAlign: "top",
};
