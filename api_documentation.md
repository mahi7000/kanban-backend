# Kanban Board Backend API Documentation

Welcome to the API documentation for the Kanban Board Backend. This API is built on **Node.js (Express)** and integrates with **Supabase** for database operations and user authentication.

## Table of Contents
1. [General Setup & Configuration](#general-setup--configuration)
2. [Standard Response Format](#standard-response-format)
3. [Authentication Endpoints](#authentication-endpoints)
4. [Project Endpoints](#project-endpoints)
5. [Member & Invitation Endpoints](#member--invitation-endpoints)
6. [Board Endpoints](#board-endpoints)
7. [Task Endpoints](#task-endpoints)
8. [CSV Import / Export Endpoints](#csv-import--export-endpoints)

---

## General Setup & Configuration

- **Base URL:** `http://localhost:5000/api` (Local development)
- **Content-Type:** `application/json` (unless specified otherwise for file uploads)
- **Authentication:** JWT Bearer tokens. Secure routes require adding an `Authorization` header:
  ```http
  Authorization: Bearer <your_jwt_access_token>
  ```

---

## Standard Response Format

All responses follow a consistent structured format:

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation successful",
  "errors": null
}
```

### Error Response
- **Validation Failures (422 Unprocessable Entity):**
  ```json
  {
    "success": false,
    "data": null,
    "message": "Validation failed",
    "errors": [
      {
        "type": "field",
        "value": "",
        "msg": "Project name is required",
        "path": "name",
        "location": "body"
      }
    ]
  }
  ```
- **Generic / Operational Failures (400, 401, 403, 404, 500):**
  ```json
  {
    "success": false,
    "data": null,
    "message": "Error description message",
    "errors": null
  }
  ```

---

## Authentication Endpoints

Base path: `/api/auth`

### 1. Register User
- **Method:** `POST`
- **Path:** `/register`
- **Auth required:** No
- **Request Body:**
  ```json
  {
    "email": "user@example.com",
    "password": "SecurePassword123!",
    "full_name": "Jane Doe"
  }
  ```
- **Response (201 Created):**
  ```json
  {
    "success": true,
    "data": {
      "user": {
        "id": "6d3c0a59-eb08-4100-a548-18e4e9f78326",
        "email": "user@example.com",
        "user_metadata": {
          "full_name": "Jane Doe"
        }
      }
    },
    "message": "Registration successful. Please check your email to verify your account.",
    "errors": null
  }
  ```

### 2. Login User
- **Method:** `POST`
- **Path:** `/login`
- **Auth required:** No
- **Request Body:**
  ```json
  {
    "email": "user@example.com",
    "password": "SecurePassword123!"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "user": {
        "id": "6d3c0a59-eb08-4100-a548-18e4e9f78326",
        "email": "user@example.com"
      },
      "access_token": "eyJhbGciOiJIUzI1Ni...",
      "refresh_token": "d8e3b97b-..."
    },
    "message": "Login successful",
    "errors": null
  }
  ```

### 3. Get Current User Profile (Me)
- **Method:** `GET`
- **Path:** `/me`
- **Auth required:** Yes (Bearer Token)
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "user": {
        "id": "6d3c0a59-eb08-4100-a548-18e4e9f78326",
        "email": "user@example.com",
        "user_metadata": {
          "full_name": "Jane Doe"
        }
      }
    },
    "message": "User profile retrieved",
    "errors": null
  }
  ```

### 4. Forgot Password
- **Method:** `POST`
- **Path:** `/forgot-password`
- **Auth required:** No
- **Request Body:**
  ```json
  {
    "email": "user@example.com"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": null,
    "message": "If this email is registered, a password recovery link has been sent.",
    "errors": null
  }
  ```

### 5. Reset Password
- **Method:** `POST`
- **Path:** `/reset-password`
- **Auth required:** No
- **Request Body:**
  ```json
  {
    "access_token": "recovery_token_here",
    "new_password": "NewSecurePassword123!"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": null,
    "message": "Password has been successfully reset",
    "errors": null
  }
  ```

### 6. Logout User
- **Method:** `POST`
- **Path:** `/logout`
- **Auth required:** Yes (Bearer Token)
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": null,
    "message": "Logout successful",
    "errors": null
  }
  ```

---

## Project Endpoints

Base path: `/api/projects`

### 1. List Projects
- **Method:** `GET`
- **Path:** `/`
- **Auth required:** Yes
- **Query Parameters:**
  - `page` (optional, default: `1`)
  - `limit` (optional, default: `20`)
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "items": [
        {
          "id": "a9e0481b-5ef6-4df4-b3ff-674e0d9b4be4",
          "name": "Project Alpha",
          "description": "My first project",
          "owner_id": "6d3c0a59-eb08-4100-a548-18e4e9f78326",
          "status": "active",
          "settings": {},
          "created_at": "2026-08-29T14:00:00.000Z",
          "updated_at": "2026-08-29T14:00:00.000Z"
        }
      ],
      "pagination": {
        "page": 1,
        "limit": 20,
        "total": 1
      }
    },
    "message": "Projects retrieved successfully",
    "errors": null
  }
  ```

### 2. Create Project
- **Method:** `POST`
- **Path:** `/`
- **Auth required:** Yes
- **Request Body:**
  ```json
  {
    "name": "Project Alpha",
    "description": "My first project",
    "status": "active",
    "settings": {}
  }
  ```
- **Response (201 Created):**
  ```json
  {
    "success": true,
    "data": {
      "id": "a9e0481b-5ef6-4df4-b3ff-674e0d9b4be4",
      "name": "Project Alpha",
      "description": "My first project",
      "owner_id": "6d3c0a59-eb08-4100-a548-18e4e9f78326",
      "status": "active",
      "settings": {},
      "created_at": "2026-08-29T14:00:00.000Z",
      "updated_at": "2026-08-29T14:00:00.000Z"
    },
    "message": "Project created successfully",
    "errors": null
  }
  ```

### 3. Get Project Details
- **Method:** `GET`
- **Path:** `/:id`
- **Auth required:** Yes (must be project owner or member)
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "id": "a9e0481b-5ef6-4df4-b3ff-674e0d9b4be4",
      "name": "Project Alpha",
      "description": "My first project",
      "owner_id": "6d3c0a59-eb08-4100-a548-18e4e9f78326",
      "status": "active",
      "settings": {},
      "created_at": "2026-08-29T14:00:00.000Z",
      "updated_at": "2026-08-29T14:00:00.000Z"
    },
    "message": "Project retrieved successfully",
    "errors": null
  }
  ```

### 4. Update Project Details
- **Method:** `PUT`
- **Path:** `/:id`
- **Auth required:** Yes (must be project owner)
- **Request Body:**
  ```json
  {
    "name": "Project Alpha (Updated)",
    "description": "Revised description",
    "status": "completed"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "id": "a9e0481b-5ef6-4df4-b3ff-674e0d9b4be4",
      "name": "Project Alpha (Updated)",
      "description": "Revised description",
      "owner_id": "6d3c0a59-eb08-4100-a548-18e4e9f78326",
      "status": "completed",
      "settings": {},
      "created_at": "2026-08-29T14:00:00.000Z",
      "updated_at": "2026-08-29T15:00:00.000Z"
    },
    "message": "Project updated successfully",
    "errors": null
  }
  ```

### 5. Delete Project
- **Method:** `DELETE`
- **Path:** `/:id`
- **Auth required:** Yes (must be project owner)
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": null,
    "message": "Project deleted successfully",
    "errors": null
  }
  ```

---

## Member & Invitation Endpoints

### 1. List Project Members
- **Method:** `GET`
- **Path:** `/api/projects/:id/members`
- **Auth required:** Yes (must be project member)
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "f8a0481b-5ef6-4df4-b3ff-674e0d9b4be9",
        "project_id": "a9e0481b-5ef6-4df4-b3ff-674e0d9b4be4",
        "user_id": "6d3c0a59-eb08-4100-a548-18e4e9f78326",
        "role": "owner",
        "status": "active",
        "invited_by": null,
        "invited_at": "2026-08-29T14:00:00.000Z",
        "joined_at": "2026-08-29T14:00:00.000Z",
        "user": {
          "id": "6d3c0a59-eb08-4100-a548-18e4e9f78326",
          "email": "user@example.com",
          "raw_user_meta_data": {
            "full_name": "Jane Doe"
          }
        }
      }
    ],
    "message": "Project members retrieved successfully",
    "errors": null
  }
  ```

### 2. Invite Member to Project
- **Method:** `POST`
- **Path:** `/api/projects/:id/members/invite`
- **Auth required:** Yes (must be project owner or admin)
- **Request Body:**
  ```json
  {
    "email": "collaborator@example.com",
    "role": "member"
  }
  ```
- **Response (201 Created):**
  ```json
  {
    "success": true,
    "data": {
      "id": "c1a0481b-5ef6-4df4-b3ff-674e0d9b4be0",
      "email": "collaborator@example.com",
      "project_id": "a9e0481b-5ef6-4df4-b3ff-674e0d9b4be4",
      "invited_by": "6d3c0a59-eb08-4100-a548-18e4e9f78326",
      "role": "member",
      "expires_at": "2026-09-01T15:00:00.000Z"
    },
    "message": "Invitation sent successfully",
    "errors": null
  }
  ```

### 3. Update Member Role
- **Method:** `PUT`
- **Path:** `/api/projects/:id/members/:userId`
- **Auth required:** Yes (must be project owner or admin; admins cannot change owners or update other admins)
- **Request Body:**
  ```json
  {
    "role": "admin"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "project_id": "a9e0481b-5ef6-4df4-b3ff-674e0d9b4be4",
      "user_id": "8e3c0a59-eb08-4100-a548-18e4e9f78327",
      "role": "admin",
      "status": "active"
    },
    "message": "Member role updated successfully",
    "errors": null
  }
  ```

### 4. Remove Member from Project
- **Method:** `DELETE`
- **Path:** `/api/projects/:id/members/:userId`
- **Auth required:** Yes (must be project owner or admin; members can also remove themselves)
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": null,
    "message": "Member removed from project successfully",
    "errors": null
  }
  ```

