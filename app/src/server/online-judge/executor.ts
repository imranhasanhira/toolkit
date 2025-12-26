
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import Docker from "dockerode";

// Connect to default socket: /var/run/docker.sock
// This works perfectly with the Dokku host mount
const docker = new Docker();

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
    memoryUsage: number; // MB
}

export const prepareExecutionEnvironment = (code: string, runtime: RuntimeConfig): ExecutionContext => {
    // Strict Validation (allows alphanumeric, ., -, _, :, /, @)
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
    fs.chmodSync(tempDir, 0o777); // Ensure docker can read/write

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
    // Create empty output files with wide permissions so docker can write to them
    fs.writeFileSync(stdoutPath, "");
    fs.chmodSync(stdoutPath, 0o666);
    fs.writeFileSync(stderrPath, "");
    fs.chmodSync(stderrPath, 0o666);

    // Simplified approach: write the command to a separate file
    const cmdScriptPath = path.join(tempDir, "cmd.sh");
    fs.writeFileSync(cmdScriptPath, runtime.runCommand);
    fs.chmodSync(cmdScriptPath, 0o755);

    const runScriptPath = path.join(tempDir, "run.sh");
    const exitCodePath = path.join(tempDir, "exit_code.txt");

    // Capture exit code of the internal command explicitly
    const runScript = `#!/bin/sh
sh cmd.sh < input.txt > stdout.txt 2> stderr.txt
echo $? > exit_code.txt
`;
    fs.writeFileSync(runScriptPath, runScript);
    fs.chmodSync(runScriptPath, 0o755);

    const startTime = process.hrtime();
    let container;

    try {
        container = await docker.createContainer({
            Image: runtime.dockerImage,
            Cmd: ["sh", "/app/run.sh"],
            Tty: false,
            NetworkDisabled: true, // Security: No network access
            HostConfig: {
                Binds: [`${tempDir}:/app`],
                Memory: runtime.memoryLimit * 1024 * 1024, // MB to bytes
                NanoCpus: runtime.cpuLimit * 1e9, // CPUs to nanoCPUs
                AutoRemove: false // We control removal
            },
            WorkingDir: "/app",
        });

        await container.start();

        // Wait for container to finish or timeout
        // dockerode doesn't have a simple timeout for wait(), so we race prompts
        const waitPromise = container.wait();
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error("GenericTimeout")), timeLimit * 1000)
        );

        await Promise.race([waitPromise, timeoutPromise]);

        // Calculate execution time (rough estimate from host perspective)
        const diff = process.hrtime(startTime);
        const executionTime = Math.round(diff[0] * 1000 + diff[1] / 1e6);

        // Read outputs with size limit
        const MAX_OUTPUT_SIZE = 2 * 1024 * 1024; // 2MB

        const readAndTruncate = (filePath: string): string => {
            if (!fs.existsSync(filePath)) return "";
            const stats = fs.statSync(filePath);
            if (stats.size > MAX_OUTPUT_SIZE) {
                // Read first 20KB
                const buffer = Buffer.alloc(MAX_OUTPUT_SIZE);
                const fd = fs.openSync(filePath, "r");
                fs.readSync(fd, buffer, 0, MAX_OUTPUT_SIZE, 0);
                fs.closeSync(fd);
                return buffer.toString("utf-8").trim() + "\n...[Output Truncated]";
            }
            return fs.readFileSync(filePath, "utf-8").trim();
        };

        let actualOutput = readAndTruncate(stdoutPath);
        let stderrOutput = readAndTruncate(stderrPath);

        let exitCode = 0;
        if (fs.existsSync(exitCodePath)) {
            const exitCodeStr = fs.readFileSync(exitCodePath, "utf-8").trim();
            exitCode = parseInt(exitCodeStr, 10);
            if (isNaN(exitCode)) exitCode = 1; // Fallback if file corrupt
        } else {
            // If exit_code.txt doesn't exist, script might have crashed or timed out before writing
            // Assume error if stderr has content, else 0? No, assume 1 if we expected it to write.
            exitCode = (stderrOutput.length > 0) ? 1 : 0;
        }

        const expected = expectedOutput ? expectedOutput.trim() : null;

        let status: ExecutionResult["status"] = "ACCEPTED";
        let finalStdout = actualOutput;

        if (exitCode !== 0) {
            // Heuristic to detect compilation errors
            // Java: "error: ", "javac"
            // C/C++: "error:", "gcc", "g++", "make"
            // Python: "SyntaxError", "IndentationError"
            const isCompilationError =
                stderrOutput.includes("error:") ||
                stderrOutput.includes("SyntaxError") ||
                stderrOutput.includes("IndentationError") ||
                stderrOutput.includes("javac") ||
                stderrOutput.includes("gcc") ||
                stderrOutput.includes("g++");

            status = isCompilationError ? "COMPILATION_ERROR" : "RUNTIME_ERROR";
            finalStdout = stderrOutput || "Process exited with error but no stderr output.";
        } else if (expected !== null && actualOutput !== expected) {
            status = "WRONG_ANSWER";
        }

        return {
            status,
            stdout: finalStdout,
            executionTime,
            memoryUsage: 0 // Placeholder
        };

    } catch (error: any) {
        const diff = process.hrtime(startTime);
        const executionTime = Math.round(diff[0] * 1000 + diff[1] / 1e6);

        // Handle Timeout
        if (error.message === "GenericTimeout") {
            try { await container?.kill(); } catch (e) { }
            return {
                status: "TIME_LIMIT_EXCEEDED",
                stdout: "",
                executionTime: timeLimit * 1000,
                memoryUsage: 0 // Placeholder
            };
        }

        // Handle Other Errors
        let userStderr = "";
        try {
            if (fs.existsSync(stderrPath)) {
                userStderr = fs.readFileSync(stderrPath, "utf-8").trim();
            }
        } catch (e) { }

        const finalOutput = userStderr || error.message || "Runtime Error";

        return {
            status: "RUNTIME_ERROR",
            stdout: finalOutput,
            executionTime,
            memoryUsage: 0 // Placeholder
        };
    } finally {
        if (container) {
            try {
                await container.remove({ force: true });
            } catch (e) {
                // Ignore removal errors
            }
        }
    }
};

export type RuntimeStatus = {
    dockerAvailable: boolean;
    imageExists: boolean;
    status: "READY" | "IMAGE_MISSING" | "DOCKER_UNAVAILABLE";
};

export const checkDockerAvailable = async (): Promise<boolean> => {
    try {
        await docker.ping();
        return true;
    } catch (e) {
        // console.error("Docker check failed:", e);
        return false;
    }
};

export const checkDockerImageExists = async (image: string): Promise<boolean> => {
    // Basic validation
    if (!/^[a-zA-Z0-9.\-_:\/@]+$/.test(image)) {
        return false;
    }
    try {
        const imageObj = docker.getImage(image);
        await imageObj.inspect();
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
