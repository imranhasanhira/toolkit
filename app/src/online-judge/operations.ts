import {
    type CreateProblem,
    type UpdateProblem,
    type GetProblems,
    type GetProblem,
    type SubmitCode,
} from "wasp/server/operations";
import { type Problem, type TestCase, type Submission, type Runtime } from "wasp/entities";
import { gradeSubmission } from "wasp/server/jobs";
import { HttpError } from "wasp/server";

type CreateProblemArgs = {
    title: string;
    slug: string;
    description: string;
    difficulty: string;
    testCases: { input: string; expectedOutput: string; isSample?: boolean }[];
};

export const createProblem: CreateProblem<CreateProblemArgs, Problem> = async (
    args,
    context
) => {
    if (!context.user) {
        throw new HttpError(401, "Unauthorized");
    }

    const { title, slug, description, difficulty, testCases } = args;

    return context.entities.Problem.create({
        data: {
            title,
            slug,
            description,
            difficulty,
            testCases: {
                // Create new test cases
                create: testCases.map((tc) => ({
                    input: tc.input,
                    expectedOutput: tc.expectedOutput,
                    isSample: tc.isSample || false,
                })),
            },
        },
    });
};

type UpdateProblemArgs = {
    id: string;
    title: string;
    slug: string;
    description: string;
    difficulty: string;
    testCases: { id?: string; input: string; expectedOutput: string; isSample?: boolean }[];
};

export const updateProblem: UpdateProblem<UpdateProblemArgs, Problem> = async (
    args,
    context
) => {
    if (!context.user) {
        throw new HttpError(401, "Unauthorized");
    }

    const { id, title, slug, description, difficulty, testCases } = args;

    // Simple update strategy: delete all test cases and recreate (or upsert if needed, but recreate is easier for prototype)
    // Ideally, use a transaction or smarter upsert logic.

    // Updating test cases implementation skipped for brevity/simplicity in this step, focusing on problem fields.
    // In a real app, you'd handle test case updates carefully.

    return context.entities.Problem.update({
        where: { id },
        data: {
            title,
            slug,
            description,
            difficulty,
            testCases: {
                // Hard delete all existing test cases first (relation in SubmissionTestCaseResult is SetNull)
                deleteMany: {},
                // Create new test cases
                create: testCases.map((tc) => ({
                    input: tc.input,
                    expectedOutput: tc.expectedOutput,
                    isSample: tc.isSample || false,
                })),
            },
        },
    });
};

export const getProblems: GetProblems<void, Problem[]> = async (args, context) => {
    return context.entities.Problem.findMany({
        orderBy: { createdAt: "desc" },
    });
};

type GetProblemArgs = { slug: string };

export const getProblem: GetProblem<GetProblemArgs, Problem & { testCases: TestCase[] }> = async (
    args,
    context
) => {
    if (!context.user) {
        throw new HttpError(401, "Must be logged in");
    }
    const problem = await context.entities.Problem.findUnique({
        where: { slug: args.slug },
        include: {
            testCases: {
                // where: { isSample: true }, // Uncomment to only show samples if desired. Currently showing all.
            },
        },
    });

    if (!problem) throw new HttpError(404, "Problem not found");

    return problem;
};

type SubmitCodeArgs = {
    problemId: string;
    code: string;
    language: string;
};

export const submitCode: SubmitCode<SubmitCodeArgs, void> = async (
    args,
    context
) => {
    if (!context.user) {
        throw new HttpError(401, "Must be logged in");
    }

    const submission = await context.entities.Submission.create({
        data: {
            code: args.code,
            language: args.language,
            status: "PENDING",
            problem: { connect: { id: args.problemId } },
            user: { connect: { id: context.user.id } },
            runtime: { connect: { language: args.language } }, // Connect by unique language key
        },
    });

    // Enqueue backend job
    await gradeSubmission.submit({ submissionId: submission.id });
};

type GetSubmissionsArgs = { problemId: string };

export const getSubmissions = async (
    args: GetSubmissionsArgs,
    context: any
) => {
    if (!context.user) {
        throw new HttpError(401, "Must be logged in");
    }

    return context.entities.Submission.findMany({
        where: {
            problemId: args.problemId,
            userId: context.user.id,
        },
        orderBy: { createdAt: "desc" },
        include: {
            testCaseResults: true,
        },
    });
};

export const getRuntimes = async (args: void, context: any) => {
    return context.entities.Runtime.findMany({
        orderBy: { language: "asc" },
    });
};

type UpdateRuntimeArgs = {
    id: string;
    defaultCode: string;
};

export const updateRuntime = async (args: UpdateRuntimeArgs, context: any) => {
    if (!context.user) throw new HttpError(401, "Unauthorized");

    return context.entities.Runtime.update({
        where: { id: args.id },
        data: { defaultCode: args.defaultCode },
    });
};

type CreateRuntimeArgs = {
    language: string;
    defaultCode: string;
};

export const createRuntime = async (args: CreateRuntimeArgs, context: any) => {
    if (!context.user) throw new HttpError(401, "Unauthorized");

    return context.entities.Runtime.create({
        data: {
            language: args.language,
            defaultCode: args.defaultCode,
        },
    });
};

type RunCodeArgs = {
    code: string;
    language: string;
    testCases: { input: string; expectedOutput?: string }[];
};

type RunCodeResult = {
    results: {
        status: string;
        stdout: string;
        executionTime: number;
        input: string;
        expectedOutput?: string;
    }[];
};

import { prepareExecutionEnvironment, executeTestCase, cleanupExecutionEnvironment } from "../server/utils/executor";

export const runCode = async (args: RunCodeArgs, context: any): Promise<RunCodeResult> => {
    if (!context.user) throw new HttpError(401, "Unauthorized");

    const { code, language, testCases } = args;
    const timeLimit = 2; // Default 2s for "Run"

    let execCtx;
    // Explicitly type the array to avoid never[] inference
    const results: {
        status: string;
        stdout: string;
        executionTime: number;
        input: string;
        expectedOutput?: string;
    }[] = [];

    try {
        execCtx = prepareExecutionEnvironment(code, language);

        for (const tc of testCases) {
            const result = await executeTestCase(execCtx, tc.input, tc.expectedOutput || null, timeLimit);
            results.push({
                status: result.status,
                stdout: result.stdout,
                executionTime: result.executionTime,
                input: tc.input,
                expectedOutput: tc.expectedOutput,
            });
        }
    } catch (err: any) {
        console.error("Error in runCode:", err);
        throw new HttpError(500, "Execution failed: " + err.message);
    } finally {
        if (execCtx) {
            cleanupExecutionEnvironment(execCtx);
        }
    }

    return { results };
};
