
import { exec } from "child_process";
import fs from "fs";
import path from "path";
import { promisify } from "util"; // Re-added promisify
import { randomUUID } from "crypto";

const execAsync = promisify(exec);

export type Language = "javascript" | "python";

export interface ExecutionContext {
    tempDir: string;
    fileName: string;
    dockerImage: string;
    runCommand: string;
}

export interface ExecutionResult {
    stdout: string;
    status: "ACCEPTED" | "WRONG_ANSWER" | "TIME_LIMIT_EXCEEDED" | "RUNTIME_ERROR" | "COMPILATION_ERROR";
    executionTime: number;
}

export const prepareExecutionEnvironment = (code: string, language: Language | string): ExecutionContext => {
    const id = randomUUID();
    const tempDir = path.join("/tmp", `exec-${id}`);

    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir);
    }

    let fileExtension = "js";
    let dockerImage = "node:18-alpine";
    let fileName = "main.js";
    let runCommand = "";

    if (language === "python") {
        fileExtension = "py";
        dockerImage = "python:3.9-slim";
        fileName = "main.py";
        runCommand = `python /app/${fileName}`;
    } else if (language === "javascript") {
        fileExtension = "js";
        dockerImage = "node:18-alpine";
        fileName = "main.js";
        runCommand = `node /app/${fileName}`;
    } else {
        // Fallback or throw?
        // throw new Error(`Unsupported language: ${language}`);
        // Assuming we only get valid languages from our system
    }

    const filePath = path.join(tempDir, fileName);
    fs.writeFileSync(filePath, code);

    return { tempDir, fileName, dockerImage, runCommand };
};

export const executeTestCase = async (
    ctx: ExecutionContext,
    input: string,
    expectedOutput: string | null = null, // Optional comparison
    timeLimitSeconds: number = 1
): Promise<ExecutionResult> => {
    const inputPath = path.join(ctx.tempDir, "input.txt");
    fs.writeFileSync(inputPath, input);

    const dockerCmd = `docker run --rm -v "${ctx.tempDir}:/app" -i ${ctx.dockerImage} sh -c "${ctx.runCommand} < /app/input.txt"`;

    const startTime = Date.now();
    let stdout = "";
    let status: ExecutionResult["status"] = "ACCEPTED";

    try {
        const { stdout: output } = await execAsync(dockerCmd, {
            timeout: timeLimitSeconds * 1000 + 1000,
        });
        stdout = output.trim();

        if (expectedOutput !== null && stdout !== expectedOutput.trim()) {
            status = "WRONG_ANSWER";
        }

    } catch (error: any) {
        if (error.signal === "SIGTERM") {
            status = "TIME_LIMIT_EXCEEDED";
        } else {
            status = "RUNTIME_ERROR";
            stdout = error.message || error.stderr || "Runtime Error";
        }
    }

    return {
        stdout,
        status,
        executionTime: Date.now() - startTime,
    };
};

export const cleanupExecutionEnvironment = (ctx: ExecutionContext) => {
    try {
        if (fs.existsSync(ctx.tempDir)) {
            fs.rmSync(ctx.tempDir, { recursive: true, force: true });
        }
    } catch (e) {
        console.error("Failed to cleanup temp dir", e);
    }
};
