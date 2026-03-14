"""
generator.py — Deterministic chaos generator for Workforce Readiness Simulator.
Single-room model: each course gets one random time slot shared by all enrolled employees.
"""
import random
from models import GeneratorProfile

FIRST_NAMES = [
    "Oliver","Jack","William","Noah","James","Lucas","Benjamin","Mason","Ethan","Liam",
    "Sophia","Emma","Charlotte","Amelia","Olivia","Ava","Isabella","Mia","Harper","Evelyn",
    "Luca","Felix","Leo","Finn","Theo","Isla","Clara","Nora","Freya","Zoe",
    "Aiden","Sebastian","Henry","Carter","Owen","Chloe","Layla","Lily","Penelope","Grace",
    "Wyatt","Julian","Caleb","Isaac","Elijah","Aurora","Stella","Violet","Hazel","Ruby",
    "Samuel","Nathan","Dominic","Adam","Adrian","Sofia","Elena","Hannah","Natalie","Leah",
    "Connor","Patrick","Brendan","Kieran","Declan","Siobhan","Aoife","Niamh","Ciara","Fiona",
    "Ravi","Arjun","Vikram","Priya","Ananya","Neha","Rohan","Kiran","Sanjay","Deepa",
    "Chen","Wei","Mei","Jing","Hao","Xiu","Liang","Fang","Ting","Jun",
    "Kai","River","Sage","Quinn","Blair","Avery","Cameron","Morgan","Reese","Skylar",
]
LAST_NAMES = [
    "Smith","Johnson","Williams","Brown","Jones","Miller","Davis","Wilson","Taylor","Anderson",
    "Thomas","Jackson","White","Harris","Martin","Thompson","Garcia","Martinez","Robinson","Clark",
    "Rodriguez","Lewis","Lee","Walker","Hall","Allen","Young","Hernandez","King","Wright",
    "Lopez","Hill","Scott","Green","Adams","Baker","Gonzalez","Nelson","Carter","Mitchell",
    "Perez","Roberts","Turner","Phillips","Campbell","Parker","Evans","Edwards","Collins","Stewart",
    "Morris","Sanchez","Rogers","Reed","Cook","Morgan","Bell","Murphy","Bailey","Rivera",
    "Cooper","Richardson","Cox","Howard","Ward","Torres","Peterson","Gray","Ramirez","James",
    "Watson","Brooks","Kelly","Sanders","Price","Bennett","Wood","Barnes","Ross","Henderson",
    "Coleman","Jenkins","Perry","Powell","Long","Patterson","Hughes","Flores","Washington","Butler",
    "Simmons","Foster","Gonzales","Bryant","Alexander","Russell","Griffin","Diaz","Hayes","Myers",
]

SAP_ROLES = [
    "SAP FICO Consultant","SAP S/4HANA Migration Lead","SAP Basis Administrator",
    "SAP MM Consultant","SAP SD Consultant","SAP PP Consultant","SAP HR/HCM Specialist",
    "SAP BW/BI Analyst","SAP Solution Architect","SAP ABAP Developer",
    "SAP GRC Compliance Lead","SAP Integration Specialist","SAP CRM Consultant",
    "SAP PM Consultant","SAP QM Specialist","SAP WM/EWM Consultant",
    "SAP Ariba Procurement Lead","SAP SuccessFactors HR Lead","SAP Analytics Cloud Specialist",
    "SAP Fiori/UX Designer","SAP Security Consultant","SAP Change Manager",
    "SAP Test Manager","SAP Training Coordinator","SAP Data Migration Specialist",
    "SAP MDG Master Data Lead","SAP TM Transportation Lead","SAP IBP Planning Specialist",
    "SAP RE-FX Real Estate Lead","SAP PS Project Systems Lead","SAP CS Customer Service Lead",
    "SAP Business Process Owner","SAP Centre of Excellence Lead","SAP Platform Owner",
    "SAP Programme Director","SAP Cutover Manager","SAP Hypercare Lead",
    "SAP Functional Analyst","SAP Technical Architect","SAP Enterprise Architect",
    "SAP Vendor Liaison","SAP Contract Manager","SAP Risk & Controls Analyst",
    "SAP Governance Lead","SAP Cloud Operations Lead","SAP DevOps Engineer",
    "SAP Landscape Architect","SAP Release Manager","SAP Knowledge Manager",
    "SAP Digital Transformation Lead",
]

