
import { Link, useLocation } from "react-router-dom";
import { type ReactNode } from "react";
import { useAuth } from "wasp/client/auth";

export default function OJLayout({ children }: { children: ReactNode }) {
    const location = useLocation();
    const { data: user } = useAuth();
    const currentPath = location.pathname;

    const tabs = [
        { name: "Problems", path: "/online-judge" },
        { name: "Runtimes", path: "/online-judge/runtimes" },
    ];

    return (
        <div className="flex flex-col h-full">
            <div className="bg-white border-b px-8 py-0">
                <div className="flex space-x-8">
                    {tabs.map((tab) => {
                        const isActive = currentPath === tab.path || (tab.path === "/online-judge" && currentPath === "/online-judge");
                        // Simple active check, strictly speaking /online-judge/create should probably highlight Problems too?
                        // For now exact or strict prefix match.
                        const isActivePrefix = currentPath.startsWith(tab.path) && (tab.path !== "/online-judge" || currentPath === "/online-judge");

                        return (
                            <Link
                                key={tab.name}
                                to={tab.path}
                                className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors ${isActive || (tab.path === "/online-judge" && currentPath.includes("/online-judge") && !currentPath.includes("runtimes"))
                                        ? "border-blue-500 text-blue-600"
                                        : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                                    }`}
                            >
                                {tab.name}
                            </Link>
                        );
                    })}
                </div>
            </div>
            <div className="flex-1 overflow-auto bg-gray-50">
                {children}
            </div>
        </div>
    );
}
