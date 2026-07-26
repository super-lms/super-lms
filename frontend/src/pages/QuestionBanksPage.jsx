import { useEffect, useState } from "react";
import authFetch from "../services/authFetch";

const EMPTY_BANK = {
  course_id: "",
  title: "",
  description: "",
  tags: "",
};

const EMPTY_ITEM = {
  question_type: "multiple_choice",
  prompt: "",
  options: ["", ""],
  correct_answer: "",
  points: "1",
  teacher_feedback: "",
  tags: "",
};

function Button({ children, onClick, type = "button", quiet = false, danger = false, disabled = false }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        border: `1px solid ${danger ? "#ef4444" : "#2563eb"}`,
        borderRadius: "10px",
        padding: "10px 14px",
        background: quiet || danger ? "#ffffff" : "#2563eb",
        color: danger ? "#b91c1c" : quiet ? "#1d4ed8" : "#ffffff",
        fontWeight: 800,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
      }}
    >
      {children}
    </button>
  );
}

function tagsFromText(value) {
  return String(value || "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function typeLabel(type) {
  return {
    multiple_choice: "Multiple Choice",
    true_false: "True / False",
    short_answer: "Short Answer",
    essay: "Essay",
  }[type] || type;
}

export default function QuestionBanksPage() {
  const [courses, setCourses] = useState([]);
  const [banks, setBanks] = useState([]);
  const [selectedBank, setSelectedBank] = useState(null);
  const [items, setItems] = useState([]);
  const [bankForm, setBankForm] = useState(EMPTY_BANK);
  const [itemForm, setItemForm] = useState(EMPTY_ITEM);
  const [editingItemId, setEditingItemId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function request(path, options) {
    const response = await authFetch(path, options);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Request failed");
    return data;
  }

  async function loadBanks(keepId = selectedBank?.id) {
    const data = await request("/api/question-banks");
    const nextBanks = Array.isArray(data) ? data : [];
    setBanks(nextBanks);
    if (keepId) {
      const match = nextBanks.find((bank) => String(bank.id) === String(keepId));
      if (match) setSelectedBank(match);
    }
  }

  async function selectBank(bank) {
    setSelectedBank(bank);
    setError("");
    setMessage("");
    setEditingItemId("");
    setItemForm(EMPTY_ITEM);
    const data = await request(`/api/question-banks/${bank.id}/items`);
    setItems(Array.isArray(data) ? data : []);
  }

  useEffect(() => {
    Promise.all([request("/api/classes"), request("/api/question-banks")])
      .then(([courseData, bankData]) => {
        setCourses(Array.isArray(courseData) ? courseData : []);
        setBanks(Array.isArray(bankData) ? bankData : []);
      })
      .catch((err) => setError(err.message));
  }, []);

  async function createBank(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const bank = await request("/api/question-banks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...bankForm,
          tags: tagsFromText(bankForm.tags),
        }),
      });
      setBankForm(EMPTY_BANK);
      await loadBanks(bank.id);
      await selectBank(bank);
      setMessage("Question bank created.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteBank() {
    if (!selectedBank || !window.confirm(`Delete question bank "${selectedBank.title}"?`)) return;
    setSaving(true);
    setError("");
    try {
      await request(`/api/question-banks/${selectedBank.id}`, { method: "DELETE" });
      setSelectedBank(null);
      setItems([]);
      await loadBanks("");
      setMessage("Question bank deleted.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function changeQuestionType(questionType) {
    setItemForm((current) => ({
      ...current,
      question_type: questionType,
      options: questionType === "multiple_choice" ? current.options || ["", ""] : [],
      correct_answer: questionType === "true_false" ? "True" : "",
    }));
  }

  function editItem(item) {
    setEditingItemId(String(item.id));
    setItemForm({
      question_type: item.question_type,
      prompt: item.prompt || "",
      options: Array.isArray(item.options_json) ? item.options_json : [],
      correct_answer: item.correct_answer_json ?? "",
      points: String(item.points || 1),
      teacher_feedback: item.teacher_feedback || "",
      tags: Array.isArray(item.tags_json) ? item.tags_json.join(", ") : "",
    });
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
  }

  async function saveItem(event) {
    event.preventDefault();
    if (!selectedBank) return;
    setSaving(true);
    setError("");
    try {
      const path = editingItemId
        ? `/api/question-banks/${selectedBank.id}/items/${editingItemId}`
        : `/api/question-banks/${selectedBank.id}/items`;
      await request(path, {
        method: editingItemId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...itemForm,
          tags: tagsFromText(itemForm.tags),
        }),
      });
      await selectBank(selectedBank);
      setEditingItemId("");
      setItemForm(EMPTY_ITEM);
      await loadBanks(selectedBank.id);
      setMessage(editingItemId ? "Bank question updated." : "Question added to bank.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteItem(itemId) {
    if (!window.confirm("Delete this bank question?")) return;
    setSaving(true);
    setError("");
    try {
      await request(`/api/question-banks/${selectedBank.id}/items/${itemId}`, {
        method: "DELETE",
      });
      await selectBank(selectedBank);
      await loadBanks(selectedBank.id);
      setMessage("Bank question deleted.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="content-area">
      <section className="panel" style={{ display: "grid", gap: "20px" }}>
        <div>
          <h1 style={{ margin: 0 }}>Question Banks</h1>
          <p style={mutedStyle}>
            Build reusable, tagged question pools for randomized assessments.
          </p>
        </div>

        {message ? <div style={noticeStyle}>{message}</div> : null}
        {error ? <div style={errorStyle}>{error}</div> : null}

        <div style={workspaceStyle}>
          <aside style={sidebarStyle}>
            <strong>Bank Library</strong>
            {banks.length === 0 ? <p style={mutedStyle}>No question banks yet.</p> : null}
            {banks.map((bank) => (
              <button
                type="button"
                key={bank.id}
                onClick={() => selectBank(bank).catch((err) => setError(err.message))}
                style={bankButtonStyle(selectedBank?.id === bank.id)}
              >
                <strong>{bank.title}</strong>
                <span>{bank.course_title}</span>
                <span>{bank.question_count} questions</span>
              </button>
            ))}

            <form onSubmit={createBank} style={formStyle}>
              <strong>Create Bank</strong>
              <label style={labelStyle}>
                Course
                <select
                  required
                  value={bankForm.course_id}
                  onChange={(event) => setBankForm({ ...bankForm, course_id: event.target.value })}
                  style={inputStyle}
                >
                  <option value="">Select course</option>
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.title || course.class_name}
                    </option>
                  ))}
                </select>
              </label>
              <label style={labelStyle}>
                Bank title
                <input
                  required
                  value={bankForm.title}
                  onChange={(event) => setBankForm({ ...bankForm, title: event.target.value })}
                  style={inputStyle}
                />
              </label>
              <label style={labelStyle}>
                Description
                <textarea
                  rows="2"
                  value={bankForm.description}
                  onChange={(event) => setBankForm({ ...bankForm, description: event.target.value })}
                  style={inputStyle}
                />
              </label>
              <label style={labelStyle}>
                Tags (comma separated)
                <input
                  value={bankForm.tags}
                  onChange={(event) => setBankForm({ ...bankForm, tags: event.target.value })}
                  style={inputStyle}
                  placeholder="Unit 1, Reading, Core"
                />
              </label>
              <Button type="submit" disabled={saving}>Create Bank</Button>
            </form>
          </aside>

          <main style={{ minWidth: 0 }}>
            {!selectedBank ? (
              <div style={cardStyle}>Select a bank or create one to begin.</div>
            ) : (
              <div style={{ display: "grid", gap: "18px" }}>
                <div style={cardStyle}>
                  <div style={rowBetweenStyle}>
                    <div>
                      <h2 style={{ margin: 0 }}>{selectedBank.title}</h2>
                      <p style={mutedStyle}>{selectedBank.description || "No description."}</p>
                      <div style={tagRowStyle}>
                        {(selectedBank.tags_json || []).map((tag) => (
                          <span key={tag} style={tagStyle}>{tag}</span>
                        ))}
                      </div>
                    </div>
                    <Button danger quiet onClick={deleteBank} disabled={saving}>Delete Bank</Button>
                  </div>
                </div>

                <div style={cardStyle}>
                  <h3 style={{ marginTop: 0 }}>Questions ({items.length})</h3>
                  {items.length === 0 ? <p style={mutedStyle}>Add the first question below.</p> : null}
                  <div style={{ display: "grid", gap: "10px" }}>
                    {items.map((item, index) => (
                      <div key={item.id} style={itemStyle}>
                        <div>
                          <strong>{index + 1}. {item.prompt}</strong>
                          <div style={mutedStyle}>
                            {typeLabel(item.question_type)} · {Number(item.points)} points
                          </div>
                          <div style={tagRowStyle}>
                            {(item.tags_json || []).map((tag) => (
                              <span key={tag} style={tagStyle}>{tag}</span>
                            ))}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                          <Button quiet onClick={() => editItem(item)}>Edit</Button>
                          <Button danger quiet onClick={() => deleteItem(item.id)}>Delete</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <form onSubmit={saveItem} style={cardStyle}>
                  <h3 style={{ marginTop: 0 }}>
                    {editingItemId ? "Edit Bank Question" : "Add Bank Question"}
                  </h3>
                  <div style={twoColumnStyle}>
                    <label style={labelStyle}>
                      Question type
                      <select
                        value={itemForm.question_type}
                        onChange={(event) => changeQuestionType(event.target.value)}
                        style={inputStyle}
                      >
                        <option value="multiple_choice">Multiple Choice</option>
                        <option value="true_false">True / False</option>
                        <option value="short_answer">Short Answer</option>
                        <option value="essay">Essay</option>
                      </select>
                    </label>
                    <label style={labelStyle}>
                      Default points
                      <input
                        type="number"
                        min="0.1"
                        step="0.1"
                        value={itemForm.points}
                        onChange={(event) => setItemForm({ ...itemForm, points: event.target.value })}
                        style={inputStyle}
                      />
                    </label>
                  </div>
                  <label style={labelStyle}>
                    Question
                    <textarea
                      required
                      rows="4"
                      value={itemForm.prompt}
                      onChange={(event) => setItemForm({ ...itemForm, prompt: event.target.value })}
                      style={inputStyle}
                    />
                  </label>

                  {itemForm.question_type === "multiple_choice" ? (
                    <div style={{ display: "grid", gap: "10px" }}>
                      <strong>Answer choices</strong>
                      {itemForm.options.map((option, index) => (
                        <div key={index} style={{ display: "flex", gap: "8px" }}>
                          <input
                            value={option}
                            onChange={(event) => {
                              const options = [...itemForm.options];
                              options[index] = event.target.value;
                              setItemForm({ ...itemForm, options });
                            }}
                            style={inputStyle}
                            placeholder={`Choice ${index + 1}`}
                          />
                          {itemForm.options.length > 2 ? (
                            <Button
                              danger
                              quiet
                              onClick={() =>
                                setItemForm({
                                  ...itemForm,
                                  options: itemForm.options.filter((_, itemIndex) => itemIndex !== index),
                                })
                              }
                            >
                              Remove
                            </Button>
                          ) : null}
                        </div>
                      ))}
                      <Button
                        quiet
                        onClick={() => setItemForm({
                          ...itemForm,
                          options: [...itemForm.options, ""],
                        })}
                      >
                        + Add Choice
                      </Button>
                      <label style={labelStyle}>
                        Correct answer
                        <select
                          required
                          value={itemForm.correct_answer}
                          onChange={(event) => setItemForm({ ...itemForm, correct_answer: event.target.value })}
                          style={inputStyle}
                        >
                          <option value="">Select correct answer</option>
                          {itemForm.options.filter(Boolean).map((option) => (
                            <option key={option} value={option}>{option}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                  ) : null}

                  {itemForm.question_type === "true_false" ? (
                    <label style={labelStyle}>
                      Correct answer
                      <select
                        value={itemForm.correct_answer}
                        onChange={(event) => setItemForm({ ...itemForm, correct_answer: event.target.value })}
                        style={inputStyle}
                      >
                        <option value="True">True</option>
                        <option value="False">False</option>
                      </select>
                    </label>
                  ) : null}

                  <label style={labelStyle}>
                    Tags (comma separated)
                    <input
                      value={itemForm.tags}
                      onChange={(event) => setItemForm({ ...itemForm, tags: event.target.value })}
                      style={inputStyle}
                      placeholder="Vocabulary, Easy, Unit 1"
                    />
                  </label>
                  <label style={labelStyle}>
                    Feedback shown after grading (optional)
                    <textarea
                      rows="2"
                      value={itemForm.teacher_feedback}
                      onChange={(event) => setItemForm({ ...itemForm, teacher_feedback: event.target.value })}
                      style={inputStyle}
                    />
                  </label>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    <Button type="submit" disabled={saving}>
                      {editingItemId ? "Save Bank Question" : "Add to Bank"}
                    </Button>
                    {editingItemId ? (
                      <Button quiet onClick={() => {
                        setEditingItemId("");
                        setItemForm(EMPTY_ITEM);
                      }}>
                        Cancel
                      </Button>
                    ) : null}
                  </div>
                </form>
              </div>
            )}
          </main>
        </div>
      </section>
    </div>
  );
}

const mutedStyle = { color: "#64748b", lineHeight: 1.5 };
const noticeStyle = { border: "1px solid #93c5fd", borderRadius: "10px", padding: "12px", background: "#eff6ff", color: "#1e3a8a" };
const errorStyle = { border: "1px solid #fca5a5", borderRadius: "10px", padding: "12px", background: "#fef2f2", color: "#991b1b" };
const workspaceStyle = { display: "grid", gridTemplateColumns: "300px minmax(0, 1fr)", gap: "20px", alignItems: "start" };
const sidebarStyle = { border: "1px solid #dbe3ef", borderRadius: "14px", padding: "14px", background: "#f8fafc", display: "grid", gap: "10px" };
const bankButtonStyle = (selected) => ({ border: `2px solid ${selected ? "#2563eb" : "#dbe3ef"}`, borderRadius: "12px", padding: "12px", background: selected ? "#eff6ff" : "#ffffff", textAlign: "left", display: "grid", gap: "4px", cursor: "pointer", font: "inherit" });
const formStyle = { borderTop: "1px solid #dbe3ef", paddingTop: "14px", marginTop: "4px", display: "grid", gap: "10px" };
const cardStyle = { border: "1px solid #dbe3ef", borderRadius: "14px", padding: "18px", background: "#ffffff", display: "grid", gap: "14px" };
const rowBetweenStyle = { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "14px", flexWrap: "wrap" };
const labelStyle = { display: "grid", gap: "6px", fontWeight: 800 };
const inputStyle = { width: "100%", border: "1px solid #cbd5e1", borderRadius: "10px", padding: "10px 12px", font: "inherit", boxSizing: "border-box" };
const twoColumnStyle = { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "14px" };
const itemStyle = { border: "1px solid #dbe3ef", borderRadius: "12px", padding: "14px", display: "flex", justifyContent: "space-between", gap: "14px", alignItems: "flex-start" };
const tagRowStyle = { display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "8px" };
const tagStyle = { border: "1px solid #bfdbfe", borderRadius: "999px", padding: "3px 8px", background: "#eff6ff", color: "#1e40af", fontSize: "0.82rem", fontWeight: 700 };
