/**
 * Multer Upload Middleware
 *
 * Configures multer for CSV file uploads.
 * Files are stored in memory (MemoryStorage) so they can be piped directly
 * to the CSV parser without writing to disk.
 *
 * Limits:
 *  - Max file size: 5 MB (configurable via MAX_FILE_SIZE env var)
 *  - Allowed MIME types: text/csv, text/plain, application/vnd.ms-excel
 */

const multer = require('multer');
const path = require('path');
const { apiResponse } = require('../utils/helpers');

// Use memory storage — no temporary files on disk
const storage = multer.memoryStorage();

/**
 * File filter — only accept CSV / plaintext files.
 */
const csvFileFilter = (req, file, cb) => {
  const allowedTypes = ['text/csv', 'text/plain', 'application/vnd.ms-excel'];
  const allowedExtensions = ['.csv'];

  const ext = path.extname(file.originalname).toLowerCase();

  if (
    allowedTypes.includes(file.mimetype) ||
    allowedExtensions.includes(ext)
  ) {
    return cb(null, true);
  }

  const err = new Error('Only CSV files are allowed');
  err.code = 'INVALID_FILE_TYPE';
  cb(err, false);
};

const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || '5242880', 10); // 5 MB default

const uploadCSV = multer({
  storage,
  fileFilter: csvFileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1,
  },
});

/**
 * Wraps multer's single-file upload to produce structured API errors
 * instead of multer's raw Error objects.
 *
 * @param {string} fieldName - The multipart field name for the file
 */
const handleCsvUpload = (fieldName = 'file') => (req, res, next) => {
  uploadCSV.single(fieldName)(req, res, (err) => {
    if (!err) return next();

    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json(
        apiResponse(false, null, `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024} MB`)
      );
    }

    if (err.code === 'INVALID_FILE_TYPE') {
      return res.status(415).json(
        apiResponse(false, null, err.message)
      );
    }

    return res.status(400).json(
      apiResponse(false, null, err.message || 'File upload failed')
    );
  });
};

module.exports = { handleCsvUpload, uploadCSV };
