import { HttpError, prisma } from 'wasp/server';
import type { AppKey } from '../shared/appKeys';

/**
 * App permission checks (UserAppPermission) are NOT enforced by any global middleware.
 * Each app-specific action/query and any custom API (e.g. serveFile) must explicitly:
 * - Call requireAppAccess(context.user.id, appKey, context.user.isAdmin) at the start, or
 * - Use hasAppAccess() for custom logic (e.g. file owner + app access).
 * Add this to every new SokaFilm / Online Judge (or other app) operation.
 */

/**
 * Throws HttpError 403 if the user does not have access to the app.
 * Call at the start of app-specific operations.
 */
export async function requireAppAccess(
  userId: string,
  appKey: AppKey,
  isAdmin?: boolean
): Promise<void> {
  const allowed = await hasAppAccess(userId, appKey, isAdmin);
  if (!allowed) {
    throw new HttpError(403, 'Access denied to this app');
  }
}

/**
 * Returns true if the user is allowed to access the given app.
 * Admins are allowed all apps. Otherwise checks UserAppPermission.
 */
export async function hasAppAccess(
  userId: string,
  appKey: AppKey,
  isAdmin?: boolean
): Promise<boolean> {
  if (isAdmin) return true;
  const row = await prisma.userAppPermission.findUnique({
    where: {
      userId_appKey: { userId, appKey },
    },
  });
  return !!row;
}

/**
 * Returns the list of app keys the user is allowed to access.
 * Admins get all apps. Otherwise returns only granted permissions.
 */
export async function getAllowedAppKeys(
  userId: string,
  isAdmin?: boolean
): Promise<AppKey[]> {
  if (isAdmin) {
    return ['sokafilm', 'online-judge'] as AppKey[];
  }
  const rows = await prisma.userAppPermission.findMany({
    where: { userId },
    select: { appKey: true },
  });
  return rows.map((r) => r.appKey as AppKey);
}
