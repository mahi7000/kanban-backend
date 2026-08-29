/**
 * Task Controller
 *
 * Handles HTTP for:
 *   GET    /api/boards/:boardId/tasks
 *   POST   /api/boards/:boardId/tasks
 *   GET    /api/tasks/:id
 *   PUT    /api/tasks/:id
 *   DELETE /api/tasks/:id
 *   PATCH  /api/tasks/:id/status
 *   PATCH  /api/tasks/:id/position
 *   GET    /api/boards/:boardId/export
 */

const db = require('../services/supabase.service');
const emailService = require('../services/email.service');
const authService = require('../services/auth.service');
const { apiResponse, paginatedResponse, getPaginationParams, cleanObject } = require('../utils/helpers');
const logger = require('../utils/logger');

// ---------------------------------------------------------------------------
// Access guard helpers
// ---------------------------------------------------------------------------

/**
 * Verify the user has access to the board's project.
 * Returns { board, project, member, isOwner } or responds with error.
 */
const assertBoardAccess = async (boardId, userId, res) => {
  const board = await db.getBoardById(boardId);
  if (!board) {
    res.status(404).json(apiResponse(false, null, 'Board not found'));
    return null;
  }

  const project = board.project;
  const isOwner = project.owner_id === userId;
  const member = await db.getMemberRecord(project.id, userId);

  if (!isOwner && !member) {
    res.status(403).json(apiResponse(false, null, 'Access denied'));
    return null;
  }

  return { board, project, isOwner, member };
};

/**
 * Verify the user has access to the task's board.
 */
const assertTaskAccess = async (taskId, userId, res) => {
  const task = await db.getTaskById(taskId);
  if (!task) {
    res.status(404).json(apiResponse(false, null, 'Task not found'));
    return null;
  }

  const ctx = await assertBoardAccess(task.board_id, userId, res);
  if (!ctx) return null;

  return { task, ...ctx };
};

// ---------------------------------------------------------------------------
// Controllers
// ---------------------------------------------------------------------------

/**
 * GET /api/boards/:boardId/tasks
 * Query: ?status=todo&page=1&limit=20
 */
const listTasks = async (req, res) => {
  try {
    const ctx = await assertBoardAccess(req.params.boardId, req.user.id, res);
    if (!ctx) return;

    const { page, limit, offset } = getPaginationParams(req.query);
    const { status } = req.query;

    const { data, count } = await db.getTasksByBoard(req.params.boardId, { status, limit, offset });

    return res.status(200).json(
      apiResponse(true, paginatedResponse(data, count, page, limit), 'Tasks retrieved')
    );
  } catch (error) {
    logger.error('listTasks error', { error: error.message });
    return res.status(500).json(apiResponse(false, null, 'Failed to retrieve tasks'));
  }
};

/**
 * POST /api/boards/:boardId/tasks
 */
const createTask = async (req, res) => {
  try {
    const ctx = await assertBoardAccess(req.params.boardId, req.user.id, res);
    if (!ctx) return;

    const {
      title, description, status, priority, assignee_id,
      epic, estimate_hours, repository, branch, dependencies,
      goal, full_prompt, week, day, date, side, position, metadata,
    } = req.body;

    const task = await db.createTask(
      cleanObject({
        board_id: req.params.boardId,
        title,
        description,
        status,
        priority: priority || 'medium',
        assignee_id,
        epic,
        estimate_hours,
        repository,
        branch,
        dependencies,
        goal,
        full_prompt,
        week,
        day,
        date,
        side,
        position: position ?? 0,
        metadata: metadata || {},
        created_by: req.user.id,
      })
    );

    // Notify assignee if specified
    if (assignee_id && assignee_id !== req.user.id) {
      notifyAssignee(assignee_id, task, ctx.board).catch(() => {});
    }

    return res.status(201).json(apiResponse(true, task, 'Task created successfully'));
  } catch (error) {
    logger.error('createTask error', { error: error.message });
    return res.status(500).json(apiResponse(false, null, 'Failed to create task'));
  }
};

/**
 * GET /api/tasks/:id
 */
const getTask = async (req, res) => {
  try {
    const ctx = await assertTaskAccess(req.params.id, req.user.id, res);
    if (!ctx) return;

    return res.status(200).json(apiResponse(true, ctx.task, 'Task retrieved'));
  } catch (error) {
    logger.error('getTask error', { error: error.message });
    return res.status(500).json(apiResponse(false, null, 'Failed to retrieve task'));
  }
};

/**
 * PUT /api/tasks/:id
 * Full update — accepts any subset of task fields.
 */
