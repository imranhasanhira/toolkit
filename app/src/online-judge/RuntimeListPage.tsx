
import { useQuery, getRuntimes, updateRuntime, createRuntime } from "wasp/client/operations";
import { useState, useEffect } from "react";
import Editor from "@monaco-editor/react";
import OJLayout from "./OJLayout";

export default function RuntimeListPage() {
    return (
        <OJLayout>
            <RuntimeListContent />
        </OJLayout>
    );
}

function RuntimeListContent() {
    const { data: runtimes, isLoading, error } = useQuery(getRuntimes);
    const [selectedRuntimeId, setSelectedRuntimeId] = useState<string | null>(null);
    const [isCreating, setIsCreating] = useState(false);

    // Select first runtime by default when loaded
    useEffect(() => {
        if (runtimes && runtimes.length > 0 && !selectedRuntimeId && !isCreating) {
            setSelectedRuntimeId(runtimes[0].id);
        }
    }, [runtimes]);

    if (isLoading) return <div className="p-8">Loading runtimes...</div>;
    if (error) return <div className="p-8">Error: {error.message}</div>;

    const selectedRuntime = runtimes?.find((r: any) => r.id === selectedRuntimeId);

    const handleSelect = (id: string) => {
        setSelectedRuntimeId(id);
        setIsCreating(false);
    };

    const handleCreateClick = () => {
        setSelectedRuntimeId(null);
        setIsCreating(true);
    };

    return (
        <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-white">
            {/* Left Sidebar: List */}
            <div className="w-64 border-r bg-gray-50 flex flex-col">
                <div className="p-4 border-b flex justify-between items-center">
                    <h2 className="font-bold text-gray-700">Runtimes</h2>
                    <button
                        onClick={handleCreateClick}
                        className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
                    >
                        + New
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto">
                    {runtimes && runtimes.map((rt: any) => (
                        <button
                            key={rt.id}
                            onClick={() => handleSelect(rt.id)}
                            className={`w-full text-left px-4 py-3 border-b border-gray-100 transition-colors ${selectedRuntimeId === rt.id
                                    ? "bg-blue-50 text-blue-700 font-medium border-l-4 border-l-blue-600"
                                    : "bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-900 border-l-4 border-l-transparent"
                                }`}
                        >
                            <div className="capitalize">{rt.language}</div>
                        </button>
                    ))}
                    {runtimes?.length === 0 && !isCreating && (
                        <div className="p-4 text-sm text-gray-500 text-center">No runtimes found.</div>
                    )}
                </div>
            </div>

            {/* Right Panel: Details/Editor */}
            <div className="flex-1 flex flex-col h-full overflow-hidden">
                {isCreating ? (
                    <RuntimeCreator onCancel={() => handleSelect(runtimes?.[0]?.id || null)} />
                ) : selectedRuntime ? (
                    <RuntimeEditor runtime={selectedRuntime} />
                ) : (
                    <div className="flex-1 flex items-center justify-center text-gray-400">
                        Select a runtime to configure
                    </div>
                )}
            </div>
        </div>
    );
}

function RuntimeCreator({ onCancel }: { onCancel: () => void }) {
    const [language, setLanguage] = useState("");
    const [code, setCode] = useState("// Default code here");
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        if (!language.trim()) return alert("Language name is required");
        setSaving(true);
        try {
            await createRuntime({
                language: language.toLowerCase(),
                defaultCode: code,
            });
            // Ideally we'd await invalidation or optimistically update, 
            // but simpler to reload or just let useQuery refetch naturally if configured. 
            // We'll perform a hard reload or just wait. 
            // Better: Wasp useQuery auto-refetches on action success usually if properly keyed? 
            // Yes, standard query invalidation should happen.
            setSaving(false);
            window.location.reload(); // Lazy reload to select the new one, or wait for query update.
        } catch (err: any) {
            alert("Error creating: " + err.message);
            setSaving(false);
        }
    };

    return (
        <div className="flex flex-col h-full">
            <div className="px-6 py-4 border-b bg-white flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <input
                        type="text"
                        placeholder="e.g. rust"
                        value={language}
                        onChange={(e) => setLanguage(e.target.value)}
                        className="text-xl font-bold border-b border-gray-300 focus:border-blue-500 focus:outline-none px-1 py-0.5 w-48"
                    />
                    <span className="text-xs text-gray-400">Enter language name (unique ID)</span>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 rounded text-sm text-gray-600 hover:bg-gray-100"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving || !language}
                        className="px-4 py-2 rounded text-sm font-semibold bg-green-600 hover:bg-green-700 text-white disabled:opacity-50"
                    >
                        {saving ? "Creating..." : "Create Runtime"}
                    </button>
                </div>
            </div>
            <div className="bg-gray-50 px-6 py-2 border-b text-xs text-gray-500">
                Default Code Template
            </div>
            <div className="flex-1">
                <Editor
                    height="100%"
                    theme="light"
                    value={code}
                    onChange={(val) => setCode(val || "")}
                    options={{ minimap: { enabled: false }, fontSize: 14, padding: { top: 16 } }}
                />
            </div>
        </div>
    );
}

function RuntimeEditor({ runtime }: { runtime: any }) {
    // Keep local state for the form
    const [code, setCode] = useState(runtime.defaultCode);
    const [saving, setSaving] = useState(false);
    const [dirty, setDirty] = useState(false);

    // Reset state when runtime selection changes
    useEffect(() => {
        setCode(runtime.defaultCode);
        setDirty(false);
    }, [runtime.id]);

    const handleSave = async () => {
        setSaving(true);
        try {
            await updateRuntime({
                id: runtime.id,
                defaultCode: code,
            });
            setDirty(false);
            // alert("Saved successfully!"); 
        } catch (err: any) {
            alert("Error saving: " + err.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="flex flex-col h-full">
            <div className="px-6 py-4 border-b bg-white flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <h2 className="text-xl font-bold capitalize text-gray-800">{runtime.language}</h2>
                    {dirty && <span className="text-xs text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded border border-yellow-200">Unsaved Changes</span>}
                </div>
                <button
                    onClick={handleSave}
                    disabled={!dirty || saving}
                    className={`px-4 py-2 rounded text-sm font-semibold transition-colors ${!dirty
                            ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                            : saving
                                ? "bg-blue-400 text-white cursor-wait"
                                : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                        }`}
                >
                    {saving ? "Saving..." : "Save Configuration"}
                </button>
            </div>

            <div className="bg-gray-50 px-6 py-2 border-b text-xs text-gray-500">
                Default Code Template (Loaded when a user selects this language)
            </div>

            <div className="flex-1">
                <Editor
                    height="100%"
                    theme="light" // Use light theme for settings page usually, but user might prefer dark? Sticky to light for admin-like feels.
                    language={runtime.language === "javascript" ? "javascript" : "python"}
                    value={code}
                    onChange={(val) => {
                        setCode(val || "");
                        setDirty(true);
                    }}
                    options={{
                        minimap: { enabled: false },
                        fontSize: 14,
                        padding: { top: 16 }
                    }}
                />
            </div>
        </div>
    );
}
