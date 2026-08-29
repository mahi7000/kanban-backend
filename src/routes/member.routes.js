/**
 * Member Routes (mounted under /api/projects)
 *
 * GET    /api/projects/:id/members
 * POST   /api/projects/:id/invite
 * PUT    /api/projects/:id/members/:userId
 * DELETE /api/projects/:id/members/:userId
 *
 * Invitation endpoints (mounted separately at /api/invitations):
 *   POST /api/invitations/accept
 *   POST /api/invitations/decline
 */

const express = require('express');
const memberController = require('../controllers/member.controller');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const {
  inviteMemberValidator,
  updateMemberRoleValidator,
} = require('../validators/project.validator');

// ── Project-scoped member routes ────────────────────────────────────────────
const projectMemberRouter = express.Router({ mergeParams: true });

projectMemberRouter.use(authenticate);

projectMemberRouter.get('/',                memberController.listMembers);
projectMemberRouter.post('/invite',         inviteMemberValidator, validate, memberController.inviteMember);
projectMemberRouter.put('/:userId',         updateMemberRoleValidator, validate, memberController.updateMemberRole);
projectMemberRouter.delete('/:userId',      memberController.removeMember);

// ── Invitation accept/decline routes ────────────────────────────────────────
const invitationRouter = express.Router();

invitationRouter.use(authenticate);

invitationRouter.post('/accept',  memberController.acceptInvitation);
invitationRouter.post('/decline', memberController.declineInvitation);

module.exports = { projectMemberRouter, invitationRouter };
