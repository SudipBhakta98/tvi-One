
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { randomUUID } from "node:crypto";

// Use the same storage directory configured in server.js.
// server.js exports UPLOADS_DIR, but importing server.js here
// would start the server, so resolve the path independently.
const PROJECT_ROOT = path.resolve(process.cwd(), "..");

const uploadRoot = path.resolve(
  process.env.UPLOADS_DIR ||
    path.join(PROJECT_ROOT, "storage", "uploads", "rfq")
);

fs.mkdirSync(uploadRoot, { recursive: true });

// Local disk storage
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadRoot);
  },

  filename: (_req, file, cb) => {
    const safe = path
      .basename(file.originalname)
      .replace(/[^a-zA-Z0-9._-]/g, "_");

    cb(null, `${Date.now()}-${randomUUID()}-${safe}`);
  },
});

// Allowed attachment extensions
const ALLOWED_EXTENSIONS =
  /\.(pdf|xls|xlsx|csv|doc|docx|txt|png|jpe?g)$/i;

export const uploadRootDirectory = uploadRoot;

export const upload = multer({
  storage,

  limits: {
    fileSize: 25 * 1024 * 1024,
    files: 20,
  },

  fileFilter: (_req, file, cb) => {
    const allowed = ALLOWED_EXTENSIONS.test(file.originalname);

    if (!allowed) {
      return cb(
        new Error("Unsupported attachment file type")
      );
    }

    cb(null, true);
  },
});

// Serialize file metadata for MongoDB
export const serializeUploadedFile = (file, _req) => ({
  file_name: file.originalname,
  file_type: file.mimetype,
  file_size: file.size,

  // Store a relative path, not a publicly accessible URL.
  file_path: path.relative(uploadRoot, file.path),
  url: `/api/rfq/attachments/${encodeURIComponent(path.basename(file.path))}`,

  storage_provider: "LOCAL",
  uploaded_at: new Date(),
});