### 5. Accept Invitation
- **Method:** `POST`
- **Path:** `/api/invitations/accept`
- **Auth required:** Yes
- **Request Body:**
  ```json
  {
    "token": "64_character_unique_token_received_in_email"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "project_id": "a9e0481b-5ef6-4df4-b3ff-674e0d9b4be4",
      "user_id": "8e3c0a59-eb08-4100-a548-18e4e9f78327",
      "role": "member",
      "status": "active",
      "joined_at": "2026-08-29T15:30:00.000Z"
    },
    "message": "You have joined the project successfully",
    "errors": null
  }
  ```

### 6. Decline Invitation
- **Method:** `POST`
- **Path:** `/api/invitations/decline`
- **Auth required:** Yes
- **Request Body:**
  ```json
  {
    "token": "64_character_unique_token_received_in_email"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": null,
    "message": "Invitation declined successfully",
    "errors": null
  }
  ```

---

## Board Endpoints

### 1. List Boards in Project
- **Method:** `GET`
- **Path:** `/api/projects/:projectId/boards`
- **Auth required:** Yes (must be project member)
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "c7e0481b-5ef6-4df4-b3ff-674e0d9b4be6",
        "project_id": "a9e0481b-5ef6-4df4-b3ff-674e0d9b4be4",
        "name": "Sprint 1",
        "column_order": ["todo", "in_progress", "review", "done"],
        "settings": {},
        "created_at": "2026-08-29T14:10:00.000Z",
        "updated_at": "2026-08-29T14:10:00.000Z"
      }
    ],
    "message": "Boards retrieved successfully",
    "errors": null
  }
  ```

### 2. Create Board
- **Method:** `POST`
- **Path:** `/api/projects/:projectId/boards`
- **Auth required:** Yes (must be project member)
- **Request Body:**
  ```json
  {
    "name": "Sprint 1",
    "column_order": ["todo", "in_progress", "review", "done"],
    "settings": {}
  }
  ```
- **Response (201 Created):**
  ```json
  {
    "success": true,
    "data": {
      "id": "c7e0481b-5ef6-4df4-b3ff-674e0d9b4be6",
      "project_id": "a9e0481b-5ef6-4df4-b3ff-674e0d9b4be4",
      "name": "Sprint 1",
      "column_order": ["todo", "in_progress", "review", "done"],
      "settings": {},
      "created_at": "2026-08-29T14:10:00.000Z",
      "updated_at": "2026-08-29T14:10:00.000Z"
    },
    "message": "Board created successfully",
    "errors": null
  }
  ```

### 3. Get Board Details
- **Method:** `GET`
- **Path:** `/api/boards/:id`
- **Auth required:** Yes (must be project member)
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "id": "c7e0481b-5ef6-4df4-b3ff-674e0d9b4be6",
      "project_id": "a9e0481b-5ef6-4df4-b3ff-674e0d9b4be4",
      "name": "Sprint 1",
      "column_order": ["todo", "in_progress", "review", "done"],
      "settings": {},
      "created_at": "2026-08-29T14:10:00.000Z",
      "updated_at": "2026-08-29T14:10:00.000Z"
    },
    "message": "Board retrieved successfully",
    "errors": null
  }
  ```

