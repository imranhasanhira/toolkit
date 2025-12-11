import { getProblems } from "wasp/client/operations";
import { routes } from "wasp/client/router";
import { Link } from "react-router-dom";
import { useQuery } from "wasp/client/operations";
import { useAuth } from "wasp/client/auth";

import OJLayout from "./OJLayout";

export default function ProblemListPage() {
    const { data: problems, isLoading, error } = useQuery(getProblems);
    const { data: user } = useAuth();

    if (isLoading) return <div>Loading...</div>;
    if (error) return <div>Error: {error.message}</div>;

    return (
        <OJLayout>
            <div className="p-8">
                <div className="flex justify-end items-center mb-6">
                    {user && (
                        <Link
                            to={routes.CreateProblemRoute.to}
                            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
                        >
                            Create Problem
                        </Link>
                    )}
                </div>

                <div className="grid gap-4">
                    {problems && problems.length > 0 ? (
                        problems.map((problem: any) => (
                            <div
                                key={problem.id}
                                className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow border border-gray-100"
                            >
                                <div className="flex justify-between items-center">
                                    <div>
                                        <Link
                                            to={`/online-judge/${problem.slug}`}
                                            className="text-xl font-semibold text-blue-600 hover:underline"
                                        >
                                            {problem.title}
                                        </Link>
                                        <div className="text-gray-500 text-sm mt-1">
                                            <span className={`px-2 py-0.5 rounded text-xs border ${problem.difficulty === "Easy"
                                                ? "border-green-200 bg-green-50 text-green-700"
                                                : problem.difficulty === "Medium"
                                                    ? "border-yellow-200 bg-yellow-50 text-yellow-700"
                                                    : "border-red-200 bg-red-50 text-red-700"
                                                }`}>
                                                {problem.difficulty}
                                            </span>
                                        </div>
                                    </div>
                                    <Link
                                        to={`/online-judge/${problem.slug}`}
                                        className="text-blue-500 hover:text-blue-700 font-medium"
                                    >
                                        Solve Challenge &rarr;
                                    </Link>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-center text-gray-500 py-12">
                            No problems found. Check back later!
                        </div>
                    )}
                </div>
            </div>
        </OJLayout>
    );
}
