import path from "node:path";
import express from "express";

export const uploadsStaticMiddleware = express.static(
  path.resolve(process.cwd(), "uploads"),
  { dotfiles: "deny", index: false, fallthrough: false, maxAge: "7d" }
);
