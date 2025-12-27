
import { useAuth } from "wasp/client/auth";
import { updateProblem, getProblem } from "wasp/client/operations";
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "wasp/client/operations";

export default function EditProblemPage() {
    const { slug: routeSlug } = useParams<{ slug: string }>();
    const navigate = useNavigate();
    const { data: user, isLoading: isAuthLoading } = useAuth();
    const { data: problem, isLoading: isProblemLoading, error: problemError } = useQuery(getProblem, { slug: routeSlug || "" }, { enabled: !!routeSlug });

    const [imgUrl, setImgUrl] = useState(""); // Unused, but keeping consistent if needed later or just omit
    const [title, setTitle] = useState("");
    const [slug, setSlug] = useState("");
    const [description, setDescription] = useState("");
    const [difficulty, setDifficulty] = useState("Easy");
    const [error, setError] = useState<string | null>(null);
    const [testCases, setTestCases] = useState<{ input: string; expectedOutput: string; isSample: boolean }[]>([
        { input: "", expectedOutput: "", isSample: true }
    ]);

    // Populate form when problem data is loaded
    useEffect(() => {
        if (problem) {
            setTitle(problem.title);
            setSlug(problem.slug);
            setDescription(problem.description);
            setDifficulty(problem.difficulty);
            if (problem.testCases && problem.testCases.length > 0) {
                // Map existing test cases to form format
                setTestCases(problem.testCases.map((tc: any) => ({
                    input: tc.input,
                    expectedOutput: tc.expectedOutput,
                    isSample: tc.isSample
                })));
            } else {
                setTestCases([{ input: "", expectedOutput: "", isSample: true }]);
            }
        }
    }, [problem]);

    if (isAuthLoading || isProblemLoading) return <div>Loading...</div>;
    if (problemError) return <div>Error loading problem: {problemError.message}</div>;
    if (!problem) return <div>Problem not found</div>;

    const addTestCase = () => {
        setTestCases([...testCases, { input: "", expectedOutput: "", isSample: false }]);
    };

    const removeTestCase = (index: number) => {
        setTestCases(testCases.filter((_, i) => i !== index));
    };

    const updateTestCase = (index: number, field: string, value: any) => {
        const newTestCases = [...testCases];
        newTestCases[index] = { ...newTestCases[index], [field]: value };
        setTestCases(newTestCases);
    };

    const handleSubmit = async () => {
        setError(null);
        try {
            await updateProblem({
                id: problem.id,
                title,
                slug,
                description,
                difficulty,
                testCases,
            });
            navigate(`/online-judge/${slug}`);
        } catch (error: any) {
            setError(error.message);
            console.error("Error updating problem: ", error);
        }
    };

    return (
        <div className="container mx-auto p-6 max-w-4xl">
            <h1 className="text-3xl font-bold mb-6">Edit Problem</h1>

            <div className="grid gap-6">
                {error && (
                    <div className="bg-red-50 text-red-700 p-4 rounded border border-red-200">
                        {error}
                    </div>
                )}
                <div className="grid gap-2">
                    <label className="font-semibold">Title</label>
                    <input
                        className="border p-2 rounded"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Add Two Numbers"
                    />
                </div>

                <div className="grid gap-2">
                    <label className="font-semibold">Slug</label>
                    <input
                        className="border p-2 rounded"
                        value={slug}
                        onChange={(e) => setSlug(e.target.value)}
                        placeholder="add-two-numbers"
                    />
                </div>

                <div className="grid gap-2">
                    <label className="font-semibold">Difficulty</label>
                    <select
                        className="border p-2 rounded"
                        value={difficulty}
                        onChange={(e) => setDifficulty(e.target.value)}
                    >
                        <option value="Easy">Easy</option>
                        <option value="Medium">Medium</option>
                        <option value="Hard">Hard</option>
                    </select>
                </div>

                <div className="grid gap-2">
                    <label className="font-semibold">Description (Markdown)</label>
                    <textarea
                        className="border p-2 rounded h-40 font-mono"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="## Problem Statement..."
                    />
                </div>

                <div className="border-t pt-4">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold">Test Cases</h2>
                        <button
                            onClick={addTestCase}
                            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                        >
                            + Add Test Case
                        </button>
                    </div>

                    {testCases.map((tc, index) => (
                        <div key={index} className="border p-4 rounded mb-4 bg-gray-50 relative">
                            <button
                                onClick={() => removeTestCase(index)}
                                className="absolute top-2 right-2 text-red-500 hover:text-red-700"
                            >
                                Remove
                            </button>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Input (Stdin)</label>
                                    <textarea
                                        className="w-full border p-2 rounded h-24 font-mono text-sm"
                                        value={tc.input}
                                        onChange={(e) => updateTestCase(index, "input", e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Expected Output (Stdout)</label>
                                    <textarea
                                        className="w-full border p-2 rounded h-24 font-mono text-sm"
                                        value={tc.expectedOutput}
                                        onChange={(e) => updateTestCase(index, "expectedOutput", e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="mt-2">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={tc.isSample}
                                        onChange={(e) => updateTestCase(index, "isSample", e.target.checked)}
                                    />
                                    <span>Is Sample Case (Visible in Description)</span>
                                </label>
                            </div>
                        </div>
                    ))}
                </div>

                <button
                    onClick={handleSubmit}
                    className="bg-green-600 text-white px-6 py-3 rounded text-lg font-semibold hover:bg-green-700 w-full"
                >
                    Update Problem
                </button>
            </div>
        </div>
    );
}
