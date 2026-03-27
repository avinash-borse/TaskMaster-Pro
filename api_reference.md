# TaskMaster Pro — REST API Reference

> **Base URL:** `http://localhost:3000/api/v1`
> **Format:** All requests and responses are `application/json`
> **Auth:** All endpoints except `/auth/register` and `/auth/login` require a `Bearer` token in the `Authorization` header.

---

## Authentication

### Register
```
POST /auth/register
```
```json
{
  "username": "john",
  "email": "john@example.com",
  "password": "password123"
}
```
**Response `201`**
```json
{
  "status": "success",
  "data": {
    "token": "<jwt>",
    "user": { "id": "...", "username": "john", "email": "john@example.com" }
  }
}
```

---

### Login
```
POST /auth/login
```
```json
{
  "email": "john@example.com",
  "password": "password123"
}
```
**Response `200`** — same structure as register.

---

### Search Users *(for assignment)*
```
GET /auth/search?q=john
Authorization: Bearer <token>
```
**Response `200`**
```json
{
  "status": "success",
  "data": {
    "users": [
      { "id": "...", "username": "john", "email": "john@example.com", "avatarColor": "#7c3aed" }
    ]
  }
}
```

---

## Tasks

> All task endpoints require `Authorization: Bearer <token>`

### List Tasks
```
GET /tasks
```
| Query param | Type | Description |
|---|---|---|
| `status` | `pending` \| `in-progress` \| `completed` | Filter by status |
| `priority` | `low` \| `medium` \| `high` | Filter by priority |
| `overdue` | `true` | Only overdue tasks |
| `workspaceId` | string | Filter by workspace |
| `sortBy` | `createdAt` \| `dueDate` \| `priority` \| `title` | Sort field (default: `createdAt`) |
| `sortOrder` | `asc` \| `desc` | Sort direction (default: `desc`) |
| `page` | number | Page number (default: `1`) |
| `limit` | number | Items per page (default: `200`) |

**Response `200`**
```json
{
  "status": "success",
  "data": {
    "tasks": [ { "id": "...", "title": "...", "priority": "high", "status": "pending", ... } ],
    "pagination": { "total": 42, "page": 1, "limit": 200, "totalPages": 1 }
  }
}
```

---

### Create Task
```
POST /tasks
```
```json
{
  "title": "Fix login bug",
  "description": "Users can't log in on mobile",
  "priority": "high",
  "status": "pending",
  "dueDate": "2026-04-01T09:00:00.000Z",
  "tags": "bug, frontend",
  "assigneeId": "<user-id>",
  "workspaceId": "<workspace-id>"
}
```
*`title` and `priority` are required. All other fields are optional.*

**Response `201`** — returns the created task object.

---

### Get Task by ID
```
GET /tasks/:id
```
**Response `200`** — returns full task with `creator`, `assignee`, `workspace`, and `_count` of comments/files.

---

### Update Task
```
PUT /tasks/:id
PATCH /tasks/:id
```
All fields are optional — send only what you want to change:
```json
{
  "status": "in-progress"
}
```
```json
{
  "workspaceId": "<workspace-id>"
}
```
```json
{
  "assigneeId": null
}
```
*Send `null` for `assigneeId` or `workspaceId` to clear them.*

**Response `200`** — returns updated task.

---

### Delete Task
```
DELETE /tasks/:id
```
**Response `204`** *(no body)*

---

### Summary Statistics
```
GET /tasks/summary
```
**Response `200`**
```json
{
  "status": "success",
  "data": {
    "summary": {
      "total": 12,
      "completed": 5,
      "pending": 4,
      "inProgress": 3,
      "overdue": 2
    }
  }
}
```

---

### Upcoming (due within 24h)
```
GET /tasks/upcoming
```
**Response `200`** — array of tasks with `id`, `title`, `dueDate`, `priority`.

---

## Comments

### List Comments
```
GET /tasks/:taskId/comments
```

### Add Comment
```
POST /tasks/:taskId/comments
```
```json
{ "content": "I'll handle this by tomorrow." }
```

### Delete Comment
```
DELETE /tasks/:taskId/comments/:commentId
```

---

## Activity Log

### Get Activity
```
GET /tasks/:taskId/activity
```
**Response `200`** — returns last 50 actions ordered by newest first.
```json
{
  "status": "success",
  "data": {
    "activities": [
      {
        "id": "...",
        "action": "status_changed",
        "detail": "pending → in-progress",
        "createdAt": "2026-03-27T09:00:00Z",
        "user": { "id": "...", "username": "john", "avatarColor": "#7c3aed" }
      }
    ]
  }
}
```
**Action values:** `created`, `status_changed`, `edited`, `assigned`, `moved`, `commented`, `file_uploaded`

---

## File Uploads

### List Files
```
GET /tasks/:taskId/files
```

### Upload File
```
POST /tasks/:taskId/files
Content-Type: multipart/form-data

file=<binary>
```
*Max size: 10MB. Allowed types: jpg, png, gif, webp, pdf, doc, docx, txt, xlsx, csv, zip*

**Response `201`**
```json
{
  "status": "success",
  "data": {
    "file": {
      "id": "...",
      "filename": "1711523600000.pdf",
      "originalName": "report.pdf",
      "mimetype": "application/pdf",
      "size": 204800,
      "user": { "username": "john" }
    }
  }
}
```
*Access uploaded files at: `http://localhost:3000/uploads/<filename>`*

### Delete File
```
DELETE /tasks/:taskId/files/:fileId
```

---

## Workspaces

### List My Workspaces
```
GET /workspaces
```

### Create Workspace
```
POST /workspaces
```
```json
{
  "name": "Design Team",
  "description": "UI/UX workspace"
}
```

### Invite Member
```
POST /workspaces/:workspaceId/invite
```
```json
{
  "email": "member@example.com",
  "role": "member"
}
```
*Roles: `owner`, `admin`, `member`*

### Remove Member
```
DELETE /workspaces/:workspaceId/members/:memberId
```
*Owner only.*

---

## Error Responses

All errors follow this shape:
```json
{
  "status": "error",
  "message": "Task not found"
}
```

| Code | Meaning |
|---|---|
| `400` | Validation error / bad input |
| `401` | Missing or invalid token |
| `403` | Forbidden (not owner/authorized) |
| `404` | Resource not found |
| `500` | Server error |

---

## Postman Quick Start

1. Set a collection variable `base_url = http://localhost:3000/api/v1`
2. Call `POST {{base_url}}/auth/login` → copy the `token`
3. Add to collection Auth: **Type → Bearer Token → `{{token}}`**
4. All other requests inherit the auth automatically
