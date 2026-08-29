-- ============================================================
-- Kanban Board Application — Supabase Database Schema
-- ============================================================
-- Run this script in the Supabase SQL Editor to set up all
-- tables, indexes, triggers, and Row Level Security policies.
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ──────────────────────────────────────────────
-- 1. PROJECTS
-- ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS projects (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name        VARCHAR(255) NOT NULL,
  description TEXT,
  owner_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status      VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'archived', 'completed')),
  settings    JSONB DEFAULT '{}',
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_owner_id ON projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_projects_status   ON projects(status);

-- ──────────────────────────────────────────────
-- 2. PROJECT MEMBERS
-- ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS project_members (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        VARCHAR(50) DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  status      VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'removed')),
  invited_by  UUID REFERENCES auth.users(id),
  invited_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  joined_at   TIMESTAMP WITH TIME ZONE,
  UNIQUE(project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_project_members_project_id ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user_id    ON project_members(user_id);

-- ──────────────────────────────────────────────
-- 3. BOARDS
-- ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS boards (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id   UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name         VARCHAR(255) NOT NULL,
  column_order JSONB DEFAULT '["todo", "in_progress", "review", "done"]',
  settings     JSONB DEFAULT '{}',
  created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_boards_project_id ON boards(project_id);

-- ──────────────────────────────────────────────
-- 4. TASKS
-- ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tasks (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  board_id        UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  title           VARCHAR(500) NOT NULL,
  description     TEXT,
  status          VARCHAR(50) NOT NULL DEFAULT 'todo'
                    CHECK (status IN ('todo', 'in_progress', 'review', 'done')),
  assignee_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  priority        VARCHAR(20) DEFAULT 'medium'
                    CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  epic            VARCHAR(255),
  estimate_hours  DECIMAL(5,2),
  repository      VARCHAR(255),
  branch          VARCHAR(255),
  dependencies    TEXT,
  goal            TEXT,
  full_prompt     TEXT,
  week            INTEGER,
  day             VARCHAR(50),
  date            DATE,
  side            VARCHAR(10),
  position        INTEGER DEFAULT 0,
  metadata        JSONB DEFAULT '{}',
  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_board_id    ON tasks(board_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status      ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee_id ON tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_position    ON tasks(board_id, status, position);

-- ──────────────────────────────────────────────
-- 5. INVITATIONS
-- ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS invitations (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email       VARCHAR(255) NOT NULL,
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  invited_by  UUID REFERENCES auth.users(id),
  role        VARCHAR(50) DEFAULT 'member',
  token       VARCHAR(255) UNIQUE NOT NULL,
  expires_at  TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invitations_token      ON invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_email      ON invitations(email);
CREATE INDEX IF NOT EXISTS idx_invitations_project_id ON invitations(project_id);

-- ──────────────────────────────────────────────
-- 6. AUTO-UPDATE updated_at TRIGGER
-- ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_boards_updated_at
  BEFORE UPDATE ON boards
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ──────────────────────────────────────────────
-- 7. ROW LEVEL SECURITY (RLS) POLICIES
-- ──────────────────────────────────────────────
-- NOTE: The backend uses the SERVICE ROLE key (bypasses RLS) for all
-- write operations. RLS here is a defence-in-depth measure, protecting
-- against direct PostgREST access with user JWTs.
-- ──────────────────────────────────────────────

ALTER TABLE projects        ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE boards          ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks           ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations     ENABLE ROW LEVEL SECURITY;

-- Helper: is the current user a member of a project?
CREATE OR REPLACE FUNCTION is_project_member(p_project_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM project_members
    WHERE project_id = p_project_id
      AND user_id = auth.uid()
      AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Projects: visible if owner OR active member
CREATE POLICY "projects_select"  ON projects FOR SELECT
  USING (owner_id = auth.uid() OR is_project_member(id));

CREATE POLICY "projects_insert"  ON projects FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "projects_update"  ON projects FOR UPDATE
  USING (owner_id = auth.uid());

CREATE POLICY "projects_delete"  ON projects FOR DELETE
  USING (owner_id = auth.uid());

-- Project Members
CREATE POLICY "members_select" ON project_members FOR SELECT
  USING (is_project_member(project_id) OR user_id = auth.uid());

-- Boards: visible to project members
CREATE POLICY "boards_select" ON boards FOR SELECT
  USING (is_project_member(project_id));

-- Tasks: visible to board's project members
CREATE POLICY "tasks_select" ON tasks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM boards b
      WHERE b.id = tasks.board_id AND is_project_member(b.project_id)
    )
  );
