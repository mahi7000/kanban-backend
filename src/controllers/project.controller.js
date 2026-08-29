/**
 * Project Controller
 *
 * Handles HTTP for:
 *   GET    /api/projects
 *   POST   /api/projects
 *   GET    /api/projects/:id
 *   PUT    /api/projects/:id
 *   DELETE /api/projects/:id
 */

const db = require('../services/supabase.service');
const { apiResponse, paginatedResponse, getPaginationParams, cleanObject } = require('../utils/helpers');
const logger = require('../utils/logger');

/**
 * GET /api/projects
 * Returns all projects the current user owns or is a member of.
 */
const listProjects = async (req, res) => {
  try {
    const { page, limit, offset } = getPaginationParams(req.query);
    const { data, count } = await db.getProjectsByUser(req.user.id, { limit, offset });

    return res.status(200).json(
      apiResponse(true, paginatedResponse(data, count, page, limit), 'Projects retrieved')
    );
  } catch (error) {
    logger.error('listProjects error', { error: error.message, userId: req.user.id });
    return res.status(500).json(apiResponse(false, null, 'Failed to retrieve projects'));
  }
};

/**
 * POST /api/projects
 */
const createProject = async (req, res) => {
  try {
    const { name, description, status, settings } = req.body;
    const project = await db.createProject(
      cleanObject({ name, description, status, settings }),
      req.user.id
    );

    return res.status(201).json(apiResponse(true, project, 'Project created successfully'));
  } catch (error) {
    logger.error('createProject error', { error: error.message });
    return res.status(500).json(apiResponse(false, null, 'Failed to create project'));
  }
};

/**
 * GET /api/projects/:id
 * Returns project details plus member count.
 */
const getProject = async (req, res) => {
  try {
    const project = await db.getProjectById(req.params.id);

    if (!project) {
      return res.status(404).json(apiResponse(false, null, 'Project not found'));
    }

    // Verify the requester is owner or member
    const member = await db.getMemberRecord(project.id, req.user.id);
    const isOwner = project.owner_id === req.user.id;

    if (!isOwner && !member) {
      return res.status(403).json(apiResponse(false, null, 'Access denied'));
    }

    return res.status(200).json(apiResponse(true, project, 'Project retrieved'));
  } catch (error) {
    logger.error('getProject error', { error: error.message, projectId: req.params.id });
    return res.status(500).json(apiResponse(false, null, 'Failed to retrieve project'));
  }
};

/**
 * PUT /api/projects/:id
 * Only the project owner can update.
 */
const updateProject = async (req, res) => {
  try {
    const project = await db.getProjectById(req.params.id);

    if (!project) {
      return res.status(404).json(apiResponse(false, null, 'Project not found'));
    }

    if (project.owner_id !== req.user.id) {
      return res.status(403).json(apiResponse(false, null, 'Only the project owner can update this project'));
    }

    const { name, description, status, settings } = req.body;
    const updated = await db.updateProject(project.id, cleanObject({ name, description, status, settings }));

    return res.status(200).json(apiResponse(true, updated, 'Project updated successfully'));
  } catch (error) {
    logger.error('updateProject error', { error: error.message, projectId: req.params.id });
    return res.status(500).json(apiResponse(false, null, 'Failed to update project'));
  }
};

/**
 * DELETE /api/projects/:id
 * Only the project owner can delete.
 */
const deleteProject = async (req, res) => {
  try {
    const project = await db.getProjectById(req.params.id);

    if (!project) {
      return res.status(404).json(apiResponse(false, null, 'Project not found'));
    }

    if (project.owner_id !== req.user.id) {
      return res.status(403).json(apiResponse(false, null, 'Only the project owner can delete this project'));
    }

    await db.deleteProject(project.id);

    return res.status(200).json(apiResponse(true, null, 'Project deleted successfully'));
  } catch (error) {
    logger.error('deleteProject error', { error: error.message, projectId: req.params.id });
    return res.status(500).json(apiResponse(false, null, 'Failed to delete project'));
  }
};

module.exports = { listProjects, createProject, getProject, updateProject, deleteProject };
