# 🚀 TaskMaster Pro: Premium Full-Stack Management Suite

TaskMaster Pro is a high-performance, full-stack Task Management System designed for both personal productivity and team collaboration. It features a modern **Glassmorphism UI**, a dynamic **Kanban Board**, and a scalable **Node.js/TypeScript** backend.

---

## ✨ Key Features

### 🎨 Elite Interface (Frontend)
- **Dynamic Views**: Switch between a drag-and-drop **Kanban Board**, a classic **Task List**, and a full **Calendar View**.
- **Modern Aesthetics**: Premium Dark Mode with glass effects, smooth transitions, and responsive design.
- **Micro-interactions**: Real-time status updates via drag-and-drop and one-click actions.
- **Activity Feed**: Live history of all changes made to a task (edits, moves, assignments).
- **Communication**: Threaded comment sections on every task with user avatars.
- **File Management**: Securely upload images, PDFs, and documents directly to tasks.
- **Smart Reminders**: Desktop browser notifications for tasks due within 24 hours.

### 🤝 Team Collaboration
- **Global User Search**: Assign tasks to *any* registered user instantly by searching their name or email. No setup required!
- **Workspaces**: Create dedicated team spaces, invite members with roles (Owner/Admin/Member), and move tasks between Personal and Team areas.
- **Live Assignment**: Real-time type-ahead search for assigning tasks to colleagues.

### ⚙️ Scalable Backend (API)
- **Robust Tech**: Built with **Node.js**, **Express**, and **TypeScript**.
- **API Friendly**: Fully documented REST API (`/api/v1`) with consistent JSON envelopes. [See API Reference](./api_reference.md).
- **Advanced Pagination**: Optimized for thousands of tasks with page-based loading (20 tasks per page).
- **Database Power**: Driven by **Prisma ORM** and **PostgreSQL (Supabase)** for persistent, production-grade data.
- **Validation**: Strict input validation using **Zod**.
- **Auth**: Secure JWT-based authentication with password hashing and protected routes.

---

## 🛠️ Tech Stack

- **Frontend**: Vanilla HTML5, CSS3 (Modern Flexbox/Grid), JavaScript (ES6+)
- **Backend**: Node.js & Express.js
- **Language**: TypeScript (Strict Mode)
- **ORM**: Prisma
- **Database**: PostgreSQL (Supabase ready) / SQLite (Local dev)
- **Authentication**: JSON Web Tokens (JWT) & Bcrypt
- **File Handling**: Multer (Local static serving)

---

## 🚀 Getting Started

### 1. Clone & Install
```bash
git clone git@github.com:avinash-borse/TaskMaster-Pro.git
cd task-management-system
npm install
```

### 2. Configure Environment
Create a `.env` file from the template:
```bash
cp .env.example .env
```
Update your `DATABASE_URL` (Supabase link) and your `JWT_SECRET`.

### 3. Initialize Database
```bash
npx prisma generate
npx prisma db push
```

### 4. Run Locally
```bash
npm run dev
```
Open `http://localhost:3000` to see the full application!

---

## 🌐 Deployment (One-Click)

The project is pre-configured for **Render** via `render.yaml`:
1. Push this repo to your GitHub.
2. Go to **Render Dashboard** → **New** → **Blueprint**.
3. Select this repository and provide your **Supabase DATABASE_URL**.
4. Render will automatically build the TS files and deploy your live site!

---

## 📜 API Documentation
For a detailed guide on all backend endpoints (Auth, Tasks, Comments, Files), see our [API Reference Guide](./api_reference.md).

---

## 📄 License
This project is open-source and ready for customization.
