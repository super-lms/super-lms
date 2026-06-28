import { useEffect, useState } from "react";
import API_BASE from "../apiBase";

function LessonsPage() {
  const [lessons, setLessons] = useState([]);
  const [courses, setCourses] = useState([]);
  const [courseId, setCourseId] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [message, setMessage] = useState("Loading lessons...");

  function loadLessons() {
    fetch(`${API_BASE}/api/lessons`)
      .then((response) => {
        if (!response.ok) {
          throw new Error("Failed to load lessons");
        }
        return response.json();
      })
      .then((data) => {
        setLessons(data);
        setMessage("Lessons loaded");
      })
      .catch((error) => {
        console.error(error);
        setMessage("Could not load lessons");
      });
  }

  function loadCourses() {
    fetch(`${API_BASE}/api/courses`)
      .then((response) => {
        if (!response.ok) {
          throw new Error("Failed to load courses");
        }
        return response.json();
      })
      .then((data) => {
        setCourses(data);
      })
      .catch((error) => {
        console.error(error);
        setMessage("Could not load courses");
      });
  }

  useEffect(() => {
    loadLessons();
    loadCourses();
  }, []);

  function uploadLessonFile(lessonId) {
    if (!selectedFile) {
      return Promise.resolve({ skipped: true });
    }

    const formData = new FormData();
    formData.append("file", selectedFile);

    return fetch(`${API_BASE}/api/lesson-files/${lessonId}`, {
      method: "POST",
      body: formData,
    }).then((response) => {
      if (!response.ok) {
        return {
          skipped: true,
          warning: "Lesson was created, but file upload is not available yet.",
        };
      }
      return response.json();
    });
  }

  function createLesson(event) {
    event.preventDefault();

    if (!courseId || !title.trim()) {
      setMessage("Please select a course and enter a lesson title");
      return;
    }

    setMessage("Creating lesson...");

    fetch("/api/lessons", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        course_id: Number(courseId),
        title,
        content,
      }),
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error("Failed to create lesson");
        }
        return response.json();
      })
      .then((newLesson) => {
        return uploadLessonFile(newLesson.id).then(() => newLesson);
      })
      .then(() => {
        setTitle("");
        setContent("");
        setCourseId("");
        setSelectedFile(null);

        const fileInput = document.getElementById("lesson-file");
        if (fileInput) {
          fileInput.value = "";
        }

        setMessage("Lesson created successfully");
        loadLessons();
      })
      .catch((error) => {
        console.error(error);
        setMessage("Error creating lesson or uploading file");
      });
  }

  function deleteLesson(id) {
    const confirmed = window.confirm("Delete this lesson?");

    if (!confirmed) {
      return;
    }

    fetch(`${API_BASE}/api/lessons/${id}`, {
      method: "DELETE",
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error("Failed to delete lesson");
        }
        return response.json();
      })
      .then(() => {
        setMessage("Lesson deleted");
        loadLessons();
      })
      .catch((error) => {
        console.error(error);
        setMessage("Error deleting lesson");
      });
  }

  function formatFileSize(size) {
    if (!size && size !== 0) {
      return "";
    }

    if (size < 1024) {
      return `${size} bytes`;
    }

    if (size < 1024 * 1024) {
      return `${(size / 1024).toFixed(1)} KB`;
    }

    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  const groupedLessons = lessons.reduce((groups, lesson) => {
    const groupName = lesson.course_title || `Course ${lesson.course_id}`;

    if (!groups[groupName]) {
      groups[groupName] = [];
    }

    groups[groupName].push(lesson);
    return groups;
  }, {});

  return (
    <div>
      <header
        style={{
          marginBottom: "24px",
          padding: "24px",
          backgroundColor: "#ffffff",
          border: "1px solid #cbd5e1",
          borderRadius: "10px",
        }}
      >
        <h2 style={{ marginTop: 0, marginBottom: "10px", fontSize: "48px" }}>
          Lessons
        </h2>
        <p style={{ margin: 0, fontSize: "20px" }}>{message}</p>
      </header>

      <section
        style={{
          background: "#ffffff",
          padding: "24px",
          borderRadius: "10px",
          marginBottom: "24px",
          border: "1px solid #cbd5e1",
        }}
      >
        <h3 style={{ marginTop: 0, marginBottom: "16px", fontSize: "32px" }}>
          Create Lesson
        </h3>

        <form onSubmit={createLesson}>
          <div style={{ marginBottom: "16px" }}>
            <label style={labelStyle}>Course</label>
            <select
              value={courseId}
              onChange={(event) => setCourseId(event.target.value)}
              style={inputStyle}
            >
              <option value="">Select Course</option>

              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  ID {course.id} — {course.title}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label style={labelStyle}>Lesson Title</label>
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label style={labelStyle}>Lesson Content</label>
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              rows="4"
              style={textareaStyle}
            />
          </div>

          <div style={{ marginBottom: "20px" }}>
            <label style={labelStyle}>Lesson Attachment</label>
            <input
              id="lesson-file"
              type="file"
              onChange={(event) => {
                const file = event.target.files && event.target.files[0]
                  ? event.target.files[0]
                  : null;
                setSelectedFile(file);
              }}
              style={{
                display: "block",
                fontSize: "16px",
              }}
            />
            <p
              style={{
                marginTop: "8px",
                marginBottom: 0,
                fontSize: "14px",
                color: "#475569",
              }}
            >
              Attach one file for now. This structure will support multiple files later.
            </p>
          </div>

          <button type="submit" style={primaryButtonStyle}>
            Create Lesson
          </button>
        </form>
      </section>

      <section
        style={{
          background: "#ffffff",
          padding: "24px",
          borderRadius: "10px",
          border: "1px solid #cbd5e1",
        }}
      >
        <h3 style={{ marginTop: 0, marginBottom: "20px", fontSize: "32px" }}>
          Lessons by Course
        </h3>

        {lessons.length === 0 ? (
          <p style={{ fontSize: "20px", margin: 0 }}>No lessons yet</p>
        ) : (
          Object.entries(groupedLessons).map(([courseTitle, courseLessons]) => (
            <div key={courseTitle} style={{ marginBottom: "32px" }}>
              <h4
                style={{
                  marginBottom: "16px",
                  fontSize: "28px",
                  color: "#0f172a",
                }}
              >
                {courseTitle}
              </h4>

              <div style={{ display: "grid", gap: "16px" }}>
                {courseLessons.map((lesson) => (
                  <div
                    key={lesson.id}
                    style={{
                      padding: "20px",
                      border: "1px solid #d1d5db",
                      borderRadius: "10px",
                      backgroundColor: "#f8fafc",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: "16px",
                        flexWrap: "wrap",
                      }}
                    >
                      <div style={{ flex: 1, minWidth: "280px" }}>
                        <div
                          style={{
                            fontSize: "24px",
                            fontWeight: "bold",
                            marginBottom: "10px",
                          }}
                        >
                          {lesson.title}
                        </div>

                        <div
                          style={{
                            fontSize: "18px",
                            marginBottom: "12px",
                            lineHeight: "1.5",
                          }}
                        >
                          {lesson.content || "No lesson content"}
                        </div>

                        <div
                          style={{
                            fontSize: "15px",
                            color: "#475569",
                            marginBottom: "14px",
                          }}
                        >
                          Lesson ID: {lesson.id} | Course ID: {lesson.course_id}
                        </div>

                        <div
                          style={{
                            padding: "14px",
                            backgroundColor: "#ffffff",
                            border: "1px solid #dbe4ee",
                            borderRadius: "8px",
                          }}
                        >
                          <div
                            style={{
                              fontSize: "18px",
                              fontWeight: "bold",
                              marginBottom: "10px",
                            }}
                          >
                            Attached Files
                          </div>

                          {!lesson.files || lesson.files.length === 0 ? (
                            <p style={{ margin: 0, fontSize: "16px" }}>
                              No files attached.
                            </p>
                          ) : (
                            <ul style={{ margin: 0, paddingLeft: "20px" }}>
                              {lesson.files.map((file) => (
                                <li key={file.id} style={{ marginBottom: "10px" }}>
                                  <a
                                    href={`http://localhost:3000${file.file_path}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    style={{
                                      color: "#1d4ed8",
                                      textDecoration: "none",
                                      fontSize: "16px",
                                      fontWeight: "bold",
                                    }}
                                  >
                                    {file.original_name}
                                  </a>
                                  <div
                                    style={{
                                      fontSize: "14px",
                                      color: "#64748b",
                                      marginTop: "2px",
                                    }}
                                  >
                                    {file.mime_type || "Unknown file type"}
                                    {file.file_size ? ` • ${formatFileSize(file.file_size)}` : ""}
                                  </div>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>

                      <button onClick={() => deleteLesson(lesson.id)} style={deleteButtonStyle}>
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}

const labelStyle = {
  display: "block",
  marginBottom: "8px",
  fontSize: "18px",
};

const inputStyle = {
  width: "100%",
  maxWidth: "500px",
  padding: "12px",
  fontSize: "18px",
  border: "1px solid #94a3b8",
  borderRadius: "8px",
  backgroundColor: "#ffffff",
};

const textareaStyle = {
  width: "100%",
  maxWidth: "500px",
  padding: "12px",
  fontSize: "18px",
  border: "1px solid #94a3b8",
  borderRadius: "8px",
  resize: "vertical",
};

const primaryButtonStyle = {
  padding: "12px 20px",
  fontSize: "18px",
  border: "1px solid #1e293b",
  borderRadius: "8px",
  backgroundColor: "#1f2937",
  color: "#ffffff",
  cursor: "pointer",
};

const deleteButtonStyle = {
  padding: "10px 16px",
  fontSize: "16px",
  border: "1px solid #7f1d1d",
  borderRadius: "8px",
  backgroundColor: "#ffffff",
  color: "#7f1d1d",
  cursor: "pointer",
  alignSelf: "flex-start",
};

export default LessonsPage;