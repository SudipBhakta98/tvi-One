const EXCEL_EPOCH = new Date(Date.UTC(1899, 11, 30));

/** True if value is a JS Date instance (what ExcelJS gives for date/time-formatted cells) */
const isDate = (v) => v instanceof Date && !isNaN(v.getTime());

/** Pad a number to 2 digits */
const pad2 = (n) => String(n).padStart(2, "0");

/**
 * Convert an Excel serial number (e.g. 46092, or 0.2963 for time-only)
 * into a JS Date (UTC-based, matching how ExcelJS/Excel store it).
 */
function excelSerialToDate(serial) {
  const ms = Math.round(serial * 24 * 60 * 60 * 1000);
  return new Date(EXCEL_EPOCH.getTime() + ms);
}

/**
 * Normalize a TIME cell value to "HH:MM:SS" (24-hour) string.
 * Handles: Date object, Excel serial fraction number, "HH:MM:SS",
 * "HH:MM", "H:MM AM/PM", "H.MM" (rare OCR/export typo), empty/null.
 */
function normalizeTime(value) {
  if (value === null || value === undefined || value === "") return "";

  // Case 1: ExcelJS gave us a real Date (typical for time-formatted cells)
  if (isDate(value)) {
    return `${pad2(value.getUTCHours())}:${pad2(value.getUTCMinutes())}:${pad2(value.getUTCSeconds())}`;
  }

  // Case 2: raw number — Excel time serials are a fraction of a day (0 to <1).
  // Some exports keep the number but strip formatting, so ExcelJS hands you
  // a plain JS number instead of a Date.
  if (typeof value === "number") {
    // If it's a whole/large number it's probably a date serial, not a time —
    // bail rather than guess wrong.
    if (value >= 1) return "";
    const d = excelSerialToDate(value);
    return `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())}`;
  }

  // Case 3: string formats
  if (typeof value === "string") {
    const str = value.trim();
    if (!str) return "";

    // 12-hour with AM/PM: "7:07:51 AM", "07:07 PM"
    const ampmMatch = str.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])$/);
    if (ampmMatch) {
      let h = Number(ampmMatch[1]);
      const m = ampmMatch[2];
      const s = ampmMatch[3] || "00";
      const isPM = ampmMatch[4].toLowerCase() === "pm";
      if (isPM && h < 12) h += 12;
      if (!isPM && h === 12) h = 0;
      return `${pad2(h)}:${m}:${s}`;
    }

    // 24-hour "HH:MM:SS" or "HH:MM"
    const hmMatch = str.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (hmMatch) {
      return `${pad2(Number(hmMatch[1]))}:${hmMatch[2]}:${hmMatch[3] || "00"}`;
    }

    // Fallback: strip anything non-digit/colon and retry once
    const cleaned = str.replace(/[^\d:]/g, "");
    const fallbackMatch = cleaned.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (fallbackMatch) {
      return `${pad2(Number(fallbackMatch[1]))}:${fallbackMatch[2]}:${fallbackMatch[3] || "00"}`;
    }

    return ""; // unrecognized — treat as missing punch rather than crash downstream
  }

  return "";
}

/**
 * Normalize a DATE cell value to "DD-MM-YYYY" string (matches your
 * existing pipeline's expected format).
 *
 * @param value      raw cell value (Date, number, or string)
 * @param knownFormat the format this column/file is known to use:
 *                    "DMY" | "MDY" | "YMD" (get this from detectDateFormat()
 *                    run once across the column — don't guess per row).
 *                    Defaults to "DMY". Ignored for unambiguous patterns
 *                    (ISO yyyy-mm-dd, named months) since those are
 *                    self-evident regardless of knownFormat.
 */
