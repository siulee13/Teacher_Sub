export const TIME_SLOTS = [
  { code: "DUTY_AM", time: "7:45-8:10", label: "早上當值", type: "duty" },
  { code: "HR", time: "8:10-8:30", label: "班主任課", type: "homeroom" },
  { code: "1", time: "8:30-9:05", label: "第一節", type: "lesson" },
  { code: "2", time: "9:05-9:40", label: "第二節", type: "lesson" },
  { code: "RECESS1", time: "9:40-9:50", label: "小息一當值", type: "duty" },
  { code: "3", time: "9:50-10:25", label: "第三節", type: "lesson" },
  { code: "4", time: "10:25-11:00", label: "第四節", type: "lesson" },
  { code: "RECESS2", time: "11:00-11:20", label: "小息二當值", type: "duty" },
  { code: "5", time: "11:20-11:55", label: "第五節", type: "lesson" },
  { code: "6", time: "11:55-12:30", label: "第六節", type: "lesson" },
  { code: "7", time: "12:30-13:05", label: "第七節", type: "lesson" },
  { code: "DUTY_LUNCH", time: "13:05-13:35", label: "午膳當值", type: "duty" },
  { code: "RECESS_LUNCH", time: "13:35-14:00", label: "午息當值", type: "duty" },
  { code: "8", time: "14:00-14:30", label: "第八節", type: "lesson" },
  { code: "9", time: "14:30-15:00", label: "第九節", type: "lesson" },
  { code: "DUTY_DISMISS", time: "15:00-15:05", label: "放學當值", type: "duty" },
  { code: "10", time: "15:05-15:40", label: "第十節", type: "lesson" },
] as const;

export type TimeSlotCode = (typeof TIME_SLOTS)[number]["code"];

export const DAY_NAMES = ["", "星期一", "星期二", "星期三", "星期四", "星期五"] as const;

export function getDayOfWeek(dateStr: string): number {
  const d = new Date(dateStr);
  const day = d.getDay(); // 0=Sun, 1=Mon ... 6=Sat
  return day; // 1-5 for Mon-Fri
}

export function getTimeSlotLabel(code: string): string {
  return TIME_SLOTS.find((s) => s.code === code)?.label ?? code;
}

export function getTimeSlotTime(code: string): string {
  return TIME_SLOTS.find((s) => s.code === code)?.time ?? "";
}
