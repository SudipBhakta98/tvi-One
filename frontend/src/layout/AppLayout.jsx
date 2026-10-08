import { useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  FileText,
  FolderKanban,
  ShoppingCart,
  Factory,
  Warehouse,
  Truck,
  Wallet,
  Users,
  LogOut,
  ChevronDown,
  Settings2,
  BarChart3,
} from "lucide-react";
import { useAuth } from "../modules/auth/contexts/AuthContext";
import { ROLES, ROLE_LABELS, ALL_ROLES } from "../constants/roles";
import { RECEIVABLE_APPROVER_ROLES } from "../modules/finance/constants/financeRoles";

const canSee = (role, allowed) =>
  role === ROLES.ADMIN || role === ROLES.SUPER_USER || allowed.includes(role);
const rowItem =
  "flex items-center justify-between w-full px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-900 rounded-md transition-colors";

const groups = [
  { label: "Dashboard", icon: LayoutDashboard, to: "/", end: true },
  {
    label: "RFQ & NPD",
    icon: FileText,
    path: "/rfq",
    allowed: [ROLES.NPD_MANAGER, ROLES.NPD_USER],
    children: [
      { label: "RFQ Register", to: "/rfq" },
      { label: "Create RFQ", to: "/rfq?create=1", create: true },
    ],
  },
  {
    label: "Projects",
    icon: FolderKanban,
    path: "/projects",
    allowed: ALL_ROLES,
    children: [{ label: "Project Register", to: "/projects" }],
  },
  {
    label: "Purchase",
    icon: ShoppingCart,
    path: "/purchase",
    allowed: [ROLES.SCM_MANAGER, ROLES.SCM_USER],
    children: [
      { label: "Purchase Orders", to: "/purchase" },
      {
        label: "Create Purchase Order",
        to: "/purchase?create=1",
        create: true,
      },
    ],
  },
  {
    label: "Production",
    icon: Factory,
    path: "/production",
    allowed: [ROLES.PRODUCTION_MANAGER, ROLES.PRODUCTION_USER],
    children: [
      { label: "Production Register", to: "/production" },
      { label: "Record Production", to: "/production?create=1", create: true },
    ],
  },
  {
    label: "Warehouse",
    icon: Warehouse,
    path: "/warehouse",
    allowed: [ROLES.WAREHOUSE_MANAGER, ROLES.WAREHOUSE_USER],
    children: [
      { label: "GRN & Inspection", to: "/warehouse" },
      { label: "Create GRN", to: "/warehouse?create=1", create: true },
    ],
  },
  {
    label: "Dispatch",
    icon: Truck,
    path: "/dispatch",
    allowed: [ROLES.DISPATCH_MANAGER, ROLES.DISPATCH_USER],
    children: [
      { label: "Dispatch Register", to: "/dispatch" },
      { label: "Create Dispatch", to: "/dispatch?create=1", create: true },
    ],
  },
 {
  label: "Finance",
  icon: Wallet,
  path: "/finance",
  allowed: [ROLES.FINANCE_MANAGER, ROLES.FINANCE_USER],
  children: [
    {
      label: "Payables",
      to: "/finance/payables",
      children: [
        {
          label: "Payable Register",
          to: "/finance/payables"
        },
        {
          label: "Create Payable",
          to: "/finance/payables?create=1",
          create: true
        }
      ]
    },

    {
      label: "Receivables",
      to: "/finance/receivables",
      path: "/finance/receivables",
      children: [
        {
          label: "Receivable Register",
          to: "/finance/receivables",
          end: true
        },
        {
          label: "Create Receivable",
          to: "/finance/receivables?create=1",
          create: true
        },
        {
          label: "Approve Receivable",
          to: "/finance/receivables/approve",
          allowed: RECEIVABLE_APPROVER_ROLES
        }
      ]
    },

    {
      label: "Advance Payments",
      to: "/finance/advances",
      children: [
        {
          label: "Advance Register",
          to: "/finance/advances"
        },
        {
          label: "Create Advance Payment",
          to: "/finance/advances?create=1",
          create: true
        }
      ]
    },

    {
      label: "Credits",
      to: "/finance/credits",
      children: [
        {
          label: "Credit Notes",
          to: "/finance/credits"
        },
        {
          label: "Create Credit Note",
          to: "/finance/credits?create=1",
          create: true
        }
      ]
    }
  ]
},
  {
    label: "Reports",
    icon: BarChart3,
    path: "/reports",
    allowed: ALL_ROLES,
    children: [{ label: "Department Reports", to: "/reports" }],
  },
  {
    label: "Account",
    icon: Settings2,
    path: "/account",
    allowed: ALL_ROLES,
    children: [{ label: "Account & Security", to: "/account" }],
  },
];

