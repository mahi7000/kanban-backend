/**
 * Board Controller
 *
 * Handles HTTP for:
 *   GET    /api/projects/:projectId/boards
 *   POST   /api/projects/:projectId/boards
 *   GET    /api/boards/:id
 *   PUT    /api/boards/:id
 *   DELETE /api/boards/:id
 */

const db = require('../services/supabase.service');
const { apiResponse, cleanObject } = require('../utils/helpers');
const logger = require('../utils/logger');

/**
 * Assert the user is a member or owner of the project that owns a board.
 * Returns the board object, or responds with an error and returns null.
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
 * GET /api/projects/:projectId/boards
 */
const listBoards = async (req, res) => {
  try {
    const { projectId } = req.params;

    // Verify access
    const project = await db.getProjectById(projectId);
    if (!project) return res.status(404).json(apiResponse(false, null, 'Project not found'));

    const isOwner = project.owner_id === req.user.id;
    const member = await db.getMemberRecord(projectId, req.user.id);
    if (!isOwner && !member) return res.status(403).json(apiResponse(false, null, 'Access denied'));

    const boards = await db.getBoardsByProject(projectId);
    return res.status(200).json(apiResponse(true, boards, 'Boards retrieved'));
  } catch (error) {
    logger.error('listBoards error', { error: error.message });
    return res.status(500).json(apiResponse(false, null, 'Failed to retrieve boards'));
  }
};

/**
 * POST /api/projects/:projectId/boards
 */
const createBoard = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { name, column_order, settings } = req.body;

    const project = await db.getProjectById(projectId);
    if (!project) return res.status(404).json(apiResponse(false, null, 'Project not found'));

    const isOwner = project.owner_id === req.user.id;
    const member = await db.getMemberRecord(projectId, req.user.id);
    if (!isOwner && !member) return res.status(403).json(apiResponse(false, null, 'Access denied'));

    const board = await db.createBoard(
      cleanObject({
        project_id: projectId,
        name,
        column_order: column_order || ['todo', 'in_progress', 'review', 'done'],
        settings: settings || {},
      })
    );

    return res.status(201).json(apiResponse(true, board, 'Board created successfully'));
  } catch (error) {
    logger.error('createBoard error', { error: error.message });
    return res.status(500).json(apiResponse(false, null, 'Failed to create board'));
  }
};

/**
 * GET /api/boards/:id
 */
const getBoard = async (req, res) => {
  try {
    const ctx = await assertBoardAccess(req.params.id, req.user.id, res);
    if (!ctx) return;

    return res.status(200).json(apiResponse(true, ctx.board, 'Board retrieved'));
  } catch (error) {
    logger.error('getBoard error', { error: error.message });
    return res.status(500).json(apiResponse(false, null, 'Failed to retrieve board'));
  }
};

/**
 * PUT /api/boards/:id
 */
const updateBoard = async (req, res) => {
  try {
    const ctx = await assertBoardAccess(req.params.id, req.user.id, res);
    if (!ctx) return;

    const { name, column_order, settings } = req.body;
    const updated = await db.updateBoard(ctx.board.id, cleanObject({ name, column_order, settings }));

    return res.status(200).json(apiResponse(true, updated, 'Board updated successfully'));
  } catch (error) {
    logger.error('updateBoard error', { error: error.message });
    return res.status(500).json(apiResponse(false, null, 'Failed to update board'));
  }
};

/**
 * DELETE /api/boards/:id
 * Only the project owner can delete a board.
 */
const deleteBoard = async (req, res) => {
  try {
    const ctx = await assertBoardAccess(req.params.id, req.user.id, res);
    if (!ctx) return;

    if (!ctx.isOwner && ctx.member?.role !== 'admin') {
      return res.status(403).json(apiResponse(false, null, 'Only admins or the owner can delete boards'));
    }

    await db.deleteBoard(ctx.board.id);
    return res.status(200).json(apiResponse(true, null, 'Board deleted successfully'));
  } catch (error) {
    logger.error('deleteBoard error', { error: error.message });
    return res.status(500).json(apiResponse(false, null, 'Failed to delete board'));
  }
};

module.exports = { listBoards, createBoard, getBoard, updateBoard, deleteBoard };
