import re
import json
import sqlite3
from html.parser import HTMLParser

class BBoxParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.pages = []
        self.current_page = None
        self.current_word = None

    def handle_starttag(self, tag, attrs):
        attrs_dict = dict(attrs)
        if tag == 'page':
            self.current_page = {'width': float(attrs_dict['width']), 'height': float(attrs_dict['height']), 'words': []}
        elif tag == 'word':
            self.current_word = {
                'xMin': float(attrs_dict['xmin']),
                'yMin': float(attrs_dict['ymin']),
                'xMax': float(attrs_dict['xmax']),
                'yMax': float(attrs_dict['ymax']),
                'text': ''
            }

    def handle_data(self, data):
        if self.current_word is not None:
            self.current_word['text'] = data

    def handle_endtag(self, tag):
        if tag == 'word' and self.current_word:
            self.current_page['words'].append(self.current_word)
            self.current_word = None
        elif tag == 'page' and self.current_page:
            self.pages.append(self.current_page)
            self.current_page = None

# Parse HTML
with open('/tmp/timetable_bbox.html', 'r') as f:
    html = f.read()

parser = BBoxParser()
parser.feed(html)
pages = parser.pages

TIME_LABELS = {
    '7:45': 'DUTY_AM',
    '8:10': 'HR',
    '8:30': '1',
    '9:05': '2',
    '9:40': 'RECESS1',
    '9:50': '3',
    '10:25': '4',
    '11:00': 'RECESS2',
    '11:20': '5',
    '11:55': '6',
    '12:30': '7',
    '13:05': 'DUTY_LUNCH',
    '13:35': 'RECESS_LUNCH',
    '14:00': '8',
    '14:30': '9',
    '15:00': 'DUTY_DISMISS',
    '15:05': '10',
}

SLOT_ORDER = ['DUTY_AM', 'HR', '1', '2', 'RECESS1', '3', '4', 'RECESS2',
              '5', '6', '7', 'DUTY_LUNCH', 'RECESS_LUNCH', '8', '9', 'DUTY_DISMISS', '10']

DUTY_SLOT_SET = {'DUTY_AM', 'RECESS1', 'RECESS2', 'DUTY_LUNCH', 'RECESS_LUNCH', 'DUTY_DISMISS'}

LESSON_ROOM_KEYWORDS = ['電腦室', '語言室', '自然科學室', '圖書館', '音樂室',
                        '視藝室', '操場', '球場', '籃球場', '禮堂', '學生活動中心']

# Words that are ONLY location indicators (in duty slots or lesson slots)
DUTY_LOCATION_WORDS = {'場', '大堂', '校務處', '正門', '側門', '車路', '走廊',
                       '燈口', '電梯', '圍欄', '梯間', '小食部'}


def is_room_word(text, duty_slot=False):
    """Check if a word is a room/location reference."""
    if any(r in text for r in LESSON_ROOM_KEYWORDS):
        return True
    if re.match(r'^[0-9]+/F', text) or re.match(r'^UG', text):
        return True
    if '/F' in text and any(c.isdigit() for c in text):
        return True
    if duty_slot:
        if text in DUTY_LOCATION_WORDS:
            return True
        # Duty group markers like "1", "2", "E-F", "(一)", "A-C" etc.
        if re.match(r'^\d+$', text):
            return True
        if re.match(r'^[（(][一二三四五六七八九十][）)]$', text):
            return True
        if re.match(r'^[A-Z]-[A-Z]$', text):
            return True
    return False


