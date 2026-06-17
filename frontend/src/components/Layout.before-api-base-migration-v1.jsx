import { Link, Outlet, useLocation } from "react-router-dom"
import { useEffect, useMemo, useState } from "react"
import { useAuth } from "../AuthContext.jsx"
import {
  LayoutDashboard,
  Users,
  BookOpen,
  FileText,
  ClipboardList,
  BarChart3,
  UserCheck,
  UserPlus,
  CalendarCheck,
  LogOut,
} from "lucide-react"

export default function Layout() {
  const location = useLocation()
  const { user, logout } = useAuth()

  const [teacherCourses, setTeacherCourses] = useState([])

  const isStudentRoute = location.pathname.startsWith("/student")

  useEffect(() => {
    if (isStudentRoute) {
      setTeacherCourses([])
      return
    }

    const normalizedRole = String(user?.role || "").trim().toLowerCase()
    const teacherId = user?.id

    if (!teacherId || (normalizedRole !== "teacher" && normalizedRole !== "admin")) {
      setTeacherCourses([])
      return
    }

    let isCancelled = false

    async function loadTeacherCourses() {
      try {
        const response = await fetch(`http://localhost:3000/api/teachers/${teacherId}/dashboard`)

        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`)
        }

        const data = await response.json()
        const safeCourses = Array.isArray(data?.courses) ? data.courses : []

        if (!isCancelled) {
          setTeacherCourses(safeCourses)
        }
      } catch (error) {
        if (!isCancelled) {
          setTeacherCourses([])
        }
      }
    }

    loadTeacherCourses()

    return () => {
      isCancelled = true
    }
  }, [user?.id, user?.role, isStudentRoute])

  const primaryGradebookPath = useMemo(() => {
    if (teacherCourses.length === 0) {
      return "/gradebook"
    }

    const primaryCourseId = teacherCourses[0]?.id

    if (!primaryCourseId) {
      return "/gradebook"
    }

    return `/gradebook?classId=${primaryCourseId}`
  }, [teacherCourses])

  function getNavLinkStyle(path) {
    const isActive =
      path === "/student"
        ? location.pathname === "/student"
        : location.pathname === path || location.pathname.startsWith(`${path}/`)

    return {
      color: "#111",
      textDecoration: "none",
      fontSize: "16px",
      display: "flex",
      alignItems: "center",
      gap: "10px",
      padding: "10px 12px",
      borderRadius: "10px",
      border: isActive ? "1px solid #d7d7d7" : "1px solid transparent",
      background: isActive ? "#f3f4f6" : "#ffffff",
      fontWeight: isActive ? 700 : 400,
      transition: "background 0.15s ease, border-color 0.15s ease",
    }
  }

  function getWorkspaceTitle() {
    if (location.pathname === "/dashboard") return "Dashboard"
    if (location.pathname === "/users") return "Users"
    if (location.pathname === "/courses") return "Courses"
    if (location.pathname === "/lessons") return "Lessons"
    if (location.pathname === "/assignments") return "Assignments"
    if (location.pathname.startsWith("/assignments/") && location.pathname.endsWith("/edit")) {
      return "Edit Assignment"
    }
    if (location.pathname.startsWith("/assignments/") && location.pathname.endsWith("/grade")) {
      return "Speed Grading"
    }
    if (location.pathname === "/gradebook") return "Gradebook"
    if (location.pathname === "/reports") return "Reports"
    if (location.pathname === "/class-enrollment") return "Class Enrollment"
    if (location.pathname === "/class-roster") return "Class Roster"
    if (location.pathname === "/enrolled-students") return "Enrolled Students"
    if (location.pathname === "/attendance") return "Attendance"

    if (location.pathname === "/student") return "My Learning"
    if (location.pathname === "/student-progress") return "My Progress"
    if (location.pathname === "/student-reports") return "My Reports"

    return isStudentRoute ? "Student Learning Environment" : "Teacher / Admin Workspace"
  }

  function getWorkspaceSubtitle() {
    if (isStudentRoute) {
      return "Clear navigation for learning, progress, and reports."
    }

    return "You are here:"
  }

  function getUserDisplayName() {
    const fullName = String(user?.name || "").trim()
    if (fullName) {
      return fullName
    }

    const email = String(user?.email || "").trim()
    if (email) {
      return email
    }

    return "Current User"
  }

  function getRoleDisplayName() {
    const rawRole = String(user?.role || "").trim().toLowerCase()

    if (rawRole === "admin") return "Admin"
    if (rawRole === "teacher") return "Teacher"
    if (rawRole === "student") return "Student"
    if (rawRole === "observer") return "Observer"

    return isStudentRoute ? "Student" : "Teacher"
  }

  const workspaceTitle = getWorkspaceTitle()
  const workspaceSubtitle = getWorkspaceSubtitle()
  const userDisplayName = getUserDisplayName()
  const roleDisplayName = getRoleDisplayName()

  return (
    <div style={{ display: "flex", minHeight: "100vh", fontFamily: "Arial, sans-serif" }}>
      <div
        style={{
          width: "260px",
          background: "white",
          color: "#111",
          padding: "24px",
          boxSizing: "border-box",
          borderRight: "1px solid #d7d7d7",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <h2 style={{ marginTop: 0, marginBottom: "40px", fontSize: "24px" }}>
          {isStudentRoute ? "Student Portal" : "Teacher / Admin Portal"}
        </h2>

        {!isStudentRoute && (
          <nav style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <NavItem to="/dashboard" style={getNavLinkStyle("/dashboard")} icon={LayoutDashboard}>
              Dashboard
            </NavItem>
            <NavItem to="/users" style={getNavLinkStyle("/users")} icon={Users}>
              Users
            </NavItem>
            <NavItem to="/courses" style={getNavLinkStyle("/courses")} icon={BookOpen}>
              Courses
            </NavItem>
            <NavItem to="/lessons" style={getNavLinkStyle("/lessons")} icon={FileText}>
              Lessons
            </NavItem>
            <NavItem to="/assignments" style={getNavLinkStyle("/assignments")} icon={ClipboardList}>
              Assignments
            </NavItem>
            <NavItem to={primaryGradebookPath} style={getNavLinkStyle("/gradebook")} icon={BarChart3}>
              Gradebook
            </NavItem>
            <NavItem to="/reports" style={getNavLinkStyle("/reports")} icon={BarChart3}>
              Reports
            </NavItem>
            <NavItem to="/class-enrollment" style={getNavLinkStyle("/class-enrollment")} icon={UserPlus}>
              Class Enrollment
            </NavItem>
            <NavItem to="/class-roster" style={getNavLinkStyle("/class-roster")} icon={UserCheck}>
              Class Roster
            </NavItem>
            <NavItem to="/enrolled-students" style={getNavLinkStyle("/enrolled-students")} icon={Users}>
              Enrolled Students
            </NavItem>
            <NavItem to="/attendance" style={getNavLinkStyle("/attendance")} icon={CalendarCheck}>
              Attendance
            </NavItem>

            <div
              style={{
                borderTop: "1px solid #e5e7eb",
                marginTop: "12px",
                paddingTop: "12px",
              }}
            />

            <button
              type="button"
              onClick={logout}
              style={logoutButtonStyle}
              title="Logout"
            >
              <LogOut size={18} />
              <span>Logout</span>
            </button>
          </nav>
        )}

        {isStudentRoute && (
          <nav style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <NavItem to="/student" style={getNavLinkStyle("/student")} icon={BookOpen}>
              My Learning
            </NavItem>
            <NavItem to="/student-progress" style={getNavLinkStyle("/student-progress")} icon={BarChart3}>
              My Progress
            </NavItem>
            <NavItem to="/student-reports" style={getNavLinkStyle("/student-reports")} icon={FileText}>
              My Reports
            </NavItem>

            <div
              style={{
                borderTop: "1px solid #e5e7eb",
                marginTop: "12px",
                paddingTop: "12px",
              }}
            />

            <button
              type="button"
              onClick={logout}
              style={logoutButtonStyle}
              title="Logout"
            >
              <LogOut size={18} />
              <span>Logout</span>
            </button>
          </nav>
        )}
      </div>

      <div style={{ flex: 1, background: "#f7f7f7" }}>
        <div
          style={{
            background: "white",
            padding: "24px",
            borderBottom: "1px solid #d7d7d7",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "16px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <div
              style={{
                fontSize: "14px",
                fontWeight: "600",
                color: "#6b7280",
                marginBottom: "6px",
              }}
            >
              {workspaceSubtitle}
            </div>

            <div
              style={{
                fontSize: "22px",
                fontWeight: "700",
                color: "#111",
              }}
            >
              {workspaceTitle}
            </div>
          </div>

          <div
            style={{
              minWidth: "220px",
              border: "1px solid #d7d7d7",
              borderRadius: "12px",
              padding: "12px 14px",
              background: "#ffffff",
            }}
          >
            <div
              style={{
                fontSize: "13px",
                fontWeight: "600",
                color: "#6b7280",
                marginBottom: "6px",
              }}
            >
              Signed in as
            </div>

            <div
              style={{
                fontSize: "16px",
                fontWeight: "700",
                color: "#111",
                marginBottom: "6px",
                wordBreak: "break-word",
              }}
            >
              {userDisplayName}
            </div>

            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                border: "1px solid #d7d7d7",
                borderRadius: "999px",
                padding: "4px 10px",
                fontSize: "13px",
                fontWeight: "600",
                background: "#f9fafb",
              }}
            >
              {roleDisplayName}
            </div>
          </div>
        </div>

        <div style={{ padding: "24px" }}>
          <Outlet />
        </div>
      </div>
    </div>
  )
}

function NavItem({ to, style, icon: Icon, children }) {
  return (
    <Link to={to} title={typeof children === "string" ? children : ""} style={style}>
      <Icon size={18} />
      <span>{children}</span>
    </Link>
  )
}

const logoutButtonStyle = {
  color: "#111",
  fontSize: "16px",
  background: "#ffffff",
  border: "1px solid transparent",
  borderRadius: "10px",
  padding: "10px 12px",
  margin: 0,
  textAlign: "left",
  cursor: "pointer",
  font: "inherit",
  transition: "background 0.15s ease, border-color 0.15s ease",
  display: "flex",
  alignItems: "center",
  gap: "10px",
  width: "100%",
}