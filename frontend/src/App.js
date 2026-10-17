import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { LayoutDashboard, UserRound, CalendarClock, FileText, Wallet, Users, Inbox } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import AppShell from "@/components/AppShell";
import Login from "@/pages/Login";
import EmpDashboard from "@/pages/employee/EmpDashboard";
import EmpProfile from "@/pages/employee/EmpProfile";
import EmpAttendance from "@/pages/employee/EmpAttendance";
import EmpRequests from "@/pages/employee/EmpRequests";
import EmpPayslips from "@/pages/employee/EmpPayslips";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminEmployees from "@/pages/admin/AdminEmployees";
import AdminEmployeeDetail from "@/pages/admin/AdminEmployeeDetail";
import AdminAttendance from "@/pages/admin/AdminAttendance";
import AdminRequests from "@/pages/admin/AdminRequests";
import AdminPayslips from "@/pages/admin/AdminPayslips";

const EMP_NAV = [
  { key: "home", to: "/employee", label: "Home", icon: LayoutDashboard, end: true },
  { key: "profile", to: "/employee/profile", label: "Profile", icon: UserRound },
  { key: "attendance", to: "/employee/attendance", label: "Attendance", icon: CalendarClock },
  { key: "requests", to: "/employee/requests", label: "Requests", icon: FileText },
  { key: "payslips", to: "/employee/payslips", label: "Payslips", icon: Wallet },
];

const ADMIN_NAV = [
  { key: "home", to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
  { key: "employees", to: "/admin/employees", label: "Employees", icon: Users },
  { key: "attendance", to: "/admin/attendance", label: "Attendance", icon: CalendarClock },
  { key: "requests", to: "/admin/requests", label: "Requests", icon: Inbox },
  { key: "payslips", to: "/admin/payslips", label: "Payslips", icon: Wallet },
];

const Loader = () => (
  <div className="min-h-screen grid place-items-center text-muted-foreground" data-testid="app-loading">Loading…</div>
);

const Guard = ({ role, children }) => {
  const { user } = useAuth();
  if (user === null) return <Loader />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== role) return <Navigate to={user.role === "admin" ? "/admin" : "/employee"} replace />;
  return children;
};

const Home = () => {
  const { user } = useAuth();
  if (user === null) return <Loader />;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === "admin" ? "/admin" : "/employee"} replace />;
};

function App() {
  return (
    <div className="App">
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/employee" element={<Guard role="employee"><AppShell nav={EMP_NAV} area="Employee Portal" /></Guard>}>
              <Route index element={<EmpDashboard />} />
              <Route path="profile" element={<EmpProfile />} />
              <Route path="attendance" element={<EmpAttendance />} />
              <Route path="requests" element={<EmpRequests />} />
              <Route path="payslips" element={<EmpPayslips />} />
            </Route>
            <Route path="/admin" element={<Guard role="admin"><AppShell nav={ADMIN_NAV} area="HR Admin" /></Guard>}>
              <Route index element={<AdminDashboard />} />
              <Route path="employees" element={<AdminEmployees />} />
              <Route path="employees/:id" element={<AdminEmployeeDetail />} />
              <Route path="attendance" element={<AdminAttendance />} />
              <Route path="requests" element={<AdminRequests />} />
              <Route path="payslips" element={<AdminPayslips />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
        <Toaster position="top-center" richColors />
      </AuthProvider>
    </div>
  );
}

export default App;
