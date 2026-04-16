import { useState, useMemo, useCallback } from "react";
import { trpc } from "../lib/trpc";
import { TIME_SLOTS, DAY_NAMES, getTimeSlotLabel, getTimeSlotTime } from "../../../shared/constants";

type AbsentTeacher = {
  fullName: string;
  shortName: string;
  leaveType: "full" | "partial";
  startSlot?: string;
  endSlot?: string;
};

type SubstitutionChoice = {
  timeSlot: string;
  className: string;
  subject: string;
  selectedTeacher: string;
  selectedTeacherShort: string;
  isSwap: boolean;
  swapNote?: string;
};

type StepProps = {
  onBack: () => void;
};

export default function SubstitutionSystem({ onBack }: StepProps) {
  const [step, setStep] = useState(1);
  const [dateStr, setDateStr] = useState("");
  const [absentTeachers, setAbsentTeachers] = useState<AbsentTeacher[]>([]);
  const [allowSwap, setAllowSwap] = useState(false);
  const [confirmIndex, setConfirmIndex] = useState(0);
  const [allChoices, setAllChoices] = useState<
    Record<string, SubstitutionChoice[]>
  >({});
  const [currentSlotIdx, setCurrentSlotIdx] = useState(0);
  const [currentTeacherIdx, setCurrentTeacherIdx] = useState(0);

  const teachersQuery = trpc.substitution.getAllTeachers.useQuery();
  const saveMutation = trpc.substitution.saveRecord.useMutation();

  const dayOfWeek = useMemo(() => {
    if (!dateStr) return 0;
    return new Date(dateStr).getDay();
  }, [dateStr]);

  const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;

  // Step 1: Input
  if (step === 1) {
    return (
      <StepInput
        dateStr={dateStr}
        setDateStr={setDateStr}
        absentTeachers={absentTeachers}
        setAbsentTeachers={setAbsentTeachers}
        allowSwap={allowSwap}
        setAllowSwap={setAllowSwap}
        isWeekday={isWeekday}
        dayOfWeek={dayOfWeek}
        teachers={teachersQuery.data ?? []}
        onNext={() => {
          setConfirmIndex(0);
          setStep(2);
        }}
        onBack={onBack}
      />
    );
  }

  // Step 2: Confirmation
  if (step === 2) {
    return (
      <StepConfirmation
        dateStr={dateStr}
        absentTeachers={absentTeachers}
        confirmIndex={confirmIndex}
        setConfirmIndex={setConfirmIndex}
        onBack={() => setStep(1)}
        onNext={() => {
          setCurrentTeacherIdx(0);
          setCurrentSlotIdx(0);
          setStep(3);
        }}
      />
    );
  }

  // Step 3: Substitution selection
  if (step === 3) {
    return (
      <StepSubstitution
        dateStr={dateStr}
        absentTeachers={absentTeachers}
        allowSwap={allowSwap}
        allChoices={allChoices}
        setAllChoices={setAllChoices}
        currentTeacherIdx={currentTeacherIdx}
        setCurrentTeacherIdx={setCurrentTeacherIdx}
        currentSlotIdx={currentSlotIdx}
        setCurrentSlotIdx={setCurrentSlotIdx}
        onBack={() => setStep(2)}
        onNext={() => setStep(4)}
      />
    );
  }

  // Step 4: Report
  return (
    <StepReport
      dateStr={dateStr}
      dayOfWeek={dayOfWeek}
      absentTeachers={absentTeachers}
      allChoices={allChoices}
      setAllChoices={setAllChoices}
      saveMutation={saveMutation}
      onBack={() => setStep(3)}
      onNew={() => {
        setStep(1);
        setDateStr("");
        setAbsentTeachers([]);
        setAllChoices({});
      }}
    />
  );
}

