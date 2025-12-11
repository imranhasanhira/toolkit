
import { useAuth } from "wasp/client/auth";
import { useParams, Link } from "react-router-dom";
import { useQuery, getProblem, submitCode, getSubmissions, runCode, getRuntimes } from "wasp/client/operations";
import { useState, useEffect } from "react";
import Editor from "@monaco-editor/react";

export default function ProblemDetailPage() {
    const { slug } = useParams();
    const { data: problem, isLoading: isLoadingProblem, error: errorProblem } = useQuery(getProblem, { slug: slug || "" });
    const { data: runtimes, isLoading: isLoadingRuntimes } = useQuery(getRuntimes);
    const { data: user } = useAuth();

    const [code, setCode] = useState("// Loading runtimes...\n");
    const [language, setLanguage] = useState("");
    const [isDirty, setIsDirty] = useState(false);

    // Effect to set initial language and code when runtimes load
    useEffect(() => {
        if (runtimes && runtimes.length > 0 && !language) {
            const defaultRuntime = runtimes.find((r: any) => r.language === "javascript") || runtimes[0];
            setLanguage(defaultRuntime.language);
            setCode(defaultRuntime.defaultCode);
            setIsDirty(false);
        }
    }, [runtimes]);

    const handleLanguageChange = (newLang: string) => {
        if (isDirty) {
            if (!window.confirm("Changing language will reset your code. Are you sure you want to continue?")) {
                return;
            }
        }

        const runtime = runtimes.find((r: any) => r.language === newLang);
        if (runtime) {
            // Only replace code if it matches a known default to avoid overwriting user work, 
            // or just always replace if user is switching languages explicitly. 
            // For now, simpler: always replace.
            setCode(runtime.defaultCode);
            setLanguage(newLang);
            setIsDirty(false);
        }
    };
    const [submitting, setSubmitting] = useState(false);
    const [running, setRunning] = useState(false);
    const [runResults, setRunResults] = useState<any>(null);
    const [selectedSubmission, setSelectedSubmission] = useState<any>(null);
    const [activeTab, setActiveTab] = useState<"submissions" | "console" | "submission_details">("submissions");

    if (isLoadingProblem || isLoadingRuntimes) return <div>Loading problem and runtimes...</div>;
    if (errorProblem) return <div>Error loading problem</div>;
    if (!problem) return <div>Problem not found</div>;

    const handleRun = async () => {
        if (!user) {
            alert("Please login to run code");
            return;
        }
        setRunning(true);
        setActiveTab("console");
        setRunResults(null);
        try {
            // Run against sample test cases
            const samples = problem.testCases.filter((tc: any) => tc.isSample);
            const testCasesToRun = samples.length > 0 ? samples : problem.testCases.slice(0, 2); // Fallback to first 2 if no samples marked

            const result = await runCode({
                code,
                language,
                testCases: testCasesToRun.map((tc: any) => ({
                    input: tc.input,
                    expectedOutput: tc.expectedOutput
                }))
            });
            setRunResults(result.results);
        } catch (err: any) {
            setRunResults({ error: err.message });
        } finally {
            setRunning(false);
        }
    };

    const handleSubmissionClick = (submission: any) => {
        setSelectedSubmission(submission);
        setActiveTab("submission_details");
    };

    const handleSubmit = async () => {
        if (!user) {
            alert("Please login to submit");
            return;
        }
        setSubmitting(true);
        setActiveTab("submissions");
        try {
            await submitCode({
                problemId: problem.id,
                code,
                language,
            });
            // We can refresh submissions or rely on optimistic/invalidation if configured, 
            // but for now let's just alert or let the user see the pending status in the table
        } catch (err: any) {
            alert("Error submitting: " + err.message);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="flex h-[calc(100vh-64px)] overflow-hidden">
            {/* Left Panel: Description */}
            <div className="w-1/2 p-6 overflow-y-auto border-r bg-white">
                <h1 className="text-2xl font-bold mb-2">{problem.title}</h1>
                <div className="flex gap-2 mb-4 items-center">
                    <span className="px-2 py-0.5 rounded text-xs border bg-gray-100">{problem.difficulty}</span>
                    {user && (
                        <Link
                            to={`/online-judge/${problem.slug}/edit`}
                            className="text-xs bg-blue-100 hover:bg-blue-200 text-blue-800 px-2 py-0.5 rounded border border-blue-200"
                        >
                            Edit
                        </Link>
                    )}
                </div>

                <div className="prose max-w-none mb-8">
                    <pre className="whitespace-pre-wrap font-sans text-base">{problem.description}</pre>
                </div>

                <h3 className="text-lg font-bold mb-2">Example Test Cases</h3>
                {problem.testCases.map((tc: any, idx: number) => (
                    <div key={tc.id} className="mb-4 bg-gray-50 p-4 rounded border">
                        <h4 className="font-semibold text-sm mb-2">
                            {tc.isSample ? `Sample ${idx + 1}` : `Test Case ${idx + 1}`}
                            {!tc.isSample && <span className="text-gray-400 text-xs ml-2">(Public)</span>}
                        </h4>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-xs text-gray-500 uppercase">Input</p>
                                <pre className="bg-gray-100 p-2 rounded text-sm mt-1 overflow-auto max-h-32">{tc.input}</pre>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 uppercase">Output</p>
                                <pre className="bg-gray-100 p-2 rounded text-sm mt-1 overflow-auto max-h-32">{tc.expectedOutput}</pre>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Right Panel: Editor */}
            <div className="w-1/2 flex flex-col bg-gray-900 border-l border-gray-700">
                <div className="flex justify-between items-center p-2 bg-gray-800 border-b border-gray-700">
                    <select
                        value={language}
                        onChange={(e) => handleLanguageChange(e.target.value)}
                        className="bg-gray-700 text-white text-sm p-1 rounded border-none focus:ring-0"
                    >
                        {runtimes && runtimes.map((rt: any) => (
                            <option key={rt.id} value={rt.language}>{rt.language}</option>
                        ))}
                    </select>

                    <div className="flex space-x-2">
                        <button
                            onClick={handleRun}
                            disabled={running || submitting}
                            className={`px-4 py-1.5 rounded text-sm font-semibold text-gray-200 border border-gray-600 hover:bg-gray-700 ${running ? "bg-gray-700 cursor-wait" : ""
                                }`}
                        >
                            {running ? "Running..." : "Run Code"}
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={submitting || running}
                            className={`px-4 py-1.5 rounded text-sm font-semibold text-white ${submitting ? "bg-gray-600 cursor-not-allowed" : "bg-green-600 hover:bg-green-500"
                                }`}
                        >
                            {submitting ? "Submitting..." : "Submit Solution"}
                        </button>
                    </div>
                </div>

                <div className="flex-1">
                    <Editor
                        height="100%"
                        theme="vs-dark"
                        language={language}
                        value={code}
                        onChange={(val) => {
                            setCode(val || "");
                            setIsDirty(true);
                        }}
                        options={{
                            minimap: { enabled: false },
                            fontSize: 14,
                            scrollBeyondLastLine: false,
                        }}
                    />
                </div>

                {/* Bottom Panel (Tabs) */}
                <div className="h-64 border-t border-gray-700 bg-gray-800 flex flex-col">
                    <div className="flex border-b border-gray-700 bg-gray-900">
                        <button
                            onClick={() => setActiveTab("console")}
                            className={`px-4 py-2 text-sm font-medium ${activeTab === "console" ? "text-white bg-gray-800 border-t-2 border-green-500" : "text-gray-400 hover:text-gray-200 hover:bg-gray-800"}`}
                        >
                            Output / Console
                        </button>
                        <button
                            onClick={() => setActiveTab("submissions")}
                            className={`px-4 py-2 text-sm font-medium ${activeTab === "submissions" ? "text-white bg-gray-800 border-t-2 border-blue-500" : "text-gray-400 hover:text-gray-200 hover:bg-gray-800"}`}
                        >
                            Previous Submissions
                        </button>
                        {selectedSubmission && (
                            <button
                                onClick={() => setActiveTab("submission_details")}
                                className={`px-4 py-2 text-sm font-medium ${activeTab === "submission_details" ? "text-white bg-gray-800 border-t-2 border-purple-500" : "text-gray-400 hover:text-gray-200 hover:bg-gray-800"}`}
                            >
                                Submission Detail
                            </button>
                        )}
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 text-white font-mono text-sm">
                        {activeTab === "console" && (
                            <div>
                                {!runResults && !running && <div className="text-gray-500">Run your code to see output here.</div>}
                                {running && <div className="text-yellow-500">Executing...</div>}
                                {runResults && runResults.error && <div className="text-red-500">Error: {runResults.error}</div>}
                                {runResults && Array.isArray(runResults) && (
                                    <div className="space-y-4">
                                        {runResults.map((res: any, idx: number) => (
                                            <div key={idx} className={`p-2 rounded border ${res.status === "ACCEPTED" ? "border-green-800 bg-green-900/10" : "border-red-800 bg-red-900/10"}`}>
                                                <div className="flex justify-between items-center mb-1">
                                                    <span className={`font-bold ${res.status === "ACCEPTED" ? "text-green-500" : "text-red-500"}`}>
                                                        {res.status}
                                                    </span>
                                                    <span className="text-gray-500 text-xs">{res.executionTime}ms</span>
                                                </div>
                                                <div className="mt-2">
                                                    <div className="text-xs text-gray-500">Input</div>
                                                    <pre className="bg-gray-900 p-2 rounded text-gray-300 font-mono text-xs overflow-x-auto">{res.input}</pre>
                                                </div>
                                                <div className="grid grid-cols-2 gap-2 mt-2">
                                                    <div>
                                                        <div className="text-xs text-gray-500">Expected Output</div>
                                                        <pre className="bg-gray-900 p-2 rounded text-gray-300 font-mono text-xs overflow-x-auto">{res.expectedOutput}</pre>
                                                    </div>
                                                    <div>
                                                        <div className="text-xs text-gray-500">Actual Output</div>
                                                        <pre className="bg-gray-900 p-2 rounded text-gray-300 font-mono text-xs overflow-x-auto">{res.stdout || "<empty>"}</pre>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === "submissions" && (
                            <SubmissionHistory problemId={problem.id} onSelect={handleSubmissionClick} />
                        )}

                        {activeTab === "submission_details" && selectedSubmission && (
                            <div className="space-y-4">
                                <div className="flex justify-between items-center mb-4 border-b border-gray-700 pb-2">
                                    <div>
                                        <div className="text-lg font-bold">{selectedSubmission.status}</div>
                                        <div className="text-xs text-gray-400">
                                            {new Date(selectedSubmission.createdAt).toLocaleString()} - {selectedSubmission.language}
                                        </div>
                                    </div>
                                    <button onClick={() => setActiveTab("submissions")} className="text-xs text-blue-400 hover:text-blue-300">
                                        Back to List
                                    </button>
                                </div>
                                {selectedSubmission.testCaseResults && selectedSubmission.testCaseResults.length > 0 ? (
                                    selectedSubmission.testCaseResults.map((res: any, idx: number) => (
                                        <div key={res.id} className={`p-2 rounded border ${res.status === "ACCEPTED" ? "border-green-800 bg-green-900/10" : "border-red-800 bg-red-900/10"}`}>
                                            <div className="flex justify-between items-center mb-1">
                                                <span className={`font-bold ${res.status === "ACCEPTED" ? "text-green-500" : "text-red-500"}`}>
                                                    {res.status}
                                                </span>
                                                <span className="text-gray-500 text-xs">{res.executionTime}ms</span>
                                            </div>
                                            <div className="mt-2">
                                                <div className="text-xs text-gray-500">Input</div>
                                                <pre className="bg-gray-900 p-2 rounded text-gray-300 font-mono text-xs overflow-x-auto">{res.input}</pre>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2 mt-2">
                                                <div>
                                                    <div className="text-xs text-gray-500">Expected Output</div>
                                                    <pre className="bg-gray-900 p-2 rounded text-gray-300 font-mono text-xs overflow-x-auto">{res.expectedOutput}</pre>
                                                </div>
                                                <div>
                                                    <div className="text-xs text-gray-500">Actual Output</div>
                                                    <pre className="bg-gray-900 p-2 rounded text-gray-300 font-mono text-xs overflow-x-auto">{res.stdout || "<empty>"}</pre>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-gray-500">No details available (Processing or Error).</div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function SubmissionHistory({ problemId, onSelect }: { problemId: string, onSelect: (sub: any) => void }) {
    const { data: submissions, isLoading } = useQuery(getSubmissions, { problemId });

    if (isLoading) return <div className="text-sm text-gray-400">Loading history...</div>;
    if (!submissions || submissions.length === 0) return <div className="text-sm text-gray-400">No submissions yet.</div>;

    return (
        <table className="w-full text-sm text-left">
            <thead>
                <tr className="border-b border-gray-700">
                    <th className="py-1">Result</th>
                    <th className="py-1">Language</th>
                    <th className="py-1">Time</th>
                </tr>
            </thead>
            <tbody>
                {submissions.map((sub: any) => (
                    <tr
                        key={sub.id}
                        className="border-b border-gray-700/50 hover:bg-gray-700 cursor-pointer transition-colors"
                        onClick={() => onSelect(sub)}
                    >
                        <td className={`py-1 font-semibold ${sub.status === "ACCEPTED" ? "text-green-500" :
                            sub.status === "PENDING" || sub.status === "PROCESSING" ? "text-yellow-500" : "text-red-500"
                            }`}>
                            {sub.status}
                        </td>
                        <td className="py-1 text-gray-300">{sub.language}</td>
                        <td className="py-1 text-gray-400">{new Date(sub.createdAt).toLocaleTimeString()}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}
