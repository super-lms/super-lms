import { Link, Outlet, useLocation } from "react-router-dom"
import { useAuth } from "../../AuthContext.jsx"
import {
  LayoutDashboard,
  Users,
  BookOpen,
  FileText,
  ClipboardList,
  BarChart3,
  UserCheck,
  Building2,
  Settings,
  LogOut,
  School,
} from "lucide-react"

export default function AdminLayout() {
  const location = useLocation()
  const { user, logout } = useAuth()

  function getNavLinkStyle(path) {
    const isActive =
      location.pathname === path || location.pathname.startsWith(`${path}/`)

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
    if (location.pathname === "/admin") return "Administrator Dashboard"
    if (location.pathname === "/admin/courses") return "School Courses"
    if (location.pathname === "/admin/teachers") return "Teachers"
    if (location.pathname === "/admin/students") return "Students"
    if (location.pathname === "/admin/departments") return "Departments"
    if (location.pathname === "/admin/gradebooks") return "School Gradebooks"
    if (location.pathname === "/admin/reports") return "School Reports"
    if (location.pathname === "/admin/analytics") return "Analytics"
    if (location.pathname === "/admin/settings") return "School Settings"
    if (location.pathname === "/admin/system") return "System Administration"

    return "Administrator Workspace"
  }

  function getUserDisplayName() {
    const fullName = String(user?.name || "").trim()
    if (fullName) return fullName

    const email = String(user?.email || "").trim()
    if (email) return email

    return "Administrator"
  }

  const workspaceTitle = getWorkspaceTitle()
  const userDisplayName = getUserDisplayName()

  return (
    <div style={{ display: "flex", minHeight: "100vh", fontFamily: "Arial, sans-serif" }}>
      <div
        style={{
          width: "280px",
          background: "white",
          color: "#111",
          padding: "24px",
          boxSizing: "border-box",
          borderRight: "1px solid #d7d7d7",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <h2 style={{ marginTop: 0, marginBottom: "10px", fontSize: "24px" }}>
          Admin Portal
        </h2>

        <div
          style={{
            fontSize: "13px",
            color: "#6b7280",
            lineHeight: 1.4,
            marginBottom: "28px",
          }}
        >
          School-wide LMS control centre
        </div>

        <nav style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <NavItem to="/admin" style={getNavLinkStyle("/admin")} icon={LayoutDashboard}>
            Dashboard
          </NavItem>

          <div style={sectionDividerStyle} />

          <NavItem to="/admin/courses" style={getNavLinkStyle("/admin/courses")} icon={BookOpen}>
            Courses
          </NavItem>
          <NavItem to="/admin/teachers" style={getNavLinkStyle("/admin/teachers")} icon={UserCheck}>
            Teachers
          </NavItem>
          <NavItem to="/admin/students" style={getNavLinkStyle("/admin/students")} icon={Users}>
            Students
          </NavItem>
          <NavItem to="/admin/departments" style={getNavLinkStyle("/admin/departments")} icon={Building2}>
            Departments
          </NavItem>

          <div style={sectionDividerStyle} />

          <NavItem to="/admin/gradebooks" style={getNavLinkStyle("/admin/gradebooks")} icon={ClipboardList}>
            Gradebooks
          </NavItem>
          <NavItem to="/admin/reports" style={getNavLinkStyle("/admin/reports")} icon={FileText}>
            Reports
          </NavItem>
          <NavItem to="/admin/analytics" style={getNavLinkStyle("/admin/analytics")} icon={BarChart3}>
            Analytics
          </NavItem>

          <div style={sectionDividerStyle} />

          <NavItem to="/admin/settings" style={getNavLinkStyle("/admin/settings")} icon={School}>
            School Settings
          </NavItem>
          <NavItem to="/admin/system" style={getNavLinkStyle("/admin/system")} icon={Settings}>
            System Admin
          </NavItem>

          <div style={sectionDividerStyle} />

          <Link to="/dashboard" style={secondaryLinkStyle}>
            Teacher Workspace
          </Link>

          <button type="button" onClick={logout} style={logoutButtonStyle} title="Logout">
            <LogOut size={18} />
            <span>Logout</span>
          </button>
        </nav>
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
              Administrator Workspace
            </div>

            <div
              style={{
                fontSize: "22px",
                fontWeight: "700",
                color: "#111827",
              }}
            >
              {workspaceTitle}
            </div>
          </div>

          <div
            style={{
              textAlign: "right",
              fontSize: "14px",
              color: "#374151",
              lineHeight: 1.5,
            }}
          >
            <div style={{ fontWeight: 700 }}>{userDisplayName}</div>
            <div>Administrator</div>
          </div>
        </div>

        <main style={{ padding: "24px" }}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function NavItem({ to, style, icon: Icon, children }) {
  return (
    <Link to={to} style={style}>
      <Icon size={18} />
      <span>{children}</span>
    </Link>
  )
}

const sectionDividerStyle = {
  borderTop: "1px solid #e5e7eb",
  marginTop: "6px",
  paddingTop: "6px",
}

const secondaryLinkStyle = {
  color: "#111",
  textDecoration: "none",
  fontSize: "15px",
  display: "flex",
  alignItems: "center",
  gap: "10px",
  padding: "10px 12px",
  borderRadius: "10px",
  border: "1px solid #d7d7d7",
  background: "#fafafa",
  fontWeight: 700,
}

const logoutButtonStyle = {
  color: "#111",
  background: "#ffffff",
  border: "1px solid transparent",
  fontSize: "16px",
  display: "flex",
  alignItems: "center",
  gap: "10px",
  padding: "10px 12px",
  borderRadius: "10px",
  cursor: "pointer",
  textAlign: "left",
}