SAP_COURSES = [
    ("S4H00","SAP S/4HANA Overview",1.0),
    ("S4F10","SAP S/4HANA Financials",1.5),
    ("S4F20","General Ledger Accounting",1.0),
    ("S4F30","Management Accounting Overview",1.5),
    ("S4F40","Product Cost Planning",2.0),
    ("S4F50","Profitability Analysis",1.0),
    ("S4520","Asset Accounting in S/4HANA",1.5),
    ("S4610","Order to Cash in S/4HANA",2.0),
    ("S4615","Billing & Revenue Management",1.0),
    ("S4500","Procurement in S/4HANA",1.5),
    ("S4510","Invoice Verification & Logistics",1.0),
    ("S4720","Manufacturing Execution",2.0),
    ("S4730","Production Planning",1.5),
    ("S4800","Plant Maintenance",1.0),
    ("S4810","Quality Management",1.5),
    ("S4H20","Embedded Analytics",1.0),
    ("S4TM10","Transportation Management",2.0),
    ("S4IBP","Integrated Business Planning",1.5),
    ("BASIS310","SAP Basis Administration",2.0),
    ("BASIS410","System Landscape Directory",1.0),
    ("ABAP01","ABAP Programming Fundamentals",2.0),
    ("ABAP02","Object-Oriented ABAP",1.5),
    ("FIORI01","SAP Fiori UX Design",1.0),
    ("FIORI02","SAP Fiori Launchpad Admin",1.0),
    ("GRC100","SAP GRC Access Control",1.5),
    ("GRC200","Risk & Compliance Framework",1.0),
    ("SFSF01","SuccessFactors Core HR",1.5),
    ("SFSF02","SuccessFactors Recruiting",1.0),
    ("SFSF03","SuccessFactors Performance",1.0),
    ("SACVIS","SAP Analytics Cloud Visualisation",1.0),
    ("SACPLN","SAP Analytics Cloud Planning",1.5),
    ("CUTOVER","Cutover Planning & Execution",2.0),
    ("HYPECARE","Hypercare & Stabilisation",1.0),
    ("DATAMIG","Data Migration Methodology",2.0),
    ("MDG100","Master Data Governance",1.5),
    ("ARIBA01","SAP Ariba Procurement",1.5),
    ("ARIBA02","SAP Ariba Contracts",1.0),
    ("REALESTATE","SAP RE-FX Basics",1.5),
    ("PROJSYS","SAP Project Systems",1.0),
    ("TSAP75","SAP Testing Strategy",1.5),
    ("CHANGE01","Change Management Fundamentals",1.0),
    ("CHANGE02","Stakeholder Engagement",0.75),
    ("TRAINING01","Training Needs Analysis",0.5),
    ("TRAINING02","SAP Train-the-Trainer",1.0),
    ("SECURITY01","SAP Role Design & Security",1.5),
    ("SECURITY02","Identity & Access Management",1.0),
    ("INTEGRATE","SAP Integration Suite",2.0),
    ("ACTIVATE","SAP Activate Methodology",1.0),
    ("DEVOPS01","SAP DevOps & CI/CD",1.5),
    ("CLOUDOPS","SAP BTP Cloud Operations",1.0),
    ("EWM100","Extended Warehouse Management",2.0),
    ("DSPRW","Data Sphere & BW Integration",1.5),
    ("REVENUEACCT","Revenue Accounting & Reporting",1.0),
    ("TAXMGMT","Tax Management in S/4HANA",1.0),
    ("TREASURY","Treasury & Cash Management",1.5),
    ("CONCUR","SAP Concur Expense",0.75),
    ("FIELDSERV","SAP Field Service Management",1.0),
    ("CXSALES","SAP CX Sales Cloud",1.5),
    ("GOVCLOUD","SAP Sovereign Cloud Compliance",1.0),
]

SHIFT_PATTERNS = [
    {"name": "Standard",     "hours": "08:00–17:00", "days": "Mon–Fri"},
    {"name": "Early Start",  "hours": "06:00–15:00", "days": "Mon–Fri"},
    {"name": "Late Finish",  "hours": "10:00–19:00", "days": "Mon–Fri"},
    {"name": "Compressed",   "hours": "07:00–17:30", "days": "Mon–Thu"},
    {"name": "Flexible",     "hours": "Flexible",    "days": "Mon–Fri"},
]

# Map from frontend shift_pattern_ids → display name used in node.shift_name
SHIFT_ID_TO_NAME = {
    "core4on4off": "Core Production",
    "panama223":   "Panama 2-2-3",
    "standard52":  "Standard 5:2 + On-call",
}

SLOT_MINUTES   = 15
SLOTS_PER_HOUR = 60 // SLOT_MINUTES


def build_time_model(start_hour:int, end_hour:int, window_days:int, start_date:str) -> dict:
    hours         = end_hour - start_hour
    slots_per_day = hours * SLOTS_PER_HOUR
    return {
        "day_start_hour":       start_hour,
        "day_end_hour":         end_hour,
        "slot_minutes":         SLOT_MINUTES,
        "slots_per_day":        slots_per_day,
        "training_window_days": window_days,
        "start_date":           start_date,
    }


