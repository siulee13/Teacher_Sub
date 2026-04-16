import { useState } from "react";
import SubstitutionSystem from "./pages/SubstitutionSystem";
import DatabaseManager from "./pages/DatabaseManager";

type Page = "home" | "substitution" | "database";

export default function App() {
  const [page, setPage] = useState<Page>("home");

  if (page === "substitution") {
    return <SubstitutionSystem onBack={() => setPage("home")} />;
  }

  if (page === "database") {
    return <DatabaseManager onBack={() => setPage("home")} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
        <div className="text-5xl mb-4">📋</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          校園代課編排系統
        </h1>
        <p className="text-gray-500 mb-1 text-sm">
          中華基督教會基法小學（油塘）
        </p>
        <p className="text-gray-400 mb-6 text-sm">
          快速安排老師請假時的代課事宜
        </p>
        <div className="space-y-3 text-left text-sm text-gray-600 mb-8">
          <div className="flex items-start gap-2">
            <span className="text-blue-500 mt-0.5">✓</span>
            <span>選擇日期及請假老師，自動顯示課堂安排</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-blue-500 mt-0.5">✓</span>
            <span>智能推薦代課老師（科任優先、空堂排序）</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-blue-500 mt-0.5">✓</span>
            <span>支援調課方案、多位老師同日請假</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-blue-500 mt-0.5">✓</span>
            <span>生成代課報告，支援下載 CSV</span>
          </div>
        </div>
        <div className="space-y-3">
          <button
            onClick={() => setPage("substitution")}
            className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 transition-colors cursor-pointer"
          >
            開始使用
          </button>
          <button
            onClick={() => setPage("database")}
            className="w-full border border-gray-300 text-gray-600 py-3 px-6 rounded-lg font-medium hover:bg-gray-50 transition-colors cursor-pointer flex items-center justify-center gap-2"
          >
            <span>🗄️</span>
            <span>時間表資料庫管理</span>
          </button>
        </div>
      </div>
    </div>
  );
}
