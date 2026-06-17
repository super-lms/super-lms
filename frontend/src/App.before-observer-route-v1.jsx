import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext.jsx";
import Layout from "./components/Layout.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";

import AssignmentsPage from "./pages/AssignmentsPage.jsx";
import AssignmentSpeedGradingPage from "./pages/AssignmentSpeedGradingPage.jsx";
import AttendancePage from "./pages/AttendancePage.jsx";
import ClassEnrollmentPage from "./pages/ClassEnrollmentPage.jsx";
import ClassRosterPage from "./pages/ClassRosterPage.jsx";
import CoursesPage from "./pages/CoursesPage.jsx";
import CourseAssignmentsPage from "./pages/CourseAssignmentsPage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import EditAssignmentPage from "./pages/EditAssignmentPage.jsx";
import EnrolledStudentsPage from "./pages/EnrolledStudentsPage.jsx";
import GradebookPage from "./pages/GradebookPage.jsx";
import LessonsPage from "./pages/LessonsPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import ParentDashboardPage from "./pages/ParentDashboardPage.jsx";
import ReportsPage from "./pages/ReportsPage.jsx";
import StudentDashboardPage from "./pages/StudentDashboardPage.jsx";
import StudentLearningPathsPage from "./pages/StudentLearningPathsPage.jsx";
import StudentProgressPage from "./pages/StudentProgressPage.jsx";
import StudentReportsPage from "./pages/StudentReportsPage.jsx";
import StudentSnapshotPage from "./pages/StudentSnapshotPage.jsx";
import TimetableBuilderPage from "./pages/TimetableBuilderPage.jsx";
import UsersPage from "./pages/UsersPage.jsx";

/* FIXED LOGIN ROUTE */
function LoginRoute() {
  const { user } = useAuth();
  const location = useLocation();

  // If not logged in → show login
  if (!user) return <LoginPage />;

  // If already logged in → go where they intended OR stay put
  if (user.role === "student") {
    return <Navigate to="/student" replace />;
  }

  if (user.role === "parent") {
    return <Navigate to="/parent" replace />;
  }

  return <Navigate to="/dashboard" replace />;
}

function ProtectedAppLayout() {
  return (
    <ProtectedRoute allowedRoles={["teacher", "admin"]}>
      <Layout />
    </ProtectedRoute>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginRoute />} />

      <Route
        path="/assignments/:assignmentId/grade"
        element={
          <ProtectedRoute allowedRoles={["teacher", "admin"]}>
            <AssignmentSpeedGradingPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/assignments/:assignmentId/edit"
        element={
          <ProtectedRoute allowedRoles={["teacher", "admin"]}>
            <EditAssignmentPage />
          </ProtectedRoute>
        }
      />

      <Route element={<ProtectedAppLayout />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/users" element={<UsersPage />} />
        <Route path="/courses" element={<CoursesPage />} />
        <Route path="/course-assignments/:courseId" element={<CourseAssignmentsPage />} />
        <Route path="/lessons" element={<LessonsPage />} />
        <Route path="/assignments" element={<AssignmentsPage />} />
        <Route path="/gradebook" element={<GradebookPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/timetable-builder" element={<TimetableBuilderPage />} />
        <Route path="/class-enrollment" element={<ClassEnrollmentPage />} />
        <Route path="/class-roster" element={<ClassRosterPage />} />
        <Route path="/enrolled-students" element={<EnrolledStudentsPage />} />
        <Route path="/attendance" element={<AttendancePage />} />
        <Route path="/student-snapshot/:courseId/:studentEmail" element={<StudentSnapshotPage />} />
      </Route>

      <Route
        path="/student"
        element={
          <ProtectedRoute allowedRoles={["student"]}>
            <StudentDashboardPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/parent"
        element={
          <ProtectedRoute allowedRoles={["parent"]}>
            <ParentDashboardPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/student-progress"
        element={
          <ProtectedRoute allowedRoles={["student"]}>
            <StudentProgressPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/student-learning-paths"
        element={
          <ProtectedRoute allowedRoles={["student"]}>
            <StudentLearningPathsPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/student-reports"
        element={
          <ProtectedRoute allowedRoles={["student"]}>
            <StudentReportsPage />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default App;