/** Drops nested menu items the role may not see (items without `allowed` are open to everyone who reaches the group). */
const filterChildrenByRole = (children, role) =>
  children
    ?.filter((child) => !child.allowed || canSee(role, child.allowed))
    .map((child) =>
      child.children
        ? { ...child, children: filterChildrenByRole(child.children, role) }
        : child,
    );

/** Vertical accordion node inside the sidebar. Handles arbitrary nesting (Finance -> Payables -> Create). */
function AccordionNode({ item, depth = 0 }) {
  const location = useLocation();
  // A node is "active" (current section) if we're exactly on its own link, or the path is
  // nested under its section path — checked against BOTH `to` (leaf links) and `path` (group
  // headers, which never carry `to` since they render as a button, not a link).
  const active = Boolean(
    (item.to && location.pathname === item.to) ||
    (item.path &&
      (location.pathname === item.path ||
        location.pathname.startsWith(`${item.path}/`))),
  );
  const [expanded, setExpanded] = useState(
    () => active && Boolean(item.children),
  );

  if (!item.children) {
    return (
      <NavLink
        to={item.to}
        end={item.end}
        className={({ isActive }) =>
          `${rowItem} justify-start gap-2 border-l-2 ${item.create ? "text-indigo-600 bg-indigo-50 border-transparent" : isActive ? "bg-indigo-50 text-indigo-700 border-indigo-600 font-bold" : "border-transparent"}`
        }
        style={{ paddingLeft: `${10 + depth * 14}px` }}
      >
        {item.icon && <item.icon size={14} />}
        {item.label}
      </NavLink>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className={`${rowItem} border-l-2 ${active ? "bg-indigo-50 text-indigo-700 border-indigo-600 font-bold" : "border-transparent"}`}
        style={{ paddingLeft: `${10 + depth * 14}px` }}
      >
        <span className="flex items-center gap-2">
          {item.icon && <item.icon size={depth === 0 ? 15 : 14} />}
          {item.label}
        </span>
        <ChevronDown
          size={12}
          className={`shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </button>
      {expanded && (
        <div className="mt-0.5 space-y-0.5 border-l border-slate-200 ml-4">
          {item.children.map((child) => (
            <AccordionNode key={child.label} item={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Left-side navigation. Always visible, spans the full viewport height (not a header dropdown),
 * matching the rest of the app's slate/blue styling.
 */
function Sidebar({ items, adminItem }) {
  return (
    <aside className="w-64 h-full shrink-0 border-r border-slate-200 bg-white flex flex-col overflow-hidden">
      <NavLink
        to="/"
        className="flex items-center gap-2.5 h-14 shrink-0 px-3 border-b border-slate-200"
      >
        <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-black text-white text-sm shadow-sm">
          TV
        </div>
        <div>
          <strong className="block text-sm text-slate-900">TVI One</strong>
          <small className="text-[10px] text-slate-500">
            Manufacturing ERP
          </small>
        </div>
      </NavLink>
      <nav className="flex-1 min-h-0 overflow-y-auto p-2 space-y-0.5">
        {items.map((item) => (
          <AccordionNode key={item.label} item={item} />
        ))}
        {adminItem && <AccordionNode item={adminItem} />}
      </nav>
    </aside>
  );
}

export default function AppLayout() {
  const nav = useNavigate();
  const { user, logout } = useAuth();
  const visible = groups
    .filter((item) => item.to || canSee(user?.role, item.allowed))
    .map((item) =>
      item.children
        ? { ...item, children: filterChildrenByRole(item.children, user?.role) }
        : item,
    );
  const adminItem =
    user?.role === ROLES.ADMIN
      ? {
          label: "Administration",
          icon: Users,
          path: "/admin",
          children: [
            { label: "Users & Sessions", to: "/admin" },
            { label: "Create User", to: "/admin?create=1", create: true },
          ],
        }
      : null;
  const doLogout = async () => {
    await logout();
    nav("/login");
  };

  return (
    <div className="w-screen h-screen flex bg-slate-50 text-slate-900 overflow-hidden font-sans">
      <Sidebar items={visible} adminItem={adminItem} />
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-14 shrink-0 border-b border-slate-200 bg-white flex items-center justify-end px-3 gap-3">
          <div className="hidden xl:block text-right">
            <strong className="block text-xs text-slate-700">
              {user?.name}
            </strong>
            <small className="text-[10px] text-slate-500">
              {ROLE_LABELS[user?.role] || user?.role}
            </small>
          </div>
          <button
            type="button"
            onClick={doLogout}
            title="Sign out"
            className="p-2 rounded-lg bg-slate-100 text-slate-500 hover:text-rose-600 hover:bg-rose-50"
          >
            <LogOut size={15} />
          </button>
        </header>
        <div className="flex-1 min-h-0 overflow-y-auto">
          <main className="max-w-[1800px] mx-auto p-3">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}