def process_page(page):
    words = page['words']
    if not words:
        return None, []

    # ── Step 1: Extract teacher name and homeroom status from title ────────────
    # The title may be split into multiple bbox words, e.g.:
    #   "6E"  "班主任"  "陳仲英老師上課時間表"   ← is_homeroom = True
    #   "區旭光主任上課時間表"                   ← is_homeroom = False
    teacher_name = None
    is_homeroom = False
    title_y = None
    for w in words:
        if '上課時間表' in w['text']:
            raw = w['text']
            title_y = w['yMin']
            is_homeroom = '班主任' in raw   # True if all in one word
            name = raw.replace('上課時間表', '')
            name = re.sub(r'(班主任|主任|老師|副校長|副)', '', name)
            name = re.sub(r'[1-6][A-FＡ-Ｆ]\s*', '', name)
            name = re.sub(r'[\(（][正副][\)）]', '', name)
            name = name.replace(' ', '').replace('\u3000', '').strip()
            teacher_name = name
            break

    # Second pass: look for a SEPARATE "班主任" word at the same title row
    if teacher_name and not is_homeroom and title_y is not None:
        for w in words:
            if abs(w['yMin'] - title_y) < 10 and '班主任' in w['text']:
                is_homeroom = True
                break

    if not teacher_name:
        return None, []

    # ── Step 2: Find column boundaries from 星期 headers ───────────────────────
    day_headers = {}
    for w in words:
        for day_name, day_num in [('星期一', 1), ('星期二', 2), ('星期三', 3), ('星期四', 4), ('星期五', 5)]:
            if w['text'] == day_name:
                day_headers[day_num] = (w['xMin'], w['xMax'])

    if len(day_headers) < 5:
        print(f"  WARNING: Could not find all day headers for {teacher_name}")
        return teacher_name, []

    # Column boundaries using midpoints between adjacent header centres
    time_x_max = 110
    col_centers = {d: (day_headers[d][0] + day_headers[d][1]) / 2 for d in range(1, 6)}
    col_bounds = {}
    for d in range(1, 6):
        left = time_x_max if d == 1 else (col_centers[d-1] + col_centers[d]) / 2
        right = page['width'] if d == 5 else (col_centers[d] + col_centers[d+1]) / 2
        col_bounds[d] = (left, right)

    # ── Step 3: Detect time slot Y positions ──────────────────────────────────
    # FIX: use \s+ (not \s*) so "13:05－13:35" is not wrongly parsed as "1"+"3:05"
    y_groups = {}
    for w in words:
        if w['xMin'] > time_x_max:
            continue
        y_key = round(w['yMin'] / 5) * 5
        if y_key not in y_groups:
            y_groups[y_key] = []
        y_groups[y_key].append(w)

    slot_y = {}
    for y_key in sorted(y_groups.keys()):
        group = sorted(y_groups[y_key], key=lambda w: w['xMin'])
        combined = ' '.join(w['text'].strip() for w in group)

        # Pattern 1: lesson-number prefix + time range (e.g. "1 8:30－ 9:05")
        # Use \s+ so we require at least one space — prevents mismatching "13:05－13:35"
        m = re.search(r'(\d+:?\d*)\s+(\d+:\d+)\s*[-－]\s*(\d+:\d+)', combined)
        if m:
            start_time = m.group(2)
        else:
            # Pattern 2: plain time range (e.g. "13:05－13:35")
            m = re.search(r'(\d+:\d+)\s*[-－]\s*(\d+:\d+)', combined)
            if m:
                start_time = m.group(1)
            else:
                continue

        if start_time in TIME_LABELS:
            slot_name = TIME_LABELS[start_time]
            if slot_name not in slot_y:
                slot_y[slot_name] = group[0]['yMin']

    # Build Y ranges using midpoints between consecutive detected slots
    slot_y_ranges = {}
    found_slots = [s for s in SLOT_ORDER if s in slot_y]
    for i, slot in enumerate(found_slots):
        y_start = 0 if i == 0 else (slot_y[found_slots[i-1]] + slot_y[slot]) / 2
        y_end = page['height'] if i + 1 >= len(found_slots) else (slot_y[slot] + slot_y[found_slots[i+1]]) / 2
        slot_y_ranges[slot] = (y_start, y_end)

    # The Y floor for content: skip anything above DUTY_AM (title/header words).
    # Subtract 3px buffer because some content words render slightly above the label Y.
    content_y_min = slot_y.get('DUTY_AM', 0) - 3

    # ── Step 4: Assign words to (slot, day) cells ─────────────────────────────
    cells = {}
    for w in words:
        # Skip time-label-area words
        if w['xMax'] <= time_x_max:
            continue
        # Skip header/title words (above first slot)
        if w['yMin'] < content_y_min:
            continue
        # Skip day-name headers
        if w['text'] in ['星期一', '星期二', '星期三', '星期四', '星期五']:
            continue
        # Skip full-title words
        if '上課時間表' in w['text'] or '中華基督教會' in w['text'] or '基法小學' in w['text']:
            continue

        # Find day column by X centre
        cx = (w['xMin'] + w['xMax']) / 2
        day = next((d for d in range(1, 6) if col_bounds[d][0] <= cx <= col_bounds[d][1]), None)
        if day is None:
            continue

        # Find slot by Y centre
        cy = (w['yMin'] + w['yMax']) / 2
        slot = next((s for s in found_slots if slot_y_ranges[s][0] <= cy <= slot_y_ranges[s][1]), None)
        if slot is None:
            continue

        key = (slot, day)
        if key not in cells:
            cells[key] = []
        cells[key].append(w)

    # ── Step 5: Parse each cell ───────────────────────────────────────────────
    entries = []
    for (slot, day), cell_words in cells.items():

        # Non-homeroom teachers have 空堂 for HR — skip entirely
        if slot == 'HR' and not is_homeroom:
            continue

        cell_words.sort(key=lambda w: (w['yMin'], w['xMin']))

        className = None
        subject_parts = []
        room_parts = []

        for w in cell_words:
            text = w['text'].strip()
            if not text:
                continue
            # Skip separators and time fragments
            if re.match(r'^\d+:\d+', text) or text in ['－', '-', '/']:
                continue

            # Class name: 1A-6F
            if re.match(r'^[1-6][A-F]$', text):
                if className is None:
                    className = text
                continue

            if slot == 'HR':
                # HR slot (班主任 teachers only)
                subject_parts.append(text)
            elif is_room_word(text, duty_slot=(slot in DUTY_SLOT_SET)):
                # Room/location word
                room_parts.append(text)
            elif re.match(r'^\d+$', text) and room_parts:
                # Bare digit following a room word → treat as group number in room
                room_parts.append(text)
            else:
                # Everything else is a subject (may be lesson subject or duty subject)
                subject_parts.append(text)

        # Build final field values
        room = ' '.join(room_parts) if room_parts else None
        subject = ''.join(subject_parts) if subject_parts else None

        # Duty slots: skip truly empty cells now; subject normalization happens
        # in Step 8 AFTER spillover (Step 7), so we keep the raw subject here.
        if slot in DUTY_SLOT_SET:
            if not className and not subject and not room:
                continue  # truly empty duty cell — skip

        # Skip entirely empty lesson/HR cells
        elif not className and not subject and not room:
            continue

        entries.append({
            'teacherFullName': teacher_name,
            'dayOfWeek': day,
            'timeSlot': slot,
            'className': className,
            'subject': subject,
            'room': room,
        })

    # ── Step 6: Post-process — room spillover into lesson slots ───────────────
    # Some lesson-slot room text (floor patterns) leaks into the next slot.
    # Detect room-only entries in non-duty slots and merge them back.
    slot_order_map = {s: i for i, s in enumerate(SLOT_ORDER)}

    for day in range(1, 6):
        day_entries = sorted(
            [(i, e) for i, e in enumerate(entries) if e is not None and e['dayOfWeek'] == day],
            key=lambda x: slot_order_map.get(x[1]['timeSlot'], 99)
        )
        for idx, (ei, entry) in enumerate(day_entries):
            if entry['timeSlot'] in DUTY_SLOT_SET:
                continue
            # If this entry has no className and no subject (only room), merge into previous
            if not entry['className'] and not entry['subject'] and entry['room']:
                if idx > 0:
                    prev_ei = day_entries[idx - 1][0]
                    if entries[prev_ei] and not entries[prev_ei]['room']:
                        entries[prev_ei]['room'] = entry['room']
                entries[ei] = None

    entries = [e for e in entries if e is not None]

    # ── Step 7: Subject spillover — lesson subject in duty slot ───────────────
    # If a duty slot has a lesson subject (not '當值') with no className,
    # move it to the previous lesson slot that has className but no subject.
    LESSON_SUBJECTS_HINT = ['中文', '英文', '數學', '常識', '普通話', '視覺藝術', '音樂', '體育',
                            '資訊科技', '小學科學', '小學人文', '聖經', '圖書', '中默', '英默',
                            '導修', '周會', '多元智能', '宗教', '品德', '生活', '普數', '數默']

    for day in range(1, 6):
        day_entries = sorted(
            [(i, e) for i, e in enumerate(entries) if e['dayOfWeek'] == day],
            key=lambda x: slot_order_map.get(x[1]['timeSlot'], 99)
        )
        for idx, (ei, entry) in enumerate(day_entries):
            if entry['timeSlot'] not in DUTY_SLOT_SET:
                continue
            if not entry['subject'] or entry['subject'] == '當值':
                continue
            # NOTE: do NOT skip entries that have a className — a duty slot can
            # simultaneously have a real className (e.g. DUTY_LUNCH 6E) AND a
            # spilled lesson subject (中文 from the preceding slot 7).
            if any(hint in entry['subject'] for hint in LESSON_SUBJECTS_HINT):
                if idx > 0:
                    prev_ei = day_entries[idx - 1][0]
                    prev = entries[prev_ei]
                    if prev and prev['className'] and not prev['subject']:
                        prev['subject'] = entry['subject']
                        entry['subject'] = None  # will be set to '當值' in Step 8

    # ── Step 8: Final duty-slot normalization ─────────────────────────────────
    # After spillover is resolved, any remaining non-'當值' subject in a duty slot
    # is either a location annotation or an un-resolvable spillover.
    # Move it to room and set subject = '當值'.
    for entry in entries:
        if entry['timeSlot'] not in DUTY_SLOT_SET:
            continue
        subject = entry['subject']
        if subject and subject != '當值':
            entry['room'] = (entry['room'] + ' ' + subject) if entry['room'] else subject
            entry['subject'] = '當值'
        elif not subject:
            entry['subject'] = '當值'

    return teacher_name, entries


