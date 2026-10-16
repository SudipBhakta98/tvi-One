import ExcelFilterDropdown from "../../finance/components/common/ExcelFilterDropdown.jsx";
import { GhostButton } from "../../../components/ui";
import { FILTER_COLUMNS } from "../hooks/useRfqFilters";
import { stageLabel } from "./rfqConfig";

// The server sends raw enum values for stages; show the same friendly names as the rest of the RFQ screens.
const LABEL_OF = { current_stage: stageLabel };

const sameMembers = (a, b) => a.length === b.length && a.every((value) => b.includes(value));

// Excel-style: an empty selection means "no filter". What that looks like in the dropdown is every option ticked, except for
// columns where the server names a default (Month: the latest months it loads on its own). Picking exactly that is "no filter" again.
export default function RfqFilterBar({ options, filters, hasFilters, onChange, onReset }) {
  return <>
    {FILTER_COLUMNS.map(({ key, title }) => {
      const columnOptions = (options[key] || []).map((option) => ({ ...option, label: LABEL_OF[key]?.(option.value) || option.label }));
      const restingValues = options.defaults?.[key] || columnOptions.map((option) => option.value);
      const selectedValues = filters[key].length ? filters[key] : restingValues;
      return <ExcelFilterDropdown
        key={key}
        title={title}
        options={columnOptions}
        selectedValues={selectedValues}
        onChange={(values) => onChange(key, sameMembers(values, restingValues) ? [] : values)}
      />;
    })}
    {hasFilters && <GhostButton type="button" onClick={onReset}>Clear filters</GhostButton>}
  </>;
}