### 4. Update Board Details
- **Method:** `PUT`
- **Path:** `/api/boards/:id`
- **Auth required:** Yes (must be project member)
- **Request Body:**
  ```json
  {
    "name": "Sprint 1 (Updated)",
    "column_order": ["todo", "in_progress", "review", "done"],
    "settings": {
      "theme": "dark"
    }
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "id": "c7e0481b-5ef6-4df4-b3ff-674e0d9b4be6",
      "project_id": "a9e0481b-5ef6-4df4-b3ff-674e0d9b4be4",
      "name": "Sprint 1 (Updated)",
      "column_order": ["todo", "in_progress", "review", "done"],
      "settings": {
        "theme": "dark"
      },
      "created_at": "2026-08-29T14:10:00.000Z",
      "updated_at": "2026-08-29T15:10:00.000Z"
    },
    "message": "Board updated successfully",
    "errors": null
  }
  ```

### 5. Delete Board
- **Method:** `DELETE`
- **Path:** `/api/boards/:id`
- **Auth required:** Yes (must be project owner or admin)
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": null,
    "message": "Board deleted successfully",
    "errors": null
  }
  ```

---

## Task Endpoints

### 1. List Board Tasks
- **Method:** `GET`
- **Path:** `/api/boards/:boardId/tasks`
- **Auth required:** Yes
- **Query Parameters:**
  - `status` (optional: `todo`, `in_progress`, `review`, `done`)
  - `page` (optional, default: `1`)
  - `limit` (optional, default: `100`)
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "items": [
        {
          "id": "e2a0481b-5ef6-4df4-b3ff-674e0d9b4be1",
          "board_id": "c7e0481b-5ef6-4df4-b3ff-674e0d9b4be6",
          "title": "Implement API",
          "description": "Detailed explanation...",
          "status": "todo",
          "priority": "high",
          "assignee_id": null,
          "estimate_hours": 4.5,
          "position": 0,
          "created_at": "2026-08-29T14:15:00.000Z"
        }
      ],
      "pagination": {
        "page": 1,
        "limit": 100,
        "total": 1
      }
    },
    "message": "Tasks retrieved successfully",
    "errors": null
  }
  ```

