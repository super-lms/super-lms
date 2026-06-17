import { useEffect, useState } from "react";

function AssessmentStructurePage() {
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState("");
  const [categories, setCategories] = useState([]);
  const [levelsByCategory, setLevelsByCategory] = useState({});
  const [status, setStatus] = useState("");

  const [editingLevelId, setEditingLevelId] = useState(null);
  const [editLevelName, setEditLevelName] = useState("");
  const [editLevelWeight, setEditLevelWeight] = useState("");

  useEffect(() => {
    fetch("/api/courses").then(res => res.json()).then(setCourses);
  }, []);

  function loadCategories(courseId) {
    fetch(`/api/courses/${courseId}/categories`)
      .then(res => res.json())
      .then(data => {
        setCategories(data);
        loadLevels(data);
      });
  }

  function loadLevels(categoryList) {
    Promise.all(
      categoryList.map(c =>
        fetch(`/api/categories/${c.id}/subcategories`)
          .then(res => res.json())
          .then(levels => ({ id: c.id, levels }))
      )
    ).then(results => {
      const map = {};
      results.forEach(r => (map[r.id] = r.levels));
      setLevelsByCategory(map);
    });
  }

  function handleCourseChange(e) {
    const id = e.target.value;
    setSelectedCourse(id);
    loadCategories(id);
  }

  function startEdit(level) {
    setEditingLevelId(level.id);
    setEditLevelName(level.name);
    setEditLevelWeight(level.weight_percent_of_parent);
  }

  function cancelEdit() {
    setEditingLevelId(null);
  }

  function saveEdit(levelId, categoryId) {
    setStatus("Saving...");

    fetch(`/api/subcategories/${levelId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editLevelName,
        weight_percent_of_parent: Number(editLevelWeight),
      }),
    })
      .then(res => res.json())
      .then(() => {
        setStatus("Level updated");
        setEditingLevelId(null);
        loadCategories(selectedCourse);
      })
      .catch(() => setStatus("Update failed"));
  }

  return (
    <div>
      <h2>Assessment Structure</h2>
      <p>{status}</p>

      <select value={selectedCourse} onChange={handleCourseChange}>
        <option value="">Select course</option>
        {courses.map(c => (
          <option key={c.id} value={c.id}>
            {c.title}
          </option>
        ))}
      </select>

      {categories.map(category => (
        <div key={category.id} style={{ marginTop: 20 }}>
          <h3>
            {category.name} ({category.weight_percent}%)
          </h3>

          <h4>Levels</h4>

          {(levelsByCategory[category.id] || []).map(level => (
            <div key={level.id}>
              {editingLevelId === level.id ? (
                <>
                  <input
                    value={editLevelName}
                    onChange={e => setEditLevelName(e.target.value)}
                  />
                  <input
                    type="number"
                    value={editLevelWeight}
                    onChange={e => setEditLevelWeight(e.target.value)}
                  />
                  <button onClick={() => saveEdit(level.id, category.id)}>Save</button>
                  <button onClick={cancelEdit}>Cancel</button>
                </>
              ) : (
                <>
                  {level.name} ({level.weight_percent_of_parent}%)
                  <button onClick={() => startEdit(level)}>Edit</button>
                </>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export default AssessmentStructurePage;