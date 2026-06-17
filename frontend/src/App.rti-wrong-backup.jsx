import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

const API_URL = "http://localhost:5050/api/rti-cases";
const STAFF_URL = "http://localhost:5050/api/staff";
const TEMPLATE_URL = "http://localhost:5050/api/form-templates";

function App() {
  const [cases, setCases] = useState([]);
  const [staff, setStaff] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentSearch, setStudentSearch] = useState("");

  const [formData, setFormData] = useState({
    tier: "Tier 0",
    studentName: "",
    initiatingTeacher: "",
    initiatingAction: "",
    concernSummary: "",
    selectedRecipients: [],
    meetingRequired: "No",
    meetingDate: "",
    meetingTime: "",
    meetingLocation: "",
    meetingPurpose: "",
  });

  const highlightedCaseRef = useRef(null);

  useEffect(() => {
    fetchCases();
    fetchStaff();
    fetchTemplates();
  }, []);

  const fetchCases = async () => {
    const response = await fetch(API_URL);
    const data = await response.json();
    setCases(data);
  };

  const fetchStaff = async () => {
    const response = await fetch(STAFF_URL);
    const data = await response.json();
    setStaff(data);
  };

  const fetchTemplates = async () => {
    const response = await fetch(TEMPLATE_URL);
    const data = await response.json();
    setTemplates(data);
  };

  const groupedStaff = useMemo(() => {
    const groups = {};

    staff.forEach((person) => {
      const group = person.notificationGroup || "Other Staff";

      if (!groups[group]) {
        groups[group] = [];
      }

      groups[group].push(person);
    });

    return groups;
  }, [staff]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleRecipientToggle = (email) => {
    const selected = formData.selectedRecipients.includes(email);

    setFormData({
      ...formData,
      selectedRecipients: selected
        ? formData.selectedRecipients.filter((item) => item !== email)
        : [...formData.selectedRecipients, email],
    });
  };

  const selectStaffGroup = (groupMembers) => {
    const groupEmails = groupMembers.map((person) => person.email);

    setFormData({
      ...formData,
      selectedRecipients: Array.from(
        new Set([...formData.selectedRecipients, ...groupEmails])
      ),
    });
  };

  const clearStaffGroup = (groupMembers) => {
    const groupEmails = groupMembers.map((person) => person.email);

    setFormData({
      ...formData,
      selectedRecipients: formData.selectedRecipients.filter(
        (email) => !groupEmails.includes(email)
      ),
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(formData),
    });

    if (!response.ok) {
      alert("Please complete required fields.");
      return;
    }

    const data = await response.json();

    setCases([data.case, ...cases]);

    setFormData({
      tier: "Tier 0",
      studentName: "",
      initiatingTeacher: "",
      initiatingAction: "",
      concernSummary: "",
      selectedRecipients: [],
      meetingRequired: "No",
      meetingDate: "",
      meetingTime: "",
      meetingLocation: "",
      meetingPurpose: "",
    });

    alert("RTI Case Created.");
  };

  const updateCaseStatus = async (caseId, status) => {
    const response = await fetch(
      `${API_URL}/${caseId}/status`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status,
        }),
      }
    );

    if (!response.ok) {
      alert("Unable to update case status.");
      return;
    }

    const data = await response.json();

    setCases((currentCases) =>
      currentCases.map((item) =>
        item.id === data.case.id ? data.case : item
      )
    );

    alert(`Case status updated to ${status}.`);
  };

  const getStudentSummaries = () => {
    const grouped = {};

    cases.forEach((item) => {
      const name = item.studentName || "Unnamed Student";

      if (!grouped[name]) {
        grouped[name] = {
          studentName: name,
          totalCases: 0,
          openCases: 0,
          highestTier: item.tier || "Tier 0",
          lastUpdate: item.createdAt,
        };
      }

      grouped[name].totalCases += 1;

      if (
        item.status === "Open" ||
        item.status === "Monitoring" ||
        item.status === "Escalated"
      ) {
        grouped[name].openCases += 1;
      }

      const currentTierNumber = Number(
        String(grouped[name].highestTier).replace("Tier ", "")
      );

      const newTierNumber = Number(
        String(item.tier).replace("Tier ", "")
      );

      if (newTierNumber > currentTierNumber) {
        grouped[name].highestTier = item.tier;
      }

      if (
        new Date(item.createdAt) >
        new Date(grouped[name].lastUpdate)
      ) {
        grouped[name].lastUpdate = item.createdAt;
      }
    });

    return Object.values(grouped);
  };

  const studentSummaries = getStudentSummaries();

  const filteredStudentSummaries = studentSummaries.filter(
    (student) =>
      student.studentName
        .toLowerCase()
        .includes(studentSearch.toLowerCase())
  );

  const selectedStudentCases = cases.filter(
    (item) => item.studentName === selectedStudent
  );

  return (
    <div className="app-container">
      <h1>CBC RTI / Care & Concern System</h1>

      <div className="form-card">
        <h2>Create RTI / Care & Concern Record</h2>

        <form onSubmit={handleSubmit}>
          <label>RTI Tier</label>

          <select
            name="tier"
            value={formData.tier}
            onChange={handleChange}
          >
            <option>Tier 0</option>
            <option>Tier 1</option>
            <option>Tier 2</option>
            <option>Tier 3</option>
            <option>Tier 4</option>
          </select>

          <label>Student Name</label>

          <input
            name="studentName"
            value={formData.studentName}
            onChange={handleChange}
            placeholder="Enter student name"
          />

          <label>Initiating Teacher</label>

          <input
            name="initiatingTeacher"
            value={formData.initiatingTeacher}
            onChange={handleChange}
          />

          <label>Initiating Action / Concern</label>

          <input
            name="initiatingAction"
            value={formData.initiatingAction}
            onChange={handleChange}
          />

          <label>Concern Summary</label>

          <textarea
            rows="5"
            name="concernSummary"
            value={formData.concernSummary}
            onChange={handleChange}
          />

          <div className="section-box">
            <h3>Meeting / Calendar Information</h3>

            <label>Meeting Required?</label>

            <select
              name="meetingRequired"
              value={formData.meetingRequired}
              onChange={handleChange}
            >
              <option>No</option>
              <option>Yes</option>
            </select>

            {formData.meetingRequired === "Yes" && (
              <>
                <label>Meeting Date</label>

                <input
                  type="date"
                  name="meetingDate"
                  value={formData.meetingDate}
                  onChange={handleChange}
                />

                <label>Meeting Time</label>

                <input
                  type="time"
                  name="meetingTime"
                  value={formData.meetingTime}
                  onChange={handleChange}
                />

                <label>Meeting Location / Link</label>

                <input
                  name="meetingLocation"
                  value={formData.meetingLocation}
                  onChange={handleChange}
                />

                <label>Meeting Purpose</label>

                <textarea
                  rows="3"
                  name="meetingPurpose"
                  value={formData.meetingPurpose}
                  onChange={handleChange}
                />
              </>
            )}
          </div>

          <div className="section-box">
            <h3>Notify Staff</h3>

            {Object.entries(groupedStaff).map(
              ([groupName, groupMembers]) => (
                <div
                  key={groupName}
                  className="staff-group-card"
                >
                  <div className="staff-group-header">
                    <div>
                      <h4>{groupName}</h4>
                    </div>

                    <div className="staff-group-actions">
                      <button
                        type="button"
                        className="small-button"
                        onClick={() =>
                          selectStaffGroup(groupMembers)
                        }
                      >
                        Select Group
                      </button>

                      <button
                        type="button"
                        className="small-button secondary-button"
                        onClick={() =>
                          clearStaffGroup(groupMembers)
                        }
                      >
                        Clear Group
                      </button>
                    </div>
                  </div>

                  <div className="recipient-box">
                    {groupMembers.map((person) => (
                      <label
                        key={person.email}
                        className="recipient-item"
                      >
                        <input
                          type="checkbox"
                          checked={formData.selectedRecipients.includes(
                            person.email
                          )}
                          onChange={() =>
                            handleRecipientToggle(person.email)
                          }
                        />

                        <span>
                          <strong>{person.name}</strong> (
                          {person.email})
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )
            )}
          </div>

          <button type="submit">
            Create RTI Record and Send Notices
          </button>
        </form>
      </div>

      <div className="student-table-card">
        <h2>Student RTI Dashboard</h2>

        <input
          value={studentSearch}
          onChange={(e) => setStudentSearch(e.target.value)}
          placeholder="Search student files"
        />

        <table className="student-table">
          <thead>
            <tr>
              <th>Student</th>
              <th>Total RTIs</th>
              <th>Open Cases</th>
              <th>Highest Tier</th>
              <th>Last Update</th>
              <th>Action</th>
            </tr>
          </thead>

          <tbody>
            {filteredStudentSummaries.map((student) => (
              <tr key={student.studentName}>
                <td>{student.studentName}</td>
                <td>{student.totalCases}</td>
                <td>{student.openCases}</td>
                <td>{student.highestTier}</td>
                <td>
                  {new Date(
                    student.lastUpdate
                  ).toLocaleDateString()}
                </td>

                <td>
                  <button
                    className="small-button"
                    onClick={() =>
                      setSelectedStudent(student.studentName)
                    }
                  >
                    Open Student File
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedStudent && (
        <div className="student-file">
          <div className="student-file-header">
            <div>
              <h2>{selectedStudent} Student File</h2>

              <p>
                Showing {selectedStudentCases.length} RTI
                record(s).
              </p>
            </div>

            <button
              className="secondary-button"
              onClick={() => setSelectedStudent(null)}
            >
              Back to Student List
            </button>
          </div>

          {selectedStudentCases.map((item) => (
            <div
              key={item.id}
              className="case-card"
              ref={highlightedCaseRef}
            >
              <h3>
                {item.studentName} — {item.tier}
              </h3>

              <div className="case-summary-grid">
                <div>
                  <strong>Teacher</strong>
                  <p>{item.initiatingTeacher}</p>
                </div>

                <div>
                  <strong>Concern</strong>
                  <p>{item.initiatingAction}</p>
                </div>

                <div>
                  <strong>Status</strong>

                  <select
                    value={item.status || "Open"}
                    onChange={(e) =>
                      updateCaseStatus(
                        item.id,
                        e.target.value
                      )
                    }
                  >
                    <option>Open</option>
                    <option>Monitoring</option>
                    <option>Escalated</option>
                    <option>Resolved</option>
                    <option>Closed</option>
                  </select>
                </div>

                <div>
                  <strong>Created</strong>

                  <p>
                    {new Date(
                      item.createdAt
                    ).toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="summary-box">
                <strong>Concern Summary</strong>

                <p>{item.concernSummary}</p>
              </div>

              {item.notificationResponses?.length > 0 && (
                <div className="section-box">
                  <h3>Notification Responses</h3>

                  {item.notificationResponses.map(
                    (notice) => (
                      <div
                        key={notice.email}
                        className="notification-card"
                      >
                        <p>
                          <strong>Email:</strong>{" "}
                          {notice.email}
                        </p>

                        <p>
                          <strong>Status:</strong>{" "}
                          {notice.status}
                        </p>

                        {notice.comment && (
                          <p>
                            <strong>Comment:</strong>{" "}
                            {notice.comment}
                          </p>
                        )}
                      </div>
                    )
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default App;