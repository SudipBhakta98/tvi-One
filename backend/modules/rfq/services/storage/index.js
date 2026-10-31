// Routes depend only on this driver facade. Replace this file's exports with
// an S3/multer-s3 driver later; controllers, schemas and UI stay unchanged.
export { upload, serializeUploadedFile, uploadRootDirectory } from "./localStorage.js";
