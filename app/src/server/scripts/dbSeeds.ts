import type { PrismaClient } from "@prisma/client";

export async function seedMockUsers(prismaClient: PrismaClient) {
  // 1. Always seed Runtimes
  const runtimes = [
    {
      language: "javascript",
      defaultCode: "// Write your JavaScript code here\n// Inputs are passed to stdin. Output to stdout.\n\nconst fs = require('fs');\nconst stdin = fs.readFileSync(0, 'utf-8');\nconsole.log('Hello from JS');",
      dockerImage: "node:18-alpine",
      runCommand: "node solution.js",
      fileName: "solution.js",
      memoryLimit: 128,
      cpuLimit: 0.5,
    },
    {
      language: "python",
      defaultCode: "# Write your Python code here\nimport sys\n\ninput_data = sys.stdin.read()\nprint('Hello from Python')",
      dockerImage: "python:3.9-slim",
      runCommand: "python3 solution.py",
      fileName: "solution.py",
      memoryLimit: 128,
      cpuLimit: 0.5,
    },
    {
      language: "java",
      defaultCode: "import java.util.Scanner;\n\npublic class Solution {\n    public static void main(String[] args) {\n        System.out.println(\"Hello from Java\");\n    }\n}",
      // dockerImage: "azul/zulu-openjdk:25-latest", // Using 25-slim as requested, though it might be EA
      dockerImage: "eclipse-temurin:25-jdk-jammy",
      runCommand: "java Solution.java",
      fileName: "Solution.java",
      memoryLimit: 512,
      cpuLimit: 1.0,
    },
    {
      language: "typescript",
      defaultCode: "console.log('Hello from TypeScript');",
      dockerImage: "node:18-alpine",
      runCommand: "npx -y ts-node solution.ts",
      fileName: "solution.ts",
      memoryLimit: 128,
      cpuLimit: 0.5,
    },
    {
      language: "c",
      defaultCode: "#include <stdio.h>\n\nint main() {\n    printf(\"Hello from C\\n\");\n    return 0;\n}",
      dockerImage: "gcc:12",
      runCommand: "gcc solution.c -o solution && ./solution",
      fileName: "solution.c",
      memoryLimit: 128,
      cpuLimit: 0.5,
    },
    {
      language: "cpp",
      defaultCode: "#include <iostream>\n\nint main() {\n    std::cout << \"Hello from C++\" << std::endl;\n    return 0;\n}",
      dockerImage: "gcc:12",
      runCommand: "g++ solution.cpp -o solution && ./solution",
      fileName: "solution.cpp",
      memoryLimit: 128,
      cpuLimit: 0.5,
    },
  ];

  for (const runtime of runtimes) {
    await prismaClient.runtime.upsert({
      where: { language: runtime.language },
      update: runtime,
      create: runtime,
    });
  }
  console.log("Runtimes seeded.");
}