const updateTask = async (req, res) => {
  try {
    const ctx = await assertTaskAccess(req.params.id, req.user.id, res);
    if (!ctx) return;

    const previousAssigneeId = ctx.task.assignee_id;

    const {
      title, description, status, priority, assignee_id,
      epic, estimate_hours, repository, branch, dependencies,
      goal, full_prompt, week, day, date, side, position, metadata,
    } = req.body;

    const updated = await db.updateTask(
      req.params.id,
      cleanObject({
        title, description, status, priority, assignee_id,
        epic, estimate_hours, repository, branch, dependencies,
        goal, full_prompt, week, day, date, side, position, metadata,
      })
    );

    // Notify new assignee if it changed
    if (
      assignee_id &&
      assignee_id !== previousAssigneeId &&
      assignee_id !== req.user.id
    ) {
      notifyAssignee(assignee_id, updated, ctx.board).catch(() => {});
    }

    return res.status(200).json(apiResponse(true, updated, 'Task updated successfully'));
  } catch (error) {
    logger.error('updateTask error', { error: error.message });
    return res.status(500).json(apiResponse(false, null, 'Failed to update task'));
  }
};

/**
 * DELETE /api/tasks/:id
 */
const deleteTask = async (req, res) => {
  try {
    const ctx = await assertTaskAccess(req.params.id, req.user.id, res);
    if (!ctx) return;

    await db.deleteTask(req.params.id);
    return res.status(200).json(apiResponse(true, null, 'Task deleted successfully'));
  } catch (error) {
    logger.error('deleteTask error', { error: error.message });
    return res.status(500).json(apiResponse(false, null, 'Failed to delete task'));
  }
};

/**
 * PATCH /api/tasks/:id/status
 * Body: { status }
 */
const updateTaskStatus = async (req, res) => {
  try {
    const ctx = await assertTaskAccess(req.params.id, req.user.id, res);
    if (!ctx) return;

    const { status } = req.body;
    const updated = await db.updateTask(req.params.id, { status });

    return res.status(200).json(apiResponse(true, updated, 'Task status updated'));
  } catch (error) {
    logger.error('updateTaskStatus error', { error: error.message });
    return res.status(500).json(apiResponse(false, null, 'Failed to update task status'));
  }
};

/**
 * PATCH /api/tasks/:id/position
 * Body: { position, status? }
 * Used for drag-and-drop reordering.
 */
const updateTaskPosition = async (req, res) => {
  try {
    const ctx = await assertTaskAccess(req.params.id, req.user.id, res);
    if (!ctx) return;

    const { position, status } = req.body;
    const updated = await db.updateTask(req.params.id, cleanObject({ position, status }));

    return res.status(200).json(apiResponse(true, updated, 'Task position updated'));
  } catch (error) {
    logger.error('updateTaskPosition error', { error: error.message });
    return res.status(500).json(apiResponse(false, null, 'Failed to update task position'));
  }
};

/**
 * GET /api/boards/:boardId/export
 * Returns all tasks for the board as JSON (can be extended to CSV export).
 */
const exportBoard = async (req, res) => {
  try {
    const ctx = await assertBoardAccess(req.params.boardId, req.user.id, res);
    if (!ctx) return;

    const { data: tasks } = await db.getTasksByBoard(req.params.boardId, { limit: 10000 });

    // Simple JSON export — extend to CSV if needed
    return res.status(200).json(
      apiResponse(
        true,
        { board: ctx.board, tasks, exported_at: new Date().toISOString() },
        'Board exported successfully'
      )
    );
  } catch (error) {
    logger.error('exportBoard error', { error: error.message });
    return res.status(500).json(apiResponse(false, null, 'Failed to export board'));
  }
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Fire-and-forget assignee notification email.
 */
const notifyAssignee = async (assigneeId, task, board) => {
  try {
    const { supabaseAdmin } = require('../config/supabase');
    const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(assigneeId);
    if (!user?.email) return;

    await emailService.sendTaskAssignmentNotification({
      email: user.email,
      assigneeName: user.user_metadata?.full_name || user.email,
      taskTitle: task.title,
      boardName: board.name,
      projectName: board.project?.name || '',
      taskId: task.id,
    });
  } catch (err) {
    logger.warn('notifyAssignee failed', { assigneeId, taskId: task.id, error: err.message });
  }
};

module.exports = {
  listTasks,
  createTask,
  getTask,
  updateTask,
  deleteTask,
  updateTaskStatus,
  updateTaskPosition,
  exportBoard,
};
