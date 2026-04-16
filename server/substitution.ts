import { z } from "zod";
import { router, publicProcedure } from "./trpc.js";
import {
  getAllTeachers,
  getTeacherByName,
  getTeacherClasses,
  getAvailableTeachers,
  getTeacherDailyLessonCount,
  getSubjectTeachers,
  appDb,
} from "./db.js";
import { getDayOfWeek } from "../shared/constants.js";

export const substitutionRouter = router({
  getAllTeachers: publicProcedure.query(() => {
    return getAllTeachers();
  }),

  getTeacherClasses: publicProcedure
    .input(z.object({ teacherFullName: z.string(), dateStr: z.string() }))
    .query(({ input }) => {
      const dayOfWeek = getDayOfWeek(input.dateStr);
      if (dayOfWeek < 1 || dayOfWeek > 5) return [];
      return getTeacherClasses(input.teacherFullName, dayOfWeek);
    }),

  getSubjectTeachers: publicProcedure
    .input(z.object({ className: z.string() }))
    .query(({ input }) => {
      return getSubjectTeachers(input.className);
    }),

  generateSuggestions: publicProcedure
    .input(
      z.object({
        dateStr: z.string(),
        absentTeacherFullName: z.string(),
        startSlot: z.string().optional(),
        endSlot: z.string().optional(),
        allowSwap: z.boolean().default(false),
        otherAbsentTeachers: z.array(z.string()).default([]),
        alreadyAssigned: z.array(z.object({
          teacherFullName: z.string(),
          timeSlot: z.string(),
        })).default([]),
      })
    )
    .query(({ input }) => {
      const dayOfWeek = getDayOfWeek(input.dateStr);
      if (dayOfWeek < 1 || dayOfWeek > 5) return [];

      // Build set of all absent teachers (current + others)
      const allAbsentSet = new Set([
        input.absentTeacherFullName,
        ...input.otherAbsentTeachers,
      ]);

      // Build map of already-assigned teachers per time slot
      const assignedBySlot = new Map<string, Set<string>>();
      for (const a of input.alreadyAssigned) {
        if (!assignedBySlot.has(a.timeSlot)) {
          assignedBySlot.set(a.timeSlot, new Set());
        }
        assignedBySlot.get(a.timeSlot)!.add(a.teacherFullName);
      }

      // Get absent teacher's classes for the day
      let classes = getTeacherClasses(
        input.absentTeacherFullName,
        dayOfWeek
      );

      // Filter by slot range if specified
      if (input.startSlot || input.endSlot) {
        const slotOrder = [
          "DUTY_AM", "HR", "1", "2", "RECESS1", "3", "4", "RECESS2",
          "5", "6", "7", "DUTY_LUNCH", "RECESS_LUNCH", "8", "9",
          "DUTY_DISMISS", "10",
        ];
        const startIdx = input.startSlot
          ? slotOrder.indexOf(input.startSlot)
          : 0;
        const endIdx = input.endSlot
          ? slotOrder.indexOf(input.endSlot)
          : slotOrder.length - 1;
        classes = classes.filter((c) => {
          const idx = slotOrder.indexOf(c.timeSlot);
          return idx >= startIdx && idx <= endIdx;
        });
      }

      // For each class, generate suggestions
      return classes.map((cls) => {
        const className = cls.className ?? "";
        const subject = cls.subject ?? "";
        const slotAssigned = assignedBySlot.get(cls.timeSlot) ?? new Set<string>();

        // Priority teachers: teachers who teach this subject to this class and are free
        const subjectTeachers = className
          ? getSubjectTeachers(className)
          : [];
        const freeTeachers = getAvailableTeachers(dayOfWeek, cls.timeSlot);
        const freeSet = new Set(freeTeachers.map((t) => t.fullName));

        // Deduplicate priority teachers — one entry per teacher, prefer matching subject
        const priorityMap = new Map<string, { fullName: string; shortName: string; subject: string; dailyLessonCount: number; alreadyAssignedThisSlot: boolean }>();
        for (const st of subjectTeachers) {
          if (!freeSet.has(st.teacherFullName)) continue;
          if (allAbsentSet.has(st.teacherFullName)) continue;
          if (priorityMap.has(st.teacherFullName)) {
            // Already have this teacher — prefer the matching subject
            if (subject && st.subject === subject) {
              priorityMap.get(st.teacherFullName)!.subject = st.subject;
            }
            continue;
          }
          const teacher = getTeacherByName(st.teacherFullName);
          priorityMap.set(st.teacherFullName, {
            fullName: st.teacherFullName,
            shortName: teacher?.shortName ?? "",
            subject: st.subject,
            dailyLessonCount: getTeacherDailyLessonCount(st.teacherFullName, dayOfWeek),
            alreadyAssignedThisSlot: slotAssigned.has(st.teacherFullName),
          });
        }
        const priorityTeachers = Array.from(priorityMap.values());

        // Other free teachers sorted by daily lesson count (ascending)
        const priorityNames = new Set(
          priorityTeachers.map((t) => t.fullName)
        );
        const otherTeachers = freeTeachers
          .filter(
            (t) =>
              !priorityNames.has(t.fullName) &&
              !allAbsentSet.has(t.fullName)
          )
          .map((t) => ({
            fullName: t.fullName,
            shortName: t.shortName,
            dailyLessonCount: getTeacherDailyLessonCount(
              t.fullName,
              dayOfWeek
            ),
            alreadyAssignedThisSlot: slotAssigned.has(t.fullName),
          }))
          .sort((a, b) => {
            // Teachers already assigned this slot go to the bottom
            if (a.alreadyAssignedThisSlot !== b.alreadyAssignedThisSlot) {
              return a.alreadyAssignedThisSlot ? 1 : -1;
            }
            return a.dailyLessonCount - b.dailyLessonCount;
          });

        // Swap candidates (if allowed)
        const swapCandidates: {
          swapTeacherFullName: string;
          swapTeacherShortName: string;
          swapTeacherTimeSlot: string;
          swapTeacherClassName: string;
          swapTeacherSubject: string;
          absentTeacherTimeSlot: string;
          absentTeacherClassName: string;
          absentTeacherSubject: string;
        }[] = [];

        // Swap candidates: only for partial leave (startSlot & endSlot must be set)
        const isPartialLeave = !!(input.startSlot && input.endSlot);
        if (input.allowSwap && isPartialLeave && className) {
          // Determine which slots the absent teacher is present (outside leave range)
          const slotOrder = [
            "DUTY_AM", "HR", "1", "2", "RECESS1", "3", "4", "RECESS2",
            "5", "6", "7", "DUTY_LUNCH", "RECESS_LUNCH", "8", "9",
            "DUTY_DISMISS", "10",
          ];
          const leaveStartIdx = slotOrder.indexOf(input.startSlot!);
          const leaveEndIdx = slotOrder.indexOf(input.endSlot!);
          const presentSlots = new Set(
            slotOrder.filter((_, idx) => idx < leaveStartIdx || idx > leaveEndIdx)
          );

          const allAbsentClasses = getTeacherClasses(
            input.absentTeacherFullName,
            dayOfWeek
          );

          const teachersOfThisClass = subjectTeachers.filter(
            (st) => st.teacherFullName !== input.absentTeacherFullName
          );

          for (const st of teachersOfThisClass) {
            const otherTeacherClasses = getTeacherClasses(
              st.teacherFullName,
              dayOfWeek
            );
            for (const otherCls of otherTeacherClasses) {
              if (!otherCls.className) continue;
              // The absent teacher must teach this class in a slot where they ARE present
              const absentTeachesOther = allAbsentClasses.find(
                (ac) =>
                  ac.className === otherCls.className &&
                  ac.timeSlot !== cls.timeSlot &&
                  presentSlots.has(ac.timeSlot)
              );
              if (absentTeachesOther) {
                const teacher = getTeacherByName(st.teacherFullName);
                swapCandidates.push({
                  swapTeacherFullName: st.teacherFullName,
                  swapTeacherShortName: teacher?.shortName ?? "",
                  swapTeacherTimeSlot: otherCls.timeSlot,
                  swapTeacherClassName: otherCls.className,
                  swapTeacherSubject: otherCls.subject ?? "",
                  absentTeacherTimeSlot: cls.timeSlot,
                  absentTeacherClassName: className,
                  absentTeacherSubject: subject,
                });
              }
            }
          }
        }

        return {
          timeSlot: cls.timeSlot,
          className,
          subject,
          room: cls.room,
          priorityTeachers,
          otherTeachers,
          swapCandidates,
        };
      });
    }),

  saveRecord: publicProcedure
    .input(
      z.object({
        dateStr: z.string(),
        note: z.string().optional(),
        items: z.array(
          z.object({
            absentTeacher: z.string(),
            timeSlot: z.string(),
            className: z.string(),
            subject: z.string(),
            substitutionTeacher: z.string(),
            isSwap: z.number().default(0),
            swapNote: z.string().optional(),
            sortOrder: z.number().default(0),
          })
        ),
      })
    )
    .mutation(({ input }) => {
      const existing = appDb
        .prepare("SELECT id FROM substitution_records WHERE dateStr = ?")
        .get(input.dateStr) as { id: number } | undefined;

      const saveTransaction = appDb.transaction(() => {
        let recordId: number;

        if (existing) {
          appDb
            .prepare(
              "UPDATE substitution_records SET updatedAt = datetime('now'), note = ? WHERE id = ?"
            )
            .run(input.note ?? null, existing.id);
          appDb
            .prepare(
              "DELETE FROM substitution_record_items WHERE recordId = ?"
            )
            .run(existing.id);
          recordId = existing.id;
        } else {
          const result = appDb
            .prepare(
              "INSERT INTO substitution_records (dateStr, note) VALUES (?, ?)"
            )
            .run(input.dateStr, input.note ?? null);
          recordId = Number(result.lastInsertRowid);
        }

        const insertItem = appDb.prepare(
          `INSERT INTO substitution_record_items
           (recordId, absentTeacher, timeSlot, className, subject, substitutionTeacher, isSwap, swapNote, sortOrder)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        );

        for (const item of input.items) {
          insertItem.run(
            recordId,
            item.absentTeacher,
            item.timeSlot,
            item.className,
            item.subject,
            item.substitutionTeacher,
            item.isSwap,
            item.swapNote ?? null,
            item.sortOrder
          );
        }

        return recordId;
      });

      return { id: saveTransaction() };
    }),

  getRecordByDate: publicProcedure
    .input(z.object({ dateStr: z.string() }))
    .query(({ input }) => {
      const record = appDb
        .prepare("SELECT * FROM substitution_records WHERE dateStr = ?")
        .get(input.dateStr) as
        | {
            id: number;
            dateStr: string;
            createdAt: string;
            updatedAt: string;
            note: string | null;
          }
        | undefined;

      if (!record) return null;

      const items = appDb
        .prepare(
          "SELECT * FROM substitution_record_items WHERE recordId = ? ORDER BY sortOrder"
        )
        .all(record.id) as {
        id: number;
        absentTeacher: string;
        timeSlot: string;
        className: string;
        subject: string;
        substitutionTeacher: string;
        isSwap: number;
        swapNote: string | null;
        sortOrder: number;
      }[];

      return { ...record, items };
    }),

  listRecords: publicProcedure
    .input(z.object({ limit: z.number().default(20) }))
    .query(({ input }) => {
      return appDb
        .prepare(
          "SELECT * FROM substitution_records ORDER BY dateStr DESC LIMIT ?"
        )
        .all(input.limit) as {
        id: number;
        dateStr: string;
        createdAt: string;
        updatedAt: string;
        note: string | null;
      }[];
    }),
});