// ========== Step 1: Input ==========
function StepInput({
  dateStr, setDateStr,
  absentTeachers, setAbsentTeachers,
  allowSwap, setAllowSwap,
  isWeekday, dayOfWeek,
  teachers,
  onNext, onBack,
}: {
  dateStr: string;
  setDateStr: (v: string) => void;
  absentTeachers: AbsentTeacher[];
  setAbsentTeachers: (v: AbsentTeacher[]) => void;
  allowSwap: boolean;
  setAllowSwap: (v: boolean) => void;
  isWeekday: boolean;
  dayOfWeek: number;
  teachers: { fullName: string; shortName: string }[];
  onNext: () => void;
  onBack: () => void;
}) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredTeachers = useMemo(() => {
    if (!searchTerm) return teachers;
    return teachers.filter(
      (t) =>
        t.fullName.includes(searchTerm) || t.shortName.includes(searchTerm)
    );
  }, [teachers, searchTerm]);

  const addTeacher = (t: { fullName: string; shortName: string }) => {
    if (absentTeachers.some((at) => at.fullName === t.fullName)) return;
    setAbsentTeachers([
      ...absentTeachers,
      { fullName: t.fullName, shortName: t.shortName, leaveType: "full" },
    ]);
    setSearchTerm("");
  };

  const removeTeacher = (name: string) => {
    setAbsentTeachers(absentTeachers.filter((t) => t.fullName !== name));
  };

  const canProceed = dateStr && isWeekday && absentTeachers.length > 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="text-gray-500 hover:text-gray-700 cursor-pointer">
          ← 返回
        </button>
        <h1 className="font-bold text-lg">代課編排</h1>
        <div className="ml-auto text-sm text-gray-400">步驟 1/4</div>
      </header>

      <div className="max-w-lg mx-auto p-4 space-y-6">
        {/* Date picker */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            代課日期
          </label>
          <input
            type="date"
            value={dateStr}
            onChange={(e) => setDateStr(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          {dateStr && !isWeekday && (
            <p className="text-red-500 text-sm mt-1">請選擇星期一至五</p>
          )}
          {dateStr && isWeekday && (
            <p className="text-green-600 text-sm mt-1">
              {DAY_NAMES[dayOfWeek]}
            </p>
          )}
        </div>

        {/* Absent teachers */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            請假老師
          </label>

          {/* Selected teachers */}
          {absentTeachers.length > 0 && (
            <div className="space-y-2 mb-3">
              {absentTeachers.map((t) => (
                <div
                  key={t.fullName}
                  className="bg-white border rounded-lg p-3"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">
                      {t.fullName}（{t.shortName}）
                    </span>
                    <button
                      onClick={() => removeTeacher(t.fullName)}
                      className="text-red-400 hover:text-red-600 text-sm cursor-pointer"
                    >
                      移除
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        setAbsentTeachers(
                          absentTeachers.map((at) =>
                            at.fullName === t.fullName
                              ? { ...at, leaveType: "full" }
                              : at
                          )
                        )
                      }
                      className={`text-sm px-3 py-1 rounded-full cursor-pointer ${
                        t.leaveType === "full"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      全日
                    </button>
                    <button
                      onClick={() =>
                        setAbsentTeachers(
                          absentTeachers.map((at) =>
                            at.fullName === t.fullName
                              ? { ...at, leaveType: "partial" }
                              : at
                          )
                        )
                      }
                      className={`text-sm px-3 py-1 rounded-full cursor-pointer ${
                        t.leaveType === "partial"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      指定時段
                    </button>
                  </div>
                  {t.leaveType === "partial" && (
                    <div className="mt-2 flex gap-2 items-center text-sm">
                      <select
                        value={t.startSlot ?? ""}
                        onChange={(e) =>
                          setAbsentTeachers(
                            absentTeachers.map((at) =>
                              at.fullName === t.fullName
                                ? { ...at, startSlot: e.target.value }
                                : at
                            )
                          )
                        }
                        className="border rounded px-2 py-1"
                      >
                        <option value="">開始</option>
                        {TIME_SLOTS.map((s) => (
                          <option key={s.code} value={s.code}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                      <span>至</span>
                      <select
                        value={t.endSlot ?? ""}
                        onChange={(e) =>
                          setAbsentTeachers(
                            absentTeachers.map((at) =>
                              at.fullName === t.fullName
                                ? { ...at, endSlot: e.target.value }
                                : at
                            )
                          )
                        }
                        className="border rounded px-2 py-1"
                      >
                        <option value="">結束</option>
                        {TIME_SLOTS.map((s) => (
                          <option key={s.code} value={s.code}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Search and add */}
          <div className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="搜尋老師姓名..."
              className="w-full border rounded-lg px-3 py-2"
            />
            {searchTerm && (
              <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {filteredTeachers.map((t) => (
                  <button
                    key={t.fullName}
                    onClick={() => addTeacher(t)}
                    disabled={absentTeachers.some(
                      (at) => at.fullName === t.fullName
                    )}
                    className="w-full text-left px-3 py-2 hover:bg-gray-50 disabled:opacity-50 text-sm cursor-pointer"
                  >
                    {t.fullName}（{t.shortName}）
                  </button>
                ))}
                {filteredTeachers.length === 0 && (
                  <div className="px-3 py-2 text-gray-400 text-sm">
                    找不到老師
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Allow swap — only available when at least one teacher has partial leave */}
        {(() => {
          const hasPartial = absentTeachers.some((t) => t.leaveType === "partial");
          return (
            <label className={`flex items-center gap-2 ${hasPartial ? "cursor-pointer" : "cursor-not-allowed opacity-50"}`}>
              <input
                type="checkbox"
                checked={allowSwap && hasPartial}
                onChange={(e) => setAllowSwap(e.target.checked)}
                disabled={!hasPartial}
                className="rounded"
              />
              <span className="text-sm text-gray-700">容許調課</span>
              {!hasPartial && absentTeachers.length > 0 && (
                <span className="text-xs text-gray-400">（全日請假不適用）</span>
              )}
            </label>
          );
        })()}

        {/* Next button */}
        <button
          onClick={onNext}
          disabled={!canProceed}
          className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          下一步：確認課堂
        </button>
      </div>
    </div>
  );
}

// ========== Step 2: Confirmation ==========
function StepConfirmation({
  dateStr,
  absentTeachers,
  confirmIndex,
  setConfirmIndex,
  onBack,
  onNext,
}: {
  dateStr: string;
  absentTeachers: AbsentTeacher[];
  confirmIndex: number;
  setConfirmIndex: (v: number) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const currentTeacher = absentTeachers[confirmIndex];
  const classesQuery = trpc.substitution.getTeacherClasses.useQuery(
    { teacherFullName: currentTeacher.fullName, dateStr },
    { enabled: !!currentTeacher }
  );

  // Filter classes by partial leave slot range
  const filteredClasses = useMemo(() => {
    const data = classesQuery.data ?? [];
    if (currentTeacher.leaveType !== "partial" || !currentTeacher.startSlot || !currentTeacher.endSlot) {
      return data;
    }
    const slotOrder: string[] = TIME_SLOTS.map((s) => s.code);
    const startIdx = slotOrder.indexOf(currentTeacher.startSlot);
    const endIdx = slotOrder.indexOf(currentTeacher.endSlot);
    return data.filter((cls) => {
      const idx = slotOrder.indexOf(cls.timeSlot);
      return idx >= startIdx && idx <= endIdx;
    });
  }, [classesQuery.data, currentTeacher]);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="text-gray-500 hover:text-gray-700 cursor-pointer">
          ← 返回
        </button>
        <h1 className="font-bold text-lg">確認課堂</h1>
        <div className="ml-auto text-sm text-gray-400">步驟 2/4</div>
      </header>

      <div className="max-w-lg mx-auto p-4">
        <div className="bg-blue-50 rounded-lg p-3 mb-4">
          <div className="font-medium text-blue-900">
            {currentTeacher.fullName}（{currentTeacher.shortName}）
          </div>
          <div className="text-sm text-blue-600">
            {currentTeacher.leaveType === "full"
              ? "全日請假"
              : `${getTimeSlotLabel(currentTeacher.startSlot ?? "")} 至 ${getTimeSlotLabel(currentTeacher.endSlot ?? "")}`}
          </div>
          <div className="text-sm text-blue-500 mt-1">
            老師 {confirmIndex + 1} / {absentTeachers.length}
          </div>
        </div>

        {classesQuery.isLoading && (
          <div className="text-center py-8 text-gray-400">載入中...</div>
        )}

        {classesQuery.data && (
          <div className="bg-white rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left">時段</th>
                  <th className="px-3 py-2 text-left">時間</th>
                  <th className="px-3 py-2 text-left">班別</th>
                  <th className="px-3 py-2 text-left">科目</th>
                </tr>
              </thead>
              <tbody>
                {filteredClasses.map((cls, i) => (
                  <tr key={i} className="border-t">
                    <td className="px-3 py-2 font-medium">
                      {getTimeSlotLabel(cls.timeSlot)}
                    </td>
                    <td className="px-3 py-2 text-gray-500">
                      {getTimeSlotTime(cls.timeSlot)}
                    </td>
                    <td className="px-3 py-2">{cls.className ?? "-"}</td>
                    <td className="px-3 py-2">{cls.subject ?? "-"}</td>
                  </tr>
                ))}
                {filteredClasses.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-gray-400">
                      當日無課堂記錄
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex gap-3 mt-6">
          {confirmIndex > 0 && (
            <button
              onClick={() => setConfirmIndex(confirmIndex - 1)}
              className="flex-1 border border-gray-300 py-3 rounded-lg font-medium hover:bg-gray-50 cursor-pointer"
            >
              上一位
            </button>
          )}
          {confirmIndex < absentTeachers.length - 1 ? (
            <button
              onClick={() => setConfirmIndex(confirmIndex + 1)}
              className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 cursor-pointer"
            >
              下一位
            </button>
          ) : (
            <button
              onClick={onNext}
              className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 cursor-pointer"
            >
              開始編排代課
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ========== Step 3: Substitution ==========
function StepSubstitution({
  dateStr,
  absentTeachers,
  allowSwap,
  allChoices,
  setAllChoices,
  currentTeacherIdx,
  setCurrentTeacherIdx,
  currentSlotIdx,
  setCurrentSlotIdx,
  onBack,
  onNext,
}: {
  dateStr: string;
  absentTeachers: AbsentTeacher[];
  allowSwap: boolean;
  allChoices: Record<string, SubstitutionChoice[]>;
  setAllChoices: (v: Record<string, SubstitutionChoice[]>) => void;
  currentTeacherIdx: number;
  setCurrentTeacherIdx: (v: number) => void;
  currentSlotIdx: number;
  setCurrentSlotIdx: (v: number) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const teacher = absentTeachers[currentTeacherIdx];

  // Build already-assigned list from all choices so far
  const alreadyAssigned = useMemo(() => {
    const assigned: { teacherFullName: string; timeSlot: string }[] = [];
    for (const choices of Object.values(allChoices)) {
      for (const c of choices) {
        if (c.selectedTeacher && c.selectedTeacher !== "無需代課") {
          assigned.push({
            teacherFullName: c.selectedTeacher,
            timeSlot: c.timeSlot,
          });
        }
      }
    }
    return assigned;
  }, [allChoices]);

  const otherAbsentTeachers = useMemo(
    () => absentTeachers.filter((t) => t.fullName !== teacher.fullName).map((t) => t.fullName),
    [absentTeachers, teacher.fullName]
  );

  const suggestionsQuery = trpc.substitution.generateSuggestions.useQuery(
    {
      dateStr,
      absentTeacherFullName: teacher.fullName,
      startSlot: teacher.leaveType === "partial" ? teacher.startSlot : undefined,
      endSlot: teacher.leaveType === "partial" ? teacher.endSlot : undefined,
      allowSwap,
      otherAbsentTeachers,
      alreadyAssigned,
    },
    { enabled: !!teacher }
  );

  const suggestions = suggestionsQuery.data ?? [];
  const currentSuggestion = suggestions[currentSlotIdx];

  // Count how many times each teacher has been selected across all choices
  const substitutionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const choices of Object.values(allChoices)) {
      for (const c of choices) {
        if (c.selectedTeacher && c.selectedTeacher !== "無需代課") {
          counts[c.selectedTeacher] = (counts[c.selectedTeacher] ?? 0) + 1;
        }
      }
    }
    return counts;
  }, [allChoices]);

  // Detect same-slot conflicts: teacher assigned to same time slot for different absent teachers
  const sameSlotConflicts = useMemo(() => {
    // Map: timeSlot -> teacherName -> list of absent teachers
    const slotMap: Record<string, Record<string, string[]>> = {};
    for (const [absentName, choices] of Object.entries(allChoices)) {
      for (const c of choices) {
        if (c.selectedTeacher && c.selectedTeacher !== "無需代課") {
          if (!slotMap[c.timeSlot]) slotMap[c.timeSlot] = {};
          if (!slotMap[c.timeSlot][c.selectedTeacher]) slotMap[c.timeSlot][c.selectedTeacher] = [];
          slotMap[c.timeSlot][c.selectedTeacher].push(absentName);
        }
      }
    }
    // Return set of "teacherName|timeSlot" that have conflicts
    const conflicts = new Set<string>();
    for (const [slot, teachers] of Object.entries(slotMap)) {
      for (const [teacherName, absentList] of Object.entries(teachers)) {
        if (absentList.length > 1) {
          conflicts.add(`${teacherName}|${slot}`);
        }
      }
    }
    return conflicts;
  }, [allChoices]);

  const selectTeacher = useCallback(
    (teacherName: string, teacherShort: string, isSwap = false, swapNote?: string) => {
      const teacherKey = teacher.fullName;
      const existing = allChoices[teacherKey] ?? [];
      const choice: SubstitutionChoice = {
        timeSlot: currentSuggestion.timeSlot,
        className: currentSuggestion.className,
        subject: currentSuggestion.subject,
        selectedTeacher: teacherName,
        selectedTeacherShort: teacherShort,
        isSwap,
        swapNote,
      };

      const updated = [...existing.filter((c) => c.timeSlot !== currentSuggestion.timeSlot), choice];
      setAllChoices({ ...allChoices, [teacherKey]: updated });

      // Move to next slot or next teacher
      if (currentSlotIdx < suggestions.length - 1) {
        setCurrentSlotIdx(currentSlotIdx + 1);
      } else if (currentTeacherIdx < absentTeachers.length - 1) {
        setCurrentTeacherIdx(currentTeacherIdx + 1);
        setCurrentSlotIdx(0);
      }
    },
    [allChoices, currentSuggestion, currentSlotIdx, currentTeacherIdx, suggestions.length, absentTeachers.length, teacher.fullName, setAllChoices, setCurrentSlotIdx, setCurrentTeacherIdx]
  );

  const totalSlots = absentTeachers.reduce((sum, t, idx) => {
    if (idx < currentTeacherIdx) return sum;
    if (idx === currentTeacherIdx) return sum + suggestions.length;
    return sum; // We don't know future teacher's slot count yet
  }, 0);

  const completedSlots = currentSlotIdx;
  const isLastSlot = currentSlotIdx >= suggestions.length - 1 && currentTeacherIdx >= absentTeachers.length - 1;

  if (suggestionsQuery.isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400">載入建議中...</div>
      </div>
    );
  }

  if (!currentSuggestion) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b px-4 py-3 flex items-center gap-3">
          <button onClick={onBack} className="text-gray-500 hover:text-gray-700 cursor-pointer">← 返回</button>
          <h1 className="font-bold text-lg">編排代課</h1>
          <div className="ml-auto text-sm text-gray-400">步驟 3/4</div>
        </header>
        <div className="max-w-lg mx-auto p-4 text-center py-12">
          <p className="text-gray-500 mb-4">
            {teacher.fullName} 在當日沒有需要代課的課堂
          </p>
          {currentTeacherIdx < absentTeachers.length - 1 ? (
            <button
              onClick={() => { setCurrentTeacherIdx(currentTeacherIdx + 1); setCurrentSlotIdx(0); }}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg cursor-pointer"
            >
              下一位老師
            </button>
          ) : (
            <button onClick={onNext} className="bg-blue-600 text-white px-6 py-3 rounded-lg cursor-pointer">
              生成報告
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="text-gray-500 hover:text-gray-700 cursor-pointer">← 返回</button>
        <h1 className="font-bold text-lg">編排代課</h1>
        <div className="ml-auto text-sm text-gray-400">步驟 3/4</div>
      </header>

      <div className="max-w-lg mx-auto p-4 space-y-4">
        {/* Conflict warning banner */}
        {sameSlotConflicts.size > 0 && (
          <div className="bg-red-50 border border-red-300 rounded-lg p-3">
            <div className="flex items-center gap-2 text-red-800 font-medium text-sm">
              <span>⚠️</span>
              <span>有 {sameSlotConflicts.size} 個時段衝突</span>
            </div>
            <p className="text-xs text-red-600 mt-1">
              同一代課老師被分配到同一時段的不同班別，請返回修正
            </p>
          </div>
        )}

        {/* Progress */}
        <div className="bg-white rounded-lg p-3 border">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-500">
              {teacher.fullName}（{teacher.shortName}）
            </span>
            <span className="text-gray-400">
              {currentSlotIdx + 1} / {suggestions.length}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 rounded-full h-2 transition-all"
              style={{ width: `${((currentSlotIdx + 1) / suggestions.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Current lesson info */}
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="text-sm text-blue-500 mb-1">
            {getTimeSlotLabel(currentSuggestion.timeSlot)} ·{" "}
            {getTimeSlotTime(currentSuggestion.timeSlot)}
          </div>
          <div className="font-bold text-lg text-blue-900">
            {currentSuggestion.className || "—"}{" "}
            <span className="font-normal text-blue-700">
              {currentSuggestion.subject}
            </span>
          </div>
        </div>

        {/* Swap candidates */}
        {currentSuggestion.swapCandidates.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-purple-700 mb-2">
              調課建議
            </h3>
            {currentSuggestion.swapCandidates.map((sc, i) => (
              <button
                key={i}
                onClick={() =>
                  selectTeacher(
                    sc.swapTeacherFullName,
                    sc.swapTeacherShortName,
                    true,
                    `調課：${sc.swapTeacherFullName} ${sc.swapTeacherTimeSlot} ↔ ${sc.absentTeacherTimeSlot}`
                  )
                }
                className="w-full text-left p-3 bg-purple-50 border border-purple-200 rounded-lg mb-2 hover:bg-purple-100 cursor-pointer"
              >
                <div className="font-medium text-purple-800">
                  {sc.swapTeacherFullName}（{sc.swapTeacherShortName}）
                </div>
                <div className="text-sm text-purple-600">
                  {sc.swapTeacherClassName} {sc.swapTeacherSubject} ↔{" "}
                  {sc.absentTeacherClassName} {sc.absentTeacherSubject}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Priority teachers */}
        {currentSuggestion.priorityTeachers.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-green-700 mb-2">
              首選：科任老師
            </h3>
            {currentSuggestion.priorityTeachers.map((t) => {
              const count = substitutionCounts[t.fullName] ?? 0;
              const isConflict = t.alreadyAssignedThisSlot;
              return (
                <button
                  key={t.fullName}
                  onClick={() => selectTeacher(t.fullName, t.shortName)}
                  className={`w-full text-left p-3 border rounded-lg mb-2 cursor-pointer ${
                    isConflict
                      ? "bg-red-50 border-red-300 hover:bg-red-100"
                      : count > 0
                        ? "bg-orange-50 border-orange-200 hover:bg-orange-100"
                        : "bg-green-50 border-green-200 hover:bg-green-50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`font-medium ${isConflict ? "text-red-800" : "text-green-800"}`}>
                      {t.fullName}（{t.shortName}）
                    </span>
                    <div className="flex items-center gap-2">
                      {isConflict && (
                        <span className="text-xs bg-red-200 text-red-800 px-2 py-0.5 rounded-full">
                          同節已派
                        </span>
                      )}
                      {count > 0 && (
                        <span className="text-xs bg-orange-200 text-orange-800 px-2 py-0.5 rounded-full">
                          ×{count}
                        </span>
                      )}
                      <span className="text-xs text-gray-400">
                        當日 {t.dailyLessonCount} 堂
                      </span>
                    </div>
                  </div>
                  <div className="text-sm text-green-600">{t.subject}</div>
                  {isConflict && (
                    <div className="text-xs text-red-600 mt-1">
                      此老師已被分配到同一時段代課，選擇將產生衝突
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Other teachers */}
        <div>
          <h3 className="text-sm font-medium text-gray-600 mb-2">
            其他空堂老師
          </h3>

          {/* No substitution option */}
          <button
            onClick={() => selectTeacher("無需代課", "—")}
            className="w-full text-left p-3 border border-gray-200 rounded-lg mb-2 hover:bg-gray-50 cursor-pointer"
          >
            <span className="text-gray-500">無需代課</span>
          </button>

          {currentSuggestion.otherTeachers.map((t) => {
            const count = substitutionCounts[t.fullName] ?? 0;
            const isConflict = t.alreadyAssignedThisSlot;
            return (
              <button
                key={t.fullName}
                onClick={() => selectTeacher(t.fullName, t.shortName)}
                className={`w-full text-left p-3 border rounded-lg mb-2 cursor-pointer ${
                  isConflict
                    ? "bg-red-50 border-red-300 hover:bg-red-100"
                    : count > 0
                      ? "bg-orange-50 border-orange-200 hover:bg-orange-100"
                      : "hover:bg-gray-50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={isConflict ? "text-red-700" : "text-gray-700"}>
                    {t.fullName}（{t.shortName}）
                  </span>
                  <div className="flex items-center gap-2">
                    {isConflict && (
                      <span className="text-xs bg-red-200 text-red-800 px-2 py-0.5 rounded-full">
                        同節已派
                      </span>
                    )}
                    {count > 0 && (
                      <span className="text-xs bg-orange-200 text-orange-800 px-2 py-0.5 rounded-full">
                        ×{count}
                      </span>
                    )}
                    <span className="text-xs text-gray-400">
                      當日 {t.dailyLessonCount} 堂
                    </span>
                  </div>
                </div>
                {isConflict && (
                  <div className="text-xs text-red-600 mt-1">
                    此老師已被分配到同一時段代課，選擇將產生衝突
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Navigation */}
        <div className="flex gap-3">
          {(currentSlotIdx > 0 || currentTeacherIdx > 0) && (
            <button
              onClick={() => {
                if (currentSlotIdx > 0) {
                  setCurrentSlotIdx(currentSlotIdx - 1);
                } else if (currentTeacherIdx > 0) {
                  setCurrentTeacherIdx(currentTeacherIdx - 1);
                  // Can't know prev teacher's slot count here, go to 0
                  setCurrentSlotIdx(0);
                }
              }}
              className="flex-1 border border-gray-300 py-3 rounded-lg font-medium hover:bg-gray-50 cursor-pointer"
            >
              上一節
            </button>
          )}
          {isLastSlot && (
            <button
              onClick={onNext}
              className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 cursor-pointer"
            >
              確認並生成報告
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ========== Step 4: Report ==========
function StepReport({
  dateStr,
  dayOfWeek,
  absentTeachers,
  allChoices,
  setAllChoices,
  saveMutation,
  onBack,
  onNew,
}: {
  dateStr: string;
  dayOfWeek: number;
  absentTeachers: AbsentTeacher[];
  allChoices: Record<string, SubstitutionChoice[]>;
  setAllChoices: (v: Record<string, SubstitutionChoice[]>) => void;
  saveMutation: ReturnType<typeof trpc.substitution.saveRecord.useMutation>;
  onBack: () => void;
  onNew: () => void;
}) {
  const [saved, setSaved] = useState(false);

  // Flatten all choices
  const allItems = useMemo(() => {
    const items: (SubstitutionChoice & { absentTeacher: string })[] = [];
    for (const [teacherName, choices] of Object.entries(allChoices)) {
      for (const c of choices) {
        if (c.selectedTeacher !== "無需代課") {
          items.push({ ...c, absentTeacher: teacherName });
        }
      }
    }
    return items;
  }, [allChoices]);

  // Count substitutions per teacher
  const subCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of allItems) {
      counts[item.selectedTeacher] = (counts[item.selectedTeacher] ?? 0) + 1;
    }
    return counts;
  }, [allItems]);

  // Detect same-slot conflicts in final report
  const reportConflicts = useMemo(() => {
    const slotMap: Record<string, { teacher: string; absentTeacher: string; className: string }[]> = {};
    for (const item of allItems) {
      const key = `${item.timeSlot}|${item.selectedTeacher}`;
      if (!slotMap[key]) slotMap[key] = [];
      slotMap[key].push({
        teacher: item.selectedTeacher,
        absentTeacher: item.absentTeacher,
        className: item.className,
      });
    }
    return Object.entries(slotMap)
      .filter(([, items]) => items.length > 1)
      .map(([key, items]) => ({
        timeSlot: key.split("|")[0],
        teacher: key.split("|")[1],
        classes: items.map((i) => `${i.className}（代 ${i.absentTeacher}）`),
      }));
  }, [allItems]);

  const totalLessons = allItems.length;
  const swapCount = allItems.filter((i) => i.isSwap).length;

  const handleSave = () => {
    saveMutation.mutate(
      {
        dateStr,
        items: allItems.map((item, idx) => ({
          absentTeacher: item.absentTeacher,
          timeSlot: item.timeSlot,
          className: item.className,
          subject: item.subject,
          substitutionTeacher: item.selectedTeacher,
          isSwap: item.isSwap ? 1 : 0,
          swapNote: item.swapNote,
          sortOrder: idx,
        })),
      },
      { onSuccess: () => setSaved(true) }
    );
  };

  const handleDownloadCSV = () => {
    const headers = absentTeachers.length > 1
      ? ["請假老師", "時段", "時間", "班別", "科目", "代課老師"]
      : ["時段", "時間", "班別", "科目", "代課老師"];

    const rows = allItems.map((item) => {
      const base = [
        getTimeSlotLabel(item.timeSlot),
        getTimeSlotTime(item.timeSlot),
        item.className,
        item.subject,
        item.selectedTeacher + (item.isSwap ? " (調課)" : ""),
      ];
      if (absentTeachers.length > 1) {
        return [item.absentTeacher, ...base];
      }
      return base;
    });

    const bom = "\uFEFF";
    const csv = bom + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `代課表_${dateStr}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="text-gray-500 hover:text-gray-700 cursor-pointer">← 返回</button>
        <h1 className="font-bold text-lg">代課報告</h1>
        <div className="ml-auto text-sm text-gray-400">步驟 4/4</div>
      </header>

      <div className="max-w-2xl mx-auto p-4 space-y-4">
        {/* Summary */}
        <div className="bg-white rounded-lg border p-4">
          <h2 className="font-bold text-lg mb-2">
            {dateStr} {DAY_NAMES[dayOfWeek]} 代課安排
          </h2>
          <div className="flex gap-4 text-sm text-gray-600">
            <span>共 {totalLessons} 節</span>
            <span>普通代課 {totalLessons - swapCount} 節</span>
            {swapCount > 0 && (
              <span className="text-purple-600">調課 {swapCount} 節</span>
            )}
          </div>
        </div>

        {/* Conflict warnings */}
        {reportConflicts.length > 0 && (
          <div className="bg-red-50 border border-red-300 rounded-lg p-4">
            <div className="flex items-center gap-2 text-red-800 font-bold mb-2">
              <span>⚠️</span>
              <span>發現 {reportConflicts.length} 個時段衝突</span>
            </div>
            <p className="text-sm text-red-700 mb-3">
              以下代課老師被分配到同一時段的多個班別，實際無法同時上課：
            </p>
            <div className="space-y-2">
              {reportConflicts.map((c, i) => (
                <div key={i} className="bg-white border border-red-200 rounded p-2 text-sm">
                  <span className="font-medium text-red-800">{c.teacher}</span>
                  <span className="text-red-600">
                    {" "}在{getTimeSlotLabel(c.timeSlot)}被分配到：{c.classes.join("、")}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-xs text-red-500 mt-2">
              請返回上一步修改代課安排
            </p>
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {absentTeachers.length > 1 && (
                  <th className="px-3 py-2 text-left">請假老師</th>
                )}
                <th className="px-3 py-2 text-left">時段</th>
                <th className="px-3 py-2 text-left">班別</th>
                <th className="px-3 py-2 text-left">科目</th>
                <th className="px-3 py-2 text-left">代課老師</th>
              </tr>
            </thead>
            <tbody>
              {allItems.map((item, i) => {
                const count = subCounts[item.selectedTeacher] ?? 0;
                const hasSlotConflict = reportConflicts.some(
                  (c) => c.timeSlot === item.timeSlot && c.teacher === item.selectedTeacher
                );
                return (
                  <tr key={i} className={`border-t ${hasSlotConflict ? "bg-red-50" : ""}`}>
                    {absentTeachers.length > 1 && (
                      <td className="px-3 py-2">{item.absentTeacher}</td>
                    )}
                    <td className="px-3 py-2">
                      <div className="font-medium">
                        {getTimeSlotLabel(item.timeSlot)}
                      </div>
                      <div className="text-gray-400 text-xs">
                        {getTimeSlotTime(item.timeSlot)}
                      </div>
                    </td>
                    <td className="px-3 py-2">{item.className}</td>
                    <td className="px-3 py-2">
                      {item.subject}
                      {item.isSwap && (
                        <span className="ml-1 text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">
                          調課
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={
                          hasSlotConflict
                            ? "text-red-700 font-bold"
                            : count > 1
                              ? "text-orange-700 font-medium"
                              : ""
                        }
                      >
                        {item.selectedTeacher}
                      </span>
                      {hasSlotConflict && (
                        <span className="ml-1 text-xs bg-red-200 text-red-800 px-1.5 py-0.5 rounded-full">
                          衝突
                        </span>
                      )}
                      {!hasSlotConflict && count > 1 && (
                        <span className="ml-1 text-xs bg-orange-200 text-orange-800 px-1.5 py-0.5 rounded-full">
                          ×{count}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {allItems.length === 0 && (
                <tr>
                  <td
                    colSpan={absentTeachers.length > 1 ? 5 : 4}
                    className="px-3 py-6 text-center text-gray-400"
                  >
                    沒有代課安排
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleDownloadCSV}
            className="flex-1 min-w-[140px] border border-gray-300 py-3 rounded-lg font-medium hover:bg-gray-50 cursor-pointer"
          >
            下載 CSV
          </button>
          <button
            onClick={handleSave}
            disabled={saved || saveMutation.isPending}
            className={`flex-1 min-w-[140px] py-3 rounded-lg font-medium cursor-pointer ${
              saved
                ? "bg-green-100 text-green-700 border border-green-300"
                : "bg-blue-600 text-white hover:bg-blue-700"
            } disabled:cursor-not-allowed`}
          >
            {saved ? "已儲存 ✓" : saveMutation.isPending ? "儲存中..." : "確認並儲存"}
          </button>
          <button
            onClick={onNew}
            className="flex-1 min-w-[140px] border border-blue-300 text-blue-600 py-3 rounded-lg font-medium hover:bg-blue-50 cursor-pointer"
          >
            編排新的代課
          </button>
        </div>
      </div>
    </div>
  );
}
