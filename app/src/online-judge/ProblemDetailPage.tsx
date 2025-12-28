
import { useAuth } from "wasp/client/auth";
import { useParams, Link } from "react-router-dom";
import { useQuery, getProblem, submitCode, getSubmissions, runCode, getRuntimes } from "wasp/client/operations";
import useColorMode from "../client/hooks/useColorMode";
import { useState, useEffect, useRef } from "react";
import Editor from "@monaco-editor/react";
// react-resizable-panels@2.0.19 exports
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import {
    Play, Send, RotateCcw, ChevronLeft, ChevronRight,
    FileText, List, Clock, Cpu, CheckCircle, XCircle, AlertCircle
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Code, Terminal } from "lucide-react"; // Added icons for Code tab

// Simple hook for mobile detection
function useIsMobile() {
    const [isMobile, setIsMobile] = useState(false);
    useEffect(() => {
        const check = () => setIsMobile(window.innerWidth < 768);
        check();
        window.addEventListener("resize", check);
        return () => window.removeEventListener("resize", check);
    }, []);
    return isMobile;
}

export default function ProblemDetailPage() {
    const { slug } = useParams();
    const { data: problem, isLoading: isLoadingProblem, error: errorProblem } = useQuery(getProblem, { slug: slug || "" });
    const { data: runtimes, isLoading: isLoadingRuntimes } = useQuery(getRuntimes);
    const { data: user } = useAuth();
    const [colorMode] = useColorMode();

    // -- EDITOR STATE --
    const [code, setCode] = useState("// Loading runtimes...\n");
    const [language, setLanguage] = useState("");
    const [isDirty, setIsDirty] = useState(false);

    // -- LAYOUT & TABS STATE --
    // -- LAYOUT & TABS STATE --
    const [leftTab, setLeftTab] = useState<"problem" | "submissions">("problem");
    const [mobileTab, setMobileTab] = useState<"problem" | "submissions" | "code">("problem"); // New state for mobile
    const [showSubmissionDetail, setShowSubmissionDetail] = useState<string | null>(null);
    const isMobile = useIsMobile();

    // -- EXECUTION STATE --
    const [submitting, setSubmitting] = useState(false);
    const [running, setRunning] = useState(false);
    const [runResults, setRunResults] = useState<any>(null);

    // -- CONSOLE STATE --
    const [activeTestCaseIndex, setActiveTestCaseIndex] = useState(0);

    // -- DATA FETCHING --
    const { data: submissions, isLoading: isLoadingSubmissions } = useQuery(getSubmissions, { problemId: problem?.id || "" }, {
        enabled: !!problem,
        refetchInterval: (data: any) => {
            if (!data) return false;
            const now = Date.now();
            const fiveMinutes = 5 * 60 * 1000;
            const hasRecentPending = data.some((s: any) => {
                const isPending = s.status === "PENDING" || s.status === "PROCESSING";
                const isRecent = (now - new Date(s.createdAt).getTime()) < fiveMinutes;
                return isPending && isRecent;
            });
            return hasRecentPending ? 5000 : false;
        }
    });

    const selectedSubmission = submissions?.find((s: any) => s.id === showSubmissionDetail);

    // -- EFFECTS --

    // Initial load of code/language
    useEffect(() => {
        if (!runtimes || runtimes.length === 0 || !problem) return;

        const draftKey = `oj_draft_${problem.id}`;
        const savedDraft = localStorage.getItem(draftKey);

        if (savedDraft) {
            try {
                const { language: savedLang, code: savedCode } = JSON.parse(savedDraft);
                const runtimeExists = runtimes.find((r: any) => r.language === savedLang);
                if (runtimeExists) {
                    setLanguage(savedLang);
                    setCode(savedCode);
                    return;
                }
            } catch (e) {
                console.error("Failed to parse draft", e);
            }
        }

        if (!language) {
            const defaultRuntime = runtimes.find((r: any) => r.language === "java") || runtimes[0];
            setLanguage(defaultRuntime.language);
            setCode(defaultRuntime.defaultCode);
            setIsDirty(false);
        }
    }, [runtimes, problem?.id]);

    // Save draft
    useEffect(() => {
        if (!problem || !language) return;
        const draftKey = `oj_draft_${problem.id}`;
        const timeoutId = setTimeout(() => {
            localStorage.setItem(draftKey, JSON.stringify({ language, code }));
        }, 1000);
        return () => clearTimeout(timeoutId);
    }, [code, language, problem?.id]);

    // -- HANDLERS --

    const handleLanguageChange = (newLang: string) => {
        if (isDirty) {
            if (!window.confirm("Changing language will reset your code. Are you sure?")) return;
        }
        const runtime = runtimes.find((r: any) => r.language === newLang);
        if (runtime) {
            setCode(runtime.defaultCode);
            setLanguage(newLang);
            setIsDirty(false);
        }
    };

    const handleRun = async () => {
        if (!user) return alert("Please login to run code");
        if (!problem) return;
        setRunning(true);
        setRunResults(null);
        setActiveTestCaseIndex(0);
        try {
            const samples = problem.testCases.filter((tc: any) => tc.isSample);
            const testCasesToRun = samples.length > 0 ? samples : problem.testCases.slice(0, 2);

            const result = await runCode({
                code,
                language,
                testCases: testCasesToRun.map((tc: any) => ({
                    input: tc.input,
                    expectedOutput: tc.expectedOutput
                }))
            });
            setRunResults(result);
        } catch (err: any) {
            setRunResults({ error: err.message });
        } finally {
            setRunning(false);
        }
    };

    const handleSubmit = async () => {
        if (!user) return alert("Please login to submit");
        if (!problem) return;
        setSubmitting(true);
        // Switch to submissions tab to see status
        setLeftTab("submissions");
        setShowSubmissionDetail(null);
        try {
            await submitCode({ problemId: problem.id, code, language });
        } catch (err: any) {
            alert("Error submitting: " + err.message);
        } finally {
            setSubmitting(false);
        }
    };

    if (isLoadingProblem || isLoadingRuntimes) return <div className="p-8 text-center text-gray-500">Loading...</div>;
    if (errorProblem) return <div className="p-8 text-center text-red-500">Error loading problem</div>;
    if (!problem) return <div className="p-8 text-center">Problem not found</div>;

    // --- RENDER HELPERS ---

    const renderLeftPanelContent = () => (
        <div className="flex flex-col h-full bg-background text-foreground">
            {/* Tabs Header (Desktop: Problem/Submissions only. Mobile: Handled nicely via main tab bar?) 
                Actually, for desktop we keep this. For mobile we might want a different switcher.
            */}
            {!isMobile && (
                <div className="flex border-b border-border">
                    <button
                        onClick={() => { setLeftTab("problem"); setShowSubmissionDetail(null); }}
                        className={`flex items-center gap-2 px-6 py-3 text-sm font-medium ${leftTab === "problem" && !showSubmissionDetail ? "text-primary border-b-2 border-primary bg-primary/10" : "text-muted-foreground hover:bg-muted"}`}
                    >
                        <FileText className="w-4 h-4" /> Problem
                    </button>
                    <button
                        onClick={() => { setLeftTab("submissions"); setShowSubmissionDetail(null); }}
                        className={`flex items-center gap-2 px-6 py-3 text-sm font-medium ${leftTab === "submissions" || showSubmissionDetail ? "text-primary border-b-2 border-primary bg-primary/10" : "text-muted-foreground hover:bg-muted"}`}
                    >
                        <List className="w-4 h-4" /> Submissions
                    </button>
                </div>
            )}

            {/* Panel Content */}
            <div className="flex-1 overflow-y-auto">
                {/* On mobile, we use mobileTab to decide content. On desktop, leftTab. */}
                {((isMobile && mobileTab === "problem") || (!isMobile && leftTab === "problem")) && !showSubmissionDetail && (
                    <ProblemDescription problem={problem} user={user} />
                )}

                {((isMobile && mobileTab === "submissions") || (!isMobile && leftTab === "submissions")) && !showSubmissionDetail && (
                    <div className="p-4">
                        <SubmissionHistory
                            submissions={submissions}
                            isLoading={isLoadingSubmissions}
                            onSelect={(sub) => setShowSubmissionDetail(sub.id)}
                        />
                    </div>
                )}

                {showSubmissionDetail && selectedSubmission && (
                    <SubmissionDetail
                        submission={selectedSubmission}
                        onBack={() => setShowSubmissionDetail(null)}
                    />
                )}
            </div>
        </div>
    );

    const renderCodeWorkspace = () => (
        <CodeWorkspace
            language={language}
            setLanguage={handleLanguageChange}
            code={code}
            setCode={(val) => { setCode(val); setIsDirty(true); }}
            runtimes={runtimes}
            running={running}
            submitting={submitting}
            onRun={handleRun}
            onSubmit={handleSubmit}
            colorMode={colorMode}
            runResults={runResults}
            activeTestCaseIndex={activeTestCaseIndex}
            setActiveTestCaseIndex={setActiveTestCaseIndex}
        />
    );

    if (isMobile) {
        return (
            <div className="flex flex-col h-[calc(100vh-64px)] w-full bg-background text-foreground font-sans">
                {/* Mobile Tabs Header */}
                <div className="flex border-b border-border overflow-x-auto">
                    <button onClick={() => { setMobileTab("problem"); setShowSubmissionDetail(null); }} className={`flex-1 flex justify-center items-center gap-2 py-3 text-sm font-medium ${mobileTab === "problem" && !showSubmissionDetail ? "text-primary border-b-2 border-primary bg-primary/5" : "text-muted-foreground"}`}>
                        <FileText className="w-4 h-4" /> Problem
                    </button>
                    <button onClick={() => { setMobileTab("submissions"); setShowSubmissionDetail(null); }} className={`flex-1 flex justify-center items-center gap-2 py-3 text-sm font-medium ${mobileTab === "submissions" || showSubmissionDetail ? "text-primary border-b-2 border-primary bg-primary/5" : "text-muted-foreground"}`}>
                        <List className="w-4 h-4" /> Submits
                    </button>
                    <button onClick={() => setMobileTab("code")} className={`flex-1 flex justify-center items-center gap-2 py-3 text-sm font-medium ${mobileTab === "code" ? "text-primary border-b-2 border-primary bg-primary/5" : "text-muted-foreground"}`}>
                        <Code className="w-4 h-4" /> Code
                    </button>
                </div>

                <div className="flex-1 overflow-hidden relative">
                    {/* 
                      We render contents differently based on tab.
                      If 'code' tab, we show the workspace.
                      Otherwise we show the left panel content logic.
                     */}
                    {mobileTab === "code" ? (
                        <div className="h-full w-full">{renderCodeWorkspace()}</div>
                    ) : (
                        renderLeftPanelContent()
                    )}
                </div>
            </div>
        )
    }

    return (
        <div className="h-[calc(100vh-64px)] w-full overflow-hidden bg-background text-foreground font-sans">
            <PanelGroup direction="horizontal">
                {/* --- LEFT PANEL: Problem & Submissions --- */}
                <Panel defaultSize={40} minSize={20}>
                    {renderLeftPanelContent()}
                </Panel>

                <PanelResizeHandle className="w-1.5 bg-border hover:bg-primary transition-colors cursor-col-resize active:bg-primary" />

                {/* --- RIGHT PANEL --- */}
                <Panel minSize={30}>
                    {renderCodeWorkspace()}
                </Panel>
            </PanelGroup>
        </div>
    );
}

