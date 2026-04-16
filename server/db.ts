import Database, { type Database as DatabaseType } from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", "data");

// Timetable DB (writable for admin edits)
export const timetableDb: DatabaseType = new Database(
  path.join(dataDir, "timetable.db")
);

// App DB (substitution records, users)
const appDbPath = path.join(dataDir, "app.db");
export const appDb: DatabaseType = new Database(appDbPath);

// Initialize app DB tables
appDb.exec(`
  CREATE TABLE IF NOT EXISTS substitution_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dateStr TEXT NOT NULL,
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now')),
    note TEXT
  );

  CREATE TABLE IF NOT EXISTS substitution_record_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recordId INTEGER NOT NULL,
    absentTeacher TEXT NOT NULL,
    timeSlot TEXT NOT NULL,
    className TEXT NOT NULL,
    subject TEXT NOT NULL,
    substitutionTeacher TEXT NOT NULL,
    isSwap INTEGER DEFAULT 0,
    swapNote TEXT,
    sortOrder INTEGER DEFAULT 0,
    FOREIGN KEY (recordId) REFERENCES substitution_records(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_records_date ON substitution_records(dateStr);
`);

// Helper functions for timetable queries
export function getAllTeachers() {
  return timetableDb
    .prepare("SELECT * FROM teacher_names ORDER BY fullName")
    .all() as {
    id: number;
    fullName: string;
    shortName: string;
    initials: string;
    role: string;
    homeClass: string | null;
  }[];
}

export function getTeacherByName(fullName: string) {
  return timetableDb
    .prepare("SELECT * FROM teacher_names WHERE fullName = ?")
    .get(fullName) as
    | {
        id: number;
        fullName: string;
        shortName: string;
        initials: string;
        role: string;
        homeClass: string | null;
      }
    | undefined;
}

export function getTeacherClasses(fullName: string, dayOfWeek: number) {
  return timetableDb
    .prepare(
      `SELECT timeSlot, className, subject, room
       FROM teacher_timetable
       WHERE teacherFullName = ? AND dayOfWeek = ?
       ORDER BY CASE timeSlot
         WHEN 'DUTY_AM' THEN 1 WHEN 'HR' THEN 2
         WHEN '1' THEN 3 WHEN '2' THEN 4 WHEN 'RECESS1' THEN 5
         WHEN '3' THEN 6 WHEN '4' THEN 7 WHEN 'RECESS2' THEN 8
         WHEN '5' THEN 9 WHEN '6' THEN 10 WHEN '7' THEN 11
         WHEN 'DUTY_LUNCH' THEN 12 WHEN 'RECESS_LUNCH' THEN 13
         WHEN '8' THEN 14 WHEN '9' THEN 15 WHEN 'DUTY_DISMISS' THEN 16
         WHEN '10' THEN 17 ELSE 99
       END`
    )
    .all(fullName, dayOfWeek) as {
    timeSlot: string;
    className: string | null;
    subject: string | null;
    room: string | null;
  }[];
}

export function getAvailableTeachers(dayOfWeek: number, timeSlot: string) {
  return timetableDb
    .prepare(
      `SELECT tn.fullName, tn.shortName, tn.initials
       FROM teacher_names tn
       WHERE tn.fullName NOT IN (
         SELECT tt.teacherFullName
         FROM teacher_timetable tt
         WHERE tt.dayOfWeek = ? AND tt.timeSlot = ?
       )
       ORDER BY tn.fullName`
    )
    .all(dayOfWeek, timeSlot) as {
    fullName: string;
    shortName: string;
    initials: string;
  }[];
}

export function getTeacherDailyLessonCount(
  fullName: string,
  dayOfWeek: number
) {
  const result = timetableDb
    .prepare(
      `SELECT COUNT(*) as count
       FROM teacher_timetable
       WHERE teacherFullName = ? AND dayOfWeek = ?
         AND timeSlot IN ('1','2','3','4','5','6','7','8','9')`
    )
    .get(fullName, dayOfWeek) as { count: number };
  return result.count;
}

export function getSubjectTeachers(className: string) {
  return timetableDb
    .prepare(
      `SELECT DISTINCT subject, teacherFullName
       FROM teacher_timetable
       WHERE className = ?
       AND subject IS NOT NULL
       AND subject != '當值'
       AND subject != '班主任課'`
    )
    .all(className) as { subject: string; teacherFullName: string }[];
}
