import re
import json
import sqlite3

with open('/tmp/timetable_full.txt', 'r') as f:
    full_text = f.read()

# Split into pages by the school name header
pages_raw = re.split(r'中華基督教會基法小學\(油塘\)', full_text)
pages_raw = [p for p in pages_raw if '上課時間表' in p]

# Known class names pattern
CLASS_PATTERN = re.compile(r'^([1-6][A-F]|二中輔\+)$')
# Known subjects
SUBJECTS = [
    '中文', '英文', '數學', '常識', '普通話', '視覺藝術', '音樂', '體育',
    '資訊科技', '小學科學', '小學人文', '聖經', '圖書',
    '中默', '英默', '數學導修', '中文導修', '英文導修',
    '數學或圖書課', '專題研習', '周會', '多元智能', '價值教育',
    '專題研習（常識）', '（常識）', '（科學）',
    '班主任課', '升旗禮', '課前集隊',
]
ROOMS = [
    '電腦室', '語言室', '自然科學室', '圖書館', '音樂室', '視藝室',
    '操場', '球場', '籃球場', '禮堂',
]

# Time slot row markers (regex patterns to identify the start of each time slot)
SLOT_MARKERS = [
    (r'7:45\s*[-－]\s*8:10', 'DUTY_AM'),
    (r'8:10\s*[-－]\s*8:30', 'HR'),
    (r'[1１]\s+8:30\s*[-－]\s*9:05|8:30\s*[-－]\s*9:05', '1'),
    (r'[2２]\s+9:05\s*[-－]\s*9:40|9:05\s*[-－]\s*9:40', '2'),
    (r'9:40\s*[-－]\s*9:50', 'RECESS1'),
    (r'[3３]\s+9:50\s*[-－]\s*10:25|9:50\s*[-－]\s*10:25', '3'),
    (r'[4４]\s+10:25\s*[-－]\s*11:00|10:25\s*[-－]\s*11:00', '4'),
    (r'11:00\s*[-－]\s*11:20', 'RECESS2'),
    (r'[5５]\s+11:20\s*[-－]\s*11:55|11:20\s*[-－]\s*11:55', '5'),
    (r'[6６]\s+11:55\s*[-－]\s*12:30|11:55\s*[-－]\s*12:30', '6'),
    (r'[7７]\s+12:30\s*[-－]\s*13:05|12:30\s*[-－]\s*13:05', '7'),
    (r'13:05\s*[-－]\s*13:35', 'DUTY_LUNCH'),
    (r'13:35\s*[-－]\s*14:00', 'RECESS_LUNCH'),
    (r'[8８]\s+14:00\s*[-－]\s*14:30|14:00\s*[-－]\s*14:30', '8'),
    (r'[9９]\s+14:30\s*[-－]\s*15:00|14:30\s*[-－]\s*15:00', '9'),
    (r'15:00\s*[-－]\s*15:05', 'DUTY_DISMISS'),
    (r'15:05\s*[-－]\s*15:40|10', '10'),
]


def find_col_boundaries(lines):
    """Find column boundaries from header line containing 星期一...星期五"""
    for line in lines:
        if '星期一' in line and '星期五' in line:
            positions = []
            for day in ['星期一', '星期二', '星期三', '星期四', '星期五']:
                idx = line.find(day)
                if idx >= 0:
                    positions.append(idx)
            if len(positions) == 5:
                # Column boundaries: start of each column
                boundaries = []
                for i in range(5):
                    start = positions[i]
                    end = positions[i + 1] if i < 4 else 200
                    boundaries.append((start, end))
                return boundaries
    return None


def extract_teacher_name(page_text):
    """Extract teacher full name from page title"""
    lines = page_text.strip().split('\n')
    for line in lines:
        line = line.strip()
        if '上課時間表' in line:
            name = line.replace('上課時間表', '').strip()
            # Remove all title decorations
            name = re.sub(r'(班主任|主任|老師|副校長|副)', '', name)
            name = re.sub(r'[1-6][A-FＡ-Ｆ]\s*', '', name)
            name = re.sub(r'[\(（][正副][\)）]', '', name)
            name = name.replace(' ', '').replace('\u3000', '').strip()
            return name
    return None


