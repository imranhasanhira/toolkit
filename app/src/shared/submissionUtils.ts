
export const calculateOverallStatus = (results: { status: string }[]): string => {
    if (!results || results.length === 0) return "UNKNOWN";

    // Priority: COMPILATION_ERROR > RUNTIME_ERROR > TIME_LIMIT_EXCEEDED > WRONG_ANSWER > ACCEPTED
    // Actually, usually the first non-accepted status is what matters, or specific hierarchy.
    // In our worker we break on COMPILATION_ERROR.
    // For "Run Code", we shouldn't necessarily hide other results, but the overall status should reflect the worst outcome.

    // If any compilation error, that's the status.
    if (results.some(r => r.status === "COMPILATION_ERROR")) return "COMPILATION_ERROR";

    // If any runtime error
    if (results.some(r => r.status === "RUNTIME_ERROR")) return "RUNTIME_ERROR";

    // If any TLE
    if (results.some(r => r.status === "TIME_LIMIT_EXCEEDED")) return "TIME_LIMIT_EXCEEDED";

    // If any wrong answer
    if (results.some(r => r.status === "WRONG_ANSWER")) return "WRONG_ANSWER";

    // If all accepted
    if (results.every(r => r.status === "ACCEPTED")) return "ACCEPTED";

    // Fallback?
    return "UNKNOWN";
};
