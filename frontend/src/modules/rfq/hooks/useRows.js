import { useState } from "react";

/** Editable list of rows with add / update / remove — shared by every dialog that captures repeated lines. */
export const useRows = (createBlankRow, initialRows = []) => {
  const [rows, setRows] = useState(initialRows);
  const update = (index, patch) => setRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  const add = () => setRows((current) => [...current, createBlankRow()]);
  const remove = (index) => setRows((current) => current.filter((_, i) => i !== index));
  return { rows, update, add, remove };
};
