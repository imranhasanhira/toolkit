import { getProblems, deleteProblem } from "wasp/client/operations";
import { Trash2 } from "lucide-react";
import { routes } from "wasp/client/router";
import { Link } from "react-router";
import { useQuery } from "wasp/client/operations";
import { useAuth } from "wasp/client/auth";
import { useTranslation } from "react-i18next";

import OJLayout from "./OJLayout";

export default function ProblemListPage() {
    const { data: problems, isLoading, error } = useQuery(getProblems);
    const { data: user } = useAuth();
    const { t } = useTranslation("online-judge");

    if (isLoading) return <div>{t("list.loading")}</div>;
    if (error) return <div>{t("list.error", { message: error.message })}</div>;

    const difficultyLabel = (d: string) => {
        const key = d?.toLowerCase();
        if (key === "easy" || key === "medium" || key === "hard") {
            return t(`list.difficulty.${key}`);
        }
        return d;
    };

    return (
        <OJLayout>
            <div className="p-8">
                <div className="flex justify-end items-center mb-6">
                    {user && (
                        <Link
                            to={routes.CreateProblemRoute.to}
                            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
                        >
                            {t("list.createProblem")}
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
                                                {difficultyLabel(problem.difficulty)}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <Link
                                            to={`/online-judge/${problem.slug}`}
                                            className="text-blue-500 hover:text-blue-700 font-medium"
                                        >
                                            {t("list.solveChallenge")}
                                        </Link>
                                        {user?.isAdmin && (
                                            <button
                                                onClick={async (e) => {
                                                    e.preventDefault();
                                                    if (window.confirm(t("list.confirmDelete"))) {
                                                        try {
                                                            await deleteProblem({ id: problem.id });
                                                            window.location.reload();
                                                        } catch (err: any) {
                                                            alert(t("list.deleteFailed", { reason: err.message }));
                                                        }
                                                    }
                                                }}
                                                className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                                                title={t("list.deleteProblem")}
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-center text-gray-500 py-12">
                            {t("list.empty")}
                        </div>
                    )}
                </div>
            </div>
        </OJLayout>
    );
}
