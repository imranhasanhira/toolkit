
import { exec } from "child_process";
import fs from "fs";
import path from "path";
import { promisify } from "util"; // Re-added promisify
import { randomUUID } from "crypto";

const execAsync = promisify(exec);

export type Language = "javascript" | "python";

export interface RuntimeConfig {
    fileName: string;
    dockerImage: string;
    runCommand: string;
    memoryLimit: number;
    cpuLimit: number;
}

export interface ExecutionContext {
    tempDir: string;
    runtime: RuntimeConfig;
}

export interface ExecutionResult {
    stdout: string;
    status: "ACCEPTED" | "WRONG_ANSWER" | "TIME_LIMIT_EXCEEDED" | "RUNTIME_ERROR" | "COMPILATION_ERROR";
    executionTime: number;
}

export const prepareExecutionEnvironment = (code: string, runtime: RuntimeConfig): ExecutionContext => {
    const id = randomUUID();
    const tempDir = path.join("/tmp", `exec-${id}`);

    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir);
    }

    const filePath = path.join(tempDir, runtime.fileName);
    fs.writeFileSync(filePath, code);

    return {
        tempDir,
        runtime
    };
};

export const executeTestCase = async (
    context: ExecutionContext,
    input: string,
    expectedOutput: string | null = null, // Optional comparison
    timeLimit: number = 1
): Promise<ExecutionResult> => {
    const { tempDir, runtime } = context;
    const inputPath = path.join(tempDir, "input.txt");
    fs.writeFileSync(inputPath, input);

    // Construct Docker command using runtime config
    // We mount the tempDir to /app in the container
    // We use `timeout` command inside shell or docker logic if possible.
    // Simpler: Use docker run with limits (though timeout signal handling is tricky).
    // Let's use `timeout` on host for simplicity or node's child_process timeout.

    // Command: docker run --rm -v tempDir:/app -w /app runtime.dockerImage sh -c "runtime.runCommand < input.txt"
    // Note: This assumes the image has sh. Most alpine/slim do.

    // Safety: runCommand comes from DB (Admin controlled).

    // We need to properly escape the command? ideally runCommand is simple "node file.js"
    const dockerCmd = `docker run --rm --network none --memory ${runtime.memoryLimit}m --cpus ${runtime.cpuLimit} -v "${tempDir}":/app -w /app ${runtime.dockerImage} sh -c "${runtime.runCommand} < input.txt"`;

    const startTime = process.hrtime();

    try {
        const { stdout, stderr } = await execAsync(dockerCmd, {
            timeout: timeLimit * 1000,
            maxBuffer: 1024 * 1024 // 1MB output limit
        });

        const diff = process.hrtime(startTime);
        const executionTime = Math.round(diff[0] * 1000 + diff[1] / 1e6); // in ms

        const actualOutput = stdout.trim();
        const expected = expectedOutput ? expectedOutput.trim() : null;

        let status: ExecutionResult["status"] = "ACCEPTED";
        if (expected !== null && actualOutput !== expected) {
            status = "WRONG_ANSWER";
        }

        return {
            status,
            stdout: actualOutput,
            executionTime
        };

    } catch (error: any) {
        const diff = process.hrtime(startTime);
        const executionTime = Math.round(diff[0] * 1000 + diff[1] / 1e6);

        if (error.killed || error.signal === 'SIGTERM') {
            return { status: "TIME_LIMIT_EXCEEDED", stdout: "", executionTime };
        }

        // Check for common error codes if needed, or return RUNTIME_ERROR
        return {
            status: "RUNTIME_ERROR",
            stdout: error.stderr || error.message || "Error",
            executionTime
        };
    }
};

// ... existing code ...

export type RuntimeStatus = {
    dockerAvailable: boolean;
    imageExists: boolean;
    status: "READY" | "IMAGE_MISSING" | "DOCKER_UNAVAILABLE";
};

export const checkDockerAvailable = async (): Promise<boolean> => {
    try {
        await execAsync("docker version");
        return true;
    } catch (e) {
        return false;
    }
};

export const checkDockerImageExists = async (image: string): Promise<boolean> => {
    try {
        await execAsync(`docker inspect --type=image ${image}`);
        return true;
    } catch (e) {
        return false;
    }
};

export const validateRuntime = async (dockerImage: string): Promise<RuntimeStatus> => {
    const dockerAvailable = await checkDockerAvailable();
    if (!dockerAvailable) {
        return { dockerAvailable: false, imageExists: false, status: "DOCKER_UNAVAILABLE" };
    }

    const imageExists = await checkDockerImageExists(dockerImage);
    return {
        dockerAvailable: true,
        imageExists,
        status: imageExists ? "READY" : "IMAGE_MISSING"
    };
};

export const cleanupExecutionEnvironment = (context: ExecutionContext) => {
    try {
        if (fs.existsSync(context.tempDir)) {
            fs.rmSync(context.tempDir, { recursive: true, force: true });
        }
    } catch (e) {
        console.error("Failed to cleanup temp dir", e);
    }
};
