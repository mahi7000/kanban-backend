/**
 * Supabase Database Service
 *
 * Centralises all direct Supabase / PostgreSQL operations.
 * Controllers should call these methods rather than constructing
 * queries inline, keeping business logic and DB access separate.
 */

const { supabaseAdmin } = require('../config/supabase');
const logger = require('../utils/logger');

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

/**
 * Return all projects the user owns or is an active member of.
 *
 * @param {string} userId
 * @param {{ limit, offset }} pagination
 */
const getProjectsByUser = async (userId, { limit = 20, offset = 0 } = {}) => {
  // Owned projects
  const { data: ownedProjects, error: ownedError, count: ownedCount } = await supabaseAdmin
    .from('projects')
    .select('*', { count: 'exact' })
    .eq('owner_id', userId)
    .order('created_at', { ascending: false });

  if (ownedError) throw ownedError;

  // Projects where the user is an accepted member (not the owner)
  const { data: memberRows, error: memberError } = await supabaseAdmin
    .from('project_members')
    .select('project_id')
    .eq('user_id', userId)
    .eq('status', 'active');

  if (memberError) throw memberError;

  const memberProjectIds = memberRows.map((r) => r.project_id);

  let memberProjects = [];
  let memberCount = 0;
  if (memberProjectIds.length > 0) {
    const { data, error, count } = await supabaseAdmin
      .from('projects')
      .select('*', { count: 'exact' })
      .in('id', memberProjectIds)
      .order('created_at', { ascending: false });

    if (error) throw error;
    memberProjects = data || [];
    memberCount = count || 0;
  }

  // Merge, de-duplicate by id, apply manual pagination
  const allProjects = [...(ownedProjects || []), ...memberProjects]
    .filter((p, i, arr) => arr.findIndex((x) => x.id === p.id) === i)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const total = allProjects.length;
  const items = allProjects.slice(offset, offset + limit);

  return { data: items, count: total };
};

/**
 * Fetch a single project by ID.
 */
const getProjectById = async (projectId) => {
  const { data, error } = await supabaseAdmin
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .single();

  if (error) throw error;
  return data;
};

/**
 * Create a new project and automatically add the creator as owner.
 */
const createProject = async (projectData, ownerId) => {
  const { data, error } = await supabaseAdmin
    .from('projects')
    .insert({ ...projectData, owner_id: ownerId })
    .select()
    .single();

  if (error) throw error;

  // Automatically add owner as member with 'owner' role
  await supabaseAdmin.from('project_members').insert({
    project_id: data.id,
    user_id: ownerId,
    role: 'owner',
    status: 'active',
    joined_at: new Date().toISOString(),
  });

  return data;
};

/**
 * Update a project. Returns the updated project row.
 */
