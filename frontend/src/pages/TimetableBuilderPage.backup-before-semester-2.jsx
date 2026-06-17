import { useMemo, useState } from "react"

const BLOCKS = [
  { id: "block1", label: "Block 1", time: "8:30–9:45" },
  { id: "block2", label: "Block 2", time: "9:50–11:05" },
  { id: "block3", label: "Block 3", time: "11:40–12:55" },
  { id: "block4", label: "Block 4", time: "1:00–2:15" },
]

const INITIAL_TEACHERS = [
  {
    id: 1,
    name: "Dr. Carrie",
    courses: ["English 10 A", "English 10 B", "English 10 C", "CTS 10 A", "CTS 10 B", "CTS 10 C"],
    assignments: {
      block1: { course: "English 10 A", subject: "English 10", locked: false },
      block2: { course: "English 10 B", subject: "English 10", locked: false },
      block3: { course: "English 10 C", subject: "English 10", locked: false },
      block4: { course: "Prep", subject: "Prep", locked: false },
    },
  },
  {
    id: 2,
    name: "Mr. Feng",
    courses: ["Physics 11A", "Physics 11B", "Physics 11C", "Pre-calc 11A", "Pre-calc 11B", "Pre-calc 11C"],
    assignments: {
      block1: { course: "Physics 11A", subject: "Physics 11", locked: false },
      block2: { course: "Physics 11B", subject: "Physics 11", locked: false },
      block3: { course: "Prep", subject: "Prep", locked: false },
      block4: { course: "Pre-calc 11A", subject: "Pre-calc 11", locked: false },
    },
  },
  {
    id: 3,
    name: "Mr. Robinson",
    courses: ["Physics 12A", "Physics 12B", "OPysics 12C", "Pre-calc 12A", "Pre-calc 12B", "Pre-calc 12C"],
    assignments: {
      block1: { course: "Physics 12A", subject: "Physics 12", locked: false },
      block2: { course: "Prep", subject: "Prep", locked: false },
      block3: { course: "Physics 12B", subject: "Physics 12", locked: false },
      block4: { course: "Pre-calc 12A", subject: "Pre-calc 12", locked: false },
    },
  },
  {
    id: 4,
    name: "Ms. Moses",
    courses: ["ELSI 11A", "ELSI 11B", "ELSI 11C", "EFP 12A", "EFP 12 B", "EFP 12C"],
    assignments: {
      block1: { course: "Prep", subject: "Prep", locked: false },
      block2: { course: "ELSI 11A", subject: "ELSI 11", locked: false },
      block3: { course: "ELSI 11B", subject: "ELSI 11", locked: false },
      block4: { course: "EFP 12A", subject: "EFP 12", locked: false },
    },
  },
  {
    id: 5,
    name: "Ms. Van der watt",
    courses: [
      "Social studies 10A",
      "Social studies 10B",
      "Social studies 10C",
      "Physical Geography 11A",
      "Physical Geography 11B",
      "Physical Geography",
    ],
    assignments: {
      block1: { course: "Social studies 10A", subject: "Social Studies 10", locked: false },
      block2: { course: "Social studies 10B", subject: "Social Studies 10", locked: false },
      block3: { course: "Physical Geography 11A", subject: "Physical Geography 11", locked: false },
      block4: { course: "Prep", subject: "Prep", locked: false },
    },
  },
  {
    id: 6,
    name: "Mr. Cheng",
    courses: ["FMP 10A", "FMP 10B", "FMP 10C", "Science 10A", "Science 10B", "Science 10C"],
    assignments: {
      block1: { course: "FMP 10A", subject: "FMP 10", locked: false },
      block2: { course: "Science 10A", subject: "Science 10", locked: false },
      block3: { course: "Prep", subject: "Prep", locked: false },
      block4: { course: "Science 10B", subject: "Science 10", locked: false },
    },
  },
  {
    id: 7,
    name: "Ms. Boys",
    courses: ["Comp 11A", "Comp 11B", "Comp 11C", "FNST 12A", "FNST 12 B", "FNST 12C"],
    assignments: {
      block1: { course: "Comp 11A", subject: "Comp 11", locked: false },
      block2: { course: "Prep", subject: "Prep", locked: false },
      block3: { course: "Comp 11B", subject: "Comp 11", locked: false },
      block4: { course: "FNST 12A", subject: "FNST 12", locked: false },
    },
  },
  {
    id: 8,
    name: "Mr. Clemens",
    courses: ["ESL 10A", "ESL 10B", "ESL 10C", "PE 10A", "PE 10B", "PE 10C"],
    assignments: {
      block1: { course: "Prep", subject: "Prep", locked: false },
      block2: { course: "ESL 10A", subject: "ESL 10", locked: false },
      block3: { course: "ESL 10B", subject: "ESL 10", locked: false },
      block4: { course: "PE 10A", subject: "PE 10", locked: false },
    },
  },
  {
    id: 9,
    name: "MYSTERY X",
    courses: ["Chem 11A", "Chem 11B", "Chem11C", "Chem 11A", "Chem 11B", "Chem 11C"],
    assignments: {
      block1: { course: "Chem 11A", subject: "Chem 11", locked: false },
      block2: { course: "Chem 11B", subject: "Chem 11", locked: false },
      block3: { course: "Prep", subject: "Prep", locked: false },
      block4: { course: "Chem11C", subject: "Chem 11", locked: false },
    },
  },
  {
    id: 10,
    name: "New teacher",
    courses: ["Accounting 11 A", "Accounting 11 B", "Accounting 11 C", "Accounting 12 A", "Accounting 12 B", "Accounting 12 V"],
    assignments: {
      block1: { course: "Accounting 11 A", subject: "Accounting 11", locked: false },
      block2: { course: "Prep", subject: "Prep", locked: false },
      block3: { course: "Accounting 11 B", subject: "Accounting 11", locked: false },
      block4: { course: "Accounting 12 A", subject: "Accounting 12", locked: false },
    },
  },
]

