import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext.jsx";

function ReportsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const commentSaveTimersRef = useRef({});

  const [courses, setCourses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [levels, setLevels] = useState([]);
  const [enrolledStudents, setEnrolledStudents] = useState([]);

  const [selectedCourse, setSelectedCourse] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [selectedCategoryName, setSelectedCategoryName] = useState("");
  const [selectedLevelName, setSelectedLevelName] = useState("");

  const [selectedStudentKey, setSelectedStudentKey] = useState("");
  const [reportScope, setReportScope] = useState("student");

  const [reportData, setReportData] = useState(null);
  const [reportComments, setReportComments] = useState([]);
  const [kduGradebookStudents, setKduGradebookStudents] = useState([]);
  const [commentTone, setCommentTone] = useState("student");
  const [savedCommentStudentId, setSavedCommentStudentId] = useState(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/courses")
      .then((res) => {
        if (!res.ok) {
          throw new Error("Could not load courses");
        }
        return res.json();
      })
      .then((data) => {
        const safeCourses = Array.isArray(data) ? data : [];
        const normalizedRole = String(user?.role || "").trim().toLowerCase();
        const normalizedUserId = String(user?.id || "").trim();
        const normalizedUserEmail = String(user?.email || "").trim().toLowerCase();

        const visibleCourses =
          normalizedRole === "teacher"
            ? safeCourses.filter((course) => {
                const courseTeacherId = String(
                  course?.teacher_id ??
                    course?.assigned_teacher_id ??
                    course?.teacherId ??
                    ""
                ).trim();

                const courseTeacherEmail = String(
                  course?.teacher_email ??
                    course?.assigned_teacher_email ??
                    course?.teacherEmail ??
                    ""
                )
                  .trim()
                  .toLowerCase();

                if (normalizedUserId && courseTeacherId) {
                  return courseTeacherId === normalizedUserId;
                }

                if (normalizedUserEmail && courseTeacherEmail) {
                  return courseTeacherEmail === normalizedUserEmail;
                }

                return false;
              })
            : safeCourses;

        setCourses(visibleCourses);

        if (
          selectedCourse &&
          !visibleCourses.some((course) => String(course.id) === String(selectedCourse))
        ) {
          setSelectedCourse("");
          setSelectedCategoryId("");
          setSelectedCategoryName("");
          setLevels([]);
          setSelectedLevelName("");
          setSelectedStudentKey("");
          setReportData(null);
        }
      })
      .catch(() => setMessage("Could not load courses"));
  }, [user?.id, user?.email, user?.role, selectedCourse]);

  useEffect(() => {
    setEnrolledStudents([]);
  }, []);

  const visibleStudents = useMemo(() => {
    const safeStudents = Array.isArray(enrolledStudents) ? enrolledStudents : [];

    if (!selectedCourse) {
      return safeStudents;
    }

    return safeStudents.filter(
      (student) => String(student.course_id || student.class_id || "") === String(selectedCourse)
    );
  }, [enrolledStudents, selectedCourse]);

  const selectedStudent = useMemo(() => {
    if (!selectedStudentKey) {
      return null;
    }

    return (
      visibleStudents.find((student) => {
        const studentKey = student.student_email || `name:${student.student_name}`;
        return studentKey === selectedStudentKey;
      }) || null
    );
  }, [visibleStudents, selectedStudentKey]);

  function loadCategories(courseId) {
    if (!courseId) {
      setCategories([]);
      setSelectedCategoryId("");
      setSelectedCategoryName("");
      setLevels([]);
      setSelectedLevelName("");
      return;
    }

    fetch(`/api/assessment-categories/${courseId}`)
      .then((res) => {
        if (!res.ok) {
          throw new Error("Could not load categories");
        }
        return res.json();
      })
      .then((data) => {
        setCategories(Array.isArray(data) ? data : []);
        setSelectedCategoryId("");
        setSelectedCategoryName("");
        setLevels([]);
        setSelectedLevelName("");
      })
      .catch(() => setMessage("Could not load categories"));
  }

  function loadLevels(categoryId) {
    if (!categoryId) {
      setLevels([]);
      setSelectedLevelName("");
      return;
    }

    fetch(`/api/assessment-levels/${categoryId}`)
      .then((res) => {
        if (!res.ok) {
          throw new Error("Could not load levels");
        }
        return res.json();
      })
      .then((data) => {
        setLevels(Array.isArray(data) ? data : []);
        setSelectedLevelName("");
      })
      .catch(() => setMessage("Could not load levels"));
  }

  function handleCourseChange(event) {
    const courseId = event.target.value;
    setSelectedCourse(courseId);
    setSelectedStudentKey("");
    setReportData(null);
    setMessage("");
    setEnrolledStudents([]);
    loadCategories(courseId);

    if (courseId) {
      fetch(`/api/class-roster/${courseId}`)
        .then((res) => {
          if (!res.ok) {
            throw new Error("Could not load students for this course");
          }
          return res.json();
        })
        .then((data) => {
          const rosterStudents = Array.isArray(data?.students) ? data.students : [];
          setEnrolledStudents(
            rosterStudents.map((student) => ({
              ...student,
              course_id: courseId,
              class_id: courseId,
              student_name: student.name || student.student_name || "",
              student_email: student.email || student.student_email || "",
            }))
          );
        })
        .catch(() => {
          setEnrolledStudents([]);
          setMessage("Could not load students for this course");
        });
    }

    fetch(`/api/classes/${courseId}/report-comments`)
      .then(res => res.json())
      .then(data => setReportComments(data.comments || []))
      .catch(() => setReportComments([]));

    fetch(`/api/classes/${courseId}/kdu-gradebook`)
      .then(res => res.json())
      .then(data => setKduGradebookStudents(data.students || []))
      .catch(() => setKduGradebookStudents([]));
  }

  function handleCategoryChange(event) {
    const categoryId = event.target.value;
    setSelectedCategoryId(categoryId);

    const selectedCategory = categories.find(
      (category) => String(category.id) === String(categoryId)
    );

    setSelectedCategoryName(selectedCategory ? selectedCategory.name : "");
    setReportData(null);
    setMessage("");
    loadLevels(categoryId);
  }

  function generateReport() {
    if (!selectedCourse) {
      setMessage("Please select a course");
      return;
    }

    if (reportScope === "student" && !selectedStudent) {
      setMessage("Please select a student");
      return;
    }

    const params = new URLSearchParams({
      studentName: selectedStudent?.student_name || "",
      studentEmail: selectedStudent?.student_email || "",
      categoryName: selectedCategoryName,
      levelName: selectedLevelName,
      reportScope,
    });

    fetch(`/api/reports/${selectedCourse}?${params.toString()}`)
      .then((res) => {
        if (!res.ok) {
          throw new Error("Report error");
        }
        return res.json();
      })
      .then((data) => {
        setReportData(data);
        setMessage(
          reportScope === "student"
            ? `Report loaded for ${selectedStudent?.student_name || "student"}`
            : `Class report loaded successfully`
        );
      })
      .catch(() => setMessage("Could not generate report"));
  }


  function updateLocalComment(studentUserId, fieldName, nextValue) {
    setReportComments((currentComments) =>
      currentComments.map((student) =>
        student.student_user_id === studentUserId
          ? { ...student, [fieldName]: nextValue }
          : student
      )
    );
  }

  function saveComment(studentUserId, com1, com2) {
    if (!selectedCourse) {
      setMessage("Please select a course before saving comments");
      return;
    }

    setSavedCommentStudentId(studentUserId);
    setMessage("Saving comment...");

    fetch(`/api/classes/${selectedCourse}/report-comments/${studentUserId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ com1, com2 })
    })
    .then(res => res.json())
    .then(() => {
      setMessage("Comment saved");
      setSavedCommentStudentId(studentUserId);

      window.setTimeout(() => {
        setSavedCommentStudentId((currentId) =>
          currentId === studentUserId ? null : currentId
        );
      }, 1400);
    })
    .catch(() => {
      setMessage("Failed to save comment");
      setSavedCommentStudentId(null);
    });
  }

  function autoSaveComment(studentUserId, com1, com2) {
    if (commentSaveTimersRef.current[studentUserId]) {
      window.clearTimeout(commentSaveTimersRef.current[studentUserId]);
    }

    commentSaveTimersRef.current[studentUserId] = window.setTimeout(() => {
      saveComment(studentUserId, com1, com2);
    }, 800);
  }

  function getScoreLabel(score) {
    const numericScore = Number(score);

    if (!Number.isFinite(numericScore)) {
      return "Not enough evidence yet";
    }

    if (numericScore >= 5.5) return "Extending";
    if (numericScore >= 4) return "Proficient";
    if (numericScore >= 2.5) return "Developing";
    return "Emerging";
  }

  function getStudentKduPerformance(student) {
    const gradebookStudent =
      kduGradebookStudents.find(
        (item) =>
          String(item.student_email || "").toLowerCase() ===
          String(student.student_email || "").toLowerCase()
      ) || null;

    const assignmentScores = Array.isArray(gradebookStudent?.assignment_scores)
      ? gradebookStudent.assignment_scores
      : [];

    const doScores = [];
    const knowScores = [];
    const understandScores = [];

    assignmentScores.forEach((assignment) => {
      const rubricSelection = assignment.rubric_selection || {};

      if (rubricSelection.DO !== undefined && rubricSelection.DO !== null) {
        doScores.push(Number(rubricSelection.DO));
      }

      if (rubricSelection.KNOW !== undefined && rubricSelection.KNOW !== null) {
        knowScores.push(Number(rubricSelection.KNOW));
      }

      if (
        rubricSelection.UNDERSTAND !== undefined &&
        rubricSelection.UNDERSTAND !== null
      ) {
        understandScores.push(Number(rubricSelection.UNDERSTAND));
      }
    });

    const averageScores = (scores) => {
      const safeScores = scores.filter((score) => Number.isFinite(score));

      if (safeScores.length === 0) {
        return null;
      }

      return safeScores.reduce((sum, score) => sum + score, 0) / safeScores.length;
    };

    return {
      overallPercent: gradebookStudent?.current_percent ?? null,
      doAverage: averageScores(doScores),
      knowAverage: averageScores(knowScores),
      understandAverage: averageScores(understandScores),
    };
  }

  function buildStudentFriendlyDraftComments(student) {
    const performance = getStudentKduPerformance(student);
    const doLabel = getScoreLabel(performance.doAverage);
    const knowLabel = getScoreLabel(performance.knowAverage);
    const understandLabel = getScoreLabel(performance.understandAverage);

    const studentFirstName = String(student.student_name || "This student").split(" ")[0];
    const studentName = String(student.student_name || "This student");

    if (commentTone === "parent") {
      const com1 = `${studentName} is making progress in English Studies 12. Current evidence shows ${knowLabel.toLowerCase()} development in KNOW, ${doLabel.toLowerCase()} development in DO, and ${understandLabel.toLowerCase()} development in UNDERSTAND. Continued practice with evidence, explanation, and connecting ideas will support further growth.`;
      const com2 = `Next step: encourage regular review, careful revision, and specific text evidence when explaining ideas.`;

      return { com1, com2 };
    }

    if (commentTone === "academic") {
      const com1 = `${studentName} demonstrates ${knowLabel.toLowerCase()} achievement in knowledge and concepts, ${doLabel.toLowerCase()} achievement in applying skills and evidence, and ${understandLabel.toLowerCase()} achievement in explaining meaning and connections. Further growth should focus on precision, depth of analysis, and consistency across written responses.`;
      const com2 = `Recommended focus: strengthen textual evidence, academic explanation, and revision for clarity and depth.`;

      return { com1, com2 };
    }

    if (commentTone === "supportive") {
      const com1 = `${studentFirstName} is working on building confidence in KNOW, DO, and UNDERSTAND. The current evidence shows ${knowLabel.toLowerCase()} progress in KNOW, ${doLabel.toLowerCase()} progress in DO, and ${understandLabel.toLowerCase()} progress in UNDERSTAND. With support and practice, ${studentFirstName} can continue improving.`;
      const com2 = `Next step: focus on one clear idea, use one strong piece of evidence, and explain how it connects to the answer.`;

      return { com1, com2 };
    }

    let strengthSentence = `${studentFirstName} is building skills in KNOW, DO, and UNDERSTAND competencies.`;

    if (doLabel === "Extending" || knowLabel === "Extending" || understandLabel === "Extending") {
      strengthSentence = `${studentFirstName} demonstrates strong learning in this course and is able to show understanding through clear evidence, explanation, and thoughtful work.`;
    } else if (doLabel === "Proficient" || knowLabel === "Proficient" || understandLabel === "Proficient") {
      strengthSentence = `${studentFirstName} is meeting expectations and is developing clear, accurate work across the KNOW, DO, and UNDERSTAND competencies.`;
    } else if (doLabel === "Developing" || knowLabel === "Developing" || understandLabel === "Developing") {
      strengthSentence = `${studentFirstName} is developing important skills and is beginning to show learning with support, practice, and clearer explanations.`;
    } else {
      strengthSentence = `${studentFirstName} is beginning to work toward the course expectations and benefits from guided support and repeated practice.`;
    }

    const com1 = `${strengthSentence} In KNOW, the current level is ${knowLabel.toLowerCase()}; in DO, the current level is ${doLabel.toLowerCase()}; and in UNDERSTAND, the current level is ${understandLabel.toLowerCase()}. The next step is to keep strengthening evidence, explanation, and connections between ideas.`;

    const com2 = `Next step: continue using specific evidence, clear explanations, and careful revision to improve confidence and consistency.`;

    return { com1, com2 };
  }

  function generateDraftComment(student) {
    const draft = buildStudentFriendlyDraftComments(student);

    setReportComments((currentComments) =>
      currentComments.map((currentStudent) =>
        currentStudent.student_user_id === student.student_user_id
          ? { ...currentStudent, com1: draft.com1, com2: draft.com2 }
          : currentStudent
      )
    );

    saveComment(student.student_user_id, draft.com1, draft.com2);
  }

  function generateAllDraftComments() {
    if (!selectedCourse) {
      setMessage("Please select a course before generating comments");
      return;
    }

    if (reportComments.length === 0) {
      setMessage("No students loaded for comment generation");
      return;
    }

    const draftedComments = reportComments.map((student) => {
      const draft = buildStudentFriendlyDraftComments(student);

      return {
        ...student,
        com1: draft.com1,
        com2: draft.com2,
      };
    });

    setReportComments(draftedComments);
    setMessage(`Generated draft comments for ${draftedComments.length} students. Saving...`);

    draftedComments.forEach((student, index) => {
      window.setTimeout(() => {
        saveComment(student.student_user_id, student.com1, student.com2);
      }, index * 120);
    });
  }

  function printReport() {
    window.print();
  }

  function exportCSV() {
    if (!reportData) {
      setMessage("Generate a report first");
      return;
    }

    const rows = [];

    rows.push(["Course", reportData.course_title || ""]);
    rows.push(["Report Scope", reportData.report_scope || reportScope]);
    rows.push(["Student Count", reportData.class_summary?.student_count ?? ""]);
    rows.push(["Class Average", reportData.class_summary?.class_average ?? ""]);
    rows.push(["Highest Grade", reportData.class_summary?.highest_grade ?? ""]);
    rows.push(["Lowest Grade", reportData.class_summary?.lowest_grade ?? ""]);
    rows.push([]);

    reportData.students.forEach((student) => {
      rows.push(["Student", student.student_name]);
      rows.push(["Student Email", student.student_email || ""]);
      rows.push(["Course Total", student.course_total]);
      rows.push([]);

      rows.push(["Category Totals"]);
      rows.push(["Category", "Total"]);
      Object.entries(student.category_totals || {}).forEach(([category, value]) => {
        rows.push([category, value]);
      });

      rows.push([]);
      rows.push(["Assignments"]);
      rows.push([
        "Assignment",
        "Lesson",
        "Category",
        "Level",
        "Score",
        "Weight %",
        "Contribution",
      ]);

      (student.assignments || []).forEach((assignment) => {
        rows.push([
          assignment.assignment_title ?? "",
          assignment.lesson_title ?? "",
          assignment.category_name ?? "",
          assignment.level_name ?? "",
          assignment.score ?? "",
          assignment.calculated_weight_percent ?? "",
          assignment.contribution ?? "",
        ]);
      });

      rows.push([]);
      rows.push([]);
    });

    const csvContent = rows
      .map((row) =>
        row
          .map((cell) => {
            const value = cell === null || cell === undefined ? "" : String(cell);
            return `"${value.replace(/"/g, '""')}"`;
          })
          .join(",")
      )
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    const safeCourseTitle = (reportData.course_title || "report")
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase();

    link.href = url;
    link.download = `${safeCourseTitle}-report.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function downloadWebtessCSV() {
    if (!selectedCourse) {
      setMessage("Please select a course before downloading WebTESS CSV");
      return;
    }

    window.location.href = `/api/classes/${selectedCourse}/webtess-marks-csv`;
    setMessage("Downloading WebTESS CSV for ministry upload");
  }

  function exportPDF() {
    if (!reportData) {
      setMessage("Generate a report first");
      return;
    }

    const printWindow = window.open("", "_blank", "width=1000,height=800");

    if (!printWindow) {
      setMessage("Pop-up blocked. Please allow pop-ups for PDF export.");
      return;
    }

    const studentSections = (reportData.students || [])
      .map((student) => {
        const categoryTotalsHtml = Object.entries(student.category_totals || {})
          .map(
            ([category, value]) =>
              `<li><strong>${escapeHtml(category)}:</strong> ${escapeHtml(String(value))}%</li>`
          )
          .join("");

        const assignmentRowsHtml = (student.assignments || [])
          .map(
            (assignment) => `
              <tr>
                <td>${escapeHtml(assignment.assignment_title ?? "")}</td>
                <td>${escapeHtml(assignment.lesson_title ?? "")}</td>
                <td>${escapeHtml(assignment.category_name ?? "")}</td>
                <td>${escapeHtml(assignment.level_name ?? "")}</td>
                <td>${escapeHtml(String(assignment.score ?? ""))}</td>
                <td>${escapeHtml(String(assignment.calculated_weight_percent ?? ""))}</td>
                <td>${escapeHtml(String(assignment.contribution ?? ""))}</td>
              </tr>
            `
          )
          .join("");

        return `
          <section class="student-block">
            <h2>${escapeHtml(student.student_name)}</h2>
            <p><strong>Student Email:</strong> ${escapeHtml(student.student_email || "")}</p>
            <p><strong>Course Total:</strong> ${escapeHtml(String(student.course_total))}%</p>

            <h3>Category Totals</h3>
            <ul>${categoryTotalsHtml || "<li>No category totals</li>"}</ul>

            <h3>Assignments</h3>
            <table>
              <thead>
                <tr>
                  <th>Assignment</th>
                  <th>Lesson</th>
                  <th>Category</th>
                  <th>Level</th>
                  <th>Score</th>
                  <th>Weight %</th>
                  <th>Contribution</th>
                </tr>
              </thead>
              <tbody>
                ${assignmentRowsHtml || '<tr><td colspan="7">No assignments</td></tr>'}
              </tbody>
            </table>
          </section>
        `;
      })
      .join("");

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${escapeHtml(reportData.course_title || "Report")}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 24px;
              color: #111827;
            }
            h1, h2, h3 {
              margin-bottom: 8px;
            }
            .summary {
              margin-bottom: 24px;
              padding: 16px;
              border: 1px solid #d1d5db;
              border-radius: 8px;
            }
            .student-block {
              margin-top: 24px;
              padding-top: 12px;
              border-top: 2px solid #d1d5db;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 8px;
              margin-bottom: 16px;
            }
            th, td {
              border: 1px solid #d1d5db;
              padding: 8px;
              text-align: left;
              vertical-align: top;
              font-size: 12px;
            }
            th {
              background: #f3f4f6;
            }
            ul {
              margin-top: 6px;
            }
            @media print {
              body {
                margin: 12px;
              }
            }
          </style>
        </head>
        <body>
          <h1>${escapeHtml(reportData.course_title || "Report")}</h1>

          <div class="summary">
            <p><strong>Report Scope:</strong> ${escapeHtml(reportData.report_scope || reportScope)}</p>
            <p><strong>Students:</strong> ${escapeHtml(String(reportData.class_summary?.student_count ?? ""))}</p>
            <p><strong>Class Average:</strong> ${escapeHtml(String(reportData.class_summary?.class_average ?? ""))}%</p>
            <p><strong>Highest Grade:</strong> ${escapeHtml(String(reportData.class_summary?.highest_grade ?? ""))}%</p>
            <p><strong>Lowest Grade:</strong> ${escapeHtml(String(reportData.class_summary?.lowest_grade ?? ""))}%</p>
          </div>

          ${studentSections || "<p>No report data available.</p>"}
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();

    setTimeout(() => {
      printWindow.print();
    }, 300);
  }

  return (
    <div>
      <div style={floatingDashboardButtonWrapStyle}>
        <button
          type="button"
          onClick={() => navigate("/dashboard")}
          style={floatingDashboardButtonStyle}
        >
          Back to Dashboard
        </button>
      </div>

      <div style={sectionStyle}>
        <h1 style={pageTitleStyle}>Reports</h1>
        <p style={introTextStyle}>
          Generate student or class reports using course, category, level, and student identity.
        </p>
      </div>

      <div style={sectionStyle}>
        <h2 style={sectionTitleStyle}>Generate Report</h2>

        <div style={formGridStyle}>
          <div>
            <label style={labelStyle}>Course</label>
            <select
              value={selectedCourse}
              onChange={handleCourseChange}
              style={inputStyle}
            >
              <option value="">Select Course</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={labelStyle}>Report Type</label>
            <select
              value={reportScope}
              onChange={(e) => {
                setReportScope(e.target.value);
                setReportData(null);
                setMessage("");
              }}
              style={inputStyle}
            >
              <option value="student">Student Report</option>
              <option value="class">Class Report</option>
            </select>
          </div>

          {reportScope === "student" && (
            <div>
              <label style={labelStyle}>Student</label>
              <select
                value={selectedStudentKey}
                onChange={(e) => {
                  setSelectedStudentKey(e.target.value);
                  setReportData(null);
                  setMessage("");
                }}
                style={inputStyle}
              >
                <option value="">Select Student</option>
                {visibleStudents.map((student) => {
                  const studentKey = student.student_email || `name:${student.student_name}`;

                  return (
                    <option key={studentKey} value={studentKey}>
                      {student.student_name}
                      {student.student_email ? ` — ${student.student_email}` : ""}
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          <div>
            <label style={labelStyle}>Category</label>
            <select
              value={selectedCategoryId}
              onChange={handleCategoryChange}
              style={inputStyle}
            >
              <option value="">All Categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={labelStyle}>Level</label>
            <select
              value={selectedLevelName}
              onChange={(e) => {
                setSelectedLevelName(e.target.value);
                setReportData(null);
                setMessage("");
              }}
              style={inputStyle}
            >
              <option value="">All Levels</option>
              {levels.map((level) => (
                <option key={level.id} value={level.level_name}>
                  {level.level_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={buttonRowStyle}>
          <button onClick={generateReport} style={buttonStyle}>
            Generate Report
          </button>

          <button onClick={exportPDF} style={buttonStyle}>
            Export PDF
          </button>

          <button onClick={exportCSV} style={buttonStyle}>
            Export CSV
          </button>

          <button onClick={downloadWebtessCSV} style={buttonStyle}>
            Download WebTESS CSV
          </button>
        </div>

        <div style={messageStyle}>{message}</div>

        <div style={webtessHelpStyle}>
          WebTESS CSV exports the required columns: Student ID, Mark, Work, Att, Com1, Com2.
          Marks are rounded to whole numbers for ministry upload.
        </div>
      </div>

      
      <div style={sectionStyle}>
        <div style={commentHeaderRowStyle}>
          <div>
            <h2 style={sectionTitleStyle}>Report Card Comments (Com1 / Com2)</h2>
            <p style={commentHelpTextStyle}>
              Generate editable student-friendly draft comments from KDU performance, then export them to WebTESS.
            </p>
          </div>

          <div style={commentActionGroupStyle}>
            <label style={commentToneLabelStyle}>
              Comment Tone
              <select
                value={commentTone}
                onChange={(e) => setCommentTone(e.target.value)}
                style={commentToneSelectStyle}
              >
                <option value="student">Student-friendly</option>
                <option value="parent">Parent-friendly</option>
                <option value="academic">Academic</option>
                <option value="supportive">Supportive / simplified</option>
              </select>
            </label>

            <button
              onClick={generateAllDraftComments}
              style={buttonStyle}
              disabled={!selectedCourse || reportComments.length === 0}
            >
              Generate All Draft Comments
            </button>
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Student</th>
                <th style={thStyle}>Com1</th>
                <th style={thStyle}>Com2</th>
                <th style={thStyle}>Draft</th>
                <th style={thStyle}>Save</th>
              </tr>
            </thead>
            <tbody>
              {reportComments.map((student) => (
                <tr key={student.student_user_id}>
                  <td style={tdStyle}>{student.student_name}</td>

                  <td style={tdStyle}>
                    <textarea
                      value={student.com1 || ""}
                      onChange={(e) => {
                        const nextCom1 = e.target.value;
                        updateLocalComment(student.student_user_id, "com1", nextCom1);
                        autoSaveComment(student.student_user_id, nextCom1, student.com2);
                      }}
                      style={{ width: "100%", minHeight: "120px" }}
                    />
                  </td>

                  <td style={tdStyle}>
                    <textarea
                      value={student.com2 || ""}
                      onChange={(e) => {
                        const nextCom2 = e.target.value;
                        updateLocalComment(student.student_user_id, "com2", nextCom2);
                        autoSaveComment(student.student_user_id, student.com1, nextCom2);
                      }}
                      style={{ width: "100%", minHeight: "120px" }}
                    />
                  </td>

                  <td style={tdStyle}>
                    <button
                      onClick={() => generateDraftComment(student)}
                      style={buttonStyle}
                    >
                      Generate Draft
                    </button>
                  </td>

                  <td style={{ ...tdStyle, position: "relative" }}>
                    {savedCommentStudentId === student.student_user_id ? (
                      <div style={floatingSavedStyle}>Saved ✓</div>
                    ) : null}

                    <button
                      onClick={() =>
                        saveComment(student.student_user_id, student.com1, student.com2)
                      }
                      style={buttonStyle}
                    >
                      Save
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

{reportData && (
        <div style={sectionStyle}>
          <div style={{ marginBottom: "18px" }}>
            <h2 style={sectionTitleStyle}>
              {reportData.course_title || "Course Report"}
            </h2>

            <div
              style={{
                padding: "14px",
                border: "1px solid #d7d7d7",
                borderRadius: "12px",
                background: "#f8fafc",
                fontSize: "16px",
                lineHeight: 1.6,
              }}
            >
              <div>
                <strong>Report Type:</strong>{" "}
                {reportData.report_scope === "student"
                  ? "Student Report"
                  : "Class Report"}
              </div>

              <div>
                <strong>Students Included:</strong>{" "}
                {reportData.class_summary?.student_count ?? 0}
              </div>
            </div>
          </div>

          <div style={buttonRowStyle}>
            <button onClick={printReport} style={buttonStyle}>
              Print / Save as PDF
            </button>
          </div>

          <div style={summaryBoxStyle}>
            <div><strong>Students:</strong> {reportData.class_summary.student_count}</div>
            <div><strong>Average:</strong> {reportData.class_summary.class_average}%</div>
            <div><strong>Highest:</strong> {reportData.class_summary.highest_grade}%</div>
            <div><strong>Lowest:</strong> {reportData.class_summary.lowest_grade}%</div>
          </div>

          <h3 style={subheadingStyle}>Students</h3>

          {reportData.students.length === 0 ? (
            <div
              style={{
                padding: "18px",
                border: "1px solid #d7d7d7",
                borderRadius: "12px",
                background: "#fff",
                fontSize: "16px",
              }}
            >
              No report data found for the selected filters.
            </div>
          ) : reportData.students.map((student) => (
            <div
              key={student.student_email || student.student_name}
              style={studentCardStyle}
            >
              <h4 style={studentTitleStyle}>{student.student_name}</h4>
              <p style={detailTextStyle}>
                <strong>Student Email:</strong> {student.student_email || "-"}
              </p>
              <p style={detailTextStyle}>
                <strong>Course Total:</strong> {student.course_total}%
              </p>

              <h5 style={miniHeadingStyle}>Category Totals</h5>
              <ul style={listStyle}>
                {Object.entries(student.category_totals).map(([category, value]) => (
                  <li key={category}>
                    {category}: {value}%
                  </li>
                ))}
              </ul>

              <h5 style={miniHeadingStyle}>Assignments</h5>
              <div style={{ overflowX: "auto" }}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Assignment</th>
                      <th style={thStyle}>Lesson</th>
                      <th style={thStyle}>Category</th>
                      <th style={thStyle}>Level</th>
                      <th style={thStyle}>Score</th>
                      <th style={thStyle}>Weight %</th>
                      <th style={thStyle}>Contribution</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(student.assignments || []).length === 0 ? (
                      <tr>
                        <td style={tdStyle} colSpan="7">
                          No assignments available.
                        </td>
                      </tr>
                    ) : student.assignments.map((assignment) => (
                      <tr key={assignment.submission_id}>
                        <td style={tdStyle}>{assignment.assignment_title}</td>
                        <td style={tdStyle}>{assignment.lesson_title}</td>
                        <td style={tdStyle}>{assignment.category_name}</td>
                        <td style={tdStyle}>{assignment.level_name}</td>
                        <td style={tdStyle}>{assignment.score}</td>
                        <td style={tdStyle}>{assignment.calculated_weight_percent}</td>
                        <td style={tdStyle}>{assignment.contribution}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

const sectionStyle = {
  background: "white",
  padding: "28px",
  borderRadius: "12px",
  border: "1px solid #d7d7d7",
  marginBottom: "24px",
};

const pageTitleStyle = {
  marginTop: 0,
  marginBottom: "10px",
  fontSize: "42px",
};

const introTextStyle = {
  margin: 0,
  fontSize: "18px",
  color: "#333",
};

const sectionTitleStyle = {
  marginTop: 0,
  marginBottom: "20px",
  fontSize: "28px",
};

const subheadingStyle = {
  marginTop: "24px",
  marginBottom: "16px",
  fontSize: "24px",
};

const formGridStyle = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "18px",
};

const labelStyle = {
  display: "block",
  marginBottom: "8px",
  fontSize: "16px",
  fontWeight: "600",
};

const inputStyle = {
  width: "100%",
  padding: "14px 16px",
  borderRadius: "10px",
  border: "1px solid #b5b5b5",
  fontSize: "16px",
  boxSizing: "border-box",
  background: "white",
  color: "#111",
};

const buttonStyle = {
  padding: "14px 20px",
  borderRadius: "10px",
  border: "1px solid #111",
  background: "white",
  color: "#111",
  fontSize: "16px",
  cursor: "pointer",
};

const buttonRowStyle = {
  display: "flex",
  gap: "12px",
  marginTop: "18px",
  flexWrap: "wrap",
};

const messageStyle = {
  minHeight: "24px",
  marginTop: "16px",
  fontSize: "16px",
  color: "#333",
};

const webtessHelpStyle = {
  marginTop: "10px",
  padding: "12px",
  border: "1px solid #d7d7d7",
  borderRadius: "10px",
  background: "#f8fafc",
  fontSize: "15px",
  lineHeight: 1.5,
  color: "#333",
};

const commentHeaderRowStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "16px",
  flexWrap: "wrap",
  marginBottom: "18px",
};

const commentHelpTextStyle = {
  marginTop: "-10px",
  marginBottom: 0,
  fontSize: "16px",
  color: "#333",
  lineHeight: 1.5,
};

const commentActionGroupStyle = {
  display: "flex",
  alignItems: "flex-end",
  gap: "12px",
  flexWrap: "wrap",
};

const commentToneLabelStyle = {
  display: "grid",
  gap: "6px",
  fontSize: "15px",
  fontWeight: 700,
};

const commentToneSelectStyle = {
  padding: "12px",
  borderRadius: "10px",
  border: "1px solid #b5b5b5",
  fontSize: "16px",
  background: "#ffffff",
  color: "#111",
};

const summaryBoxStyle = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr 1fr 1fr",
  gap: "12px",
  padding: "18px",
  border: "1px solid #d7d7d7",
  borderRadius: "10px",
  marginBottom: "20px",
};

const studentCardStyle = {
  border: "1px solid #d7d7d7",
  padding: "16px",
  borderRadius: "8px",
  marginBottom: "20px",
};

const studentTitleStyle = {
  marginTop: 0,
  marginBottom: "10px",
  fontSize: "22px",
};

const detailTextStyle = {
  marginTop: 0,
  marginBottom: "8px",
};

const miniHeadingStyle = {
  marginTop: "18px",
  marginBottom: "10px",
  fontSize: "18px",
};

const listStyle = {
  marginTop: 0,
  marginBottom: "12px",
};

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: "15px",
};

const thStyle = {
  textAlign: "left",
  padding: "12px",
  borderBottom: "1px solid #d7d7d7",
  background: "white",
};

const tdStyle = {
  padding: "12px",
  borderBottom: "1px solid #e3e3e3",
  verticalAlign: "top",
};

const floatingSavedStyle = {
  position: "absolute",
  top: "8px",
  right: "8px",
  border: "2px solid #111",
  borderRadius: "999px",
  padding: "6px 10px",
  background: "#ffffff",
  fontWeight: 900,
  zIndex: 2,
};

export default ReportsPage;

const floatingDashboardButtonWrapStyle = {
  position: "fixed",
  left: "14px",
  top: "45%",
  zIndex: 15,
  maxWidth: "180px",
};

const floatingDashboardButtonStyle = {
  padding: "12px 14px",
  borderRadius: "10px",
  border: "1px solid #111",
  background: "#ffffff",
  color: "#111",
  fontSize: "15px",
  fontWeight: 800,
  cursor: "pointer",
  boxShadow: "0 2px 8px rgba(0, 0, 0, 0.12)",
};
