import { useEffect, useMemo, useState } from "react"
import authFetch from "../../services/authFetch"

export default function AdminStudentsPage() {
  const [penRows,setPenRows]=useState([]),[penPreview,setPenPreview]=useState(null),[penMessage,setPenMessage]=useState("");
  async function importPens(apply=false){try{const res=await authFetch("/api/master-students/pen-import",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({rows:penRows,apply})});const data=await res.json();if(!res.ok)throw new Error(data.error);setPenPreview(data.preview);setPenMessage(apply?`${data.updated} PEN numbers updated. Refresh to view changes.`:"Preview ready. Check student IDs and names before importing.");}catch(error){setPenMessage(error.message);}}
  const [students, setStudents] = useState([])
  const [search, setSearch] = useState("")
  const [gradeFilter, setGradeFilter] = useState("all")
  const [message, setMessage] = useState("Loading students...")

  useEffect(() => {
    async function loadStudents() {
      try {
        const response = await authFetch("/api/master-students")
        const data = await response.json()

        if (!response.ok || data?.success === false) {
          throw new Error(data?.error || "Failed to load students")
        }

        const rows = Array.isArray(data?.students) ? data.students : []
        setStudents(rows)
        setMessage("")
      } catch (err) {
        console.error("Admin students load failed:", err)
        setStudents([])
        setMessage("Unable to load the master student directory.")
      }
    }

    loadStudents()
  }, [])

  const grades = useMemo(() => {
    const uniqueGrades = new Set()
    students.forEach((student) => {
      if (student.current_grade !== null && student.current_grade !== undefined) {
        uniqueGrades.add(String(student.current_grade))
      }
    })
    return Array.from(uniqueGrades).sort((a, b) => Number(a) - Number(b))
  }, [students])

  const filteredStudents = useMemo(() => {
    const term = search.trim().toLowerCase()

    return students.filter((student) => {
      const matchesGrade =
        gradeFilter === "all" || String(student.current_grade || "") === gradeFilter

      const haystack = [
        student.display_name,
        student.legal_first_name,
        student.legal_last_name,
        student.student_id,
        student.pen,
        student.student_email,
        student.current_homeform,
        student.next_year_homeform,
        student.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()

      const matchesSearch = !term || haystack.includes(term)

      return matchesGrade && matchesSearch
    })
  }, [students, search, gradeFilter])

  return (
    <div>
      <h1 style={{ marginTop: 0, fontSize: "28px" }}>Students</h1>

      <p style={{ fontSize: "16px", color: "#4b5563", lineHeight: 1.6 }}>
        Master Student Directory for school-wide student verification and course roster support.
      </p>

      <section style={{padding:16,border:'1px solid #ddd',borderRadius:10,marginBottom:20}}><h2>Update student PEN numbers</h2><p>Upload the prepared student ID and PEN mapping file. Existing names, grades, accounts and enrolments are preserved.</p><input type="file" accept=".json" onChange={async e=>{try{const rows=JSON.parse(await e.target.files[0].text());setPenRows(rows);setPenPreview(null);setPenMessage(`${rows.length} mappings loaded. Click Preview.`);}catch{setPenMessage('Choose a valid JSON mapping file.');}}}/><button disabled={!penRows.length} onClick={()=>importPens()}>Preview PEN updates</button>{penPreview&&<><p>Ready: {penPreview.filter(r=>r.status==='Ready').length} · Already set: {penPreview.filter(r=>r.status==='Already set').length} · Review: {penPreview.filter(r=>r.issue).length}</p><div style={{maxHeight:300,overflow:'auto'}}><table><thead><tr><th>Student ID</th><th>Student</th><th>PEN</th><th>Status</th></tr></thead><tbody>{penPreview.map(r=><tr key={r.student_id}><td>{r.student_id}</td><td>{r.name||r.source_name}</td><td>{r.pen}</td><td>{r.issue||r.status}</td></tr>)}</tbody></table></div><button disabled={penPreview.some(r=>r.issue)||!penPreview.some(r=>r.status==='Ready')} onClick={()=>importPens(true)}>Import reviewed PEN updates</button></>}<p role="status">{penMessage}</p></section>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "14px", marginTop: "18px" }}>
        <SummaryCard label="Total Students" value={students.length} />
        <SummaryCard label="Visible Students" value={filteredStudents.length} />
        <SummaryCard label="Grade Levels" value={grades.length} />
      </div>

      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginTop: "20px", marginBottom: "16px" }}>
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by name, PEN, student ID, email, or homeform"
          style={{
            flex: "1 1 360px",
            padding: "12px",
            border: "1px solid #d7d7d7",
            borderRadius: "10px",
            fontSize: "15px",
          }}
        />

        <select
          value={gradeFilter}
          onChange={(event) => setGradeFilter(event.target.value)}
          style={{
            padding: "12px",
            border: "1px solid #d7d7d7",
            borderRadius: "10px",
            fontSize: "15px",
            background: "white",
          }}
        >
          <option value="all">All Grades</option>
          {grades.map((grade) => (
            <option key={grade} value={grade}>
              Grade {grade}
            </option>
          ))}
        </select>
      </div>

      {message ? (
        <div style={{ background: "white", border: "1px solid #d7d7d7", borderRadius: "12px", padding: "18px" }}>
          {message}
        </div>
      ) : (
        <div style={{ background: "white", border: "1px solid #d7d7d7", borderRadius: "12px", overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1.2fr 1.2fr 1.8fr 1fr", gap: "10px", padding: "12px 14px", fontWeight: 800, background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
            <div>Student</div>
            <div>Grade</div>
            <div>Homeform</div>
            <div>Student ID</div>
            <div>PEN</div>
            <div>Email</div>
            <div>Status</div>
          </div>

          {filteredStudents.length === 0 ? (
            <div style={{ padding: "16px" }}>No students match the current filters.</div>
          ) : (
            filteredStudents.map((student) => (
              <div
                key={student.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "2fr 1fr 1fr 1.2fr 1.2fr 1.8fr 1fr",
                  gap: "10px",
                  padding: "12px 14px",
                  borderBottom: "1px solid #f1f5f9",
                  alignItems: "center",
                }}
              >
                <div style={{ fontWeight: 800 }}>{student.display_name || `${student.legal_first_name || ""} ${student.legal_last_name || ""}`.trim() || "Unnamed Student"}</div>
                <div>{student.current_grade || "—"}</div>
                <div>{student.current_homeform || "—"}</div>
                <div>{student.student_id || "—"}</div>
                <div>{student.pen || "—"}</div>
                <div>{student.student_email || "—"}</div>
                <div>{student.status || "—"}</div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

function SummaryCard({ label, value }) {
  return (
    <div style={{ background: "white", border: "1px solid #d7d7d7", borderRadius: "12px", padding: "16px" }}>
      <div style={{ fontSize: "14px", color: "#6b7280", marginBottom: "6px" }}>{label}</div>
      <div style={{ fontSize: "26px", fontWeight: 800 }}>{value}</div>
    </div>
  )
}
