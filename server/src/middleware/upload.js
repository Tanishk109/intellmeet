import multer from "multer";

function baseMimeType(mimetype) {
  return String(mimetype || "")
    .split(";")[0]
    .trim()
    .toLowerCase();
}

function hasRecordingExtension(filename) {
  return /\.(webm|mp4)$/i.test(String(filename || ""));
}

export const recordingUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024,
  },
  fileFilter: (_req, file, callback) => {
    const allowed = ["video/webm", "video/mp4", "audio/webm"];

    if (!allowed.includes(baseMimeType(file.mimetype)) && !hasRecordingExtension(file.originalname)) {
      const error = new Error("Unsupported recording format");
      error.status = 400;
      return callback(error);
    }

    callback(null, true);
  },
});