def build_snapshot_from_profile(profile: GeneratorProfile) -> dict:
    seed = profile.deterministic_seed()
    random.seed(seed)

    start_date    = profile.resolved_start_date()
    window_days   = profile.training_window_days
    hours_per_day = profile.day_end_hour - profile.day_start_hour
    slots_per_day = hours_per_day * SLOTS_PER_HOUR

    nodes:       list[dict] = []
    constraints: list[dict] = []
    placements:  list[dict] = []

    # Unique employee names
    used_names:     set  = set()
    employee_names: list = []
    attempts = 0
    while len(employee_names) < profile.employees and attempts < 50_000:
        attempts += 1
        name = f"{random.choice(FIRST_NAMES)} {random.choice(LAST_NAMES)}"
        if name not in used_names:
            used_names.add(name)
            employee_names.append(name)
    while len(employee_names) < profile.employees:
        employee_names.append(f"Employee {len(employee_names)+1}")

    # Resolve which shift patterns are active for this simulation
    active_shift_ids = profile.shift_pattern_ids if profile.shift_pattern_ids else ["core4on4off"]
    active_shift_names = [SHIFT_ID_TO_NAME.get(sid, sid) for sid in active_shift_ids]
    shift_split = profile.shift_split or {}

    # Build a weighted list of shift names based on employee share percentages
    weighted_shifts: list[str] = []
    for sid in active_shift_ids:
        name   = SHIFT_ID_TO_NAME.get(sid, sid)
        weight = max(1, int(shift_split.get(sid, 100 / len(active_shift_ids))))
        weighted_shifts.extend([name] * weight)
    if not weighted_shifts:
        weighted_shifts = ["Core Production"]

    for i, name in enumerate(employee_names):
        shift_name = weighted_shifts[i % len(weighted_shifts)]
        nodes.append({
            "id":           f"emp_{i}",
            "type":         "employee",
            "label":        name,
            "shift_name":   shift_name,
        })

    # Roles
    role_titles = random.sample(SAP_ROLES, k=min(profile.roles, len(SAP_ROLES)))
    for i, title in enumerate(role_titles):
        nodes.append({"id": f"role_{i}", "type": "role", "label": title})

    # Courses
    selected = random.sample(SAP_COURSES, k=min(profile.courses, len(SAP_COURSES)))
    course_meta: list[dict] = []
    for i, (code, name, hours) in enumerate(selected):
        dur = max(2, min(int(hours * SLOTS_PER_HOUR), slots_per_day - 1))
        course_meta.append({"id": f"course_{i}", "code": code, "duration_slots": dur, "duration_hours": hours})
        nodes.append({"id": f"course_{i}", "type": "course", "label": f"{code} – {name}"})

    # Role → Course map
    role_course_map: dict = {}
    for r in range(profile.roles):
        min_c = max(1, int(profile.relationship_density * profile.courses * 0.25))
        max_c = max(2, int(profile.relationship_density * profile.courses * 0.55))
        count = random.randint(min_c, max_c)
        role_course_map[f"role_{r}"] = random.sample(course_meta, k=min(count, len(course_meta)))

    # Employee → Role
    employee_roles: dict = {}
    for e in range(profile.employees):
        role_count = 1 if profile.relationship_density < 0.6 else random.choice([1, 2])
        assigned   = random.sample([f"role_{i}" for i in range(profile.roles)], k=min(role_count, profile.roles))
        employee_roles[f"emp_{e}"] = assigned

    # Constraints
    cid = 0
    for emp_id, roles in employee_roles.items():
        for role_id in roles:
            constraints.append({"id": f"c_{cid}", "type": "requires", "from": emp_id, "to": role_id})
            cid += 1

    # Enrolments: course_id → set of employee_ids
    course_enrolments: dict = {c["id"]: set() for c in course_meta}
    for emp_id, roles in employee_roles.items():
        for role_id in roles:
            for c in role_course_map[role_id]:
                course_enrolments[c["id"]].add(emp_id)

    # Chaotic planned placements — each course gets ONE random slot
    pid = 0
    for c in course_meta:
        enrolled = list(course_enrolments[c["id"]])
        if not enrolled:
            continue
        dur   = c["duration_slots"]
        day   = random.randint(0, window_days - 1)
        max_s = slots_per_day - dur
        if max_s < 0:
            continue
        start = random.randint(0, max_s)
        for emp_id in enrolled:
            placements.append({
                "id": f"p_{pid}", "employee_id": emp_id, "course_id": c["id"],
                "day_index": day, "start_slot": start, "duration_slots": dur, "overflow": False,
            })
            pid += 1

    total_hours   = sum(p["duration_slots"] for p in placements) / SLOTS_PER_HOUR
    unique_enrol  = sum(len(v) for v in course_enrolments.values())
    manual_hours  = round((unique_enrol * 8 / 60 * 1.6) + (profile.employees * 15 / 60), 1)

    return {
        "nodes": nodes, "constraints": constraints, "placements": placements,
        "metrics": {
            "score": 0, "compression_percent": 0,
            "remaining_hours": round(total_hours, 1),
            "estimated_manual_hours": manual_hours,
            "total_placements": len(placements),
        },
        "phase": "planned",
        "time_model": build_time_model(profile.day_start_hour, profile.day_end_hour, window_days, start_date),
    }