export default function TimetableBuilderPage() {
  const [teachers, setTeachers] = useState(INITIAL_TEACHERS)

  const summary = useMemo(() => {
    const prepByBlock = {}
    const subjectCounts = {}
    const warnings = []

    for (const block of BLOCKS) {
      prepByBlock[block.id] = 0
      subjectCounts[block.id] = {}
    }

    for (const teacher of teachers) {
      let teachingBlocks = 0
      let prepBlocks = 0

      for (const block of BLOCKS) {
        const assignment = teacher.assignments[block.id]

        if (!assignment) continue

        if (assignment.subject === "Prep") {
          prepBlocks += 1
          prepByBlock[block.id] += 1
        } else {
          teachingBlocks += 1
          subjectCounts[block.id][assignment.subject] =
            (subjectCounts[block.id][assignment.subject] || 0) + 1
        }
      }

      if (teachingBlocks !== 3 || prepBlocks !== 1) {
        warnings.push(`${teacher.name} should teach 3 blocks and have 1 prep block.`)
      }
    }

    for (const block of BLOCKS) {
      for (const [subject, count] of Object.entries(subjectCounts[block.id])) {
        if (count > 3) {
          warnings.push(`${subject} is offered more than 3 times in ${block.label}.`)
        }
      }
    }

    return { prepByBlock, warnings }
  }, [teachers])

  function toggleLock(teacherId, blockId) {
    setTeachers((currentTeachers) =>
      currentTeachers.map((teacher) => {
        if (teacher.id !== teacherId) return teacher

        const assignment = teacher.assignments[blockId]

        return {
          ...teacher,
          assignments: {
            ...teacher.assignments,
            [blockId]: {
              ...assignment,
              locked: !assignment.locked,
            },
          },
        }
      })
    )
  }

  function reshuffleUnlockedPreps() {
    setTeachers((currentTeachers) =>
      currentTeachers.map((teacher, index) => {
        const preferredPrepBlock = BLOCKS[index % BLOCKS.length].id
        const currentPrepBlock = BLOCKS.find(
          (block) => teacher.assignments[block.id]?.subject === "Prep"
        )?.id

        if (!currentPrepBlock || currentPrepBlock === preferredPrepBlock) {
          return teacher
        }

        const currentPrep = teacher.assignments[currentPrepBlock]
        const targetAssignment = teacher.assignments[preferredPrepBlock]

        if (currentPrep.locked || targetAssignment.locked) {
          return teacher
        }

        return {
          ...teacher,
          assignments: {
            ...teacher.assignments,
            [currentPrepBlock]: targetAssignment,
            [preferredPrepBlock]: currentPrep,
          },
        }
      })
    )
  }

  function getUnscheduledCourses(teacher) {
    const scheduledCourses = new Set(
      Object.values(teacher.assignments)
        .map((assignment) => assignment.course)
        .filter((course) => course !== "Prep")
    )

    return teacher.courses.filter((course) => !scheduledCourses.has(course))
  }

  return (
    <div style={pageStyle}>
      <div style={headerCardStyle}>
        <div>
          <h1 style={titleStyle}>Timetable Builder</h1>
          <p style={subtitleStyle}>
            Draft a Monday–Thursday semester timetable from your teacher/course spreadsheet.
          </p>
        </div>

        <button type="button" onClick={reshuffleUnlockedPreps} style={primaryButtonStyle}>
          Reshuffle Unlocked Prep Blocks
        </button>
      </div>

      <div style={rulesGridStyle}>
        <RuleCard title="Spreadsheet Loaded" text="Teacher rows and course columns now match your screenshot." />
        <RuleCard title="Semester Pattern" text="Courses stay in the same block Monday through Thursday." />
        <RuleCard title="Teacher Load" text="Each teacher teaches 3 blocks and has 1 prep block." />
        <RuleCard title="Next Step" text="Add course swapping so unscheduled courses can replace scheduled ones." />
      </div>

      <div style={statusCardStyle}>
        <h2 style={sectionTitleStyle}>Prep Balance</h2>
        <div style={prepGridStyle}>
          {BLOCKS.map((block) => (
            <div key={block.id} style={prepBoxStyle}>
              <div style={prepLabelStyle}>{block.label}</div>
              <div style={prepValueStyle}>{summary.prepByBlock[block.id]} teacher(s) on prep</div>
            </div>
          ))}
        </div>

        {summary.warnings.length > 0 ? (
          <div style={warningBoxStyle}>
            <strong>Conflicts to fix:</strong>
            <ul style={{ marginBottom: 0 }}>
              {summary.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </div>
        ) : (
          <div style={successBoxStyle}>No major timetable conflicts found in this draft.</div>
        )}
      </div>

      <div style={tableWrapStyle}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={teacherHeaderStyle}>Teacher</th>
              {BLOCKS.map((block) => (
                <th key={block.id} style={headerCellStyle}>
                  <div>{block.label}</div>
                  <div style={timeStyle}>{block.time}</div>
                </th>
              ))}
              <th style={headerCellStyle}>Unscheduled Courses</th>
            </tr>
          </thead>
          <tbody>
            {teachers.map((teacher) => (
              <tr key={teacher.id}>
                <td style={teacherCellStyle}>{teacher.name}</td>

                {BLOCKS.map((block) => {
                  const assignment = teacher.assignments[block.id]

                  return (
                    <td key={block.id} style={cellStyle}>
                      <div style={assignment?.subject === "Prep" ? prepCardStyle : courseCardStyle}>
                        <div style={courseTitleStyle}>{assignment.course}</div>
                        <div style={courseMetaStyle}>{assignment.subject}</div>

                        <button
                          type="button"
                          onClick={() => toggleLock(teacher.id, block.id)}
                          style={assignment.locked ? lockedButtonStyle : lockButtonStyle}
                        >
                          {assignment.locked ? "Locked" : "Unlocked"}
                        </button>
                      </div>
                    </td>
                  )
                })}

                <td style={cellStyle}>
                  <div style={unscheduledListStyle}>
                    {getUnscheduledCourses(teacher).map((course) => (
                      <div key={course} style={unscheduledCourseStyle}>
                        {course}
                      </div>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function RuleCard({ title, text }) {
  return (
    <div style={ruleCardStyle}>
      <h3 style={ruleTitleStyle}>{title}</h3>
      <p style={ruleTextStyle}>{text}</p>
    </div>
  )
}

const pageStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "18px",
}

const headerCardStyle = {
  background: "#ffffff",
  border: "1px solid #d7d7d7",
  borderRadius: "14px",
  padding: "20px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "16px",
  flexWrap: "wrap",
}

const titleStyle = {
  margin: 0,
  fontSize: "28px",
  color: "#111",
}

const subtitleStyle = {
  margin: "8px 0 0",
  fontSize: "16px",
  color: "#374151",
  lineHeight: 1.5,
}

const primaryButtonStyle = {
  border: "1px solid #111",
  background: "#111",
  color: "#ffffff",
  borderRadius: "10px",
  padding: "12px 16px",
  fontSize: "15px",
  fontWeight: 700,
  cursor: "pointer",
}

const rulesGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "12px",
}

const ruleCardStyle = {
  background: "#ffffff",
  border: "1px solid #d7d7d7",
  borderRadius: "14px",
  padding: "16px",
}

const ruleTitleStyle = {
  margin: "0 0 8px",
  fontSize: "16px",
  color: "#111",
}

const ruleTextStyle = {
  margin: 0,
  fontSize: "14px",
  color: "#374151",
  lineHeight: 1.45,
}

const statusCardStyle = {
  background: "#ffffff",
  border: "1px solid #d7d7d7",
  borderRadius: "14px",
  padding: "18px",
}

const sectionTitleStyle = {
  margin: "0 0 12px",
  fontSize: "20px",
  color: "#111",
}

const prepGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
  gap: "10px",
}

const prepBoxStyle = {
  border: "1px solid #d7d7d7",
  borderRadius: "12px",
  padding: "12px",
  background: "#f9fafb",
}

const prepLabelStyle = {
  fontSize: "14px",
  fontWeight: 700,
  color: "#111",
  marginBottom: "4px",
}

const prepValueStyle = {
  fontSize: "14px",
  color: "#374151",
}

const warningBoxStyle = {
  marginTop: "14px",
  border: "1px solid #9ca3af",
  borderRadius: "12px",
  padding: "12px",
  background: "#ffffff",
  color: "#111",
  fontSize: "14px",
  lineHeight: 1.5,
}

const successBoxStyle = {
  marginTop: "14px",
  border: "1px solid #9ca3af",
  borderRadius: "12px",
  padding: "12px",
  background: "#ffffff",
  color: "#111",
  fontSize: "14px",
  fontWeight: 700,
}

const tableWrapStyle = {
  background: "#ffffff",
  border: "1px solid #d7d7d7",
  borderRadius: "14px",
  overflowX: "auto",
}

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse",
  minWidth: "1200px",
}

const teacherHeaderStyle = {
  textAlign: "left",
  padding: "14px",
  borderBottom: "1px solid #d7d7d7",
  background: "#f9fafb",
  width: "170px",
}

const headerCellStyle = {
  textAlign: "left",
  padding: "14px",
  borderBottom: "1px solid #d7d7d7",
  background: "#f9fafb",
}

const timeStyle = {
  marginTop: "4px",
  fontSize: "13px",
  fontWeight: 400,
  color: "#4b5563",
}

const teacherCellStyle = {
  padding: "14px",
  borderTop: "1px solid #eeeeee",
  fontWeight: 700,
  color: "#111",
  verticalAlign: "top",
}

const cellStyle = {
  padding: "12px",
  borderTop: "1px solid #eeeeee",
  verticalAlign: "top",
}

const courseCardStyle = {
  border: "1px solid #b5b5b5",
  borderRadius: "12px",
  padding: "12px",
  background: "#ffffff",
  minHeight: "95px",
}

const prepCardStyle = {
  border: "1px dashed #777",
  borderRadius: "12px",
  padding: "12px",
  background: "#f3f4f6",
  minHeight: "95px",
}

const courseTitleStyle = {
  fontSize: "15px",
  fontWeight: 700,
  color: "#111",
  marginBottom: "6px",
}

const courseMetaStyle = {
  fontSize: "13px",
  color: "#374151",
  marginBottom: "4px",
}

const lockButtonStyle = {
  marginTop: "8px",
  border: "1px solid #9ca3af",
  background: "#ffffff",
  color: "#111",
  borderRadius: "999px",
  padding: "6px 10px",
  fontSize: "12px",
  fontWeight: 700,
  cursor: "pointer",
}

const lockedButtonStyle = {
  ...lockButtonStyle,
  border: "1px solid #111",
  background: "#111",
  color: "#ffffff",
}

const unscheduledListStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "8px",
}

const unscheduledCourseStyle = {
  border: "1px solid #d7d7d7",
  borderRadius: "10px",
  padding: "8px 10px",
  background: "#ffffff",
  fontSize: "13px",
  fontWeight: 700,
  color: "#111",
}
