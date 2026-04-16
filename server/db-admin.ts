import { z } from "zod";
import { router, publicProcedure } from "./trpc.js";
import { timetableDb } from "./db.js";

type TeacherRow = {
  id: number;
  fullName: string;
  shortName: string;
  initials: string;
  role: string;
  homeClass: string | null;
};

type TimetableRow = {
  id: number;
  teacherFullName: string;
  dayOfWeek: number;
  timeSlot: string;
  className: string | null;
  subject: string | null;
  room: string | null;
};

export const dbAdminRouter = router({
  // ── teacher_names ──────────────────────────────────────────────
  listTeachers: publicProcedure.query(() => {
    return timetableDb
      .prepare("SELECT * FROM teacher_names ORDER BY fullName")
      .all() as TeacherRow[];
  }),

  updateTeacher: publicProcedure
    .input(
      z.object({
        id: z.number(),
        fullName: z.string().min(1),
        shortName: z.string(),
        initials: z.string(),
        role: z.string(),
        homeClass: z.string().nullable(),
      })
    )
    .mutation(({ input }) => {
      timetableDb
        .prepare(
          `UPDATE teacher_names
           SET fullName = ?, shortName = ?, initials = ?, role = ?, homeClass = ?
           WHERE id = ?`
        )
        .run(
          input.fullName,
          input.shortName,
          input.initials,
          input.role,
          input.homeClass ?? null,
          input.id
        );
      return { ok: true };
    }),

  addTeacher: publicProcedure
    .input(
      z.object({
        fullName: z.string().min(1),
        shortName: z.string(),
        initials: z.string(),
        role: z.string(),
        homeClass: z.string().nullable(),
      })
    )
    .mutation(({ input }) => {
      const result = timetableDb
        .prepare(
          `INSERT INTO teacher_names (fullName, shortName, initials, role, homeClass)
           VALUES (?, ?, ?, ?, ?)`
        )
        .run(
          input.fullName,
          input.shortName,
          input.initials,
          input.role,
          input.homeClass ?? null
        );
      return { id: Number(result.lastInsertRowid) };
    }),

  deleteTeacher: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input }) => {
      timetableDb
        .prepare("DELETE FROM teacher_names WHERE id = ?")
        .run(input.id);
      return { ok: true };
    }),

  // ── teacher_timetable ──────────────────────────────────────────
  getTeacherTimetable: publicProcedure
    .input(z.object({ teacherFullName: z.string() }))
    .query(({ input }) => {
      return timetableDb
        .prepare(
          `SELECT * FROM teacher_timetable
           WHERE teacherFullName = ?
           ORDER BY dayOfWeek,
             CASE timeSlot
               WHEN 'DUTY_AM' THEN 1 WHEN 'HR' THEN 2
               WHEN '1' THEN 3 WHEN '2' THEN 4 WHEN 'RECESS1' THEN 5
               WHEN '3' THEN 6 WHEN '4' THEN 7 WHEN 'RECESS2' THEN 8
               WHEN '5' THEN 9 WHEN '6' THEN 10 WHEN '7' THEN 11
               WHEN 'DUTY_LUNCH' THEN 12 WHEN 'RECESS_LUNCH' THEN 13
               WHEN '8' THEN 14 WHEN '9' THEN 15 WHEN 'DUTY_DISMISS' THEN 16
               WHEN '10' THEN 17 ELSE 99
             END`
        )
        .all(input.teacherFullName) as TimetableRow[];
    }),

  updateTimetableEntry: publicProcedure
    .input(
      z.object({
        id: z.number(),
        className: z.string().nullable(),
        subject: z.string().nullable(),
        room: z.string().nullable(),
      })
    )
    .mutation(({ input }) => {
      timetableDb
        .prepare(
          `UPDATE teacher_timetable
           SET className = ?, subject = ?, room = ?
           WHERE id = ?`
        )
        .run(
          input.className ?? null,
          input.subject ?? null,
          input.room ?? null,
          input.id
        );
      return { ok: true };
    }),

  addTimetableEntry: publicProcedure
    .input(
      z.object({
        teacherFullName: z.string().min(1),
        dayOfWeek: z.number().min(1).max(5),
        timeSlot: z.string().min(1),
        className: z.string().nullable(),
        subject: z.string().nullable(),
        room: z.string().nullable(),
      })
    )
    .mutation(({ input }) => {
      const result = timetableDb
        .prepare(
          `INSERT INTO teacher_timetable (teacherFullName, dayOfWeek, timeSlot, className, subject, room)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .run(
          input.teacherFullName,
          input.dayOfWeek,
          input.timeSlot,
          input.className ?? null,
          input.subject ?? null,
          input.room ?? null
        );
      return { id: Number(result.lastInsertRowid) };
    }),

  deleteTimetableEntry: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input }) => {
      timetableDb
        .prepare("DELETE FROM teacher_timetable WHERE id = ?")
        .run(input.id);
      return { ok: true };
    }),
});