# ── Process all pages ─────────────────────────────────────────────────────────
all_entries = []
teacher_names_found = []

for i, page in enumerate(pages):
    teacher_name, entries = process_page(page)
    if teacher_name:
        teacher_names_found.append(teacher_name)
        all_entries.extend(entries)
        print(f"Page {i+1}: {teacher_name} ({'班主任' if any(True for _ in [None]) else ''}) - {len(entries)} entries")
    else:
        print(f"Page {i+1}: FAILED")

print(f"\nTotal: {len(teacher_names_found)} teachers, {len(all_entries)} entries")

# Count by slot
from collections import Counter
slot_counts = Counter(e['timeSlot'] for e in all_entries)
for slot in SLOT_ORDER:
    print(f"  {slot}: {slot_counts.get(slot, 0)}")

# Save JSON
with open('/Users/siu_lee/Teacher_Sub/data/timetable_raw.json', 'w') as f:
    json.dump(all_entries, f, ensure_ascii=False, indent=2)

# Save to SQLite (teacher_timetable only — teacher_names unchanged)
conn = sqlite3.connect('/Users/siu_lee/Teacher_Sub/data/timetable.db')
c = conn.cursor()
c.execute('DROP TABLE IF EXISTS teacher_timetable')
c.execute('''CREATE TABLE teacher_timetable (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    teacherFullName TEXT NOT NULL,
    dayOfWeek INTEGER NOT NULL,
    timeSlot TEXT NOT NULL,
    className TEXT,
    subject TEXT,
    room TEXT
)''')
for e in all_entries:
    c.execute('INSERT INTO teacher_timetable (teacherFullName, dayOfWeek, timeSlot, className, subject, room) VALUES (?, ?, ?, ?, ?, ?)',
              (e['teacherFullName'], e['dayOfWeek'], e['timeSlot'], e['className'], e['subject'], e['room']))
conn.commit()
conn.close()
print(f"\nSaved {len(all_entries)} entries to timetable.db")
