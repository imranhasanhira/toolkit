import { useState } from "react";
import {
  getPaginatedUsers,
  getUsersAppPermissions,
  setUserAppPermission,
  useAction,
  useQuery,
} from "wasp/client/operations";
import { Checkbox } from "../../../client/components/ui/checkbox";
import { Input } from "../../../client/components/ui/input";
import { Label } from "../../../client/components/ui/label";
import { APP_DISPLAY_NAMES, APP_KEYS_LIST, type AppKey } from "../../../shared/appKeys";
import useDebounce from "../../../client/hooks/useDebounce";
import LoadingSpinner from "../../layout/LoadingSpinner";

const PAGE_SIZE = 10;

const AppPermissionsMatrix = () => {
  const [currentPage, setCurrentPage] = useState(1);
  const [emailFilter, setEmailFilter] = useState<string>("");
  const debouncedEmail = useDebounce(emailFilter, 300);
  const skipPages = currentPage - 1;

  const { data: usersData, isLoading: usersLoading } = useQuery(
    getPaginatedUsers,
    {
      skipPages,
      filter: {
        emailContains: debouncedEmail || undefined,
      },
    }
  );

  const userIds =
    usersData?.users?.map((u) => u.id) ?? [];
  const { data: permissionsMap, refetch: refetchPermissions } = useQuery(
    getUsersAppPermissions,
    { userIds },
    { enabled: userIds.length > 0 }
  );

  const setUserAppPermissionAction = useAction(setUserAppPermission);

  const handleToggle = async (
    userId: string,
    appKey: AppKey,
    granted: boolean
  ) => {
    await setUserAppPermissionAction({ userId, appKey, granted });
    refetchPermissions();
  };

  const totalPages = usersData?.totalPages ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="border-border bg-card rounded-sm border shadow">
        <div className="bg-muted/40 flex w-full flex-col gap-3 p-6">
          <div className="flex items-center gap-3">
            <Label htmlFor="email-filter" className="text-muted-foreground text-sm">
              Filter by email:
            </Label>
            <Input
              id="email-filter"
              type="text"
              placeholder="Filter..."
              value={emailFilter}
              onChange={(e) => setEmailFilter(e.target.value)}
              className="max-w-xs"
            />
            <div className="flex items-center gap-2">
              <span className="text-sm">Page</span>
              <Input
                type="number"
                min={1}
                max={Math.max(1, totalPages)}
                value={currentPage}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  if (v >= 1 && v <= totalPages) setCurrentPage(v);
                }}
                className="w-16"
              />
              <span className="text-sm">/ {totalPages || 1}</span>
            </div>
          </div>
        </div>

        {usersLoading && <LoadingSpinner />}
        {!usersLoading &&
          usersData?.users &&
          usersData.users.length > 0 &&
          usersData.users.map((user) => (
            <div
              key={user.id}
              className="border-border border-t px-4 py-4 md:px-6"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-8">
                <div className="min-w-0 shrink-0 lg:w-56 xl:w-64">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium">
                      {user.email ?? "—"}
                    </span>
                    {user.username ? (
                      <span className="text-muted-foreground text-xs">
                        {user.username}
                      </span>
                    ) : null}
                  </div>
                  {user.isAdmin ? (
                    <p className="text-muted-foreground mt-1 text-xs">
                      Admin — all apps enabled
                    </p>
                  ) : null}
                </div>
                <div
                  className="flex flex-wrap items-center gap-x-5 gap-y-2.5 border-border/60 lg:border-l lg:pl-8"
                  role="group"
                  aria-label={`App access for ${user.email ?? "user"}`}
                >
                  {APP_KEYS_LIST.map((appKey) => {
                    const allowed =
                      user.isAdmin ||
                      (permissionsMap?.[user.id]?.includes(appKey) ?? false);
                    const controlId = `app-perm-${user.id}-${appKey}`;
                    return (
                      <div
                        key={appKey}
                        className="flex items-center gap-2"
                      >
                        <Checkbox
                          id={controlId}
                          checked={allowed}
                          disabled={!!user.isAdmin}
                          onCheckedChange={(checked) => {
                            if (user.isAdmin) return;
                            handleToggle(user.id, appKey, !!checked);
                          }}
                          title={
                            user.isAdmin
                              ? "Admins have access to all apps"
                              : undefined
                          }
                        />
                        <Label
                          htmlFor={controlId}
                          className={
                            user.isAdmin
                              ? "text-muted-foreground cursor-not-allowed text-sm font-normal"
                              : "cursor-pointer text-sm font-normal"
                          }
                        >
                          {APP_DISPLAY_NAMES[appKey]}
                        </Label>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}

        {!usersLoading && usersData?.users?.length === 0 && (
          <div className="border-border border-t px-4 py-8 text-center text-muted-foreground md:px-6">
            No users match the filter.
          </div>
        )}
      </div>
    </div>
  );
};

export default AppPermissionsMatrix;
