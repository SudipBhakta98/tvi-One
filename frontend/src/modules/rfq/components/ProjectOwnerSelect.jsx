import { useEffect, useState } from "react";
import api from "../../../services/api";
import { ENDPOINTS } from "../../../services/endpoints";
import { Select } from "../../../components/ui";

// Drop-in for the old "Project Lead" text input on the create / edit RFQ form. `value` and `onChange` carry the user id.
export default function ProjectOwnerSelect({ value, onChange }) {
  const [owners, setOwners] = useState([]);
  useEffect(() => { api.get(ENDPOINTS.RFQ.OWNERS).then((response) => setOwners(response.data)); }, []);

  return (
    <Select value={value || ""} onChange={(event) => onChange(event.target.value)} required>
      <option value="">Select project owner</option>
      {owners.map(({ value: ownerId, label }) => <option key={ownerId} value={ownerId}>{label}</option>)}
    </Select>
  );
}
