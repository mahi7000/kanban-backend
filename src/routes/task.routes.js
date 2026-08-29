/**
 * Task Routes
 *
 * Board-scoped:
 *   GET    /api/boards/:boardId/tasks
 *   POST   /api/boards/:boardId/tasks
 *   POST   /api/boards/:boardId/import-csv
 *   GET    /api/boards/:boardId/export
 *
 * Standalone task:
 *   GET    /api/tasks/:id
 *   PUT    /api/tasks/:id
 *   DELETE /api/tasks/:id
 *   PATCH  /api/tasks/:id/status
 *   PATCH  /api/tasks/:id/position
 */

const express = require('express');
const taskController = require('../controllers/task.controller');
const csvController = require('../controllers/csv.controller');
const { authenticate } = require('../middleware/auth');
const { handleCsvUpload } = require('../middleware/upload');
const { validate } = require('../middleware/validation');
const {
  createTaskValidator,
  updateTaskValidator,
  updateTaskStatusValidator,
  updateTaskPositionValidator,
} = require('../validators/task.validator');

// ── Board-scoped task + CSV routes ──────────────────────────────────────────
const boardTaskRouter = express.Router({ mergeParams: true });

boardTaskRouter.use(authenticate);
boardTaskRouter.get('/',  taskController.listTasks);
boardTaskRouter.post('/', createTaskValidator, validate, taskController.createTask);

// ── Standalone task routes ───────────────────────────────────────────────────
const taskRouter = express.Router();

taskRouter.use(authenticate);
taskRouter.get('/:id',          taskController.getTask);
taskRouter.put('/:id',          updateTaskValidator, validate, taskController.updateTask);
taskRouter.delete('/:id',       taskController.deleteTask);
taskRouter.patch('/:id/status', updateTaskStatusValidator, validate, taskController.updateTaskStatus);
taskRouter.patch('/:id/position', updateTaskPositionValidator, validate, taskController.updateTaskPosition);

module.exports = { boardTaskRouter, taskRouter };
