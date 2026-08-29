/**
 * Member Controller
 *
 * Handles HTTP for:
 *   GET    /api/projects/:id/members
 *   POST   /api/projects/:id/invite
 *   PUT    /api/projects/:id/members/:userId
 *   DELETE /api/projects/:id/members/:userId
 *   GET    /api/invitations/accept   (token in query)
 *   GET    /api/invitations/decline  (token in query)
 */

const db = require('../services/supabase.service');
const authService = require('../services/auth.service');
const emailService = require('../services/email.service');
const { apiResponse, generateInviteToken, hoursFromNow } = require('../utils/helpers');
const logger = require('../utils/logger');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns the current user's member record or throws 403.
 */
const assertMember = async (projectId, userId, res) => {
  const project = await db.getProjectById(projectId);
  if (!project) {
    res.status(404).json(apiResponse(false, null, 'Project not found'));
    return null;
  }
  const member = await db.getMemberRecord(projectId, userId);
  const isOwner = project.owner_id === userId;
  if (!member && !isOwner) {
    res.status(403).json(apiResponse(false, null, 'Access denied'));
    return null;
  }
  return { project, member, isOwner };
};

/**
 * True if the user's role is owner or admin.
 */
const isAdminOrOwner = (role) => ['owner', 'admin'].includes(role);

// ---------------------------------------------------------------------------
// Controllers
// ---------------------------------------------------------------------------

/**
 * GET /api/projects/:id/members
 */
const listMembers = async (req, res) => {
  try {
    const ctx = await assertMember(req.params.id, req.user.id, res);
    if (!ctx) return;

    const members = await db.getProjectMembers(req.params.id);
    return res.status(200).json(apiResponse(true, members, 'Members retrieved'));
  } catch (error) {
    logger.error('listMembers error', { error: error.message });
    return res.status(500).json(apiResponse(false, null, 'Failed to retrieve members'));
  }
};

/**
 * POST /api/projects/:id/invite
 * Body: { email, role? }
 */
const inviteMember = async (req, res) => {
  try {
    const { id: projectId } = req.params;
    const { email, role = 'member' } = req.body;

    const project = await db.getProjectById(projectId);
    if (!project) {
      return res.status(404).json(apiResponse(false, null, 'Project not found'));
    }

    // Only admins/owners can invite
    const requesterMember = await db.getMemberRecord(projectId, req.user.id);
    const isOwner = project.owner_id === req.user.id;
    if (!isOwner && !isAdminOrOwner(requesterMember?.role)) {
      return res.status(403).json(apiResponse(false, null, 'Only project admins can invite members'));
    }

    // Check if the target user already exists in Supabase
    const existingUser = await authService.getUserByEmail(email);

    if (existingUser) {
      // Check if already a member
      const existingMember = await db.getMemberRecord(projectId, existingUser.id);
      if (existingMember) {
        return res.status(409).json(apiResponse(false, null, 'User is already a member of this project'));
      }
    }

    // Create invitation record
    const token = generateInviteToken();
    const invitation = await db.createInvitation({
      email,
      project_id: projectId,
      invited_by: req.user.id,
      role,
      token,
      expires_at: hoursFromNow(72).toISOString(),
    });

    // Send invitation email
    emailService
      .sendProjectInvitation({
        email,
        inviterName: req.user.user_metadata?.full_name || req.user.email,
        projectName: project.name,
        inviteToken: token,
        role,
      })
      .catch((err) => logger.warn('Invitation email failed', { error: err.message, email }));

    return res.status(201).json(
      apiResponse(true, { invitation_id: invitation.id }, 'Invitation sent successfully')
    );
  } catch (error) {
    logger.error('inviteMember error', { error: error.message });
    return res.status(500).json(apiResponse(false, null, 'Failed to send invitation'));
  }
};

/**
 * PUT /api/projects/:id/members/:userId
 * Body: { role }
 * Only owner/admin can change roles.
 */
