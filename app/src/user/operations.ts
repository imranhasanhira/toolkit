import { type Prisma } from "@prisma/client";
import { type User } from "wasp/entities";
import { HttpError, prisma } from "wasp/server";
import {
  type GetPaginatedUsers,
  type UpdateIsUserAdminById,
  type GetMyAppPermissions,
  type SetUserAppPermission,
  type GetUsersAppPermissions,
} from "wasp/server/operations";
import * as z from "zod";
import { SubscriptionStatus } from "../payment/plans";
import { ensureArgsSchemaOrThrowHttpError } from "../server/validation";
import { getAllowedAppKeys } from "../server/appPermissions";
import { APP_KEYS_LIST, type AppKey } from "../shared/appKeys";

const updateUserAdminByIdInputSchema = z.object({
  id: z.string().nonempty(),
  isAdmin: z.boolean(),
});

type UpdateUserAdminByIdInput = z.infer<typeof updateUserAdminByIdInputSchema>;

export const updateIsUserAdminById: UpdateIsUserAdminById<
  UpdateUserAdminByIdInput,
  User
> = async (rawArgs, context) => {
  const { id, isAdmin } = ensureArgsSchemaOrThrowHttpError(
    updateUserAdminByIdInputSchema,
    rawArgs,
  );

  if (!context.user) {
    throw new HttpError(
      401,
      "Only authenticated users are allowed to perform this operation",
    );
  }

  if (!context.user.isAdmin) {
    throw new HttpError(
      403,
      "Only admins are allowed to perform this operation",
    );
  }

  return context.entities.User.update({
    where: { id },
    data: { isAdmin },
  });
};

type GetPaginatedUsersOutput = {
  users: Pick<
    User,
    | "id"
    | "email"
    | "username"
    | "subscriptionStatus"
    | "paymentProcessorUserId"
    | "isAdmin"
  >[];
  totalPages: number;
};

const getPaginatorArgsSchema = z.object({
  skipPages: z.number(),
  filter: z.object({
    emailContains: z.string().nonempty().optional(),
    isAdmin: z.boolean().optional(),
    subscriptionStatusIn: z
      .array(z.nativeEnum(SubscriptionStatus).nullable())
      .optional(),
  }),
});

type GetPaginatedUsersInput = z.infer<typeof getPaginatorArgsSchema>;

export const getPaginatedUsers: GetPaginatedUsers<
  GetPaginatedUsersInput,
  GetPaginatedUsersOutput
> = async (rawArgs, context) => {
  if (!context.user) {
    throw new HttpError(
      401,
      "Only authenticated users are allowed to perform this operation",
    );
  }

  if (!context.user.isAdmin) {
    throw new HttpError(
      403,
      "Only admins are allowed to perform this operation",
    );
  }

  const {
    skipPages,
    filter: {
      subscriptionStatusIn: subscriptionStatus,
      emailContains,
      isAdmin,
    },
  } = ensureArgsSchemaOrThrowHttpError(getPaginatorArgsSchema, rawArgs);

  const includeUnsubscribedUsers = !!subscriptionStatus?.some(
    (status) => status === null,
  );
  const desiredSubscriptionStatuses = subscriptionStatus?.filter(
    (status) => status !== null,
  );

  const pageSize = 10;

  const userPageQuery: Prisma.UserFindManyArgs = {
    skip: skipPages * pageSize,
    take: pageSize,
    where: {
      AND: [
        {
          email: {
            contains: emailContains,
            mode: "insensitive",
          },
          isAdmin,
        },
        {
          OR: [
            {
              subscriptionStatus: {
                in: desiredSubscriptionStatuses,
              },
            },
            {
              subscriptionStatus: includeUnsubscribedUsers ? null : undefined,
            },
          ],
        },
      ],
    },
    select: {
      id: true,
      email: true,
      username: true,
      isAdmin: true,
      subscriptionStatus: true,
      paymentProcessorUserId: true,
    },
    orderBy: {
      username: "asc",
    },
  };

  const [pageOfUsers, totalUsers] = await prisma.$transaction([
    context.entities.User.findMany(userPageQuery),
    context.entities.User.count({ where: userPageQuery.where }),
  ]);
  const totalPages = Math.ceil(totalUsers / pageSize);

  return {
    users: pageOfUsers,
    totalPages,
  };
};

export const getMyAppPermissions: GetMyAppPermissions<void, AppKey[]> = async (
  _args,
  context
) => {
  if (!context.user) {
    return [];
  }
  return getAllowedAppKeys(context.user.id, context.user.isAdmin ?? false);
};

const setUserAppPermissionSchema = z.object({
  userId: z.string().nonempty(),
  appKey: z.enum(APP_KEYS_LIST as [AppKey, ...AppKey[]]),
  granted: z.boolean(),
});

type SetUserAppPermissionInput = z.infer<typeof setUserAppPermissionSchema>;

export const setUserAppPermission: SetUserAppPermission<
  SetUserAppPermissionInput,
  void
> = async (rawArgs, context) => {
  if (!context.user) {
    throw new HttpError(401, "Not authenticated");
  }
  if (!context.user.isAdmin) {
    throw new HttpError(403, "Only admins can change app permissions");
  }
  const { userId, appKey, granted } = ensureArgsSchemaOrThrowHttpError(
    setUserAppPermissionSchema,
    rawArgs
  );
  if (granted) {
    await context.entities.UserAppPermission.upsert({
      where: {
        userId_appKey: { userId, appKey },
      },
      create: { userId, appKey },
      update: {},
    });
  } else {
    await context.entities.UserAppPermission.deleteMany({
      where: { userId, appKey },
    });
  }
};

const getUsersAppPermissionsSchema = z.object({
  userIds: z.array(z.string().nonempty()),
});

export const getUsersAppPermissions: GetUsersAppPermissions<
  z.infer<typeof getUsersAppPermissionsSchema>,
  Record<string, AppKey[]>
> = async (rawArgs, context) => {
  if (!context.user) {
    throw new HttpError(401, "Not authenticated");
  }
  if (!context.user.isAdmin) {
    throw new HttpError(403, "Only admins can view app permissions");
  }
  const { userIds } = ensureArgsSchemaOrThrowHttpError(
    getUsersAppPermissionsSchema,
    rawArgs
  );
  if (userIds.length === 0) return {};
  const rows = await context.entities.UserAppPermission.findMany({
    where: { userId: { in: userIds } },
    select: { userId: true, appKey: true },
  });
  const result: Record<string, AppKey[]> = {};
  for (const id of userIds) result[id] = [];
  for (const r of rows) {
    if (!result[r.userId]) result[r.userId] = [];
    result[r.userId].push(r.appKey as AppKey);
  }
  return result;
};
