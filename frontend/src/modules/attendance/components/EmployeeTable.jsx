import { Table, EmptyState } from "../../../components/ui";
import { SINGLE_EVENT_COLUMNS, FREQUENT_COLUMNS } from "../constants/attendanceConstants";

const NO_PUNCH = "--:--";
const NO_HOURS = "00:00";
const punchTone = (punch, presentTone) => (punch ? presentTone : "bg-rose-50 border-rose-100 text-rose-600");
const Chip = ({ className, children }) => <span className={`px-1.5 py-0.5 rounded border text-[11px] font-bold ${className}`}>{children}</span>;

function SingleEventRow({ employee }) {
  const hasHours = employee.workingHours && employee.workingHours !== NO_HOURS;
  return (
    <>
      <td className="px-3 py-2"><Chip className="bg-slate-100 border-slate-200 font-mono text-slate-900">{employee.employeeCode}</Chip></td>
      <td className="px-3 py-2 font-bold text-slate-900">{employee.employeeName}</td>
      <td className="px-3 py-2 font-mono">
        <span className="flex items-center gap-1">
          <Chip className={punchTone(employee.inPunch, "bg-emerald-50 border-emerald-100 text-emerald-700")}>{employee.inPunch || NO_PUNCH}</Chip>
          <span className="text-slate-300">→</span>
          <Chip className={punchTone(employee.outPunch, "bg-indigo-50 border-indigo-100 text-indigo-700")}>{employee.outPunch || NO_PUNCH}</Chip>
        </span>
      </td>
      <td className={`px-3 py-2 font-mono font-bold ${hasHours ? "text-slate-800" : "text-rose-500"}`}>{employee.workingHours || NO_HOURS}</td>
      <td className="px-3 py-2"><Chip className="bg-amber-50 border-amber-100 text-amber-800 uppercase">{employee.shift || "N/A"}</Chip></td>
      <td className="px-3 py-2 font-bold text-slate-800">{employee.department || <span className="font-normal italic text-slate-400">No Dept</span>}</td>
      <td className="px-3 py-2"><Chip className="bg-blue-50 border-blue-100 text-blue-800 uppercase">{employee.company || "N/A"}</Chip></td>
      <td className="px-3 py-2"><Chip className="bg-purple-50 border-purple-100 text-purple-800 uppercase">{employee.unit || "N/A"}</Chip></td>
    </>
  );
}

function FrequentRow({ employee, categoryLabel }) {
  return (
    <>
      <td className="px-3 py-2"><Chip className="bg-slate-100 border-slate-200 font-mono text-slate-900">{employee.employeeCode}</Chip></td>
      <td className="px-3 py-2 font-bold text-slate-900">{employee.employeeName}</td>
      <td className="px-3 py-2 text-center"><Chip className="bg-rose-50 border-rose-200 text-rose-700 uppercase">{categoryLabel} ({employee.count}x)</Chip></td>
      <td className="px-3 py-2">
        <span className="flex flex-wrap gap-1 font-mono text-[11px] text-slate-700">
          {employee.dates?.map((date) => <span key={date} className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5">{date}</span>) || <span className="italic text-slate-400">N/A</span>}
        </span>
      </td>
    </>
  );
}

/** Employee exception list. `frequent` switches to the streak layout used by the "Frequently ..." categories. */
export default function EmployeeTable({ list, frequent, categoryLabel }) {
  if (!list?.length) return <EmptyState message="No operational records found matching the active segment filter." />;
  const Row = frequent ? FrequentRow : SingleEventRow;
  return (
    <div className="max-h-80 overflow-y-auto">
      <Table columns={frequent ? FREQUENT_COLUMNS : SINGLE_EVENT_COLUMNS}>
        {list.map((employee, index) => (
          <tr key={`${employee.employeeCode}-${index}`} className="hover:bg-slate-50 text-xs text-slate-700">
            <Row employee={employee} categoryLabel={categoryLabel} />
          </tr>
        ))}
      </Table>
    </div>
  );
}
