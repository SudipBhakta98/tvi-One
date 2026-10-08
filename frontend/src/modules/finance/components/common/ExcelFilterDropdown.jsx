import React, { useState, useEffect, useMemo, useRef } from "react";

// Excel-style multi-select dropdown filter (shared by the Receivable pages).
export default function ExcelFilterDropdown({ title, options, selectedValues, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = useMemo(() => {
    return options.filter((opt) =>
      opt.label.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [options, searchTerm]);

  const isAllSelected =
    options.length > 0 && selectedValues.length === options.length;

  const handleToggleAll = () => {
    if (isAllSelected) {
      onChange([]);
    } else {
      onChange(options.map((o) => o.value));
    }
  };

  const handleToggleOption = (val) => {
    if (selectedValues.includes(val)) {
      onChange(selectedValues.filter((v) => v !== val));
    } else {
      onChange([...selectedValues, val]);
    }
  };

  const activeCount = selectedValues.length;
  const isFiltered = activeCount > 0 && activeCount < options.length;

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border transition ${
          isFiltered
            ? "bg-indigo-50 border-indigo-300 text-indigo-700 font-semibold"
            : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
        }`}
      >
        <span>{title}</span>
        {isFiltered && (
          <span className="px-1.5 py-0.2 rounded-full bg-indigo-600 text-white text-[10px]">
            {activeCount}
          </span>
        )}
        <svg
          className="w-3.5 h-3.5 text-slate-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-2 w-64 rounded-xl bg-white border border-slate-200 shadow-xl z-50 p-3 space-y-2 text-xs">
          {/* Search Box */}
          <input
            type="text"
            placeholder={`Search ${title.toLowerCase()}...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />

          {/* Controls */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-2 pt-1 text-[11px]">
            <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={isAllSelected}
                onChange={handleToggleAll}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span>(Select All)</span>
            </label>
            {activeCount > 0 && (
              <button
                type="button"
                onClick={() => onChange([])}
                className="text-rose-600 hover:underline font-medium"
              >
                Clear
              </button>
            )}
          </div>

          {/* Options List */}
          <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
            {filteredOptions.length === 0 ? (
              <div className="text-slate-400 text-center py-2">No options found</div>
            ) : (
              filteredOptions.map((opt) => {
                const checked = selectedValues.includes(opt.value);
                return (
                  <label
                    key={opt.value}
                    className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-slate-50 cursor-pointer text-slate-700"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => handleToggleOption(opt.value)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="truncate">{opt.label}</span>
                  </label>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
