import { z } from 'zod';
import { TaskStatus, TaskPriority } from '../utils/constants.js';

// Validation for task creation and updates
export const taskBodySchema = z.object({
  title: z.string().min(1, 'Title is required').max(100),
  description: z.string().max(500).optional().nullable(),
  tags: z.string().max(200).optional().nullable(),
  priority: z.nativeEnum(TaskPriority, {
    message: 'Invalid priority. Choose: low, medium, high'
  }),
  dueDate: z.string().datetime({ message: 'Invalid ISO date content' }).optional().nullable().transform(v => v ? new Date(v) : undefined),
  status: z.nativeEnum(TaskStatus, {
    message: 'Invalid status'
  }).optional().default(TaskStatus.PENDING),
  workspaceId: z.string().optional().nullable(),
  assigneeId: z.string().optional().nullable()
});

// For update: make all fields optional but validate if present
export const updateTaskBodySchema = taskBodySchema.partial();

// For filters/query params
export const taskQuerySchema = z.object({
  status: z.nativeEnum(TaskStatus).optional(),
  priority: z.nativeEnum(TaskPriority).optional(),
  overdue: z.string().transform((v) => v === 'true').optional(),
  page: z.string().transform((v) => parseInt(v)).optional(),
  limit: z.string().transform((v) => parseInt(v)).optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional().default('asc')
});