function normalizeDate(value, knownFormat = "DMY") {
  if (value === null || value === undefined || value === "") return "";

  // Case 1: real Date object — always unambiguous, ignore knownFormat
  if (isDate(value)) {
    return `${pad2(value.getUTCDate())}-${pad2(value.getUTCMonth() + 1)}-${value.getUTCFullYear()}`;
  }

  // Case 2: Excel serial date number — always unambiguous
  if (typeof value === "number") {
    const d = excelSerialToDate(value);
    return `${pad2(d.getUTCDate())}-${pad2(d.getUTCMonth() + 1)}-${d.getUTCFullYear()}`;
  }

  // Case 3: string formats
  if (typeof value === "string") {
    const str = value.trim();
    if (!str) return "";

    // DD-MMM-YYYY e.g. "18-Jun-2026" — self-evident, no ambiguity
    let m = str.match(/^(\d{1,2})[-\s]([A-Za-z]{3,9})[-\s](\d{4})$/);
    if (m) {
      const months = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
      const idx = months.indexOf(m[2].toLowerCase().slice(0, 3));
      if (idx >= 0) return `${pad2(m[1])}-${pad2(idx + 1)}-${m[3]}`;
    }

    // Purely numeric, 3 parts, any separator (-, /, ., space)
    const parts = splitDateParts(str);
    if (parts) {
      const [a, b, c] = parts;

      // If a 4-digit/large part is clearly the year, that resolves
      // YMD vs {D,M}MY regardless of knownFormat
      if (a > 31) return `${pad2(c)}-${pad2(b)}-${a}`;          // YYYY-?-?
      if (c > 31) {
        // last part is the year; order of first two depends on format
        if (knownFormat === "MDY") return `${pad2(b)}-${pad2(a)}-${c}`;
        return `${pad2(a)}-${pad2(b)}-${c}`; // DMY default
      }
      // No part > 31 at all (e.g. "05-06-26", 2-digit year) — trust knownFormat fully
      if (knownFormat === "YMD") return `${pad2(c)}-${pad2(b)}-${pad2(a)}`;
      if (knownFormat === "MDY") return `${pad2(b)}-${pad2(a)}-${pad2(c)}`;
      return `${pad2(a)}-${pad2(b)}-${pad2(c)}`; // DMY default
    }

    return ""; // unrecognized format
  }

  return "";
}


const SUPPORTED_NUMERIC_FORMATS = ["DMY", "MDY", "YMD"]; // YDM is rare enough to skip by default

function splitDateParts(str) {
  const m = String(str).trim().match(/^(\d{1,4})[-/.\s](\d{1,4})[-/.\s](\d{1,4})$/);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function candidateFormatsForParts([a, b, c]) {
  const candidates = [];

  if (a > 31) {
    // first part is clearly a year
    if (b >= 1 && b <= 12 && c >= 1 && c <= 31) candidates.push("YMD");
  } else if (c > 31) {
    // last part is clearly the year — middle order still ambiguous
    if (a >= 1 && a <= 12 && b >= 1 && b <= 31) candidates.push("MDY");
    if (b >= 1 && b <= 12 && a >= 1 && a <= 31) candidates.push("DMY");
  } else {
    // no part is obviously a year (all <= 31) — only resolvable if one
    // of the first two parts is > 12 (so it must be the day)
    if (a > 12 && a <= 31) candidates.push("DMY");
    if (b > 12 && b <= 31) candidates.push("MDY");
  }
  return candidates;
}

function detectDateFormat(sampleValues, fallback = "DMY") {
  let possible = new Set(SUPPORTED_NUMERIC_FORMATS);

  for (const raw of sampleValues) {
    if (isDate(raw) || typeof raw === "number") continue; // handled separately, not a format clue
    const parts = splitDateParts(raw);
    if (!parts) continue;

    const candidatesForThisRow = new Set(candidateFormatsForParts(parts));
    if (candidatesForThisRow.size === 0) continue; // unparseable, skip

    // Narrow possibilities down to only formats consistent with EVERY row seen
    possible = new Set([...possible].filter((f) => candidatesForThisRow.has(f)));

    if (possible.size === 1) return [...possible][0]; // resolved early, no need to scan further
    if (possible.size === 0) {
      // Contradiction (shouldn't normally happen) — reset and trust fallback
      return fallback;
    }
  }

  if (possible.size === 1) return [...possible][0];
  return fallback; 
}

function normalizeEmployeeCode(value, padWidth = 0) {
  if (value === null || value === undefined) return "";
  let str = String(value).trim();
  if (padWidth && /^\d+$/.test(str)) str = str.padStart(padWidth, "0");
  return str;
}

/** Generic safe string normalizer for text fields (name, unit, company, dept) */
function normalizeText(value, fallback = "Default") {
  if (value === null || value === undefined) return fallback;
  const str = String(value).trim();
  return str || fallback;
}

export {
  normalizeTime,
  normalizeDate,
  detectDateFormat,
  normalizeEmployeeCode,
  normalizeText,
};