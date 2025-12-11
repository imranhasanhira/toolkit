import type { PrismaClient } from "@prisma/client";

export async function seedMockUsers(prismaClient: PrismaClient) {
  const email = "admin@example.com";
  console.log(`Checking for user ${email}...`);
  const user = await prismaClient.user.findFirst({
    where: { email },
  });

  if (user) {
    console.log(`Found user ${email}, updating to admin...`);
    await prismaClient.user.update({
      where: { id: user.id },
      data: { isAdmin: true },
    });
    console.log(`User ${email} is now an admin.`);
  } else {
    console.log(`User ${email} not found. Please sign up first.`);
  }
}
