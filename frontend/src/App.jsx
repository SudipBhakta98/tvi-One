
import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./modules/auth/contexts/AuthContext";
import AppLayout from "./layout/AppLayout";
import { ROLES } from "./constants/roles";

const LoginPage = lazy(() => import("./modules/auth/pages/LoginPage"));
const DashboardPage = lazy(
  () => import("./modules/dashboard/pages/DashboardPage"),
);
const RfqPage = lazy(() => import("./modules/rfq/pages/RfqPage"));
const RfqProvider = lazy(() =>
  import("./modules/rfq/contexts/RfqContext").then((m) => ({
    default: m.RfqProvider,
  })),
);
const ProjectsPage = lazy(
  () => import("./modules/projects/pages/ProjectsPage"),
);
const ProjectsProvider = lazy(() =>
  import("./modules/projects/contexts/ProjectsContext").then((m) => ({
    default: m.ProjectsProvider,
  })),
);
const PurchasePage = lazy(
  () => import("./modules/purchase/pages/PurchasePage"),
);
const PurchaseProvider = lazy(() =>
  import("./modules/purchase/contexts/PurchaseContext").then((m) => ({
    default: m.PurchaseProvider,
  })),
);
const ProductionPage = lazy(
  () => import("./modules/production/pages/ProductionPage"),
);
const ProductionProvider = lazy(() =>
  import("./modules/production/contexts/ProductionContext").then((m) => ({
    default: m.ProductionProvider,
  })),
);
const WarehousePage = lazy(
  () => import("./modules/warehouse/pages/WarehousePage"),
);
const WarehouseProvider = lazy(() =>
  import("./modules/warehouse/contexts/WarehouseContext").then((m) => ({
    default: m.WarehouseProvider,
  })),
);
const AttendancePage = lazy(
  () => import("./modules/attendance/pages/AttendancePage"),
);
const AttendanceProvider = lazy(() =>
  import("./modules/attendance/contexts/AttendanceContext").then((m) => ({
    default: m.AttendanceProvider,
  })),
);
const DispatchPage = lazy(
  () => import("./modules/dispatch/pages/DispatchPage"),
);
const DispatchProvider = lazy(() =>
  import("./modules/dispatch/contexts/DispatchContext").then((m) => ({
    default: m.DispatchProvider,
  })),
);
const AdminPage = lazy(
  () => import("./modules/admin/pages/AdminUserManagementPage"),
);
const AdminProvider = lazy(() =>
  import("./modules/admin/contexts/AdminContext").then((m) => ({
    default: m.AdminProvider,
  })),
);
const PayablesProvider = lazy(() =>
  import("./modules/finance/contexts/PayableContext").then((m) => ({
    default: m.PayablesProvider,
  })),
);
const ReceivablesProvider = lazy(() =>
  import("./modules/finance/contexts/ReceivableContext").then((m) => ({
    default: m.ReceivablesProvider,
  })),
);
const AccountPage = lazy(() => import("./modules/settings/pages/AccountPage"));
const ReportsPage = lazy(() => import("./modules/reports/pages/ReportsPage"));
const PayablesPage = lazy(() => import("./modules/finance/pages/PayablesPage"));
const PaymentsPage = lazy(
  () => import("./modules/finance/pages/PaymentsPage"),
);
const CreditPage = lazy(() => import("./modules/finance/pages/CreditPage"));
const AdvancePaymentPage = lazy(
  () => import("./modules/finance/pages/AdvancePaymentPage"),
);
const ReceivablesPage = lazy(
  () => import("./modules/finance/pages/ReceivablesPage"),
);
const CollectionPage = lazy(
  () => import("./modules/finance/pages/CollectionPage"),
);

const ModuleRoute = ({ Provider, Page }) => (
  <Provider>
    <Page />
  </Provider>
);
const Loading = () => (
  <div className="p-2.5 text-xs text-slate-500">Loading...</div>
);

export default function App() {
  const { user } = useAuth();
  return (
    <Suspense fallback={<Loading />}>
      {!user ? (
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      ) : (
        <Routes>
          <Route element={<AppLayout user={user} />}>
            <Route path="/" element={<DashboardPage />} />
            <Route
              path="/rfq"
              element={<ModuleRoute Provider={RfqProvider} Page={RfqPage} />}
            />
            <Route
              path="/projects"
              element={
                <ModuleRoute Provider={ProjectsProvider} Page={ProjectsPage} />
              }
            />
            <Route
              path="/purchase"
              element={
                <ModuleRoute Provider={PurchaseProvider} Page={PurchasePage} />
              }
            />
            <Route
              path="/production"
              element={
                <ModuleRoute
                  Provider={ProductionProvider}
                  Page={ProductionPage}
                />
              }
            />
            <Route
              path="/warehouse"
              element={
                <ModuleRoute
                  Provider={WarehouseProvider}
                  Page={WarehousePage}
                />
              }
            />
            <Route
              path="/dispatch"
              element={
                <ModuleRoute Provider={DispatchProvider} Page={DispatchPage} />
              }
            />
            <Route
              path="/attendance"
              element={
                <ModuleRoute
                  Provider={AttendanceProvider}
                  Page={AttendancePage}
                />
              }
            />
            <Route path="/account" element={<AccountPage />} />
            <Route path="/reports" element={<ReportsPage />} />

            <Route
              path="/finance/payables"
              element={
                <ModuleRoute Provider={PayablesProvider} Page={PayablesPage} />
              }
            />

            <Route
              path="/finance/payments"
              element={<PaymentsPage />}
            />

            <Route
              path="/finance/receivables"
              element={
                <ModuleRoute
                  Provider={ReceivablesProvider}
                  Page={ReceivablesPage}
                />
              }
            />

            {/* Collection is visible to the Finance team. Only Super User can update status inside CollectionPage. */}
            <Route
              path="/finance/collection"
              element={<CollectionPage />}
            />

            {/* Redirect old approval URL to the new Collection page for all users. */}
            <Route
              path="/finance/receivables/approve"
              element={
                <Navigate to="/finance/collection" replace />
              }
            />

            <Route path="/finance/advances" element={<AdvancePaymentPage />} />
            <Route path="/finance/credits" element={<CreditPage />} />

            {user.role === ROLES.ADMIN && (
              <Route
                path="/admin"
                element={
                  <ModuleRoute Provider={AdminProvider} Page={AdminPage} />
                }
              />
            )}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      )}
    </Suspense>
  );
}