const updateMemberRole = async (req, res) => {
  try {
    const { id: projectId, userId } = req.params;
    const { role } = req.body;

    const project = await db.getProjectById(projectId);
    if (!project) return res.status(404).json(apiResponse(false, null, 'Project not found'));

    const requesterMember = await db.getMemberRecord(projectId, req.user.id);
    const isOwner = project.owner_id === req.user.id;

    if (!isOwner && !isAdminOrOwner(requesterMember?.role)) {
      return res.status(403).json(apiResponse(false, null, 'Only admins or the owner can change roles'));
    }

    // Cannot change the owner's role via this endpoint
    if (userId === project.owner_id && role !== 'owner') {
      return res.status(400).json(apiResponse(false, null, 'Cannot change the owner\'s role'));
    }

    const updated = await db.updateMemberRole(projectId, userId, role);
    return res.status(200).json(apiResponse(true, updated, 'Member role updated'));
  } catch (error) {
    logger.error('updateMemberRole error', { error: error.message });
    return res.status(500).json(apiResponse(false, null, 'Failed to update member role'));
  }
};

/**
 * DELETE /api/projects/:id/members/:userId
 * Owner/admin can remove members. Members can remove themselves.
 */
const removeMember = async (req, res) => {
  try {
    const { id: projectId, userId } = req.params;

    const project = await db.getProjectById(projectId);
    if (!project) return res.status(404).json(apiResponse(false, null, 'Project not found'));

    const requesterMember = await db.getMemberRecord(projectId, req.user.id);
    const isOwner = project.owner_id === req.user.id;
    const isSelf = req.user.id === userId;

    // Must be owner, admin, or removing themselves
    if (!isOwner && !isAdminOrOwner(requesterMember?.role) && !isSelf) {
      return res.status(403).json(apiResponse(false, null, 'Access denied'));
    }

    // Project owner cannot be removed
    if (userId === project.owner_id) {
      return res.status(400).json(apiResponse(false, null, 'The project owner cannot be removed'));
    }

    await db.removeMember(projectId, userId);
    return res.status(200).json(apiResponse(true, null, 'Member removed from project'));
  } catch (error) {
    logger.error('removeMember error', { error: error.message });
    return res.status(500).json(apiResponse(false, null, 'Failed to remove member'));
  }
};

/**
 * POST /api/invitations/accept
 * Body or Query: { token }
 * The invitee must be authenticated.
 */
const acceptInvitation = async (req, res) => {
  try {
    const token = req.body.token || req.query.token;
    if (!token) {
      return res.status(400).json(apiResponse(false, null, 'Invitation token is required'));
    }

    const invitation = await db.getInvitationByToken(token);

    if (!invitation) {
      return res.status(404).json(apiResponse(false, null, 'Invitation not found or already used'));
    }

    if (new Date(invitation.expires_at) < new Date()) {
      await db.deleteInvitation(invitation.id);
      return res.status(410).json(apiResponse(false, null, 'Invitation has expired'));
    }

    // Verify the email matches the current user's email
    if (req.user.email !== invitation.email) {
      return res.status(403).json(apiResponse(false, null, 'This invitation was sent to a different email address'));
    }

    // Add the user as a member
    const existing = await db.getMemberRecord(invitation.project_id, req.user.id);
    if (!existing) {
      await db.addMember(invitation.project_id, req.user.id, invitation.role, invitation.invited_by);
    }

    // Delete the used invitation
    await db.deleteInvitation(invitation.id);

    return res.status(200).json(
      apiResponse(true, { project: invitation.project }, 'Invitation accepted. Welcome to the project!')
    );
  } catch (error) {
    logger.error('acceptInvitation error', { error: error.message });
    return res.status(500).json(apiResponse(false, null, 'Failed to accept invitation'));
  }
};

/**
 * POST /api/invitations/decline
 * Body or Query: { token }
 */
const declineInvitation = async (req, res) => {
  try {
    const token = req.body.token || req.query.token;
    if (!token) {
      return res.status(400).json(apiResponse(false, null, 'Invitation token is required'));
    }

    const invitation = await db.getInvitationByToken(token);
    if (invitation) {
      await db.deleteInvitation(invitation.id);
    }

    return res.status(200).json(apiResponse(true, null, 'Invitation declined'));
  } catch (error) {
    logger.error('declineInvitation error', { error: error.message });
    return res.status(500).json(apiResponse(false, null, 'Failed to decline invitation'));
  }
};

module.exports = {
  listMembers,
  inviteMember,
  updateMemberRole,
  removeMember,
  acceptInvitation,
  declineInvitation,
};
