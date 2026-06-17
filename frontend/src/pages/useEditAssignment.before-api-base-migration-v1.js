import { useEffect, useMemo, useState } from "react";

const API_BASE = "http://localhost:3000";

export default function useEditAssignment(assignmentId) {
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
      return { ok: false };
    }

    if (!selectedCategoryId) {
      setError("Category selection is required");
      return { ok: false };
    }

    if (!selectedSubcategoryId) {
      setError("Subcategory selection is required");
      return { ok: false };
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
      setMessage("Assignment updated successfully.");

      return { ok: true, data };
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to update assignment");
      return { ok: false, error: err };
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
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

      return { ok: true, data };
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to delete assignment");
      return { ok: false, error: err };
    } finally {
      setDeleting(false);
    }
  }

  return {
    loading,
    saving,
    deleting,
    bucketLoading,
    assignment,
    categories,
    subcategories,
    title,
    setTitle,
    description,
    setDescription,
    dueDate,
    setDueDate,
    selectedCategoryId,
    setSelectedCategoryId,
    selectedSubcategoryId,
    setSelectedSubcategoryId,
    selectedCategory,
    selectedSubcategory,
    message,
    setMessage,
    error,
    setError,
    handleSave,
    handleDelete,
    reloadAssignment: loadAssignment,
  };
}
