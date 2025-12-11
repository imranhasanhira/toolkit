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
      where: { email: "admin@example.com" },
      data: { isAdmin: true },
    });

    // Seed Runtimes
    const runtimes = [
      { language: "javascript", defaultCode: "// Write your JavaScript code here\n" },
      { language: "python", defaultCode: "# Write your Python code here\n" },
    ];

    for (const rt of runtimes) {
      await prismaClient.runtime.upsert({
        where: { language: rt.language },
        update: {},
        create: rt,
      });
    }
    console.log(`User ${email} is now an admin.`);
  } else {
    console.log(`User ${email} not found. Please sign up first.`);
  }
}