### 2. Create Task
- **Method:** `POST`
- **Path:** `/api/boards/:boardId/tasks`
- **Auth required:** Yes
- **Request Body:**
  ```json
  {
    "title": "Implement API",
    "description": "Detailed explanation...",
    "status": "todo",
    "priority": "high",
    "assignee_id": "8e3c0a59-eb08-4100-a548-18e4e9f78327",
    "epic": "Authentication",
    "estimate_hours": 4.5,
    "repository": "kanban-backend",
    "branch": "feature/api",
    "dependencies": "Database setup",
    "goal": "Build robust JSON response routes",
    "full_prompt": "Write routes for task creations...",
    "week": 1,
    "day": "Day 1",
    "date": "2026-08-30",
    "side": "BE",
    "position": 0,
    "metadata": {}
  }
  ```
- **Response (201 Created):**
  ```json
  {
    "success": true,
    "data": {
      "id": "e2a0481b-5ef6-4df4-b3ff-674e0d9b4be1",
      "board_id": "c7e0481b-5ef6-4df4-b3ff-674e0d9b4be6",
      "title": "Implement API",
      "description": "Detailed explanation...",
      "status": "todo",
      "priority": "high",
      "assignee_id": "8e3c0a59-eb08-4100-a548-18e4e9f78327",
      "epic": "Authentication",
      "estimate_hours": 4.5,
      "repository": "kanban-backend",
      "branch": "feature/api",
      "dependencies": "Database setup",
      "goal": "Build robust JSON response routes",
      "full_prompt": "Write routes for task creations...",
      "week": 1,
      "day": "Day 1",
      "date": "2026-08-30",
      "side": "BE",
      "position": 0,
      "metadata": {},
      "created_by": "6d3c0a59-eb08-4100-a548-18e4e9f78326",
      "created_at": "2026-08-29T14:15:00.000Z",
      "updated_at": "2026-08-29T14:15:00.000Z"
    },
    "message": "Task created successfully",
    "errors": null
  }
  ```

