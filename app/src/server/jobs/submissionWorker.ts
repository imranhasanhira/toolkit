import { type GradeSubmission } from "wasp/server/jobs";
import { exec } from "child_process";
import fs from "fs";
import path from "path";
import { promisify } from "util";
import { type Submission, type Problem, type TestCase } from "wasp/entities";

const execAsync = promisify(exec);

export const gradeSubmission: GradeSubmission<never, void> = async (
    args,
    context
) => {
    const { submissionId } = args as any;
    console.log(`Starting grading for submission: ${submissionId}`);

    const submission = await context.entities.Submission.findUnique({
        where: { id: submissionId },
        include: {
            problem: {
                include: {
                    testCases: true,
                },
            },
            testCaseResults: true,
        },
    });

    if (!submission) {
        console.error(`Submission ${submissionId} not found`);
        return;
    }

    await context.entities.Submission.update({
        where: { id: submissionId },
        data: { status: "PROCESSING" },
    });

    const { problem, code, language } = submission;
    const testCases = problem.testCases;
    let allPassed = true;

    // Create a temporary directory for execution
    const tempDir = path.join("/tmp", `submission-${submissionId}`);
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir);
    }

    try {
        // Write code to file
        const fileExtension = language === "python" ? "py" : "js"; // Simple mapping for now
        const fileName = `main.${fileExtension}`;
        const filePath = path.join(tempDir, fileName);
        fs.writeFileSync(filePath, code);

        for (const testCase of testCases) {
            console.log(`Running test case ${testCase.id}`);
            const startTime = Date.now();

            let dockerImage = "";
            let runCommand = "";

            if (language === "python") {
                dockerImage = "python:3.9-slim";
                runCommand = `python /app/${fileName}`;
            } else if (language === "javascript") {
                dockerImage = "node:18-alpine";
                runCommand = `node /app/${fileName}`;
            } else {
                throw new Error(`Unsupported language: ${language}`);
            }

            // Prepare input file
            const inputPath = path.join(tempDir, "input.txt");
            fs.writeFileSync(inputPath, testCase.input);

            // Docker command: mount tempDir to /app, run command, pipe input
            const dockerCmd = `docker run --rm -v "${tempDir}:/app" -i ${dockerImage} sh -c "${runCommand} < /app/input.txt"`;

            let stdout = "";
            let status = "ACCEPTED";
            let executionTime = 0;

            try {
                const { stdout: output, stderr } = await execAsync(dockerCmd, {
                    timeout: problem.timeLimit * 1000 + 1000,
                });
                stdout = output.trim();
                executionTime = Date.now() - startTime;

                if (stdout !== testCase.expectedOutput.trim()) {
                    status = "WRONG_ANSWER";
                    allPassed = false;
                }

            } catch (error: any) {
                executionTime = Date.now() - startTime;
                if (error.signal === "SIGTERM") {
                    status = "TIME_LIMIT_EXCEEDED";
                } else {
                    status = "RUNTIME_ERROR";
                    stdout = error.message;
                }
                allPassed = false;
            }

            await context.entities.SubmissionTestCaseResult.create({
                data: {
                    submissionId: submission.id,
                    testCaseId: testCase.id,
                    status,
                    stdout,
                    executionTime,
                    input: testCase.input,
                    expectedOutput: testCase.expectedOutput,
                },
            });
        }

        const finalStatus = allPassed ? "ACCEPTED" : "WRONG_ANSWER";

        await context.entities.Submission.update({
            where: { id: submissionId },
            data: { status: finalStatus },
        });

    } catch (err: any) {
        console.error("Critical error in submission worker:", err);
        await context.entities.Submission.update({
            where: { id: submissionId },
            data: { status: "RUNTIME_ERROR" },
        });
    } finally {
        // Cleanup
        try {
            if (fs.existsSync(tempDir)) {
                fs.rmSync(tempDir, { recursive: true, force: true });
            }
        } catch (e) { console.error("Failed to cleanup temp dir", e); }
    }
};
