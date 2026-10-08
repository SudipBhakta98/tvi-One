// Form controls with explicit, high-contrast colours so labels and typed text are always readable.
const inputClass = "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";

export const FormField = ({ label, children }) => <label className="block space-y-1">
  <span className="block text-xs font-semibold text-slate-700">{label}</span>
  {children}
</label>;

export const TextInput = ({ className = "", ...props }) => <input {...props} className={`${inputClass} ${className}`} />;
export const TextAreaInput = ({ className = "", ...props }) => <textarea {...props} className={`${inputClass} ${className}`} />;