def extract_cell_content(text_lines, col_start, col_end):
    """Extract class, subject, and room from a column segment"""
    parts = []
    for line in text_lines:
        if len(line) > col_start:
            segment = line[col_start:min(col_end, len(line))]
            segment = segment.strip()
            if segment:
                parts.append(segment)

    if not parts:
        return None

    # Try to identify class name, subject, room
    className = None
    subject = None
    room = None

    for part in parts:
        part_clean = part.strip()
        if not part_clean:
            continue
        # Check if it's a class name
        if re.match(r'^[1-6][A-F]$', part_clean):
            className = part_clean
        elif part_clean in ['二中輔+', '二中輔']:
            className = part_clean
        # Check if it's a known room
        elif any(r in part_clean for r in ['電腦室', '語言室', '自然科學室', '圖書館', '音樂室',
                                            '視藝室', '操場', '球場', '籃球場', '禮堂']):
            room = part_clean
        # Check if it contains floor/location markers (duty locations)
        elif re.match(r'^[0-9]+/F|^UG|^\d+\s*場|^[1-6]/F', part_clean):
            room = part_clean
        elif '場' in part_clean and ('/' in part_clean or 'F' in part_clean):
            room = part_clean
        # Subject or other content
        elif part_clean in ['班主任課', '升旗禮 及', '課前集隊', '升旗禮及課前集隊']:
            subject = '班主任課' if '班主任' in part_clean else part_clean
        elif part_clean == '升旗禮 及':
            continue  # Part of 升旗禮及課前集隊
        else:
            # Likely a subject
            if not subject:
                subject = part_clean
            elif not className and not room:
                # Could be continuation
                subject = subject + part_clean if subject else part_clean

    if not className and not subject:
        # Check if it's just a duty location
        if room:
            return {'className': None, 'subject': '當值', 'room': room}
        return None

    return {'className': className, 'subject': subject, 'room': room}


def parse_page(page_text):
    """Parse a single teacher's timetable page"""
    teacher_name = extract_teacher_name(page_text)
    if not teacher_name:
        return None, []

    lines = page_text.split('\n')
    boundaries = find_col_boundaries(lines)
    if not boundaries:
        print(f"  WARNING: Could not find column boundaries for {teacher_name}")
        return teacher_name, []

    # Find line indices for each time slot
    slot_lines = {}
    for i, line in enumerate(lines):
        for pattern, slot_name in SLOT_MARKERS:
            if re.search(pattern, line):
                if slot_name not in slot_lines:
                    slot_lines[slot_name] = i
                break

    # Build ordered list of slot positions
    slot_order = ['DUTY_AM', 'HR', '1', '2', 'RECESS1', '3', '4', 'RECESS2',
                  '5', '6', '7', 'DUTY_LUNCH', 'RECESS_LUNCH', '8', '9', 'DUTY_DISMISS', '10']

    entries = []

    for si, slot_name in enumerate(slot_order):
        if slot_name not in slot_lines:
            continue

        start_line = slot_lines[slot_name]
        # Find end: next slot's start line, or end of lines
        end_line = len(lines)
        for next_slot in slot_order[si + 1:]:
            if next_slot in slot_lines:
                end_line = slot_lines[next_slot]
                break

        section_lines = lines[start_line:end_line]

        for day_idx in range(5):
            col_start, col_end = boundaries[day_idx]
            cell = extract_cell_content(section_lines, col_start, col_end)
            if cell:
                entries.append({
                    'teacherFullName': teacher_name,
                    'dayOfWeek': day_idx + 1,
                    'timeSlot': slot_name,
                    'className': cell.get('className'),
                    'subject': cell.get('subject'),
                    'room': cell.get('room'),
                })

    return teacher_name, entries


# Parse all pages
all_entries = []
teacher_names_found = []

for i, page in enumerate(pages_raw):
    teacher_name, entries = parse_page(page)
    if teacher_name:
        teacher_names_found.append(teacher_name)
        all_entries.extend(entries)
        print(f"Page {i+1}: {teacher_name} - {len(entries)} entries")
    else:
        print(f"Page {i+1}: FAILED to extract teacher name")

print(f"\nTotal: {len(teacher_names_found)} teachers, {len(all_entries)} timetable entries")

# Save to JSON for review
with open('/Users/siu_lee/Teacher_Sub/data/timetable_raw.json', 'w') as f:
    json.dump(all_entries, f, ensure_ascii=False, indent=2)

# Save to SQLite
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
