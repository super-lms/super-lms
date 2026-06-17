import { useEffect, useState } from "react"
import { useAuth } from "../AuthContext.jsx"
import API_BASE from "../apiBase"

export default function ObserverPage() {
  const { user } = useAuth()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [observerData, setObserverData] = useState({
    observer: null,
    students: [],
    submissions: [],
  })

  useEffect(() => {
    async function loadObserverData() {
      if (!user?.email) {
        setError("No observer email found.")
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError("")

        const response = await fetch(
          `${API_BASE}/api/observers/${encodeURIComponent(user.email)}/dashboard`
        )

        const data = await response.json().catch(() => null)

        if (!response.ok) {
          throw new Error((data && data.error) || "Failed to load observer dashboard")
        }

        setObserverData({
          observer: data?.observer || null,
          students: Array.isArray(data?.students) ? data.students : [],
          submissions: Array.isArray(data?.submissions) ? data.submissions : [],
        })
      } catch (err) {
        setError(err.message || "Failed to load observer dashboard")
      } finally {
        setLoading(false)
      }
    }

    loadObserverData()
  }, [user?.email])

  return (
    <div className="page">
      <h1>Observer View</h1>

      {loading ? <p>Loading observer dashboard...</p> : null}
      {error ? <p>{error}</p> : null}

      {!loading && !error ? (
        <>
          <div
            style={{
              border: "1px solid #d7dce5",
              borderRadius: "12px",
              padding: "16px",
              background: "#ffffff",
              marginBottom: "24px",
            }}
          >
            <h2 style={{ marginTop: 0 }}>Observer Information</h2>
            <p><strong>Name:</strong> {user?.name || "Observer"}</p>
            <p><strong>Email:</strong> {user?.email || ""}</p>
            <p><strong>Relationship:</strong> {observerData.observer?.relationship || "Not set"}</p>
          </div>

          <div
            style={{
              border: "1px solid #d7dce5",
              borderRadius: "12px",
              padding: "16px",
              background: "#ffffff",
              marginBottom: "24px",
            }}
          >
            <h2 style={{ marginTop: 0 }}>Linked Students</h2>

            {observerData.students.length === 0 ? (
              <p>No linked students found for this observer.</p>
            ) : (
              <div style={{ display: "grid", gap: "12px" }}>
                {observerData.students.map((student, index) => (
                  <div
                    key={`${student.student_id || "student"}-${student.class_id || "class"}-${index}`}
                    style={{
                      border: "1px solid #d7dce5",
                      borderRadius: "12px",
                      padding: "12px",
                    }}
                  >
                    <div><strong>Student:</strong> {student.student_name || "-"}</div>
                    <div><strong>Student Email:</strong> {student.student_email || "-"}</div>
                    <div><strong>Class:</strong> {student.class_name || "-"}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div
            style={{
              border: "1px solid #d7dce5",
              borderRadius: "12px",
              padding: "16px",
              background: "#ffffff",
            }}
          >
            <h2 style={{ marginTop: 0 }}>Student Work, Grades, and Feedback</h2>

            {observerData.submissions.length === 0 ? (
              <p>No submissions found.</p>
            ) : (
              <div style={{ display: "grid", gap: "16px" }}>
                {observerData.submissions.map((submission) => (
                  <div
                    key={submission.id}
                    style={{
                      border: "1px solid #d7dce5",
                      borderRadius: "12px",
                      padding: "14px",
                    }}
                  >
                    <div>
                      <strong>{submission.student_name}</strong>
                      {submission.student_email ? ` (${submission.student_email})` : ""}
                    </div>

                    <div style={{ marginTop: "6px" }}>
                      <strong>Assignment:</strong> {submission.assignment_title || "Assignment"}
                      {submission.class_name ? ` — ${submission.class_name}` : ""}
                    </div>

                    <div style={{ marginTop: "6px" }}>
                      {submission.content || "No text submission"}
                    </div>

                    <div style={{ marginTop: "8px" }}>
                      <strong>Score:</strong>{" "}
                      {submission.score !== null && submission.score !== undefined
                        ? submission.score
                        : "Not graded"}
                    </div>

                    <div>
                      <strong>Grade:</strong> {submission.grade || "Not graded"}
                    </div>

                    <div>
                      <strong>Feedback:</strong> {submission.feedback || "No feedback yet"}
                    </div>

                    {Array.isArray(submission.files) && submission.files.length > 0 ? (
                      <div style={{ marginTop: "8px" }}>
                        <strong>Attachments:</strong>
                        {submission.files.map((file) => (
                          <div key={file.id}>
                            <a
                              href={`${API_BASE}${file.file_path}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {file.file_name}
                            </a>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  )
}
