import { useState } from "react";
import { trpc } from "../lib/trpc";
import { TIME_SLOTS, DAY_NAMES } from "../../../shared/constants";

type Tab = "teachers" | "timetable";

const DAY_OPTIONS = [1, 2, 3, 4, 5] as const;

// ── Teacher row editor ────────────────────────────────────────────────────────
function TeacherEditor({
  teacher,
  onSave,
  onCancel,
}: {
  teacher: {
    id: number;
    fullName: string;
    shortName: string;
    initials: string;
    role: string;
    homeClass: string | null;
  } | null; // null = new
  onSave: () => void;
  onCancel: () => void;
}) {
  const isNew = teacher === null;
  const [fullName, setFullName] = useState(teacher?.fullName ?? "");
  const [shortName, setShortName] = useState(teacher?.shortName ?? "");
  const [initials, setInitials] = useState(teacher?.initials ?? "");
  const [role, setRole] = useState(teacher?.role ?? "老師");
  const [homeClass, setHomeClass] = useState(teacher?.homeClass ?? "");

  const updateMut = trpc.db.updateTeacher.useMutation({ onSuccess: onSave });
  const addMut = trpc.db.addTeacher.useMutation({ onSuccess: onSave });

  const busy = updateMut.isPending || addMut.isPending;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isNew) {
      addMut.mutate({
        fullName,
        shortName,
        initials,
        role,
        homeClass: homeClass || null,
      });
    } else {
      updateMut.mutate({
        id: teacher!.id,
        fullName,
        shortName,
        initials,
        role,
        homeClass: homeClass || null,
      });
    }
  }

  const fieldClass =
    "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">全名 *</label>
          <input
            className={fieldClass}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">簡稱</label>
          <input
            className={fieldClass}
            value={shortName}
            onChange={(e) => setShortName(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">縮寫</label>
          <input
            className={fieldClass}
            value={initials}
            onChange={(e) => setInitials(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">職位</label>
          <input
            className={fieldClass}
            value={role}
            onChange={(e) => setRole(e.target.value)}
          />
        </div>
        <div className="col-span-2">
          <label className="text-xs text-gray-500 mb-1 block">班別（班主任）</label>
          <input
            className={fieldClass}
            value={homeClass}
            onChange={(e) => setHomeClass(e.target.value)}
            placeholder="留空表示無"
          />
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={busy}
          className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
        >
          {busy ? "儲存中…" : isNew ? "新增" : "儲存"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-50 cursor-pointer"
        >
          取消
        </button>
      </div>
    </form>
  );
}

// ── Timetable entry editor ────────────────────────────────────────────────────
function TimetableEntryEditor({
  entry,
  teacherFullName,
  onSave,
  onCancel,
}: {
  entry: {
    id: number;
    dayOfWeek: number;
    timeSlot: string;
    className: string | null;
    subject: string | null;
    room: string | null;
  } | null;
  teacherFullName: string;
  onSave: () => void;
  onCancel: () => void;
}) {
  const isNew = entry === null;
  const [dayOfWeek, setDayOfWeek] = useState(entry?.dayOfWeek ?? 1);
  const [timeSlot, setTimeSlot] = useState(entry?.timeSlot ?? "1");
  const [className, setClassName] = useState(entry?.className ?? "");
  const [subject, setSubject] = useState(entry?.subject ?? "");
  const [room, setRoom] = useState(entry?.room ?? "");

  const updateMut = trpc.db.updateTimetableEntry.useMutation({ onSuccess: onSave });
  const addMut = trpc.db.addTimetableEntry.useMutation({ onSuccess: onSave });

  const busy = updateMut.isPending || addMut.isPending;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isNew) {
      addMut.mutate({
        teacherFullName,
        dayOfWeek,
        timeSlot,
        className: className || null,
        subject: subject || null,
        room: room || null,
      });
    } else {
      updateMut.mutate({
        id: entry!.id,
        className: className || null,
        subject: subject || null,
        room: room || null,
      });
    }
  }

  const fieldClass =
    "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <form onSubmit={handleSubmit} className="space-y-3 bg-blue-50 rounded-xl p-4">
      <p className="text-sm font-medium text-gray-700">
        {isNew ? "新增時間表條目" : "編輯條目"}
      </p>
      <div className="grid grid-cols-2 gap-3">
        {isNew && (
          <>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">星期</label>
              <select
                className={fieldClass}
                value={dayOfWeek}
                onChange={(e) => setDayOfWeek(Number(e.target.value))}
              >
                {DAY_OPTIONS.map((d) => (
                  <option key={d} value={d}>
                    {DAY_NAMES[d]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">時段</label>
              <select
                className={fieldClass}
                value={timeSlot}
                onChange={(e) => setTimeSlot(e.target.value)}
              >
                {TIME_SLOTS.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}
        <div>
          <label className="text-xs text-gray-500 mb-1 block">班別</label>
          <input
            className={fieldClass}
            value={className}
            onChange={(e) => setClassName(e.target.value)}
            placeholder="例：6E"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">科目</label>
          <input
            className={fieldClass}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="例：英文"
          />
        </div>
        <div className="col-span-2">
          <label className="text-xs text-gray-500 mb-1 block">課室</label>
          <input
            className={fieldClass}
            value={room}
            onChange={(e) => setRoom(e.target.value)}
            placeholder="例：101"
          />
        </div>
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy}
          className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
        >
          {busy ? "儲存中…" : "儲存"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-50 cursor-pointer"
        >
          取消
        </button>
      </div>
    </form>
  );
}

// ── Teachers tab ──────────────────────────────────────────────────────────────
function TeachersTab() {
  const { data: teachers, refetch, isLoading } = trpc.db.listTeachers.useQuery();
  const deleteMut = trpc.db.deleteTeacher.useMutation({ onSuccess: () => refetch() });

  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<number | "new" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  const filtered = (teachers ?? []).filter(
    (t) =>
      !search ||
      t.fullName.includes(search) ||
      t.shortName?.includes(search) ||
      t.initials?.includes(search)
  );

  const editingTeacher =
    editingId === "new"
      ? null
      : editingId != null
      ? (teachers ?? []).find((t) => t.id === editingId) ?? null
      : null;

  function handleSave() {
    setEditingId(null);
    refetch();
  }

  if (isLoading)
    return <p className="text-center text-gray-400 py-12">載入中…</p>;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex gap-2">
        <input
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="搜尋老師姓名…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button
          onClick={() => setEditingId("new")}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 cursor-pointer whitespace-nowrap"
        >
          ＋ 新增
        </button>
      </div>

      {/* New teacher form */}
      {editingId === "new" && (
        <div className="bg-blue-50 rounded-xl p-4">
          <p className="text-sm font-medium text-gray-700 mb-3">新增老師</p>
          <TeacherEditor
            teacher={null}
            onSave={handleSave}
            onCancel={() => setEditingId(null)}
          />
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs">
            <tr>
              <th className="text-left px-4 py-3 font-medium">全名</th>
              <th className="text-left px-4 py-3 font-medium">簡稱</th>
              <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">縮寫</th>
              <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">職位</th>
              <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">班別</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map((t) => (
              <>
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{t.fullName}</td>
                  <td className="px-4 py-3 text-gray-600">{t.shortName}</td>
                  <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">{t.initials}</td>
                  <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">{t.role}</td>
                  <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">{t.homeClass ?? "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() =>
                          setEditingId(editingId === t.id ? null : t.id)
                        }
                        className="text-blue-600 hover:text-blue-800 text-xs px-2 py-1 rounded border border-blue-200 hover:bg-blue-50 cursor-pointer"
                      >
                        編輯
                      </button>
                      {confirmDelete === t.id ? (
                        <button
                          onClick={() => {
                            deleteMut.mutate({ id: t.id });
                            setConfirmDelete(null);
                          }}
                          className="text-red-600 hover:text-red-800 text-xs px-2 py-1 rounded border border-red-200 hover:bg-red-50 cursor-pointer"
                        >
                          確認刪除
                        </button>
                      ) : (
                        <button
                          onClick={() => setConfirmDelete(t.id)}
                          className="text-gray-400 hover:text-red-600 text-xs px-2 py-1 rounded border border-gray-200 hover:border-red-200 cursor-pointer"
                        >
                          刪除
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                {editingId === t.id && (
                  <tr key={`edit-${t.id}`}>
                    <td colSpan={6} className="px-4 py-3 bg-blue-50">
                      <TeacherEditor
                        teacher={t}
                        onSave={handleSave}
                        onCancel={() => setEditingId(null)}
                      />
                    </td>
                  </tr>
                )}
              </>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  沒有符合結果
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-400 text-right">共 {filtered.length} 位老師</p>
    </div>
  );
}

// ── Timetable tab ─────────────────────────────────────────────────────────────
function TimetableTab() {
  const { data: teachers } = trpc.db.listTeachers.useQuery();
  const [selectedTeacher, setSelectedTeacher] = useState("");

  const {
    data: entries,
    refetch,
    isLoading,
  } = trpc.db.getTeacherTimetable.useQuery(
    { teacherFullName: selectedTeacher },
    { enabled: !!selectedTeacher }
  );

  const deleteMut = trpc.db.deleteTimetableEntry.useMutation({
    onSuccess: () => refetch(),
  });

  const [editingId, setEditingId] = useState<number | "new" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  function handleSave() {
    setEditingId(null);
    refetch();
  }

  const editingEntry =
    editingId === "new"
      ? null
      : editingId != null
      ? (entries ?? []).find((e) => e.id === editingId) ?? null
      : null;

  return (
    <div className="space-y-4">
      {/* Teacher selector */}
      <div className="flex gap-2">
        <select
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={selectedTeacher}
          onChange={(e) => {
            setSelectedTeacher(e.target.value);
            setEditingId(null);
          }}
        >
          <option value="">— 選擇老師 —</option>
          {(teachers ?? []).map((t) => (
            <option key={t.id} value={t.fullName}>
              {t.fullName}（{t.shortName}）
            </option>
          ))}
        </select>
        {selectedTeacher && (
          <button
            onClick={() => setEditingId("new")}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 cursor-pointer whitespace-nowrap"
          >
            ＋ 新增
          </button>
        )}
      </div>

      {!selectedTeacher && (
        <p className="text-center text-gray-400 py-12">請先選擇老師</p>
      )}

      {selectedTeacher && isLoading && (
        <p className="text-center text-gray-400 py-12">載入中…</p>
      )}

      {/* New entry form */}
      {editingId === "new" && selectedTeacher && (
        <TimetableEntryEditor
          entry={null}
          teacherFullName={selectedTeacher}
          onSave={handleSave}
          onCancel={() => setEditingId(null)}
        />
      )}

      {/* Timetable table */}
      {selectedTeacher && !isLoading && entries && (
        <>
          <div className="rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs">
                <tr>
                  <th className="text-left px-3 py-3 font-medium">星期</th>
                  <th className="text-left px-3 py-3 font-medium">時段</th>
                  <th className="text-left px-3 py-3 font-medium">班別</th>
                  <th className="text-left px-3 py-3 font-medium">科目</th>
                  <th className="text-left px-3 py-3 font-medium hidden sm:table-cell">
                    課室
                  </th>
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {entries.map((e) => {
                  const slotInfo = TIME_SLOTS.find((s) => s.code === e.timeSlot);
                  return (
                    <>
                      <tr key={e.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">
                          {DAY_NAMES[e.dayOfWeek]}
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="font-medium text-gray-800">
                            {slotInfo?.label ?? e.timeSlot}
                          </span>
                          <span className="text-gray-400 text-xs ml-1">
                            {slotInfo?.time}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-gray-700">
                          {e.className ?? "—"}
                        </td>
                        <td className="px-3 py-2.5 text-gray-700">
                          {e.subject ?? "—"}
                        </td>
                        <td className="px-3 py-2.5 text-gray-500 hidden sm:table-cell">
                          {e.room ?? "—"}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <div className="flex gap-1.5 justify-end">
                            <button
                              onClick={() =>
                                setEditingId(editingId === e.id ? null : e.id)
                              }
                              className="text-blue-600 hover:text-blue-800 text-xs px-2 py-1 rounded border border-blue-200 hover:bg-blue-50 cursor-pointer"
                            >
                              編輯
                            </button>
                            {confirmDelete === e.id ? (
                              <button
                                onClick={() => {
                                  deleteMut.mutate({ id: e.id });
                                  setConfirmDelete(null);
                                }}
                                className="text-red-600 text-xs px-2 py-1 rounded border border-red-200 hover:bg-red-50 cursor-pointer"
                              >
                                確認
                              </button>
                            ) : (
                              <button
                                onClick={() => setConfirmDelete(e.id)}
                                className="text-gray-400 hover:text-red-600 text-xs px-2 py-1 rounded border border-gray-200 hover:border-red-200 cursor-pointer"
                              >
                                刪除
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {editingId === e.id && (
                        <tr key={`edit-${e.id}`}>
                          <td colSpan={6} className="px-3 py-3">
                            <TimetableEntryEditor
                              entry={e}
                              teacherFullName={selectedTeacher}
                              onSave={handleSave}
                              onCancel={() => setEditingId(null)}
                            />
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
                {entries.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-8 text-center text-gray-400"
                    >
                      沒有時間表資料
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-400 text-right">
            共 {entries.length} 個時段
          </p>
        </>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function DatabaseManager({
  onBack,
}: {
  onBack: () => void;
}) {
  const [tab, setTab] = useState<Tab>("teachers");

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button
          onClick={onBack}
          className="text-gray-500 hover:text-gray-700 text-sm cursor-pointer"
        >
          ← 返回
        </button>
        <h1 className="font-semibold text-gray-900">資料庫管理</h1>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {/* Tabs */}
        <div className="flex rounded-xl bg-gray-200 p-1 gap-1">
          {(
            [
              { key: "teachers", label: "👥 老師名單" },
              { key: "timetable", label: "📅 時間表" },
            ] as const
          ).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                tab === key
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-800"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === "teachers" ? <TeachersTab /> : <TimetableTab />}
      </div>
    </div>
  );
}