const updateProject = async (projectId, updateData) => {
  const { data, error } = await supabaseAdmin
    .from('projects')
    .update({ ...updateData, updated_at: new Date().toISOString() })
    .eq('id', projectId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

/**
 * Delete a project (cascades to members, boards, tasks).
 */
const deleteProject = async (projectId) => {
  const { error } = await supabaseAdmin
    .from('projects')
    .delete()
    .eq('id', projectId);

  if (error) throw error;
};

// ---------------------------------------------------------------------------
// Project Members
// ---------------------------------------------------------------------------

const getProjectMembers = async (projectId) => {
  const { data, error } = await supabaseAdmin
    .from('project_members')
    .select('*')
    .eq('project_id', projectId)
    .order('joined_at', { ascending: true });

  if (error) throw error;

  const members = data || [];
  if (members.length === 0) return members;

  // Fetch user profiles through the admin API (service role).
  // Do not attempt a PostgREST embed on auth.users: there is no FK
  // relationship declared between project_members.user_id and auth.users,
  // so `select('*, user:user_id(...)')` fails in the schema cache.
  const { data: usersData, error: usersError } = await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (usersError) throw usersError;

  const userById = new Map(
    (usersData?.users || []).map((u) => [
      u.id,
      {
        id: u.id,
        email: u.email,
        full_name: u.user_metadata?.full_name || u.user_metadata?.name || '',
        raw_user_meta_data: u.user_metadata || {},
      },
    ])
  );

  return members.map((m) => ({ ...m, user: userById.get(m.user_id) || null }));
};

const getMemberRecord = async (projectId, userId) => {
  const { data, error } = await supabaseAdmin
    .from('project_members')
    .select('*')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .single();

  if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
  return data || null;
};

const updateMemberRole = async (projectId, userId, role) => {
  const { data, error } = await supabaseAdmin
    .from('project_members')
    .update({ role })
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

const removeMember = async (projectId, userId) => {
  const { error } = await supabaseAdmin
    .from('project_members')
    .delete()
    .eq('project_id', projectId)
    .eq('user_id', userId);

  if (error) throw error;
};

const addMember = async (projectId, userId, role = 'member', invitedBy = null) => {
  const { data, error } = await supabaseAdmin
    .from('project_members')
    .insert({
      project_id: projectId,
      user_id: userId,
      role,
      status: 'active',
      invited_by: invitedBy,
      joined_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return data;
};

// ---------------------------------------------------------------------------
// Invitations
// ---------------------------------------------------------------------------

const createInvitation = async (invitationData) => {
  const { data, error } = await supabaseAdmin
    .from('invitations')
    .insert(invitationData)
    .select()
    .single();

  if (error) throw error;
  return data;
};

const getInvitationByToken = async (token) => {
  const { data, error } = await supabaseAdmin
    .from('invitations')
    .select('*, project:project_id(id, name)')
    .eq('token', token)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data || null;
};

const deleteInvitation = async (invitationId) => {
  const { error } = await supabaseAdmin
    .from('invitations')
    .delete()
    .eq('id', invitationId);

  if (error) throw error;
};

// ---------------------------------------------------------------------------
// Boards
// ---------------------------------------------------------------------------

const getBoardsByProject = async (projectId) => {
  const { data, error } = await supabaseAdmin
    .from('boards')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data;
};

const getBoardById = async (boardId) => {
  const { data, error } = await supabaseAdmin
    .from('boards')
    .select('*, project:project_id(id, name, owner_id)')
    .eq('id', boardId)
    .single();

  if (error) throw error;
  return data;
};

const createBoard = async (boardData) => {
  const { data, error } = await supabaseAdmin
    .from('boards')
    .insert(boardData)
    .select()
    .single();

  if (error) throw error;
  return data;
};

const updateBoard = async (boardId, updateData) => {
  const { data, error } = await supabaseAdmin
    .from('boards')
    .update({ ...updateData, updated_at: new Date().toISOString() })
    .eq('id', boardId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

const deleteBoard = async (boardId) => {
  const { error } = await supabaseAdmin
    .from('boards')
    .delete()
    .eq('id', boardId);

  if (error) throw error;
};

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

/**
 * Fetch all tasks for a board, grouped/ordered by position.
 * Optionally filter by status.
 */
const getTasksByBoard = async (boardId, { status, limit = 100, offset = 0 } = {}) => {
  let query = supabaseAdmin
    .from('tasks')
    .select('*', { count: 'exact' })
    .eq('board_id', boardId)
    .order('status', { ascending: true })
    .order('position', { ascending: true })
    .range(offset, offset + limit - 1);

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error, count } = await query;
  if (error) throw error;
  return { data, count };
};

const getTaskById = async (taskId) => {
  const { data, error } = await supabaseAdmin
    .from('tasks')
    .select('*')
    .eq('id', taskId)
    .single();

  if (error) throw error;
  return data;
};

const createTask = async (taskData) => {
  const { data, error } = await supabaseAdmin
    .from('tasks')
    .insert(taskData)
    .select()
    .single();

  if (error) throw error;
  return data;
};

const updateTask = async (taskId, updateData) => {
  const { data, error } = await supabaseAdmin
    .from('tasks')
    .update({ ...updateData, updated_at: new Date().toISOString() })
    .eq('id', taskId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

const deleteTask = async (taskId) => {
  const { error } = await supabaseAdmin
    .from('tasks')
    .delete()
    .eq('id', taskId);

  if (error) throw error;
};

/**
 * Bulk-insert an array of task objects.
 * Returns inserted rows.
 */
const bulkCreateTasks = async (tasks) => {
  const { data, error } = await supabaseAdmin
    .from('tasks')
    .insert(tasks)
    .select();

  if (error) throw error;
  return data;
};

module.exports = {
  // Projects
  getProjectsByUser,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
  // Members
  getProjectMembers,
  getMemberRecord,
  updateMemberRole,
  removeMember,
  addMember,
  // Invitations
  createInvitation,
  getInvitationByToken,
  deleteInvitation,
  // Boards
  getBoardsByProject,
  getBoardById,
  createBoard,
  updateBoard,
  deleteBoard,
  // Tasks
  getTasksByBoard,
  getTaskById,
  createTask,
  updateTask,
  deleteTask,
  bulkCreateTasks,
};
