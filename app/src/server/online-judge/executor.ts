
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
    const stdoutPath = path.join(tempDir, "stdout.txt");
    const stderrPath = path.join(tempDir, "stderr.txt");
    const timePath = path.join(tempDir, "time.txt");

    fs.writeFileSync(inputPath, input);

    const runScriptPath = path.join(tempDir, "run.sh");
    // We create a robust wrapper script to handle:
    // 1. Shell differences (bash vs sh/time availability)
    // 2. Complex quoting (avoiding nested quote hell in docker command)
    // 3. Ensuring inputs/outputs are redirected correctly
    const runScript = `#!/bin/sh
CMD="${runtime.runCommand.replace(/"/g, '\\"')}"
if [ -x /bin/bash ]; then
    # Debian/Ubuntu (has bash, time is builtin or in /usr/bin)
    exec /bin/bash -c "time -p sh -c \\"\$CMD < input.txt > stdout.txt 2> stderr.txt\\" 2> time.txt"
else
    # Alpine (busybox sh has time)
    exec time -p sh -c "$CMD < input.txt > stdout.txt 2> stderr.txt" 2> time.txt
fi
`;
    fs.writeFileSync(runScriptPath, runScript);

    // Command: docker run ... sh /app/run.sh
    const dockerCmd = `docker run --rm --network none --memory ${runtime.memoryLimit}m --cpus ${runtime.cpuLimit} -v "${tempDir}":/app -w /app ${runtime.dockerImage} sh /app/run.sh`;

    const startTime = process.hrtime();

    try {
        await execAsync(dockerCmd, {
            timeout: timeLimit * 1000,
            maxBuffer: 1024 * 1024 // 1MB output limit (for Docker structure output, not user output anymore)
        });

        // Read outputs from files
        // Paths already defined above.

        let actualOutput = "";
        let stderrOutput = ""; // We can optionaly return this if needed for debugging users code
        let executionTime = 0; // ms

        if (fs.existsSync(stdoutPath)) {
            actualOutput = fs.readFileSync(stdoutPath, "utf-8").trim();
        }

        // Try to parse execution time from time.txt
        // Format:
        // real 0.00
        // user 0.00
        // sys 0.00
        if (fs.existsSync(timePath)) {
            const timeContent = fs.readFileSync(timePath, "utf-8");
            const realTimeMatch = timeContent.match(/real\s+(\d+\.?\d*)/);
            if (realTimeMatch && realTimeMatch[1]) {
                // Convert seconds to ms
                executionTime = Math.round(parseFloat(realTimeMatch[1]) * 1000);
            } else {
                // Fallback if parsing fails (shouldn't happen if time works)
                const diff = process.hrtime(startTime);
                executionTime = Math.round(diff[0] * 1000 + diff[1] / 1e6);
            }
        } else {
            // Fallback if time.txt doesn't exist (e.g. killed by timeout or docker error)
            const diff = process.hrtime(startTime);
            executionTime = Math.round(diff[0] * 1000 + diff[1] / 1e6);
        }

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
        // If the process timed out or errored
        const diff = process.hrtime(startTime);

        // If it was a timeout from execAsync, it likely means valid TLE
        if (error.signal === "SIGTERM" || error.cancelled) { // exec default timeout kill
            return {
                status: "TIME_LIMIT_EXCEEDED",
                stdout: "",
                executionTime: timeLimit * 1000
            };
        }

        // For other errors, check if we have partial output or if it's a runtime error
        // But usually exec error implies non-zero exit code.

        // If time.txt or stderr.txt exists, we might glean more info.
        // For SIMPLICITY: Treat non-zero exit as RUNTIME_ERROR
        return {
            status: "RUNTIME_ERROR",
            stdout: error.stderr || (fs.existsSync(stderrPath) ? fs.readFileSync(stderrPath, "utf-8") : "") || error.message || "Runtime Error",
            executionTime: Math.round(diff[0] * 1000 + diff[1] / 1e6)
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
