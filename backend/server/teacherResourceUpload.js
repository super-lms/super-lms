const multer = require("multer");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const MAX_RESOURCE_BYTES = 250 * 1024 * 1024;

// Stage large batches on disk; handlers read only the file being saved.
function createTeacherResourceUpload() {
  function handler(multiple) {
    return async (req, res, next) => {
      let directory;
      try {
        directory = await fs.mkdtemp(path.join(os.tmpdir(), "lms-resource-"));
      } catch (error) {
        return next(error);
      }
      const cleanup = () => fs.rm(directory, { recursive: true, force: true }).catch(console.error);
      res.once("finish", cleanup);
      res.once("close", cleanup);
      const upload = multer({
        dest: directory,
        limits: { fileSize: MAX_RESOURCE_BYTES + 1, files: multiple ? 20 : 1 },
      });
      const parse = multiple ? upload.array("files", 20) : upload.single("attachment");
      parse(req, res, (error) => {
        if (res.destroyed) { cleanup(); return; }
        if (!error) return next();
        cleanup();
        return res.status(error.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({
          error: error.code === "LIMIT_FILE_SIZE"
            ? "Each resource must be 250 MB or smaller"
            : error.code === "LIMIT_FILE_COUNT"
              ? `Upload no more than ${multiple ? 20 : 1} resources at once`
              : "Resources could not be uploaded",
        });
      });
    };
  }
  return { multiple: handler(true), single: handler(false) };
}

module.exports = { createTeacherResourceUpload, MAX_RESOURCE_BYTES };
