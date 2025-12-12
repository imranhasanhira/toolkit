
import { useQuery, getRuntimes, updateRuntime, createRuntime, checkRuntimeStatus } from "wasp/client/operations";
import { useState, useEffect, useCallback } from "react";
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
    const [dockerImage, setDockerImage] = useState("node:18-alpine");
    const [runCommand, setRunCommand] = useState("node solution.js");
    const [fileName, setFileName] = useState("solution.js");
    const [memoryLimit, setMemoryLimit] = useState(128);
    const [cpuLimit, setCpuLimit] = useState(0.5);
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        if (!language.trim()) return alert("Language name is required");
        setSaving(true);
        try {
            await createRuntime({
                language: language.toLowerCase(),
                defaultCode: code,
                dockerImage,
                runCommand,
                fileName,
                memoryLimit,
                cpuLimit,
            });
            setSaving(false);
            window.location.reload();
        } catch (err: any) {
            alert("Error creating: " + err.message);
            setSaving(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-white">
            <div className="px-6 py-4 border-b bg-gray-50 flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-800">New Runtime</h2>
                <div className="flex gap-2">
                    <button onClick={onCancel} className="px-4 py-2 rounded text-sm text-gray-600 hover:bg-gray-200">Cancel</button>
                    <button onClick={handleSave} disabled={saving} className="px-4 py-2 rounded text-sm font-semibold bg-green-600 hover:bg-green-700 text-white">
                        {saving ? "Creating..." : "Create"}
                    </button>
                </div>
            </div>

            <div className="flex-1 flex flex-col overflow-hidden">
                <div className="p-6 grid grid-cols-2 gap-6 border-b bg-white">
                    <div className="col-span-2">
                        <label className="block text-xs font-bold text-gray-500 uppercase">Language Name (ID)</label>
                        <input type="text" value={language} onChange={e => setLanguage(e.target.value)} className="w-full mt-1 p-2 border rounded" placeholder="e.g. rust" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase">Docker Image</label>
                        <input type="text" value={dockerImage} onChange={e => setDockerImage(e.target.value)} className="w-full mt-1 p-2 border rounded" placeholder="node:18-alpine" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase">Run Command</label>
                        <input type="text" value={runCommand} onChange={e => setRunCommand(e.target.value)} className="w-full mt-1 p-2 border rounded" placeholder="node solution.js" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase">File Name</label>
                        <input type="text" value={fileName} onChange={e => setFileName(e.target.value)} className="w-full mt-1 p-2 border rounded" placeholder="solution.js" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase">Memory (MB)</label>
                        <input type="number" value={memoryLimit} onChange={e => setMemoryLimit(parseInt(e.target.value) || 128)} className="w-full mt-1 p-2 border rounded" placeholder="128" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase">CPUs</label>
                        <input type="number" step="0.1" value={cpuLimit} onChange={e => setCpuLimit(parseFloat(e.target.value) || 0.5)} className="w-full mt-1 p-2 border rounded" placeholder="0.5" />
                    </div>
                </div>

                <div className="bg-gray-100 px-6 py-2 border-b text-xs text-gray-500">Default Code Template</div>
                <div className="flex-1">
                    <Editor height="100%" theme="light" value={code} onChange={(val) => setCode(val || "")} options={{ minimap: { enabled: false } }} />
                </div>
            </div>
        </div>
    );
}

