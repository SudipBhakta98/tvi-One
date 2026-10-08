import { useState } from "react";

/**
 * State for one Excel-style multi-select filter (used with ExcelFilterDropdown).
 * `options` is [{ value, label }]. An empty selection means "no filter":
 * every row is shown and every option is ticked, so "Clear" behaves like "Select All".
 */
export default function useMultiFilter(options) {
  const [chosenValues, setSelectedValues] = useState([]);

  const noFilterApplied = chosenValues.length === 0;
  const selectedValues = noFilterApplied ? options.map((option) => option.value) : chosenValues;

  const matches = (value) => noFilterApplied || chosenValues.includes(value);
  const reset = () => setSelectedValues([]);

  return { selectedValues, setSelectedValues, matches, reset };
}
