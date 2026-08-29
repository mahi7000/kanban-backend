/**
 * Board Routes
 *
 * Nested under projects:
 *   GET    /api/projects/:projectId/boards
 *   POST   /api/projects/:projectId/boards
 *
 * Standalone:
 *   GET    /api/boards/:id
 *   PUT    /api/boards/:id
 *   DELETE /api/boards/:id
 */

const express = require('express');
const boardController = require('../controllers/board.controller');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const { createBoardValidator, updateBoardValidator } = require('../validators/task.validator');

// ── Project-scoped board routes ──────────────────────────────────────────────
const projectBoardRouter = express.Router({ mergeParams: true });

projectBoardRouter.use(authenticate);
projectBoardRouter.get('/',  boardController.listBoards);
projectBoardRouter.post('/', createBoardValidator, validate, boardController.createBoard);

const taskController = require('../controllers/task.controller');
const csvController = require('../controllers/csv.controller');
const { handleCsvUpload } = require('../middleware/upload');

// ── Standalone board routes ──────────────────────────────────────────────────
const boardRouter = express.Router();

boardRouter.use(authenticate);
boardRouter.get('/:id',    boardController.getBoard);
boardRouter.put('/:id',    updateBoardValidator, validate, boardController.updateBoard);
boardRouter.delete('/:id', boardController.deleteBoard);
boardRouter.post('/:boardId/import-csv', handleCsvUpload('file'), csvController.importCsv);
boardRouter.get('/:boardId/export', taskController.exportBoard);

module.exports = { projectBoardRouter, boardRouter };
