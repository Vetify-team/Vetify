import type { User } from '@vetify/types';
import { toIsoDateTime } from '../common/dates.js';
import type { User as UserRow } from '../generated/prisma/client.js';

export const toUser = (user: UserRow): User => ({
  id: user.id,
  email: user.email,
  name: user.name,
  role: user.role,
  phone: user.phone,
  createdAt: toIsoDateTime(user.createdAt),
});