### 3. Get Task Details
- **Method:** `GET`
- **Path:** `/api/tasks/:id`
- **Auth required:** Yes
- **Response (200 OK):**
  *(Matches the single task schema response above)*

### 4. Update Task Details
- **Method:** `PUT`
- **Path:** `/api/tasks/:id`
- **Auth required:** Yes
- **Request Body:**
  *(Any task field to update, fields not provided will keep their current value)*
- **Response (200 OK):**
  *(Returns the fully updated task row)*

### 5. Update Task Status (Column Move)
- **Method:** `PATCH`
- **Path:** `/api/tasks/:id/status`
- **Auth required:** Yes
- **Request Body:**
  ```json
  {
    "status": "in_progress"
  }
  ```
- **Response (200 OK):**
  *(Returns the task row with the updated status)*

### 6. Update Task Position (Reordering)
- **Method:** `PATCH`
- **Path:** `/api/tasks/:id/position`
- **Auth required:** Yes
- **Request Body:**
  ```json
  {
    "position": 3,
    "status": "in_progress"
  }
  ```
- **Response (200 OK):**
  *(Returns the task row with the updated position and status)*

### 7. Delete Task
- **Method:** `DELETE`
- **Path:** `/api/tasks/:id`
- **Auth required:** Yes
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": null,
    "message": "Task deleted successfully",
    "errors": null
  }
  ```

---

## CSV Import / Export Endpoints

### 1. Import Tasks from CSV
- **Method:** `POST`
- **Path:** `/api/boards/:boardId/import-csv`
- **Auth required:** Yes
- **Content-Type:** `multipart/form-data`
- **Body Form-Data:**
  - `file`: (Select file, *.csv)
- **CSV Headers expected (case-insensitive):**
  `Week, Day, Date, Assignee, Email, Side, Status, Title, Epic, Priority, EstimateHours, Repo, Branch, Dependencies, Goal, FullPrompt`
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "total_rows": 5,
      "imported": 4,
      "failed": 1,
      "invalid_rows": [
        {
          "row": 3,
          "data": {
            "title": "",
            "email": "invalid-email"
          },
          "errors": [
            "Title is required",
            "Assignee email must be a valid email"
          ]
        }
      ]
    },
    "message": "CSV import completed. 4 tasks created, 1 failed.",
    "errors": null
  }
  ```

### 2. Export Board Tasks
- **Method:** `GET`
- **Path:** `/api/boards/:boardId/export`
- **Auth required:** Yes
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "board": {
        "id": "c7e0481b-5ef6-4df4-b3ff-674e0d9b4be6",
        "name": "Sprint 1",
        "column_order": ["todo", "in_progress", "review", "done"]
      },
      "tasks": [
        {
          "id": "e2a0481b-5ef6-4df4-b3ff-674e0d9b4be1",
          "title": "Implement API",
          "status": "todo",
          "priority": "high",
          "epic": "Authentication",
          "estimate_hours": 4.5
          // ... rest of task parameters
        }
      ]
    },
    "message": "Board tasks exported successfully",
    "errors": null
  }
  ```
