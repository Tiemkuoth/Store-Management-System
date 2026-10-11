/**
 * Comprehensive Zod validation schemas for all API endpoints
 */

import { z } from 'zod';

// ── Common field schemas ────────────────────────────────────────
const emailSchema = z.string().email('Invalid email address');
const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain uppercase letter')
  .regex(/[0-9]/, 'Password must contain number');
const usernameSchema = z.string()
  .min(3, 'Username must be at least 3 characters')
  .max(50, 'Username must be at most 50 characters')
  .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, _, -');
const nameSchema = z.string()
  .min(2, 'Name must be at least 2 characters')
  .max(100, 'Name must be at most 100 characters');
const idSchema = z.number().int('ID must be an integer').positive('ID must be positive');

// ── Auth Schemas ────────────────────────────────────────────────
export const loginSchema = z.object({
  username: usernameSchema,
  password: z.string().min(1, 'Password is required'),
});

export const signupSchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
  full_name: nameSchema,
  email: emailSchema,
});

export const changePasswordSchema = z.object({
  new_password: passwordSchema,
  current_password: z.string().min(1, 'Current password is required'),
});

export const forceChangePasswordSchema = z.object({
  user_id: idSchema,
  current_password: z.string().min(1, 'Current password is required'),
  new_password: passwordSchema,
});

// ── User Schemas ────────────────────────────────────────────────
export const updateProfileSchema = z.object({
  full_name: nameSchema,
  email: emailSchema,
  theme_preference: z.enum(['Light', 'Dark']).optional(),
}).strict();

export const updateUserSchema = z.object({
  full_name: nameSchema.optional(),
  email: emailSchema.optional(),
  role: z.enum(['Director', 'Administrator', 'Manager', 'Storekeeper', 'Employee']).optional(),
  status: z.enum(['Active', 'Inactive']).optional(),
  theme_preference: z.enum(['Light', 'Dark']).optional(),
}).strict();

export const updateUserStatusSchema = z.object({
  status: z.enum(['Active', 'Inactive'], 'Invalid status'),
}).strict();

export const createUserSchema = z.object({
  username: usernameSchema,
  full_name: nameSchema,
  email: emailSchema,
  role: z.enum(['Director', 'Administrator', 'Manager', 'Storekeeper', 'Employee']),
  status: z.enum(['Active', 'Inactive']).optional(),
  avatar_url: z.string().url().optional().nullable(),
  theme_preference: z.enum(['Light', 'Dark']).optional(),
}).strict();

export const resetPasswordSchema = z.object({
  new_password: passwordSchema,
}).strict();

// ── Message Schemas ────────────────────────────────────────────
export const sendMessageSchema = z.object({
  recipient_id: idSchema,
  content: z.string()
    .min(1, 'Message cannot be empty')
    .max(5000, 'Message must be less than 5000 characters')
    .trim(),
}).strict();

export const markMessageReadSchema = z.object({}).strict();

export const messageIdParamSchema = z.object({
  id: idSchema,
}).strict();

export const paginationSchema = z.object({
  page: z.string().regex(/^\d+$/, 'Page must be a number').transform(Number).optional(),
  limit: z.string().regex(/^\d+$/, 'Limit must be a number').transform(Number).optional(),
}).strict();

// ── Material Schemas ────────────────────────────────────────────
export const createMaterialSchema = z.object({
  name: nameSchema,
  description: z.string().max(1000).optional(),
  sku: z.string().min(1, 'SKU is required').max(50),
  unit: z.enum(['PCS', 'KG', 'L', 'M', 'BOX', 'PACK']),
  reorder_level: z.number().int().min(0),
  reorder_quantity: z.number().int().min(1),
  category_id: idSchema.optional(),
}).strict();

export const updateMaterialSchema = z.object({
  name: nameSchema.optional(),
  description: z.string().max(1000).optional(),
  sku: z.string().min(1).max(50).optional(),
  unit: z.enum(['PCS', 'KG', 'L', 'M', 'BOX', 'PACK']).optional(),
  reorder_level: z.number().int().min(0).optional(),
  reorder_quantity: z.number().int().min(1).optional(),
  category_id: idSchema.optional(),
}).strict();