function RuntimeEditor({ runtime }: { runtime: any }) {
    const [code, setCode] = useState(runtime.defaultCode);
    const [dockerImage, setDockerImage] = useState(runtime.dockerImage || "");
    const [runCommand, setRunCommand] = useState(runtime.runCommand || "");
    const [fileName, setFileName] = useState(runtime.fileName || "");
    const [memoryLimit, setMemoryLimit] = useState(runtime.memoryLimit || 128);
    const [cpuLimit, setCpuLimit] = useState(runtime.cpuLimit || 0.5);

    const [saving, setSaving] = useState(false);
    const [dirty, setDirty] = useState(false);

    useEffect(() => {
        setCode(runtime.defaultCode);
        setDockerImage(runtime.dockerImage || "");
        setRunCommand(runtime.runCommand || "");
        setFileName(runtime.fileName || "");
        setMemoryLimit(runtime.memoryLimit || 128);
        setCpuLimit(runtime.cpuLimit || 0.5);
        setDirty(false);
    }, [runtime.id]);

    const handleSave = async () => {
        setSaving(true);
        try {
            await updateRuntime({
                id: runtime.id,
                defaultCode: code,
                dockerImage,
                runCommand,
                fileName,
                memoryLimit,
                cpuLimit,
            });
            setDirty(false);
        } catch (err: any) {
            alert("Error saving: " + err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleChange = (setter: any, val: any) => {
        setter(val);
        setDirty(true);
    };

    return (
        <div className="flex flex-col h-full bg-white">
            <div className="px-6 py-4 border-b bg-gray-50 flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <h2 className="text-xl font-bold capitalize text-gray-800">{runtime.language}</h2>
                    {dirty && <span className="text-xs text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded border border-yellow-200">Unsaved Changes</span>}
                </div>
                <button
                    onClick={handleSave}
                    disabled={!dirty || saving}
                    className={`px-4 py-2 rounded text-sm font-semibold transition-colors ${!dirty ? "bg-gray-200 text-gray-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700 text-white"
                        }`}
                >
                    {saving ? "Saving..." : "Save Configuration"}
                </button>
            </div>

            <div className="flex-1 flex flex-col overflow-hidden">
                <div className="p-6 grid grid-cols-2 gap-6 border-b bg-white">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase flex items-center justify-between">
                            Docker Image
                            <RuntimeStatusBadge dockerImage={dockerImage} />
                        </label>
                        <input type="text" value={dockerImage} onChange={e => handleChange(setDockerImage, e.target.value)} className="w-full mt-1 p-2 border rounded" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase">Run Command</label>
                        <input type="text" value={runCommand} onChange={e => handleChange(setRunCommand, e.target.value)} className="w-full mt-1 p-2 border rounded" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase">File Name</label>
                        <input type="text" value={fileName} onChange={e => handleChange(setFileName, e.target.value)} className="w-full mt-1 p-2 border rounded" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase">Memory (MB)</label>
                        <input type="number" value={memoryLimit} onChange={e => handleChange(setMemoryLimit, parseInt(e.target.value) || 128)} className="w-full mt-1 p-2 border rounded" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase">CPUs</label>
                        <input type="number" step="0.1" value={cpuLimit} onChange={e => handleChange(setCpuLimit, parseFloat(e.target.value) || 0.5)} className="w-full mt-1 p-2 border rounded" />
                    </div>
                </div>

                <div className="bg-gray-100 px-6 py-2 border-b text-xs text-gray-500">Default Code Template</div>
                <div className="flex-1">
                    <Editor
                        height="100%"
                        theme="light"
                        language={runtime.language === "javascript" ? "javascript" : "python"} // Best guess or add extension mapping layer
                        value={code}
                        onChange={(val) => handleChange(setCode, val || "")}
                        options={{ minimap: { enabled: false } }}
                    />
                </div>
            </div>
        </div>
    );
}

function RuntimeStatusBadge({ dockerImage }: { dockerImage: string }) {
    const [status, setStatus] = useState<any>(null);
    const [checking, setChecking] = useState(false);

    useEffect(() => {
        if (!dockerImage) {
            setStatus(null);
            return;
        }

        const check = async () => {
            setChecking(true);
            try {
                const result = await checkRuntimeStatus({ dockerImage });
                setStatus(result);
            } catch (err) {
                setStatus({ status: "ERROR" });
            } finally {
                setChecking(false);
            }
        };

        const timeoutId = setTimeout(check, 1000); // Debounce 1s
        return () => clearTimeout(timeoutId);
    }, [dockerImage]);

    if (checking) return <span className="text-xs text-gray-400 font-normal normal-case ml-2">Checking...</span>

    if (!status) return null;

    if (status.status === "DOCKER_UNAVAILABLE") {
        return <span className="text-xs text-red-600 font-bold bg-red-50 px-2 py-0.5 rounded normal-case ml-2">Docker Unavailable</span>;
    }

    if (status.status === "READY") {
        return <span className="text-xs text-green-600 font-bold bg-green-50 px-2 py-0.5 rounded normal-case ml-2">Ready</span>;
    }

    if (status.status === "IMAGE_MISSING") {
        return <span className="text-xs text-orange-600 font-bold bg-orange-50 px-2 py-0.5 rounded normal-case ml-2">Image Missing on Host</span>;
    }

    return <span className="text-xs text-red-600 normal-case ml-2">Error</span>;
}
