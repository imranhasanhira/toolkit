/** Stored in scopeId when projectId is null. Unique with the user, not with any project. */
export const GLOBAL_SCOPE_ID = 'global';

export type LeaveScope = 'project' | 'global';

export function scopeIdFor(projectId: string | null): string {
  return projectId ?? GLOBAL_SCOPE_ID;
}

export function isGlobalRow(projectId: string | null | undefined): boolean {
  return projectId == null;
}

export function isVisibleInProject(rowProjectId: string | null | undefined, activeProjectId: string): boolean {
  return rowProjectId == null || rowProjectId === activeProjectId;
}
