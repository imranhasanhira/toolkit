import { type GradeSubmission } from "wasp/server/jobs";
import { type Submission, type Problem, type TestCase } from "wasp/entities";
import { prepareExecutionEnvironment, executeTestCase, cleanupExecutionEnvironment } from "./executor";

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
            runtime: true,
            testCaseResults: true,
        },
    });

    if (!submission) {
        console.error(`Submission ${submissionId} not found`);
        return;
    }

    if (!submission.runtime) {
        console.error(`Runtime not found for submission ${submissionId}`);
        await context.entities.Submission.update({
            where: { id: submissionId },
            data: { status: "RUNTIME_ERROR" } // Or specialized error
        });
        return;
    }

    await context.entities.Submission.update({
        where: { id: submissionId },
        data: { status: "PROCESSING" },
    });

    const { problem, code } = submission;
    const testCases = problem.testCases;
    let allPassed = true;

    // Prepare Environment
    let execCtx;
    // The `runtime` field is now strictly typed as `Runtime` due to the `if (!submission.runtime)` check above.
    const runtime = submission.runtime;
    try {
        execCtx = prepareExecutionEnvironment(code, {
            fileName: runtime.fileName,
            dockerImage: runtime.dockerImage,
            runCommand: runtime.runCommand,
            memoryLimit: (runtime as any).memoryLimit || 128,
            cpuLimit: (runtime as any).cpuLimit || 0.5,
        });

        for (const testCase of testCases) {
            console.log(`Running test case ${testCase.id}`);

            const result = await executeTestCase(
                execCtx,
                testCase.input,
                testCase.expectedOutput,
                problem.timeLimit
            );

            if (result.status !== "ACCEPTED") {
                allPassed = false;
            }

            await context.entities.SubmissionTestCaseResult.create({
                data: {
                    submissionId: submission.id,
                    testCaseId: testCase.id,
                    status: result.status,
                    stdout: result.stdout,
                    executionTime: result.executionTime,
                    input: testCase.input,
                    expectedOutput: testCase.expectedOutput,
                },
            });
        }

        const finalStatus = allPassed ? "ACCEPTED" : "WRONG_ANSWER";

        await context.entities.Submission.update({
            where: { id: submissionId },
            data: {
                status: finalStatus,
            },
        });

    } catch (err: any) {
        console.error("Critical error in submission worker:", err);
        await context.entities.Submission.update({
            where: { id: submissionId },
            data: { status: "SYSTEM_ERROR" },
        });
    } finally {
        if (execCtx) {
            cleanupExecutionEnvironment(execCtx);
        }
    }
};
