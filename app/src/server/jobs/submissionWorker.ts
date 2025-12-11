import { type GradeSubmission } from "wasp/server/jobs";
import { type Submission, type Problem, type TestCase } from "wasp/entities";
import { prepareExecutionEnvironment, executeTestCase, cleanupExecutionEnvironment } from "../utils/executor";

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

    // Prepare Environment
    let execCtx;
    try {
        execCtx = prepareExecutionEnvironment(code, language);

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
            data: { status: finalStatus },
        });

    } catch (err: any) {
        console.error("Critical error in submission worker:", err);
        await context.entities.Submission.update({
            where: { id: submissionId },
            data: { status: "RUNTIME_ERROR" },
        });
    } finally {
        if (execCtx) {
            cleanupExecutionEnvironment(execCtx);
        }
    }
};
