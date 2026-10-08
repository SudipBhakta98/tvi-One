import { useState } from "react";
import { errorMessage } from "../components/rfqConfig";

/** Runs an async action with busy + error state. Any thrown Error (client check or API) becomes `error`. */
export const useAsyncAction = () => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const run = async (action) => {
    setBusy(true);
    setError("");
    try { await action(); return true; }
    catch (e) { setError(errorMessage(e)); return false; }
    finally { setBusy(false); }
  };
  return { run, busy, error };
};
