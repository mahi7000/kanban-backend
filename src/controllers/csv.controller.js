/**
 * CSV Controller
 *
 * Handles HTTP for:
 *   POST /api/boards/:boardId/import-csv
 *
 * Flow:
 *   1. Multer stores the uploaded file in memory
 *   2. csv.service parses the buffer into task objects
 *   3. Valid tasks are bulk-inserted; invalid rows are reported
 *   4. A summary is returned to the client
 */

const db = require('../services/supabase.service');
const csvService = require('../services/csv.service');
const { apiResponse } = require('../utils/helpers');
const logger = require('../utils/logger');

/**
 * POST /api/boards/:boardId/import-csv
 * multipart/form-data field: file
 */
const importCsv = async (req, res) => {
  try {
    const { boardId } = req.params;

    if (!req.file) {
      return res.status(400).json(apiResponse(false, null, 'No CSV file uploaded'));
    }

    // Verify board access
    const board = await db.getBoardById(boardId);
    if (!board) {
      return res.status(404).json(apiResponse(false, null, 'Board not found'));
    }

    const project = board.project;
    const isOwner = project.owner_id === req.user.id;
    const member = await db.getMemberRecord(project.id, req.user.id);

    if (!isOwner && !member) {
      return res.status(403).json(apiResponse(false, null, 'Access denied'));
    }

    // Parse CSV
    const { valid, invalid, total } = await csvService.parseCsvBuffer(
      req.file.buffer,
      boardId,
      req.user.id
    );

    // Bulk insert valid tasks (even on partial failure)
    let inserted = [];
    let insertErrors = [];

    if (valid.length > 0) {
      try {
        inserted = await db.bulkCreateTasks(valid);
      } catch (err) {
        logger.error('Bulk task insert failed', { error: err.message });
        insertErrors.push(`Database insert failed: ${err.message}`);
      }
    }

    const summary = {
      total_rows: total,
      imported: inserted.length,
      failed: invalid.length + insertErrors.length,
      invalid_rows: invalid,
      errors: insertErrors,
    };

    const success = inserted.length > 0 || (total > 0 && invalid.length < total);
    const statusCode = success ? 200 : 422;
    const message =
      inserted.length === 0
        ? 'No tasks were imported. Please check the error details.'
        : `Successfully imported ${inserted.length} of ${total} tasks.`;

    return res.status(statusCode).json(
      apiResponse(success, summary, message)
    );
  } catch (error) {
    logger.error('importCsv error', { error: error.message });

    if (error.message.includes('Invalid Record Length')) {
      return res.status(400).json(
        apiResponse(false, null, 'CSV format error: inconsistent column count. Please check your file.')
      );
    }

    return res.status(500).json(apiResponse(false, null, 'Failed to import CSV'));
  }
};

module.exports = { importCsv };
