/**
 * Project Routes
 *
 * GET    /api/projects
 * POST   /api/projects
 * GET    /api/projects/:id
 * PUT    /api/projects/:id
 * DELETE /api/projects/:id
 */

const express = require('express');
const projectController = require('../controllers/project.controller');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const {
  createProjectValidator,
  updateProjectValidator,
} = require('../validators/project.validator');

const router = express.Router();

// All project routes require authentication
router.use(authenticate);

router.get('/',     projectController.listProjects);
router.post('/',    createProjectValidator, validate, projectController.createProject);
router.get('/:id',  projectController.getProject);
router.put('/:id',  updateProjectValidator, validate, projectController.updateProject);
router.delete('/:id', projectController.deleteProject);

module.exports = router;