// --- SUB-COMPONENTS ---


interface CodeWorkspaceProps {
    language: string;
    setLanguage: (lang: string) => void;
    code: string;
    setCode: (code: string) => void;
    runtimes: any[];
    running: boolean;
    submitting: boolean;
    onRun: () => void;
    onSubmit: () => void;
    colorMode: string;
    runResults: any;
    activeTestCaseIndex: number;
    setActiveTestCaseIndex: (idx: number) => void;
}

function CodeWorkspace({
    language, setLanguage, code, setCode, runtimes, running, submitting, onRun, onSubmit, colorMode, runResults, activeTestCaseIndex, setActiveTestCaseIndex
}: CodeWorkspaceProps) {
    return (
        <PanelGroup direction="vertical">
            {/* TOP: Editor */}
            <Panel defaultSize={60} minSize={20}>
                <div className="flex flex-col h-full">
                    {/* Toolbar */}
                    <div className="flex justify-between items-center p-2 bg-muted border-b border-border">
                        <select
                            value={language}
                            onChange={(e) => setLanguage(e.target.value)}
                            className="bg-background text-foreground text-sm py-1 px-3 rounded border border-border focus:ring-1 focus:ring-primary outline-none"
                        >
                            {runtimes && runtimes.map((rt: any) => (
                                <option key={rt.id} value={rt.language}>{rt.language}</option>
                            ))}
                        </select>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={onRun}
                                disabled={running || submitting}
                                className="flex items-center gap-2 px-4 py-1.5 rounded text-sm font-semibold bg-secondary text-secondary-foreground hover:bg-secondary/80 disabled:opacity-50 transition-colors"
                            >
                                {running ? <RotateCcw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                                Run
                            </button>
                            <button
                                onClick={onSubmit}
                                disabled={submitting || running}
                                className="flex items-center gap-2 px-4 py-1.5 rounded text-sm font-semibold bg-green-600 hover:bg-green-500 text-white disabled:opacity-50 transition-colors shadow-sm"
                            >
                                {submitting ? <RotateCcw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                Submit
                            </button>
                        </div>
                    </div>
                    {/* Monaco Editor */}
                    <div className="flex-1">
                        <Editor
                            height="100%"
                            theme={colorMode === "dark" ? "vs-dark" : "light"}
                            language={language}
                            value={code}
                            onChange={(val) => setCode(val || "")}
                            options={{
                                minimap: { enabled: false },
                                fontSize: 14,
                                padding: { top: 16 },
                                scrollBeyondLastLine: false,
                                fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace"
                            }}
                        />
                    </div>
                </div>
            </Panel>

            <PanelResizeHandle className="h-1.5 bg-border hover:bg-primary transition-colors cursor-row-resize active:bg-primary" />

            {/* BOTTOM: Output Console */}
            <Panel minSize={10} defaultSize={40}>
                <div className="h-full bg-background border-t border-border flex flex-col">
                    <div className="flex items-center justify-between px-4 py-2 bg-muted border-b border-border">
                        <div className="flex items-center gap-4">
                            <span className="text-sm font-medium text-foreground">Console</span>
                            {runResults && runResults.overallStatus && (
                                <div className={`flex items-center gap-2 px-3 py-1 rounded text-xs font-bold ${runResults.overallStatus === "ACCEPTED"
                                    ? "bg-green-100 text-green-800 border border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800"
                                    : "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800"
                                    }`}>
                                    {runResults.overallStatus === "ACCEPTED" ? <CheckCircle className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                                    <span>{runResults.overallStatus === "ACCEPTED" ? "ACCEPTED" : runResults.overallStatus.replace(/_/g, " ")}</span>
                                </div>
                            )}
                        </div>
                        {runResults && runResults.results && runResults.results.length > 0 && (
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-500 mr-2">
                                    Test Case {activeTestCaseIndex + 1} of {runResults.results.length}
                                </span>
                                <button
                                    onClick={() => setActiveTestCaseIndex(Math.max(0, activeTestCaseIndex - 1))}
                                    disabled={activeTestCaseIndex === 0}
                                    className="p-1 hover:bg-gray-700 rounded disabled:opacity-30"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => setActiveTestCaseIndex(Math.min(runResults.results.length - 1, activeTestCaseIndex + 1))}
                                    disabled={activeTestCaseIndex === runResults.results.length - 1}
                                    className="p-1 hover:bg-gray-700 rounded disabled:opacity-30"
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 font-mono text-sm">
                        {!runResults && !running && !submitting && (
                            <div className="text-gray-500 italic">Run your code to see output here...</div>
                        )}
                        {running && <div className="text-yellow-500">Compiling and executing...</div>}
                        {runResults && runResults.error && (
                            <div className="text-red-400 bg-red-900/20 p-4 rounded border border-red-900">
                                <span className="font-bold">Execution Error:</span>
                                <pre className="mt-2 text-xs whitespace-pre-wrap">{runResults.error}</pre>
                            </div>
                        )}

                        {runResults && runResults.results && runResults.results.length > 0 && (
                            <TestCaseResultView result={runResults.results[activeTestCaseIndex] || runResults.results[0]} />
                        )}
                    </div>
                </div>
            </Panel>
        </PanelGroup>
    );
}

function ProblemDescription({ problem, user }: { problem: any, user: any }) {
    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold mb-2 text-foreground">{problem.title}</h1>
            <div className="flex gap-2 mb-6 items-center">
                <span className={`px-2 py-0.5 rounded text-xs font-medium border
                    ${problem.difficulty === "Easy" ? "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800" :
                        problem.difficulty === "Medium" ? "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800" :
                            "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800"}`}>
                    {problem.difficulty}
                </span>
                {user && (
                    <Link to={`/online-judge/${problem.slug}/edit`} className="text-xs text-primary hover:underline">
                        Edit Problem
                    </Link>
                )}
            </div>

            <div className="prose prose-sm max-w-none mb-8 text-foreground dark:prose-invert">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{problem.description}</ReactMarkdown>
            </div>

            <h3 className="text-lg font-bold mb-4 text-foreground border-b border-border pb-2">Example Test Cases</h3>
            <div className="space-y-6">
                {problem.testCases.filter((tc: any) => tc.isSample).map((tc: any, idx: number) => (
                    <div key={tc.id}>
                        <h4 className="font-semibold text-sm mb-2 text-foreground">Example {idx + 1}</h4>
                        <div className="bg-muted p-4 rounded-lg border border-border font-mono text-sm">
                            <div className="mb-3">
                                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">Input</span>
                                <pre className="text-foreground whitespace-pre-wrap font-inherit">{tc.input}</pre>
                            </div>
                            <div>
                                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">Output</span>
                                <pre className="text-foreground whitespace-pre-wrap font-inherit">{tc.expectedOutput}</pre>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function SubmissionHistory({ submissions, isLoading, onSelect }: { submissions: any[], isLoading: boolean, onSelect: (sub: any) => void }) {
    if (isLoading) return <div className="text-center text-muted-foreground mt-10">Loading submissions...</div>;
    if (!submissions || submissions.length === 0) return <div className="text-center text-muted-foreground mt-10 p-4 bg-muted rounded">No submissions yet. Be the first!</div>;

    return (
        <div className="overflow-hidden border border-border rounded-lg">
            <table className="w-full text-sm text-left">
                <thead className="bg-muted text-muted-foreground font-medium border-b border-border">
                    <tr>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Language</th>
                        <th className="py-3 px-4">Time</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-border">
                    {submissions.map((sub: any) => {
                        const isSuccess = sub.status === "ACCEPTED";
                        const isError = sub.status === "WRONG_ANSWER" || sub.status === "RUNTIME_ERROR" || sub.status === "TIME_LIMIT_EXCEEDED" || sub.status === "COMPILATION_ERROR";
                        return (
                            <tr
                                key={sub.id}
                                className="hover:bg-muted cursor-pointer transition-colors"
                                onClick={() => onSelect(sub)}
                            >
                                <td className="py-3 px-4 font-semibold">
                                    <div className="flex items-center gap-2">
                                        {isSuccess && <CheckCircle className="w-4 h-4 text-green-500" />}
                                        {isError && <XCircle className="w-4 h-4 text-red-500" />}
                                        {!isSuccess && !isError && <Clock className="w-4 h-4 text-yellow-500" />}
                                        <span className={`${isSuccess ? 'text-green-600 dark:text-green-500' : isError ? 'text-red-600 dark:text-red-500' : 'text-yellow-600 dark:text-yellow-500'}`}>
                                            {sub.status.replace(/_/g, " ")}
                                        </span>
                                    </div>
                                </td>
                                <td className="py-3 px-4 text-muted-foreground">{sub.language}</td>
                                <td className="py-3 px-4 text-muted-foreground text-xs">{new Date(sub.createdAt).toLocaleString()}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

function SubmissionDetail({ submission, onBack }: { submission: any, onBack: () => void }) {
    const [testCaseIndex, setTestCaseIndex] = useState(0);
    const results = submission.testCaseResults || [];

    return (
        <div className="p-6 text-foreground">
            <button onClick={onBack} className="flex items-center gap-1 text-sm text-primary hover:underline mb-4">
                <ChevronLeft className="w-4 h-4" /> Back to submissions
            </button>

            <div className="flex items-center justify-between mb-6">
                <h2 className={`text-xl font-bold ${submission.status === "ACCEPTED" ? "text-green-600 dark:text-green-500" :
                    submission.status === "WRONG_ANSWER" ? "text-red-600 dark:text-red-500" : "text-foreground"
                    }`}>
                    {submission.status.replace(/_/g, " ")}
                </h2>
                <span className="text-muted-foreground text-sm">{new Date(submission.createdAt).toLocaleString()}</span>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-muted p-3 rounded border border-border flex items-center gap-3">
                    <div className="p-2 bg-card rounded shadow-sm text-foreground"><Clock className="w-5 h-5" /></div>
                    <div>
                        <div className="text-xs text-muted-foreground uppercase font-bold">Avg Runtime</div>
                        <div className="font-mono text-foreground">{submission.executionTime != null ? `${submission.executionTime} ms` : "N/A"}</div>
                    </div>
                </div>
                {/* Max Memory Removed */}
                <div className="bg-muted p-3 rounded border border-border flex items-center gap-3">
                    <div className="p-2 bg-card rounded shadow-sm text-foreground"><FileText className="w-5 h-5" /></div>
                    <div>
                        <div className="text-xs text-muted-foreground uppercase font-bold">Language</div>
                        <div className="font-mono text-foreground">{submission.language}</div>
                    </div>
                </div>
            </div>

            {/* Code */}
            <div className="mb-8">
                <h3 className="text-sm font-bold text-foreground mb-2">Submitted Code</h3>
                <pre className="bg-muted text-foreground p-4 rounded-lg overflow-x-auto font-mono text-xs border border-border">
                    {submission.code}
                </pre>
            </div>

            {/* Test Cases Results (Paginated) */}
            <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold text-gray-700">Test Case Results</h3>

                {results.length > 0 && (
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 mr-2">
                            Case {testCaseIndex + 1} of {results.length}
                        </span>
                        <button
                            onClick={() => setTestCaseIndex(Math.max(0, testCaseIndex - 1))}
                            disabled={testCaseIndex === 0}
                            className="p-1 hover:bg-gray-100 rounded disabled:opacity-30 border"
                        >
                            <ChevronLeft className="w-4 h-4 text-gray-600" />
                        </button>
                        <button
                            onClick={() => setTestCaseIndex(Math.min(results.length - 1, testCaseIndex + 1))}
                            disabled={testCaseIndex === results.length - 1}
                            className="p-1 hover:bg-gray-100 rounded disabled:opacity-30 border"
                        >
                            <ChevronRight className="w-4 h-4 text-gray-600" />
                        </button>
                    </div>
                )}
            </div>

            {results.length > 0 ? (
                <div className="bg-card p-4 rounded-lg border border-border">
                    <TestCaseResultView result={results[testCaseIndex]} />
                </div>
            ) : (
                <div className="text-muted-foreground italic p-4 border rounded bg-muted text-center">No details available (Processing or Pending).</div>
            )}
        </div>
    );
}

function TestCaseResultView({ result }: { result: any }) {
    const isSuccess = result.status === "ACCEPTED";
    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
                {isSuccess ? <CheckCircle className="w-5 h-5 text-green-500" /> : <AlertCircle className="w-5 h-5 text-red-500" />}
                <span className={`text-lg font-bold ${isSuccess ? "text-green-600 dark:text-green-500" : "text-red-600 dark:text-red-500"}`}>
                    {isSuccess ? "PASSED" : result.status.replace(/_/g, " ")}
                </span>
                <span className="text-muted-foreground ml-4 border-l border-border pl-4 py-1">
                    Runtime: <span className="text-foreground">{result.executionTime} ms</span>
                </span>
            </div>

            <div className="space-y-4">
                <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Input</div>
                    <pre className="bg-muted p-3 rounded-lg text-foreground text-sm overflow-x-auto border border-border">
                        {result.input}
                    </pre>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <div className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Expected Output</div>
                        <pre className="bg-muted p-3 rounded-lg text-foreground text-sm overflow-x-auto border border-border h-full">
                            {result.expectedOutput}
                        </pre>
                    </div>
                    <div>
                        <div className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Actual Output</div>
                        <pre className={`p-3 rounded-lg text-sm overflow-x-auto border h-full ${isSuccess
                            ? "bg-muted border-border text-foreground"
                            : "bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-900/50 text-red-800 dark:text-red-200"
                            }`}>
                            {result.stdout || <span className="text-muted-foreground italic">&lt;empty&gt;</span>}
                        </pre>
                    </div>
                </div>
            </div>
        </div>
    );
}
