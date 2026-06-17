import { useEffect, useMemo, useState } from "react"
import * as XLSX from "xlsx"
import { useAuth } from "../AuthContext.jsx"

const API_BASE = "http://localhost:3000"

const CLASS_CSV_TEMPLATE = `class_name,student_name,student_email,parent_email,student_id
English 10 Block A,Jordan Lee,jordan.lee@school.ca,parent1@email.com,S1001
English 10 Block A,Avery Smith,avery.smith@school.ca,parent2@email.com,S1002
English 10 Block A,Morgan Chen,morgan.chen@school.ca,parent3@email.com,S1003`

export default function ClassEnrollmentPage() {
  const { user } = useAuth()
  const [courses, setCourses] = useState([])
  const [coursesMessage, setCoursesMessage] = useState("Loading assigned courses...")
  const [selectedCourseId, setSelectedCourseId] = useState("")
  const [selectedCourseTitle, setSelectedCourseTitle] = useState("")

  const [className, setClassName] = useState("")
  const [teacherName, setTeacherName] = useState("")
  const [teacherEmail, setTeacherEmail] = useState("")

  const [studentName, setStudentName] = useState("")
  const [studentEmail, setStudentEmail] = useState("")
  const [observerName, setObserverName] = useState("")
  const [observerEmail, setObserverEmail] = useState("")
  const [observerRelationship, setObserverRelationship] = useState("")

  const [students, setStudents] = useState([])
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState("")

  const [csvText, setCsvText] = useState(CLASS_CSV_TEMPLATE)
  const [isImportingCsv, setIsImportingCsv] = useState(false)
  const [csvMessage, setCsvMessage] = useState("")
  const [selectedImportFileName, setSelectedImportFileName] = useState("")

  useEffect(() => {
    loadCourses()
  }, [])

  const loadCourses = async () => {
    setCoursesMessage("Loading assigned courses...")

    try {
      const response = await fetch(`${API_BASE}/api/courses`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to load courses.")
      }

      const safeCourses = Array.isArray(data) ? data : []
      const currentTeacherId = Number(user?.id || 0)
      const userRole = String(user?.role || "").toLowerCase()

      const assignedCourses = safeCourses.filter((course) => {
        if (userRole === "admin") return true
        if (userRole === "teacher") {
          return currentTeacherId && Number(course.teacher_id || course.teacherId || 0) === currentTeacherId
        }
        return false
      })

      setCourses(assignedCourses)

      if (assignedCourses.length === 0) {
        setCoursesMessage("No assigned courses found.")
        return
      }

      setCoursesMessage(`${assignedCourses.length} assigned course${assignedCourses.length === 1 ? "" : "s"} loaded.`)

      const firstCourse = assignedCourses[0]
      setSelectedCourseId(String(firstCourse.id))
      setSelectedCourseTitle(String(firstCourse.title || ""))
      setClassName(String(firstCourse.title || ""))
    } catch (error) {
      console.error("Error loading courses:", error)
      setCourses([])
      setCoursesMessage(error.message || "Failed to load courses.")
    }
  }

  const addStudent = () => {
    if (!studentName.trim() || !studentEmail.trim()) {
      alert("Please enter both student name and student email.")
      return
    }

    const duplicateStudent = students.some(
      (student) =>
        student.studentEmail.trim().toLowerCase() ===
        studentEmail.trim().toLowerCase()
    )

    if (duplicateStudent) {
      alert("That student email is already in the roster.")
      return
    }

    const newStudent = {
      id: Date.now(),
      studentName: studentName.trim(),
      studentEmail: studentEmail.trim(),
      observerName: observerName.trim(),
      observerEmail: observerEmail.trim(),
      observerRelationship: observerRelationship.trim(),
    }

    setStudents((current) => [...current, newStudent])

    setStudentName("")
    setStudentEmail("")
    setObserverName("")
    setObserverEmail("")
    setObserverRelationship("")
    setSaveMessage("")
  }

  const removeStudent = (id) => {
    setStudents((current) => current.filter((student) => student.id !== id))
    setSaveMessage("")
  }

  const clearRosterForm = () => {
    setClassName(selectedCourseTitle || "")
    setTeacherName("")
    setTeacherEmail("")
    setStudentName("")
    setStudentEmail("")
    setObserverName("")
    setObserverEmail("")
    setObserverRelationship("")
    setStudents([])
  }

  const saveRoster = async () => {
    if (!className.trim() || !teacherName.trim() || !teacherEmail.trim()) {
      alert("Please complete Class Name, Teacher Name, and Teacher Email.")
      return
    }

    if (students.length === 0) {
      alert("Please add at least one student before saving the roster.")
      return
    }

    setIsSaving(true)
    setSaveMessage("Saving roster...")

    try {
      const response = await fetch(`${API_BASE}/api/class-enrollment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          className: className.trim(),
          teacherName: teacherName.trim(),
          teacherEmail: teacherEmail.trim(),
          students: students.map((student) => ({
            studentName: student.studentName,
            studentEmail: student.studentEmail,
            observerName: student.observerName,
            observerEmail: student.observerEmail,
            observerRelationship: student.observerRelationship,
          })),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to save roster.")
      }

      setSaveMessage("Roster saved successfully.")
      clearRosterForm()
    } catch (error) {
      console.error("Error saving roster:", error)
      setSaveMessage(error.message || "Failed to save roster.")
    } finally {
      setIsSaving(false)
    }
  }

  const importClassCsv = async () => {
    if (!csvText.trim()) {
      alert("Please paste class CSV text before importing.")
      return
    }

    setIsImportingCsv(true)
    setCsvMessage("Importing class CSV...")

    try {
      const response = await fetch(`${API_BASE}/api/import/class-from-csv-text`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          csvText: csvText.trim(),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to import class CSV.")
      }

      setCsvMessage(
        `Class imported successfully. Class: ${data.className || "-"} | Created students: ${data.createdStudents || 0} | Updated student roles: ${data.updatedStudentRoles || 0} | Enrolled students: ${data.enrolledStudents || 0}`
      )
    } catch (error) {
      console.error("Error importing class CSV:", error)
      setCsvMessage(error.message || "Failed to import class CSV.")
    } finally {
      setIsImportingCsv(false)
    }
  }

  const escapeCsvValue = (value) => {
    const stringValue = String(value ?? "")
    if (
      stringValue.includes(",") ||
      stringValue.includes('"') ||
      stringValue.includes("\n")
    ) {
      return `"${stringValue.replace(/"/g, '""')}"`
    }
    return stringValue
  }

  const normalizeSpreadsheetHeaders = (row) => {
    const normalizedRow = {}

    Object.keys(row || {}).forEach((key) => {
      const normalizedKey = String(key || "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "_")

      normalizedRow[normalizedKey] = row[key]
    })

    return normalizedRow
  }

  const buildCsvFromSpreadsheetRows = (rows) => {
    const requiredHeaders = [
      "class_name",
      "student_name",
      "student_email",
      "parent_email",
      "student_id",
    ]

    const normalizedRows = rows.map((row) => normalizeSpreadsheetHeaders(row))

    if (normalizedRows.length === 0) {
      throw new Error("Spreadsheet has no student rows.")
    }

    const missingHeaders = requiredHeaders.filter((header) => {
      return !Object.prototype.hasOwnProperty.call(normalizedRows[0], header)
    })

    if (missingHeaders.length > 0) {
      throw new Error(
        `Spreadsheet is missing required header(s): ${missingHeaders.join(", ")}`
      )
    }

    const csvLines = [
      requiredHeaders.join(","),
      ...normalizedRows.map((row) =>
        requiredHeaders.map((header) => escapeCsvValue(row[header])).join(",")
      ),
    ]

    return csvLines.join("\n")
  }

  const handleSpreadsheetUpload = async (event) => {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    setCsvMessage("Reading spreadsheet...")
    setSelectedImportFileName(file.name)

    try {
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: "array" })

      const firstSheetName = workbook.SheetNames[0]
      if (!firstSheetName) {
        throw new Error("Spreadsheet does not contain a worksheet.")
      }

      const worksheet = workbook.Sheets[firstSheetName]
      const rows = XLSX.utils.sheet_to_json(worksheet, {
        defval: "",
        raw: false,
      })

      const convertedCsv = buildCsvFromSpreadsheetRows(rows)

      setCsvText(convertedCsv)
      setCsvMessage(
        `Spreadsheet loaded successfully from ${file.name}. Review the converted CSV below, then click Import Class CSV.`
      )
    } catch (error) {
      console.error("Error reading spreadsheet:", error)
      setCsvMessage(error.message || "Failed to read spreadsheet.")
    } finally {
      event.target.value = ""
    }
  }

  const loadTemplate = () => {
    setCsvText(CLASS_CSV_TEMPLATE)
    setCsvMessage("")
    setSelectedImportFileName("")
  }

  const clearCsv = () => {
    setCsvText("")
    setCsvMessage("")
    setSelectedImportFileName("")
  }

  const applySelectedCourseToManualForm = () => {
    if (!selectedCourseTitle) {
      alert("Select a course first.")
      return
    }

    setClassName(selectedCourseTitle)
    setSaveMessage("Selected course copied into manual roster form.")
  }

  const applySelectedCourseToCsv = () => {
    if (!selectedCourseTitle) {
      alert("Select a course first.")
      return
    }

    const selectedCourseCsv = `class_name,student_name,student_email,parent_email,student_id
${selectedCourseTitle},Jordan Lee,jordan.lee@school.ca,parent1@email.com,S1001
${selectedCourseTitle},Avery Smith,avery.smith@school.ca,parent2@email.com,S1002
${selectedCourseTitle},Morgan Chen,morgan.chen@school.ca,parent3@email.com,S1003`

    setCsvText(selectedCourseCsv)
    setCsvMessage(`CSV example loaded for ${selectedCourseTitle}.`)
    setSelectedImportFileName("")
  }

  const handleCourseChange = (event) => {
    const nextCourseId = event.target.value
    const matchedCourse =
      courses.find((course) => String(course.id) === String(nextCourseId)) || null

    setSelectedCourseId(nextCourseId)
    setSelectedCourseTitle(matchedCourse?.title || "")
    setClassName(matchedCourse?.title || "")
    setSaveMessage("")
  }

  const totalStudents = useMemo(() => students.length, [students])

  return (
    <div>
      <div style={sectionStyle}>
        <h1 style={pageTitleStyle}>Class Enrollment</h1>
        <p style={introTextStyle}>
          Build your class roster manually or import students into a course from CSV or Excel.
        </p>
      </div>

      <div style={sectionStyle}>
        <h2 style={sectionTitleStyle}>Assigned Course Target</h2>
        <p style={helperTextStyle}>
          Pick one of your assigned courses so the class name stays consistent across import and manual entry.
        </p>

        <div style={formGridStyle}>
          <div>
            <label style={labelStyle}>Selected Course</label>
            <select
              value={selectedCourseId}
              onChange={handleCourseChange}
              style={inputStyle}
            >
              {courses.length === 0 ? (
                <option value="">No assigned courses found</option>
              ) : (
                courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.title}
                  </option>
                ))
              )}
            </select>
          </div>

          <div>
            <label style={labelStyle}>Assigned Courses Status</label>
            <div style={statusBoxStyle}>{coursesMessage}</div>
          </div>
        </div>

        <div style={buttonRowStyle}>
          <button onClick={applySelectedCourseToCsv} style={buttonStyle} type="button">
            Use Selected Course In CSV
          </button>

          <button onClick={applySelectedCourseToManualForm} style={buttonStyle} type="button">
            Use Selected Course In Manual Form
          </button>
        </div>
      </div>

      <div style={sectionStyle}>
        <h2 style={sectionTitleStyle}>Class CSV or Excel Import</h2>
        <p style={helperTextStyle}>
          Use these exact headers for import:
        </p>

        <div style={csvHeaderBoxStyle}>
          class_name,student_name,student_email,parent_email,student_id
        </div>

        <div style={uploadSectionStyle}>
          <label style={labelStyle}>Upload Excel File (.xls or .xlsx)</label>
          <input
            type="file"
            accept=".xls,.xlsx"
            onChange={handleSpreadsheetUpload}
            style={fileInputStyle}
          />
          <div style={fileHelperTextStyle}>
            {selectedImportFileName
              ? `Loaded file: ${selectedImportFileName}`
              : "You can upload an Excel spreadsheet with class_name, student_name, student_id, student_email, and parent_email columns."}
          </div>
        </div>

        <label style={labelStyle}>Paste or Review CSV Text</label>
        <textarea
          value={csvText}
          onChange={(e) => setCsvText(e.target.value)}
          style={textareaStyle}
          placeholder="Paste class CSV here"
        />

        <div style={buttonRowStyle}>
          <button onClick={importClassCsv} style={buttonStyle} disabled={isImportingCsv}>
            {isImportingCsv ? "Importing CSV..." : "Import Class CSV"}
          </button>

          <button onClick={loadTemplate} style={buttonStyle} type="button">
            Load CSV Example
          </button>

          <button onClick={clearCsv} style={buttonStyle} type="button">
            Clear CSV
          </button>
        </div>

        <div style={messageStyle}>{csvMessage}</div>
      </div>

      <div style={sectionStyle}>
        <h2 style={sectionTitleStyle}>Manual Class Details</h2>

        <div style={formGridStyle}>
          <div>
            <label style={labelStyle}>Class Name</label>
            <input
              type="text"
              value={className}
              onChange={(e) => setClassName(e.target.value)}
              style={inputStyle}
              placeholder="Example: English 10 Block A"
            />
          </div>

          <div>
            <label style={labelStyle}>Teacher Name</label>
            <input
              type="text"
              value={teacherName}
              onChange={(e) => setTeacherName(e.target.value)}
              style={inputStyle}
              placeholder="Example: Ms. Carter"
            />
          </div>

          <div>
            <label style={labelStyle}>Teacher Email</label>
            <input
              type="email"
              value={teacherEmail}
              onChange={(e) => setTeacherEmail(e.target.value)}
              style={inputStyle}
              placeholder="Example: teacher@school.ca"
            />
          </div>
        </div>
      </div>

      <div style={sectionStyle}>
        <h2 style={sectionTitleStyle}>Add Student Manually</h2>

        <div style={formGridStyle}>
          <div>
            <label style={labelStyle}>Student Name</label>
            <input
              type="text"
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              style={inputStyle}
              placeholder="Example: Jordan Lee"
            />
          </div>

          <div>
            <label style={labelStyle}>Student Email</label>
            <input
              type="email"
              value={studentEmail}
              onChange={(e) => setStudentEmail(e.target.value)}
              style={inputStyle}
              placeholder="Example: student@school.ca"
            />
          </div>

          <div>
            <label style={labelStyle}>Observer Name</label>
            <input
              type="text"
              value={observerName}
              onChange={(e) => setObserverName(e.target.value)}
              style={inputStyle}
              placeholder="Example: Taylor Lee"
            />
          </div>

          <div>
            <label style={labelStyle}>Observer Email</label>
            <input
              type="email"
              value={observerEmail}
              onChange={(e) => setObserverEmail(e.target.value)}
              style={inputStyle}
              placeholder="Example: parent@email.com"
            />
          </div>

          <div>
            <label style={labelStyle}>Relationship</label>
            <input
              type="text"
              value={observerRelationship}
              onChange={(e) => setObserverRelationship(e.target.value)}
              style={inputStyle}
              placeholder="Example: Mother, Father, Guardian"
            />
          </div>
        </div>

        <div style={buttonRowStyle}>
          <button onClick={addStudent} style={buttonStyle}>
            Add Student to Roster
          </button>
        </div>
      </div>

      <div style={sectionStyle}>
        <h2 style={sectionTitleStyle}>Manual Roster Preview</h2>

        <div style={summaryBoxStyle}>
          <div><strong>Class:</strong> {className || "-"}</div>
          <div><strong>Teacher:</strong> {teacherName || "-"}</div>
          <div><strong>Teacher Email:</strong> {teacherEmail || "-"}</div>
          <div><strong>Total Students:</strong> {totalStudents}</div>
        </div>

        {students.length === 0 ? (
          <p style={emptyTextStyle}>No students added yet.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Student Name</th>
                  <th style={thStyle}>Student Email</th>
                  <th style={thStyle}>Observer Name</th>
                  <th style={thStyle}>Observer Email</th>
                  <th style={thStyle}>Relationship</th>
                  <th style={thStyle}>Action</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student) => (
                  <tr key={student.id}>
                    <td style={tdStyle}>{student.studentName}</td>
                    <td style={tdStyle}>{student.studentEmail}</td>
                    <td style={tdStyle}>{student.observerName || "-"}</td>
                    <td style={tdStyle}>{student.observerEmail || "-"}</td>
                    <td style={tdStyle}>{student.observerRelationship || "-"}</td>
                    <td style={tdStyle}>
                      <button
                        onClick={() => removeStudent(student.id)}
                        style={smallButtonStyle}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={footerActionAreaStyle}>
          <div style={messageStyle}>{saveMessage}</div>

          <div style={buttonRowStyle}>
            <button
              onClick={saveRoster}
              style={buttonStyle}
              disabled={isSaving}
            >
              {isSaving ? "Saving Roster..." : "Save Manual Roster"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

const sectionStyle = {
  background: "white",
  padding: "28px",
  borderRadius: "12px",
  border: "1px solid #d7d7d7",
  marginBottom: "24px",
}

const pageTitleStyle = {
  marginTop: 0,
  marginBottom: "10px",
  fontSize: "42px",
}

const introTextStyle = {
  margin: 0,
  fontSize: "18px",
  color: "#333",
}

const sectionTitleStyle = {
  marginTop: 0,
  marginBottom: "20px",
  fontSize: "28px",
}

const helperTextStyle = {
  marginTop: 0,
  marginBottom: "10px",
  fontSize: "16px",
  color: "#333",
}

const csvHeaderBoxStyle = {
  padding: "14px 16px",
  borderRadius: "10px",
  border: "1px solid #b5b5b5",
  background: "#ffffff",
  fontSize: "15px",
  marginBottom: "16px",
  overflowX: "auto",
}

const uploadSectionStyle = {
  marginBottom: "20px",
}

const fileInputStyle = {
  width: "100%",
  padding: "12px 0",
  fontSize: "16px",
  boxSizing: "border-box",
}

const fileHelperTextStyle = {
  marginTop: "8px",
  fontSize: "15px",
  color: "#333",
}

const formGridStyle = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "18px",
}

const labelStyle = {
  display: "block",
  marginBottom: "8px",
  fontSize: "16px",
  fontWeight: "600",
}

const inputStyle = {
  width: "100%",
  padding: "14px 16px",
  borderRadius: "10px",
  border: "1px solid #b5b5b5",
  fontSize: "16px",
  boxSizing: "border-box",
  background: "white",
  color: "#111",
}

const textareaStyle = {
  width: "100%",
  minHeight: "240px",
  padding: "14px 16px",
  borderRadius: "10px",
  border: "1px solid #b5b5b5",
  fontSize: "15px",
  boxSizing: "border-box",
  background: "white",
  color: "#111",
  resize: "vertical",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  lineHeight: 1.5,
}

const buttonStyle = {
  padding: "14px 20px",
  borderRadius: "10px",
  border: "1px solid #111",
  background: "white",
  color: "#111",
  fontSize: "16px",
  cursor: "pointer",
}

const smallButtonStyle = {
  padding: "8px 12px",
  borderRadius: "8px",
  border: "1px solid #111",
  background: "white",
  color: "#111",
  fontSize: "14px",
  cursor: "pointer",
}

const summaryBoxStyle = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "12px",
  padding: "18px",
  border: "1px solid #d7d7d7",
  borderRadius: "10px",
  marginBottom: "20px",
}

const statusBoxStyle = {
  width: "100%",
  minHeight: "52px",
  padding: "14px 16px",
  borderRadius: "10px",
  border: "1px solid #d7d7d7",
  fontSize: "16px",
  boxSizing: "border-box",
  background: "white",
  color: "#111",
  display: "flex",
  alignItems: "center",
}

const emptyTextStyle = {
  margin: 0,
  color: "#444",
}

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: "15px",
}

const thStyle = {
  textAlign: "left",
  padding: "12px",
  borderBottom: "1px solid #d7d7d7",
  background: "white",
}

const tdStyle = {
  padding: "12px",
  borderBottom: "1px solid #e3e3e3",
}

const buttonRowStyle = {
  display: "flex",
  gap: "12px",
  marginTop: "18px",
  flexWrap: "wrap",
}

const footerActionAreaStyle = {
  marginTop: "24px",
  borderTop: "1px solid #d7d7d7",
  paddingTop: "20px",
}

const messageStyle = {
  minHeight: "24px",
  fontSize: "16px",
  color: "#333",
}