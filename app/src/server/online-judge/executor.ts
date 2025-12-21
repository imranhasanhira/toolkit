
import { exec, execFile } from "child_process";
import fs from "fs";
import path from "path";
import { promisify } from "util";
import { randomUUID } from "crypto";

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);
const MAX_OUTPUT_SIZE = 1024 * 1024; // 1MB



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
    // Strict Validation (allows alphanumeric, ., -, _, :, /, @)
    // Ref: https://github.com/distribution/distribution/blob/v2.7.1/docs/spec/api.md
    if (!/^[a-zA-Z0-9.\-_:\/@]+$/.test(runtime.dockerImage)) {
        throw new Error("Invalid docker image name");
    }
    if (!/^[a-zA-Z0-9._-]+$/.test(runtime.fileName)) {
        throw new Error("Invalid file name");
    }
    if (typeof runtime.memoryLimit !== "number" || runtime.memoryLimit <= 0) {
        throw new Error("Invalid memory limit");
    }
    if (typeof runtime.cpuLimit !== "number" || runtime.cpuLimit <= 0) {
        throw new Error("Invalid cpu limit");
    }

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

    // Simplified approach: write the command to a separate file to avoid nested quoting issues
    const cmdScriptPath = path.join(tempDir, "cmd.sh");
    fs.writeFileSync(cmdScriptPath, runtime.runCommand);
    fs.chmodSync(cmdScriptPath, 0o755);

    const runScriptPath = path.join(tempDir, "run.sh");
    const runScript = `#!/bin/sh
# Execute the user command with I/O redirection and timing
if command -v time >/dev/null 2>&1; then
    time -p sh cmd.sh < input.txt > stdout.txt 2> stderr.txt 2> time.txt
else
    # Fallback if time is not available
    sh cmd.sh < input.txt > stdout.txt 2> stderr.txt
fi
`;
    fs.writeFileSync(runScriptPath, runScript);

    const dockerArgs = [
        "run", "--rm", "--network", "none",
        "--memory", `${runtime.memoryLimit}m`,
        "--cpus", `${runtime.cpuLimit.toString()}`,
        "-v", `${tempDir}:/app`,
        "-w", "/app",
        runtime.dockerImage,
        "sh", "/app/run.sh"
    ];

    const startTime = process.hrtime();

    try {
        await execFileAsync("docker", dockerArgs, {
            timeout: timeLimit * 1000,
            maxBuffer: MAX_OUTPUT_SIZE
        });

        // Read outputs from files
        // Paths already defined above.

        let actualOutput = "";
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

        // Check for file outputs first
        let userStderr = "";
        try {
            if (fs.existsSync(stderrPath)) {
                userStderr = fs.readFileSync(stderrPath, "utf-8").trim();
            }
        } catch (e) { /* ignore read error */ }

        let userStdout = "";
        try {
            if (fs.existsSync(stdoutPath)) {
                userStdout = fs.readFileSync(stdoutPath, "utf-8").trim();
            }
        } catch (e) { /* ignore read error */ }

        let timeDiagnostics = "";
        try {
            if (fs.existsSync(timePath)) {
                const timeFileContent = fs.readFileSync(timePath, "utf-8").trim();
                // If it contains timing data like "real 0.00", ignore it for error reporting
                // Otherwise, it might contain shell errors that we should show
                if (timeFileContent && !timeFileContent.includes("real ")) {
                    timeDiagnostics = timeFileContent;
                }
            }
        } catch (e) { /* ignore read error */ }

        // Docker stderr (e.g. image missing, resource limits reached)
        const dockerStderr = error.stderr ? error.stderr.toString().trim() : "";

        // Construct a meaningful error message
        // Priority: Container Stderr -> Timing/Setup Error -> Docker Stderr -> Stdout fallback
        const finalOutput = userStderr || timeDiagnostics || dockerStderr || (userStdout ? `Process exited with error.\nStdout: ${userStdout}` : "") || "Runtime Error (No output)";

        return {
            status: "RUNTIME_ERROR",
            stdout: finalOutput,
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
        await execFileAsync("docker", ["version"]);
        return true;
    } catch (e) {
        return false;
    }
};

export const checkDockerImageExists = async (image: string): Promise<boolean> => {
    // Basic validation before passing to execFile
    if (!/^[a-zA-Z0-9.\-_:\/@]+$/.test(image)) {
        return false;
    }
    try {
        await execFileAsync("docker", ["inspect", "--type=image", image]);
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
