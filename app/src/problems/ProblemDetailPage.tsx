
import { useAuth } from "wasp/client/auth";
import { useParams, Link } from "react-router-dom";
import { useQuery, getProblem, submitCode, getSubmissions } from "wasp/client/operations";
import { useState } from "react";
import Editor from "@monaco-editor/react";

export default function ProblemDetailPage() {
    const { slug } = useParams();
    const { data: problem, isLoading, error } = useQuery(getProblem, { slug: slug || "" });
    const { data: user } = useAuth();

    const [code, setCode] = useState("// Write your solution here\n");
    const [language, setLanguage] = useState("javascript");
    const [submitting, setSubmitting] = useState(false);

    if (isLoading) return <div>Loading problem...</div>;
    if (error) return <div>Error loading problem</div>;
    if (!problem) return <div>Problem not found</div>;

    const handleSubmit = async () => {
        if (!user) {
            alert("Please login to submit");
            return;
        }
        setSubmitting(true);
        try {
            await submitCode({
                problemId: problem.id,
                code,
                language,
            });
            alert("Submission received! Check results shortly.");
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
                    {/* In real app, render Markdown here */}
                    <pre className="whitespace-pre-wrap font-sans text-base">{problem.description}</pre>
                </div>

                <h3 className="text-lg font-bold mb-2">Example Test Cases</h3>
                {problem.testCases.map((tc: any, idx: number) => (
                    <div key={tc.id} className="mb-4 bg-gray-50 p-4 rounded border">
                        <h4 className="font-semibold text-sm mb-2">Example {idx + 1}</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-xs text-gray-500 uppercase">Input</p>
                                <pre className="bg-gray-100 p-2 rounded text-sm mt-1">{tc.input}</pre>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 uppercase">Output</p>
                                <pre className="bg-gray-100 p-2 rounded text-sm mt-1">{tc.expectedOutput}</pre>
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
                        onChange={(e) => {
                            setCode(e.target.value === "python" ? "# Write your python code\n" : "// Write your js code\n");
                            setLanguage(e.target.value);
                        }}
                        className="bg-gray-700 text-white text-sm p-1 rounded border-none focus:ring-0"
                    >
                        <option value="javascript">JavaScript (Node.js 18)</option>
                        <option value="python">Python (3.9)</option>
                    </select>

                    <button
                        onClick={handleSubmit}
                        disabled={submitting}
                        className={`px-4 py-1.5 rounded text-sm font-semibold text-white ${submitting ? "bg-gray-600 cursor-not-allowed" : "bg-green-600 hover:bg-green-500"
                            }`}
                    >
                        {submitting ? "Submitting..." : "Submit Solution"}
                    </button>
                </div>

                <div className="flex-1">
                    <Editor
                        height="100%"
                        theme="vs-dark"
                        language={language}
                        value={code}
                        onChange={(val) => setCode(val || "")}
                        options={{
                            minimap: { enabled: false },
                            fontSize: 14,
                            scrollBeyondLastLine: false,
                        }}
                    />
                </div>

                {/* Submissions Panel */}
                <div className="h-64 border-t border-gray-700 bg-gray-800 p-4 overflow-y-auto text-white">
                    <h3 className="font-bold mb-2">Previous Submissions</h3>
                    <SubmissionHistory problemId={problem.id} />
                </div>
            </div>
        </div>
    );
}

function SubmissionHistory({ problemId }: { problemId: string }) {
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
                    <tr key={sub.id} className="border-b border-gray-700/50">
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
