# Task Management System API

A simple, robust Task Management System built with Node.js, TypeScript, Express, and MongoDB. Features secure JWT authentication, CRUD operations for tasks, advanced filtering, pagination, and statistics.

## Features

- **Authentication**: Secure registration and login using JWT.
- **Task Management**: Create, view, update, and delete tasks.
- **Advanced Filtering**: Filter tasks by status, priority, and overdue status.
- **Pagination & Sorting**: Support for large task lists with customizable sorting.
- **Statistics**: Summary of tasks (total, completed, pending, overdue).
- **Security**: Password hashing with bcrypt, security headers with helmet, and CORS support.

## Tech Stack

- **Backend**: Node.js & Express
- **Language**: TypeScript
- **Database**: SQLite (Prisma)
- **Validation**: Zod
- **Auth**: JSON Web Tokens (JWT) & bcryptjs

## Prerequisites

- [Node.js](https://nodejs.org/) (v16.x or higher)
- No external database required (uses local SQLite file)

## Getting Started

### 1. Clone the repository
```bash
git clone <your-repo-url>
cd task-management-system
```

### 2. Install dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Create a `.env` file in the root directory:
```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/task-management-db
JWT_SECRET=your_long_random_secret_string
NODE_ENV=development
JWT_EXPIRES_IN=1d
CORS_ORIGIN=*
```

### 4. Run the application
**Development Mode:**
```bash
npm run dev
```
**Production Build:**
```bash
npm run build
npm start
```

## API Documentation

All routes are prefixed with `/api/v1`.

### Authentication
- `POST /auth/register`: Create a new user.
- `POST /auth/login`: Authenticate and get a JWT token.

### Tasks (Protected - Requires Bearer Token)
- `POST /tasks`: Create a new task.
- `GET /tasks`: List tasks with query params (`status`, `priority`, `overdue`, `page`, `limit`, `sortBy`, `sortOrder`).
- `GET /tasks/summary`: Get statistics of your tasks.
- `GET /tasks/:id`: Get a specific task.
- `PUT /tasks/:id`: Replace a task.
- `PATCH /tasks/:id`: Update specific fields.
- `DELETE /tasks/:id`: Delete a task.

#### Filtration Example:
`GET /tasks?status=pending&priority=high&overdue=true`

## Deployment

The application is ready for deployment on platforms like Render, Railway, or Vercel. 
1. Push to GitHub.
2. Connect your repository to the hosting platform.
3. Configure the environment variables in the platform dashboard.
4. Ensure MongoDB is accessible (e.g., using MongoDB Atlas).