// ── Transaction Schemas ─────────────────────────────────────────
export const createTransactionSchema = z.object({
  type: z.enum(['IN', 'OUT', 'ADJUSTMENT']),
  material_id: idSchema,
  quantity: z.number().positive('Quantity must be positive'),
  reason: z.string().min(1, 'Reason is required').max(500),
  reference_number: z.string().min(1).max(100).optional(),
  notes: z.string().max(1000).optional(),
}).strict();

export const updateTransactionSchema = z.object({
  quantity: z.number().positive().optional(),
  reason: z.string().min(1).max(500).optional(),
  notes: z.string().max(1000).optional(),
}).strict();

// ── Task Schemas ────────────────────────────────────────────────
export const createTaskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(2000).optional(),
  assigned_to: idSchema.optional(),
  priority: z.enum(['Low', 'Medium', 'High', 'Critical']).optional(),
  due_date: z.string().datetime().optional(),
  status: z.enum(['Open', 'In Progress', 'Completed']).optional(),
}).strict();

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  assigned_to: idSchema.optional(),
  priority: z.enum(['Low', 'Medium', 'High', 'Critical']).optional(),
  due_date: z.string().datetime().optional(),
  status: z.enum(['Open', 'In Progress', 'Completed']).optional(),
}).strict();

// ── Notification Schemas ────────────────────────────────────────
export const markNotificationReadSchema = z.object({
  id: z.number().int().positive(),
}).strict();

export const createNotificationSchema = z.object({
  user_id: idSchema,
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(1000),
  type: z.enum(['message', 'alert', 'system', 'task']).optional(),
  data: z.record(z.any()).optional(),
}).strict();

// ── Role & Permission Schemas ───────────────────────────────────
export const updateUserRoleSchema = z.object({
  role: z.enum(['Director', 'Administrator', 'Manager', 'Storekeeper', 'Employee']),
}).strict();

// ── Category Schemas ────────────────────────────────────────────
export const createCategorySchema = z.object({
  name: nameSchema,
  description: z.string().max(500).optional(),
}).strict();

export const updateCategorySchema = z.object({
  name: nameSchema.optional(),
  description: z.string().max(500).optional(),
}).strict();

// ── Supplier Schemas ────────────────────────────────────────────
export const createSupplierSchema = z.object({
  name: nameSchema,
  email: emailSchema.optional(),
  phone: z.string().min(1).max(20).optional(),
  address: z.string().max(500).optional(),
}).strict();

export const updateSupplierSchema = z.object({
  name: nameSchema.optional(),
  email: emailSchema.optional(),
  phone: z.string().min(1).max(20).optional(),
  address: z.string().max(500).optional(),
}).strict();

// ── Purchase Order Schemas ──────────────────────────────────────
export const createPurchaseOrderSchema = z.object({
  supplier_id: idSchema,
  materials: z.array(z.object({
    material_id: idSchema,
    quantity: z.number().positive(),
    unit_price: z.number().positive(),
  })).min(1, 'At least one material required'),
  expected_delivery_date: z.string().datetime().optional(),
  notes: z.string().max(1000).optional(),
}).strict();

export const approvePurchaseOrderSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  notes: z.string().max(500).optional(),
}).strict();

// ── System Settings Schemas ────────────────────────────────────
export const updateSystemSettingsSchema = z.object({
  organization_name: z.string().min(1).max(200).optional(),
  organization_email: z.string().email().optional(),
  max_inactive_sessions: z.number().int().min(1).optional(),
  session_timeout: z.number().int().min(15).optional(),
  pwd_min_length: z.number().int().min(8).max(128).optional(),
  pwd_max_failed_attempts: z.number().int().min(1).optional(),
  pwd_lockout_duration_mins: z.number().int().min(1).optional(),
}).strict();

// ── Search/Filter Schemas ───────────────────────────────────────
export const searchSchema = z.object({
  q: z.string().min(1).max(100).optional(),
  page: z.string().regex(/^\d+$/).transform(Number).optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).optional(),
  sort_by: z.string().max(50).optional(),
  order: z.enum(['ASC', 'DESC']).optional(),
}).strict();

// ── Validation helper ────────────────────────────────────────────
export function validateRequest(schema, data) {
  const result = schema.safeParse(data);
  
  if (!result.success) {
    const errors = result.error.errors.map(err => ({
      field: err.path.join('.'),
      message: err.message,
      code: err.code,
    }));
    
    return {
      valid: false,
      errors,
      message: `Validation failed: ${errors[0]?.message || 'Unknown error'}`,
    };
  }
  
  return {
    valid: true,
    data: result.data,
  };
}
