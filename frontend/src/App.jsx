import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext.jsx";
import Layout from "./components/Layout.jsx";
import AdminLayout from "./components/admin/AdminLayout.jsx";
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
import HomeformAssignmentPage from "./pages/HomeformAssignmentPage.jsx";
import LessonsPage from "./pages/LessonsPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import ObserverPage from "./pages/ObserverPage.jsx";
import ParentDashboardPage from "./pages/ParentDashboardPage.jsx";
import ReportsPage from "./pages/ReportsPage.jsx";
import RubricRepositoryPage from "./pages/RubricRepositoryPage.jsx";
import StudentDashboardPage from "./pages/StudentDashboardPage.jsx";
import StudentImportPage from "./pages/StudentImportPage.jsx";
import StudentLearningPathsPage from "./pages/StudentLearningPathsPage.jsx";
import StudentProgressPage from "./pages/StudentProgressPage.jsx";
import StudentReportsPage from "./pages/StudentReportsPage.jsx";
import StudentSnapshotPage from "./pages/StudentSnapshotPage.jsx";
import TimetableBuilderPage from "./pages/TimetableBuilderPage.jsx";
import UsersPage from "./pages/UsersPage.jsx";

import AdminDashboardPage from "./pages/admin/AdminDashboardPage.jsx";
import AdminCoursesPage from "./pages/admin/CoursesPage.jsx";
import AdminCourseWorkspacePage from "./pages/admin/AdminCourseWorkspacePage.jsx";
import AdminCourseLearningPathsPage from "./pages/admin/AdminCourseLearningPathsPage.jsx";
import AdminCourseLessonsPage from "./pages/admin/AdminCourseLessonsPage.jsx";
import AdminCourseStudentsPage from "./pages/admin/AdminCourseStudentsPage.jsx";
import AdminCourseTeacherPage from "./pages/admin/AdminCourseTeacherPage.jsx";
import AdminTeachersPage from "./pages/admin/AdminTeachersPage.jsx";
import AdminStudentsPage from "./pages/admin/AdminStudentsPage.jsx";
import AdminGradebooksPage from "./pages/admin/AdminGradebooksPage.jsx";
import AdminReportsPage from "./pages/admin/AdminReportsPage.jsx";
import AdminAnalyticsPage from "./pages/admin/AdminAnalyticsPage.jsx";
import AdminSchoolSettingsPage from "./pages/admin/AdminSchoolSettingsPage.jsx";
import AdminSystemPage from "./pages/admin/AdminSystemPage.jsx";

function LoginRoute() {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) return <LoginPage />;

  if (user.role === "student") {
    return <Navigate to="/student" replace />;
  }

  if (user.role === "parent") {
    return <Navigate to="/parent" replace />;
  }

  if (user.role === "observer") {
    return <Navigate to="/observer" replace />;
  }

  if (user.role === "admin") {
    return <Navigate to="/admin" replace />;
  }

  return <Navigate to="/dashboard" replace />;
}

function TeacherProtectedLayout() {
  return (
    <ProtectedRoute allowedRoles={["teacher", "admin"]}>
      <Layout />
    </ProtectedRoute>
  );
}

function AdminProtectedLayout() {
  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <AdminLayout />
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

      <Route element={<TeacherProtectedLayout />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/users" element={<UsersPage />} />
        <Route path="/courses" element={<CoursesPage />} />
        <Route path="/course-assignments/:courseId" element={<CourseAssignmentsPage />} />
        <Route path="/lessons" element={<LessonsPage />} />
        <Route path="/assignments" element={<AssignmentsPage />} />
        <Route path="/gradebook" element={<GradebookPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/rubric-repository" element={<RubricRepositoryPage />} />
        <Route path="/timetable-builder" element={<TimetableBuilderPage />} />
        <Route path="/student-import" element={<StudentImportPage />} />
        <Route path="/homeform-assignment" element={<HomeformAssignmentPage />} />
        <Route path="/class-enrollment" element={<ClassEnrollmentPage />} />
        <Route path="/class-roster" element={<ClassRosterPage />} />
        <Route path="/enrolled-students" element={<EnrolledStudentsPage />} />
        <Route path="/attendance" element={<AttendancePage />} />
        <Route path="/student-snapshot/:courseId/:studentEmail" element={<StudentSnapshotPage />} />
      </Route>

      <Route element={<AdminProtectedLayout />}>
        <Route path="/admin" element={<AdminDashboardPage />} />
        <Route path="/admin/courses" element={<AdminCoursesPage />} />
        <Route path="/admin/users" element={<UsersPage />} />
        <Route path="/admin/teachers" element={<AdminTeachersPage />} />
        <Route path="/admin/students" element={<AdminStudentsPage />} />
        <Route path="/admin/gradebooks" element={<AdminGradebooksPage />} />
        <Route path="/admin/reports" element={<AdminReportsPage />} />
        <Route path="/admin/analytics" element={<AdminAnalyticsPage />} />
        <Route path="/admin/settings" element={<AdminSchoolSettingsPage />} />
        <Route path="/admin/system" element={<AdminSystemPage />} />
        <Route path="/admin/courses/:courseName" element={<AdminCourseWorkspacePage />} />
        <Route path="/admin/courses/:courseName/assignments" element={<CourseAssignmentsPage />} />
        <Route path="/admin/courses/:courseId/learning-paths" element={<AdminCourseLearningPathsPage />} />
        <Route path="/admin/courses/:courseId/lessons" element={<AdminCourseLessonsPage />} />
        <Route path="/admin/courses/:courseId/students" element={<AdminCourseStudentsPage />} />
        <Route path="/admin/courses/:courseId/teacher" element={<AdminCourseTeacherPage />} />
        <Route path="/admin/courses/:courseId/reports" element={<ReportsPage />} />
        <Route path="/admin/courses/:courseId/attendance" element={<AttendancePage />} />
        <Route path="/admin/courses/:courseId/analytics" element={<DashboardPage />} />
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
        path="/observer"
        element={
          <ProtectedRoute allowedRoles={["observer", "admin"]}>
            <ObserverPage />
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

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default App;
