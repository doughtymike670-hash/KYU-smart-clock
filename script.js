"use strict";

/* =========================================================
   KYU Smart Class Clock — Application Logic v2
   Fully offline. No network calls. All state in localStorage.
   ========================================================= */

/* ---------------------------------------------------------
   1. COURSE DATA
   Add more courses here later — the course picker and every
   screen already read from this object, so a new course just
   needs an entry with its own `timetable` array.
--------------------------------------------------------- */
const COURSES = {
  "epi-y1s1": {
    id: "epi-y1s1",
    label: "BSc. Epidemiology & Medical Statistics",
    sublabel: "Year 1, Semester 1",
    timetable: [
      { day: "Tuesday",   start: "07:00", end: "10:00", code: "HES 2102", name: "Cell and Molecular Biology", venue: "JSM 104", lecturer: "Prof. Laura Wangai", type: "PHYSICAL" },
      { day: "Tuesday",   start: "13:00", end: "16:00", code: "HES 2102", name: "Cell and Molecular Biology", venue: "LAB", lecturer: "Prof. Laura Wangai", type: "PHYSICAL" },
      { day: "Tuesday",   start: "16:00", end: "19:00", code: "HES 2104", name: "Mathematics for Science", venue: "JSM 402", lecturer: "Dr. Hussein Lao", type: "PHYSICAL" },
      { day: "Wednesday", start: "13:00", end: "16:00", code: "HES 2101", name: "First Aid & Basic Life Support", venue: "KLH 102", lecturer: "Mr. Kiplimo Jacob", type: "PHYSICAL" },
      { day: "Wednesday", start: "16:00", end: "19:00", code: "UCU 2107", name: "Fundamentals of Digital Technologies and Artificial Intelligence", venue: "Virtual", lecturer: "Edwin Ireri", type: "VIRTUAL" },
      { day: "Thursday",  start: "07:00", end: "10:00", code: "HES 2103", name: "Introduction to Chemistry", venue: "JSM 403", lecturer: "Margaret Kariuki", type: "PHYSICAL" },
      { day: "Thursday",  start: "16:00", end: "19:00", code: "UCU 2106", name: "Communication Skills and Information Literacy", venue: "Virtual", lecturer: "Mrs. Omwando", type: "VIRTUAL" },
      { day: "Friday",    start: "16:00", end: "19:00", code: "HES 2105", name: "Human Anatomy and Physiology", venue: "KLH 006", lecturer: "Mr. Mteeve Brian Amugune", type: "PHYSICAL" }
    ]
  }
};

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const WEEK_TABS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

const QUOTES = [
  "Stay consistent, your goals are closer than you think.",
  "Small steps every day lead to big results.",
  "Discipline today, success tomorrow.",
  "You don't have to be great to start, you have to start to be great.",
  "Rest well — tomorrow's lecture will still be waiting.",
  "Progress, not perfection.",
  "Your future self is built by what you do today."
];

/* ---------------------------------------------------------
   2. STORAGE KEYS + STATE
--------------------------------------------------------- */
const LS = {
  course: "kyu_course_id",
  settings: "kyu_settings",
  triggered: "kyu_triggered_alarms",
  history: "kyu_alarm_history",
  theme: "kyu_theme",
  activeTab: "kyu_active_tab",
  timetablePrefix: "kyu_custom_timetable_" // + courseId
};

const DEFAULT_SETTINGS = {
  warningMinutes: 15,
  alarmSeconds: 5,
  clockFormat: "12",
  soundOn: true,
  notifOn: true
};

let state = {
  courseId: null,
  settings: { ...DEFAULT_SETTINGS },
  selectedWeekDay: currentDayName(),
  editingClassId: null,
  formType: "PHYSICAL"
};

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (e) {
    return fallback;
  }
}
function saveJSON(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* storage full/unavailable */ }
}

function currentDayName(d) {
  return DAY_NAMES[(d || new Date()).getDay()];
}

/* ---------------------------------------------------------
   3. TIMETABLE ACCESS (with per-course custom overrides)
--------------------------------------------------------- */
function getTimetable() {
  const custom = loadJSON(LS.timetablePrefix + state.courseId, null);
  if (custom && Array.isArray(custom)) return custom;
  const course = COURSES[state.courseId];
  return course ? course.timetable.map((c, i) => ({ ...c, id: c.id || `${state.courseId}-${i}` })) : [];
}
function saveTimetable(list) { saveJSON(LS.timetablePrefix + state.courseId, list); }
function ensureIds(list) { return list.map((c, i) => ({ ...c, id: c.id || `${state.courseId}-${Date.now()}-${i}` })); }

/* ---------------------------------------------------------
   4. TIME HELPERS
--------------------------------------------------------- */
function toMinutes(hhmm) { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; }
function dateAt(baseDate, hhmm) { const [h, m] = hhmm.split(":").map(Number); const d = new Date(baseDate); d.setHours(h, m, 0, 0); return d; }
function isSameDate(a, b) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
function pad(n) { return String(n).padStart(2, "0"); }

function formatClockParts(d, format) {
  let h = d.getHours();
  const m = pad(d.getMinutes());
  const s = pad(d.getSeconds());
  if (format === "24") return { main: `${pad(h)}:${m}:${s}`, ampm: "" };
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12; if (h === 0) h = 12;
  return { main: `${pad(h)}:${m}:${s}`, ampm };
}

function formatTimeShort(hhmm, format) {
  const [H, M] = hhmm.split(":").map(Number);
  if (format === "24") return `${pad(H)}:${pad(M)}`;
  let h = H % 12; if (h === 0) h = 12;
  const ampm = H >= 12 ? "PM" : "AM";
  return `${h}:${pad(M)} ${ampm}`;
}

function formatDateLong(d) {
  const days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function formatCountdown(ms) {
  if (ms < 0) ms = 0;
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}
function formatHM(ms) {
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h <= 0) return `${m}m`;
  return `${h}h ${m}m`;
}
function dayOfYear(d) {
  const start = new Date(d.getFullYear(), 0, 0);
  return Math.floor((d - start) / 86400000);
}

/* ---------------------------------------------------------
   5. OCCURRENCE BUILDING
--------------------------------------------------------- */
function buildOccurrences(fromDate, spanDays) {
  const list = getTimetable();
  const occ = [];
  for (let offset = 0; offset < spanDays; offset++) {
    const date = new Date(fromDate);
    date.setDate(date.getDate() + offset);
    const dayName = currentDayName(date);
    for (const c of list) {
      if (c.day !== dayName) continue;
      const startDate = dateAt(date, c.start);
      const endDate = dateAt(date, c.end);
      const dateStr = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
      occ.push({ ...c, startDate, endDate, occId: `${dateStr}-${c.code}-${c.start}` });
    }
  }
  occ.sort((a, b) => a.startDate - b.startDate);
  return occ;
}

/* ---------------------------------------------------------
   6. DOM REFERENCES
--------------------------------------------------------- */
const $ = (id) => document.getElementById(id);

const els = {
  clockTime: $("clock-time"),
  clockDate: $("clock-date"),
  statusBanner: $("status-banner"),
  nextCard: $("next-class-card"),
  nextCode: $("next-code"),
  nextName: $("next-name"),
  nextTypeBadge: $("next-type-badge"),
  nextPlace: $("next-place"),
  nextDay: $("next-day"),
  nextTime: $("next-time"),
  nextCountdown: $("next-countdown"),
  nextJoin: $("next-join"),
  currentCard: $("current-class-card"),
  currentCode: $("current-code"),
  currentName: $("current-name"),
  currentTypeBadge: $("current-type-badge"),
  currentPlace: $("current-place"),
  currentProgress: $("current-progress"),
  currentProgressPct: $("current-progress-pct"),
  currentEndsIn: $("current-ends-in"),
  currentJoin: $("current-join"),
  todayHeading: $("today-heading"),
  todayList: $("today-list"),
  dayTabs: $("day-tabs"),
  weekList: $("week-list"),
  alarmOverlay: $("alarm-overlay"),
  alarmLead: $("alarm-lead"),
  alarmHeadline: $("alarm-headline"),
  alarmRingFill: $("alarm-ring-fill"),
  alarmRingNum: $("alarm-ring-num"),
  alarmCode: $("alarm-code"),
  alarmUnit: $("alarm-unit"),
  alarmPlace: $("alarm-place"),
  alarmTime: $("alarm-time"),
  alarmDismiss: $("alarm-dismiss"),
  alarmAudio: $("alarm-audio"),
  upcomingAlarmsList: $("upcoming-alarms-list"),
  alarmHistoryList: $("alarm-history-list"),
  alarmsWarningPreview: $("alarms-warning-preview"),
  alarmsDurationPreview: $("alarms-duration-preview"),
  courseSelectScreen: $("screen-course-select"),
  courseList: $("course-list"),
  courseSelectSettings: $("course-select"),
  warningSelect: $("warning-select"),
  warningCustomWrap: $("warning-custom-wrap"),
  warningCustom: $("warning-custom"),
  durationSelect: $("duration-select"),
  durationCustomWrap: $("duration-custom-wrap"),
  durationCustom: $("duration-custom"),
  clockFormatSelect: $("clock-format-select"),
  darkModeToggle: $("dark-mode-toggle"),
  soundToggle: $("sound-toggle"),
  notifToggle: $("notif-toggle"),
  editorList: $("editor-list"),
  classForm: $("class-form"),
  classFormTitle: $("class-form-title"),
  fDay: $("f-day"), fStart: $("f-start"), fEnd: $("f-end"), fCode: $("f-code"),
  fName: $("f-name"), fType: $("f-type"), fVenue: $("f-venue"), fVenueWrap: $("f-venue-wrap"),
  fLink: $("f-link"), fLinkWrap: $("f-link-wrap"), fLecturer: $("f-lecturer"), fId: $("f-id"),
  fDelete: $("f-delete"), fCancel: $("f-cancel"), fTypeSegmented: $("f-type-segmented"),
  menuOpen: $("menu-open"),
  menuSheet: $("menu-sheet"),
  menuClose: $("menu-close"),
  menuThemeToggle: $("menu-theme-toggle"),
  menuThemeIcon: $("menu-theme-icon"),
  menuThemeLabel: $("menu-theme-label"),
  qsClockFormat: $("qs-clock-format"),
  qsWarning: $("qs-warning"),
  qsDuration: $("qs-duration")
};

/* ---------------------------------------------------------
   7. TOAST
--------------------------------------------------------- */
function toast(msg) {
  let el = document.getElementById("kyu-toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "kyu-toast";
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.opacity = "1";
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.style.opacity = "0"; }, 2400);
}

/* ---------------------------------------------------------
   8. NAVIGATION
--------------------------------------------------------- */
function showScreen(id) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
  const target = $(id);
  if (target) target.classList.add("active");
  document.querySelectorAll(".nav-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.screen === id);
  });
  if (["screen-home", "screen-timetable", "screen-alarms", "screen-settings"].includes(id)) {
    saveJSON(LS.activeTab, id);
  }
  window.scrollTo(0, 0);
}

document.querySelectorAll(".nav-btn").forEach((btn) => {
  btn.addEventListener("click", () => showScreen(btn.dataset.screen));
});
document.querySelectorAll("[data-goto]").forEach((btn) => {
  btn.addEventListener("click", () => {
    showScreen(btn.dataset.goto);
    if (btn.hasAttribute("data-close-menu")) closeMenu();
  });
});

/* ---------------------------------------------------------
   9. MENU SHEET + THEME
--------------------------------------------------------- */
function openMenu() { els.menuSheet.hidden = false; }
function closeMenu() { els.menuSheet.hidden = true; }
els.menuOpen.addEventListener("click", openMenu);
els.menuClose.addEventListener("click", closeMenu);
els.menuSheet.addEventListener("click", (e) => { if (e.target === els.menuSheet) closeMenu(); });

function applyTheme(mode) {
  document.body.classList.toggle("theme-light", mode === "light");
  const isDark = mode !== "light";
  els.menuThemeIcon.textContent = isDark ? "🌙" : "☀";
  els.menuThemeLabel.textContent = isDark ? "Dark mode" : "Light mode";
  if (els.darkModeToggle) els.darkModeToggle.checked = isDark;
}
function toggleTheme() {
  const current = loadJSON(LS.theme, "dark");
  const next = current === "dark" ? "light" : "dark";
  saveJSON(LS.theme, next);
  applyTheme(next);
}
els.menuThemeToggle.addEventListener("click", toggleTheme);
els.darkModeToggle.addEventListener("change", () => {
  saveJSON(LS.theme, els.darkModeToggle.checked ? "dark" : "light");
  applyTheme(els.darkModeToggle.checked ? "dark" : "light");
});

/* ---------------------------------------------------------
   10. COURSE SELECTION
--------------------------------------------------------- */
function renderCourseOptions(container, onPick) {
  container.innerHTML = "";
  Object.values(COURSES).forEach((c) => {
    const btn = document.createElement("button");
    btn.className = "course-option";
    btn.innerHTML = `${escapeHTML(c.label)}<small>${escapeHTML(c.sublabel)}</small>`;
    btn.addEventListener("click", () => onPick(c.id));
    container.appendChild(btn);
  });
}

function initCourse() {
  const saved = loadJSON(LS.course, null);
  if (saved && COURSES[saved]) {
    state.courseId = saved;
    els.courseSelectScreen.hidden = true;
  } else {
    state.courseId = Object.keys(COURSES)[0];
    els.courseSelectScreen.hidden = false;
    renderCourseOptions(els.courseList, (id) => {
      state.courseId = id;
      saveJSON(LS.course, id);
      els.courseSelectScreen.hidden = true;
      refreshCourseDependentUI();
      tick();
    });
  }
  els.courseSelectSettings.innerHTML = "";
  Object.values(COURSES).forEach((c) => {
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = c.label;
    els.courseSelectSettings.appendChild(opt);
  });
  els.courseSelectSettings.value = state.courseId;
}
els.courseSelectSettings.addEventListener("change", () => {
  state.courseId = els.courseSelectSettings.value;
  saveJSON(LS.course, state.courseId);
  refreshCourseDependentUI();
  toast("Course switched");
  tick();
});

function refreshCourseDependentUI() {
  renderWeekTabs();
  renderWeekList();
  renderEditorList();
}

/* ---------------------------------------------------------
   11. SETTINGS
--------------------------------------------------------- */
function loadSettings() { state.settings = { ...DEFAULT_SETTINGS, ...loadJSON(LS.settings, {}) }; }
function persistSettings() { saveJSON(LS.settings, state.settings); syncSettingsUI(); }

function syncSettingsUI() {
  const s = state.settings;
  const stdWarn = [1,5,10,15,20,30,45,60];
  if (stdWarn.includes(s.warningMinutes)) {
    els.warningSelect.value = String(s.warningMinutes);
    els.warningCustomWrap.hidden = true;
  } else {
    els.warningSelect.value = "custom";
    els.warningCustomWrap.hidden = false;
    els.warningCustom.value = s.warningMinutes;
  }
  const stdDur = [2,3,5,10,15,30];
  if (stdDur.includes(s.alarmSeconds)) {
    els.durationSelect.value = String(s.alarmSeconds);
    els.durationCustomWrap.hidden = true;
  } else {
    els.durationSelect.value = "custom";
    els.durationCustomWrap.hidden = false;
    els.durationCustom.value = s.alarmSeconds;
  }
  els.clockFormatSelect.value = s.clockFormat;
  els.soundToggle.checked = s.soundOn;
  els.notifToggle.checked = s.notifOn;
  els.alarmsWarningPreview.textContent = `${s.warningMinutes} minute${s.warningMinutes == 1 ? "" : "s"} before`;
  els.alarmsDurationPreview.textContent = `${s.alarmSeconds} second${s.alarmSeconds == 1 ? "" : "s"}`;

  // Quick settings panel (desktop)
  els.qsClockFormat.textContent = s.clockFormat === "24" ? "24-hour" : "12-hour";
  els.qsWarning.textContent = `${s.warningMinutes} minute${s.warningMinutes == 1 ? "" : "s"}`;
  els.qsDuration.textContent = `${s.alarmSeconds} second${s.alarmSeconds == 1 ? "" : "s"}`;
}

els.warningSelect.addEventListener("change", () => {
  if (els.warningSelect.value === "custom") {
    els.warningCustomWrap.hidden = false;
    els.warningCustom.focus();
  } else {
    els.warningCustomWrap.hidden = true;
    state.settings.warningMinutes = Number(els.warningSelect.value);
    persistSettings();
  }
});
els.warningCustom.addEventListener("input", () => {
  const v = Math.max(1, Number(els.warningCustom.value) || 1);
  state.settings.warningMinutes = v;
  saveJSON(LS.settings, state.settings);
  els.alarmsWarningPreview.textContent = `${v} minute${v == 1 ? "" : "s"} before`;
  els.qsWarning.textContent = `${v} minute${v == 1 ? "" : "s"}`;
});

els.durationSelect.addEventListener("change", () => {
  if (els.durationSelect.value === "custom") {
    els.durationCustomWrap.hidden = false;
    els.durationCustom.focus();
  } else {
    els.durationCustomWrap.hidden = true;
    state.settings.alarmSeconds = Number(els.durationSelect.value);
    persistSettings();
  }
});
els.durationCustom.addEventListener("input", () => {
  const v = Math.max(1, Number(els.durationCustom.value) || 1);
  state.settings.alarmSeconds = v;
  saveJSON(LS.settings, state.settings);
  els.alarmsDurationPreview.textContent = `${v} second${v == 1 ? "" : "s"}`;
  els.qsDuration.textContent = `${v} second${v == 1 ? "" : "s"}`;
});

els.clockFormatSelect.addEventListener("change", () => {
  state.settings.clockFormat = els.clockFormatSelect.value;
  persistSettings();
});
els.soundToggle.addEventListener("change", () => { state.settings.soundOn = els.soundToggle.checked; persistSettings(); });
els.notifToggle.addEventListener("change", () => {
  state.settings.notifOn = els.notifToggle.checked;
  if (state.settings.notifOn && "Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
  }
  persistSettings();
});

$("reset-settings-btn").addEventListener("click", () => {
  if (!confirm("Reset all settings to default? Your timetable data will not be affected.")) return;
  state.settings = { ...DEFAULT_SETTINGS };
  persistSettings();
  applyTheme("dark");
  saveJSON(LS.theme, "dark");
  toast("Settings reset");
});

/* ---------------------------------------------------------
   12. HOME SCREEN RENDERING
--------------------------------------------------------- */
function typeBadgeText(type) { return type === "VIRTUAL" ? "💻 VIRTUAL" : "🏫 PHYSICAL"; }
function placeLabel(c) { return c.type === "VIRTUAL" ? "💻 Virtual" : `📍 ${c.venue || "TBA"}`; }

function setJoinButton(anchorEl, cls) {
  if (cls.type === "VIRTUAL") {
    anchorEl.hidden = false;
    if (cls.link) {
      anchorEl.textContent = "JOIN CLASS";
      anchorEl.href = cls.link;
      anchorEl.style.pointerEvents = "auto";
      anchorEl.style.opacity = "1";
    } else {
      anchorEl.textContent = "NO CLASS LINK SET";
      anchorEl.removeAttribute("href");
      anchorEl.style.pointerEvents = "none";
      anchorEl.style.opacity = "0.55";
    }
  } else {
    anchorEl.hidden = true;
  }
}

function renderHome(now, occWindow) {
  const format = state.settings.clockFormat;
  const parts = formatClockParts(now, format);
  els.clockTime.innerHTML = parts.ampm ? `${parts.main}<span class="ampm">${parts.ampm}</span>` : parts.main;
  els.clockDate.textContent = formatDateLong(now);

  const todays = occWindow.filter((o) => isSameDate(o.startDate, now));
  const current = todays.find((o) => o.startDate <= now && now < o.endDate);
  const upcomingOverall = occWindow.find((o) => o.startDate > now);

  // ---- current class card ----
  if (current) {
    els.currentCard.hidden = false;
    els.currentCode.textContent = current.code;
    els.currentName.textContent = current.name;
    els.currentTypeBadge.textContent = typeBadgeText(current.type);
    els.currentTypeBadge.className = "pill-badge " + (current.type === "VIRTUAL" ? "virtual" : "physical");
    els.currentPlace.textContent = placeLabel(current);
    const total = current.endDate - current.startDate;
    const elapsed = now - current.startDate;
    const pct = Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));
    els.currentProgress.style.width = pct + "%";
    els.currentProgressPct.textContent = pct + "%";
    els.currentEndsIn.textContent = formatCountdown(current.endDate - now);
    setJoinButton(els.currentJoin, current);
  } else {
    els.currentCard.hidden = true;
  }

  // ---- next class card / status banner ----
  els.nextCard.hidden = true;
  els.statusBanner.hidden = true;

  if (upcomingOverall) {
    const sameDay = isSameDate(upcomingOverall.startDate, now);
    if (sameDay) {
      els.nextCard.hidden = false;
      fillNextCard(upcomingOverall, now);
    } else if (!current) {
      els.statusBanner.hidden = false;
      renderNoMoreClassesBanner(upcomingOverall, now, format);
    }
  } else if (!current) {
    els.statusBanner.hidden = false;
    els.statusBanner.innerHTML = `
      <div class="sb-icon">🗓️</div>
      <div class="sb-pill" style="background:var(--blue-dim);color:#7EB0FF;">NO CLASSES SCHEDULED</div>
      <p class="sb-empty-note">Add classes in Settings → Edit timetable.</p>
    `;
  }

  // ---- today's classes list ----
  els.todayHeading.textContent = `Today's classes — ${currentDayName(now)}`;
  els.todayList.innerHTML = "";
  if (todays.length === 0) {
    els.todayList.innerHTML = `<div class="empty-note">No classes today. Enjoy the break.</div>`;
  } else {
    let nextAssigned = false;
    todays.forEach((o) => {
      let statusType;
      if (now >= o.endDate) statusType = "done";
      else if (o.startDate <= now && now < o.endDate) statusType = "live";
      else if (!nextAssigned) { statusType = "next"; nextAssigned = true; }
      else statusType = "upcoming";
      els.todayList.appendChild(buildClassItem(o, statusType, format));
    });
  }
}

function isTomorrow(d, now) {
  const t = new Date(now);
  t.setDate(t.getDate() + 1);
  return isSameDate(d, t);
}

function renderNoMoreClassesBanner(next, now, format) {
  const dayLabel = isTomorrow(next.startDate, now) ? "Tomorrow" : currentDayName(next.startDate);
  const quote = QUOTES[dayOfYear(now) % QUOTES.length];
  els.statusBanner.innerHTML = `
    <div class="sb-icon">✅</div>
    <div class="sb-pill">✓ NO MORE CLASSES TODAY</div>
    <div class="sb-next-card">
      <div class="sb-next-label">NEXT CLASS</div>
      <div class="sb-next-row">📅 <span>${dayLabel} · ${formatTimeShort(next.start, format)}</span></div>
      <div class="sb-next-name">${escapeHTML(next.name)}</div>
      <div class="sb-next-row">${next.type === "VIRTUAL" ? "💻 <span>Virtual</span>" : `📍 <span>${escapeHTML(next.venue || "TBA")}</span>`}</div>
    </div>
    <div class="sb-countdown-row">⏱ Starts in <span class="sb-countdown-value">${formatHM(next.startDate - now)}</span></div>
    <div class="sb-quote">"${escapeHTML(quote)}"</div>
  `;
}

function fillNextCard(next, now) {
  const format = state.settings.clockFormat;
  els.nextCode.textContent = next.code;
  els.nextName.textContent = next.name;
  els.nextTypeBadge.textContent = typeBadgeText(next.type);
  els.nextTypeBadge.className = "pill-badge " + (next.type === "VIRTUAL" ? "virtual" : "physical");
  els.nextPlace.textContent = placeLabel(next);
  els.nextDay.textContent = isSameDate(next.startDate, now) ? "Today" : (isTomorrow(next.startDate, now) ? "Tomorrow" : currentDayName(next.startDate));
  els.nextTime.textContent = `${formatTimeShort(next.start, format)} – ${formatTimeShort(next.end, format)}`;
  els.nextCountdown.textContent = formatCountdown(next.startDate - now);
  setJoinButton(els.nextJoin, next);
}

const STATUS_LABELS = { done: "✓ COMPLETED", live: "🔴 LIVE", next: "NEXT", upcoming: "UPCOMING" };
const STATUS_CLASSES = { done: "status-done", live: "status-current", next: "status-next", upcoming: "status-upcoming" };

function buildClassItem(o, statusType, format) {
  const div = document.createElement("div");
  div.className = "class-item " + (o.type === "VIRTUAL" ? "type-virtual" : "type-physical")
    + (statusType === "done" ? " is-done" : "") + (statusType === "live" ? " is-live" : "");
  div.innerHTML = `
    <div class="class-item-body">
      <div class="class-item-time">${formatTimeShort(o.start, format)} – ${formatTimeShort(o.end, format)}</div>
      <div class="class-item-name">${escapeHTML(o.name)} <span style="color:var(--text-dim);font-weight:400;">(${escapeHTML(o.code)})</span></div>
      <div class="class-item-sub">${o.type === "VIRTUAL" ? "💻 Virtual" : "📍 " + escapeHTML(o.venue || "TBA")}${o.lecturer ? " · " + escapeHTML(o.lecturer) : ""}</div>
    </div>
    <span class="class-item-status ${STATUS_CLASSES[statusType]}">${STATUS_LABELS[statusType]}</span>
  `;
  return div;
}

function escapeHTML(str) {
  return String(str ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
}

/* ---------------------------------------------------------
   13. TIMETABLE (WEEK VIEW)
--------------------------------------------------------- */
function renderWeekTabs() {
  els.dayTabs.innerHTML = "";
  WEEK_TABS.forEach((day) => {
    const btn = document.createElement("button");
    btn.className = "day-tab" + (day === state.selectedWeekDay ? " active" : "");
    btn.textContent = day.slice(0, 3).toUpperCase();
    btn.addEventListener("click", () => {
      state.selectedWeekDay = day;
      renderWeekTabs();
      renderWeekList();
    });
    els.dayTabs.appendChild(btn);
  });
}

function renderWeekList() {
  const format = state.settings.clockFormat;
  const list = getTimetable()
    .filter((c) => c.day === state.selectedWeekDay)
    .sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
  els.weekList.innerHTML = "";
  if (list.length === 0) {
    els.weekList.innerHTML = `<div class="empty-note">No classes on ${state.selectedWeekDay}.</div>`;
    return;
  }
  list.forEach((c) => {
    const div = document.createElement("div");
    div.className = "class-item " + (c.type === "VIRTUAL" ? "type-virtual" : "type-physical");
    div.innerHTML = `
      <div class="class-item-body">
        <div class="class-item-time">${formatTimeShort(c.start, format)} – ${formatTimeShort(c.end, format)}</div>
        <div class="class-item-name">${escapeHTML(c.name)} <span style="color:var(--text-dim);font-weight:400;">(${escapeHTML(c.code)})</span></div>
        <div class="class-item-sub">${c.type === "VIRTUAL" ? "💻 Virtual" : "📍 " + escapeHTML(c.venue || "TBA")}${c.lecturer ? " · " + escapeHTML(c.lecturer) : ""}</div>
      </div>
      <span class="pill-badge ${c.type === "VIRTUAL" ? "virtual" : "physical"}">${c.type === "VIRTUAL" ? "VIRTUAL" : "PHYSICAL"}</span>
    `;
    els.weekList.appendChild(div);
  });
}

/* ---------------------------------------------------------
   14. ALARM ENGINE
--------------------------------------------------------- */
let alarmAudioTimer = null;
let alarmAutoDismissTimer = null;
const ALARM_RING_CIRCUMFERENCE = 2 * Math.PI * 52;

function loadTriggered() { return new Set((loadJSON(LS.triggered, { ids: [] }).ids) || []); }
function saveTriggered(set) { saveJSON(LS.triggered, { ids: Array.from(set).slice(-500) }); }
function pushHistory(entry) {
  const hist = loadJSON(LS.history, []);
  hist.unshift(entry);
  saveJSON(LS.history, hist.slice(0, 30));
}

function checkAlarms(now, occWindow) {
  const triggered = loadTriggered();
  const warnMs = state.settings.warningMinutes * 60000;
  let changed = false;
  for (const o of occWindow) {
    if (o.startDate <= now) continue;
    const alarmAt = new Date(o.startDate.getTime() - warnMs);
    if (now >= alarmAt && !triggered.has(o.occId)) {
      triggered.add(o.occId);
      changed = true;
      fireAlarm(o, now);
    }
  }
  if (changed) saveTriggered(triggered);
}

function fireAlarm(o, now) {
  const format = state.settings.clockFormat;
  showAlarmOverlay({
    lead: "CLASS ALERT",
    headline: `YOUR CLASS STARTS IN ${state.settings.warningMinutes} MINUTE${state.settings.warningMinutes == 1 ? "" : "S"}`,
    minutes: state.settings.warningMinutes,
    code: o.code,
    unit: o.name,
    place: o.type === "VIRTUAL" ? "💻 VIRTUAL CLASS" : `📍 ${o.venue || "TBA"}`,
    time: `${formatTimeShort(o.start, format)} – ${formatTimeShort(o.end, format)}`
  });
  pushHistory({
    code: o.code, name: o.name, day: currentDayName(o.startDate),
    time: `${formatTimeShort(o.start, format)} – ${formatTimeShort(o.end, format)}`,
    triggeredAt: now.toISOString()
  });
  if (state.settings.notifOn && "Notification" in window && Notification.permission === "granted") {
    try {
      new Notification("Class alert", {
        body: `${o.name} (${o.code}) starts in ${state.settings.warningMinutes} min — ${o.type === "VIRTUAL" ? "Virtual" : o.venue}`,
        icon: "assets/icon-192.png"
      });
    } catch (e) { /* ignore */ }
  }
  renderAlarmsTab();
}

function showAlarmOverlay(info) {
  els.alarmLead.textContent = info.lead;
  els.alarmHeadline.textContent = info.headline;
  els.alarmRingNum.textContent = `${info.minutes}:00`;
  const fillPct = Math.max(0.15, Math.min(1, info.minutes / 60));
  els.alarmRingFill.setAttribute("stroke-dasharray", String(ALARM_RING_CIRCUMFERENCE));
  els.alarmRingFill.setAttribute("stroke-dashoffset", String(ALARM_RING_CIRCUMFERENCE * (1 - fillPct)));
  els.alarmCode.textContent = info.code;
  els.alarmUnit.textContent = info.unit;
  els.alarmPlace.textContent = info.place;
  els.alarmTime.textContent = "🕐 " + info.time;
  els.alarmOverlay.hidden = false;

  if (state.settings.soundOn) playAlarmSound(state.settings.alarmSeconds);
  clearTimeout(alarmAutoDismissTimer);
  alarmAutoDismissTimer = setTimeout(dismissAlarm, Math.max(state.settings.alarmSeconds * 1000, 2000) + 4000);
}

function dismissAlarm() {
  els.alarmOverlay.hidden = true;
  stopAlarmSound();
  clearTimeout(alarmAutoDismissTimer);
}
els.alarmDismiss.addEventListener("click", dismissAlarm);

function playAlarmSound(seconds) {
  stopAlarmSound();
  const audio = els.alarmAudio;
  audio.currentTime = 0;
  audio.loop = true;
  const p = audio.play();
  if (p && p.catch) p.catch(() => { /* autoplay may be blocked until user interacts once */ });
  alarmAudioTimer = setTimeout(stopAlarmSound, seconds * 1000);
}
function stopAlarmSound() {
  clearTimeout(alarmAudioTimer);
  const audio = els.alarmAudio;
  audio.loop = false;
  audio.pause();
  audio.currentTime = 0;
}

function runTestAlarm() {
  const format = state.settings.clockFormat;
  const sample = getTimetable()[0];
  showAlarmOverlay({
    lead: "TEST ALARM",
    headline: `YOUR CLASS STARTS IN ${state.settings.warningMinutes} MINUTE${state.settings.warningMinutes == 1 ? "" : "S"}`,
    minutes: state.settings.warningMinutes,
    code: sample ? sample.code : "TEST 000",
    unit: sample ? sample.name : "Sample Class",
    place: sample ? (sample.type === "VIRTUAL" ? "💻 VIRTUAL CLASS" : `📍 ${sample.venue}`) : "📍 Sample venue",
    time: sample ? `${formatTimeShort(sample.start, format)} – ${formatTimeShort(sample.end, format)}` : "—"
  });
}
$("test-alarm-btn").addEventListener("click", runTestAlarm);
$("test-alarm-btn-2").addEventListener("click", runTestAlarm);

async function runTestNotification() {
  if (!("Notification" in window)) { toast("Notifications aren't supported on this browser"); return; }
  let perm = Notification.permission;
  if (perm === "default") perm = await Notification.requestPermission();
  if (perm === "granted") {
    new Notification("KYU Smart Class Clock", { body: "This is a test notification.", icon: "assets/icon-192.png" });
    toast("Test notification sent");
  } else {
    toast("Notification permission denied");
  }
}
$("test-notification-btn").addEventListener("click", runTestNotification);
$("test-notification-btn-2").addEventListener("click", runTestNotification);

function renderAlarmsTab() {
  const now = new Date();
  const format = state.settings.clockFormat;
  const occWindow = buildOccurrences(now, 2);
  const triggered = loadTriggered();
  const todays = occWindow.filter((o) => isSameDate(o.startDate, now) && o.startDate > now);

  els.upcomingAlarmsList.innerHTML = "";
  if (todays.length === 0) {
    els.upcomingAlarmsList.innerHTML = `<div class="empty-note">No more alarms scheduled today.</div>`;
  } else {
    todays.forEach((o) => {
      const alarmAt = new Date(o.startDate.getTime() - state.settings.warningMinutes * 60000);
      const done = triggered.has(o.occId);
      const div = document.createElement("div");
      div.className = "class-item " + (o.type === "VIRTUAL" ? "type-virtual" : "type-physical") + (done ? " is-done" : "");
      div.innerHTML = `
        <div class="class-item-body">
          <div class="class-item-time">Rings at ${formatTimeShort(`${pad(alarmAt.getHours())}:${pad(alarmAt.getMinutes())}`, format)}</div>
          <div class="class-item-name">${escapeHTML(o.name)} <span style="color:var(--text-dim);font-weight:400;">(${escapeHTML(o.code)})</span></div>
          <div class="class-item-sub">Class at ${formatTimeShort(o.start, format)}</div>
        </div>
        <span class="class-item-status ${done ? "status-done" : "status-upcoming"}">${done ? "✓ RUNG" : "PENDING"}</span>
      `;
      els.upcomingAlarmsList.appendChild(div);
    });
  }

  const hist = loadJSON(LS.history, []);
  els.alarmHistoryList.innerHTML = "";
  if (hist.length === 0) {
    els.alarmHistoryList.innerHTML = `<div class="empty-note">No alarms have rung yet.</div>`;
  } else {
    hist.slice(0, 10).forEach((h) => {
      const t = new Date(h.triggeredAt);
      const div = document.createElement("div");
      div.className = "class-item type-physical is-done";
      div.innerHTML = `
        <div class="class-item-body">
          <div class="class-item-time">${h.day}, ${formatTimeShort(`${pad(t.getHours())}:${pad(t.getMinutes())}`, format)}</div>
          <div class="class-item-name">${escapeHTML(h.name)} <span style="color:var(--text-dim);font-weight:400;">(${escapeHTML(h.code)})</span></div>
          <div class="class-item-sub">${h.time}</div>
        </div>
      `;
      els.alarmHistoryList.appendChild(div);
    });
  }
}

/* ---------------------------------------------------------
   15. TIMETABLE EDITOR
--------------------------------------------------------- */
$("open-editor").addEventListener("click", () => { renderEditorList(); showScreen("screen-editor"); });
$("open-editor-2").addEventListener("click", () => { renderEditorList(); showScreen("screen-editor"); });
$("editor-close").addEventListener("click", () => showScreen("screen-settings"));

function renderEditorList() {
  const format = state.settings.clockFormat;
  const list = ensureIds(getTimetable()).slice().sort((a, b) => {
    const da = WEEK_TABS.indexOf(a.day), db = WEEK_TABS.indexOf(b.day);
    return da - db || toMinutes(a.start) - toMinutes(b.start);
  });
  els.editorList.innerHTML = "";
  if (list.length === 0) {
    els.editorList.innerHTML = `<div class="empty-note">No classes yet. Tap "Add class" to create your timetable.</div>`;
    return;
  }
  list.forEach((c) => {
    const div = document.createElement("div");
    div.className = "class-item " + (c.type === "VIRTUAL" ? "type-virtual" : "type-physical");
    div.style.cursor = "pointer";
    div.innerHTML = `
      <div class="class-item-body">
        <div class="class-item-time">${c.day} · ${formatTimeShort(c.start, format)}–${formatTimeShort(c.end, format)}</div>
        <div class="class-item-name">${escapeHTML(c.name)} <span style="color:var(--text-dim);font-weight:400;">(${escapeHTML(c.code)})</span></div>
        <div class="class-item-sub">${c.type === "VIRTUAL" ? "💻 Virtual" : "📍 " + escapeHTML(c.venue || "TBA")}</div>
      </div>
      <span class="class-item-status status-upcoming">✎ EDIT</span>
    `;
    div.addEventListener("click", () => openClassForm(c));
    els.editorList.appendChild(div);
  });
}

$("editor-add-btn").addEventListener("click", () => openClassForm(null));

function setFormType(type) {
  state.formType = type;
  els.fType.value = type;
  els.fTypeSegmented.querySelectorAll(".segmented-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.type === type);
  });
  els.fVenueWrap.hidden = type === "VIRTUAL";
  els.fLinkWrap.hidden = type !== "VIRTUAL";
}
els.fTypeSegmented.querySelectorAll(".segmented-btn").forEach((btn) => {
  btn.addEventListener("click", () => setFormType(btn.dataset.type));
});

function openClassForm(cls) {
  state.editingClassId = cls ? cls.id : null;
  els.classFormTitle.textContent = cls ? "Edit class" : "Add class";
  els.fId.value = cls ? cls.id : "";
  els.fDay.value = cls ? cls.day : "Monday";
  els.fStart.value = cls ? cls.start : "07:00";
  els.fEnd.value = cls ? cls.end : "09:00";
  els.fCode.value = cls ? cls.code : "";
  els.fName.value = cls ? cls.name : "";
  els.fVenue.value = cls ? (cls.venue || "") : "";
  els.fLink.value = cls ? (cls.link || "") : "";
  els.fLecturer.value = cls ? (cls.lecturer || "") : "";
  setFormType(cls ? cls.type : "PHYSICAL");
  els.fDelete.hidden = !cls;
  showScreen("screen-class-form");
}
$("class-form-close").addEventListener("click", () => showScreen("screen-editor"));
els.fCancel.addEventListener("click", () => showScreen("screen-editor"));

els.classForm.addEventListener("submit", (e) => {
  e.preventDefault();
  if (toMinutes(els.fEnd.value) <= toMinutes(els.fStart.value)) {
    toast("End time must be after start time");
    return;
  }
  const list = ensureIds(getTimetable());
  const payload = {
    id: els.fId.value || `${state.courseId}-${Date.now()}`,
    day: els.fDay.value,
    start: els.fStart.value,
    end: els.fEnd.value,
    code: els.fCode.value.trim(),
    name: els.fName.value.trim(),
    type: state.formType,
    venue: state.formType === "VIRTUAL" ? "Virtual" : els.fVenue.value.trim(),
    link: state.formType === "VIRTUAL" ? els.fLink.value.trim() : "",
    lecturer: els.fLecturer.value.trim()
  };
  const idx = list.findIndex((c) => c.id === payload.id);
  if (idx >= 0) list[idx] = payload; else list.push(payload);
  saveTimetable(list);
  toast("Class saved");
  showScreen("screen-editor");
  renderEditorList();
  refreshCourseDependentUI();
  tick();
});

els.fDelete.addEventListener("click", () => {
  if (!confirm("Delete this class?")) return;
  const list = ensureIds(getTimetable()).filter((c) => c.id !== els.fId.value);
  saveTimetable(list);
  toast("Class deleted");
  showScreen("screen-editor");
  renderEditorList();
  refreshCourseDependentUI();
  tick();
});

/* ---------------------------------------------------------
   16. BACKUP & RESTORE
--------------------------------------------------------- */
$("open-backup-export").addEventListener("click", () => showScreen("screen-backup"));
$("open-backup-import").addEventListener("click", () => showScreen("screen-backup"));
$("backup-close").addEventListener("click", () => showScreen("screen-settings"));

$("export-btn").addEventListener("click", () => {
  const payload = {
    exportedAt: new Date().toISOString(),
    courseId: state.courseId,
    courseLabel: COURSES[state.courseId] ? COURSES[state.courseId].label : state.courseId,
    timetable: getTimetable(),
    settings: state.settings
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `kyu-timetable-${state.courseId}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  toast("Timetable exported");
});

$("import-btn").addEventListener("click", () => $("import-file").click());
$("import-file").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!Array.isArray(data.timetable)) throw new Error("Invalid file: missing timetable array");
      saveTimetable(ensureIds(data.timetable));
      if (data.settings) {
        state.settings = { ...DEFAULT_SETTINGS, ...data.settings };
        persistSettings();
      }
      refreshCourseDependentUI();
      renderEditorList();
      tick();
      toast("Timetable imported");
    } catch (err) {
      toast("Import failed: " + err.message);
    } finally {
      e.target.value = "";
    }
  };
  reader.readAsText(file);
});

/* ---------------------------------------------------------
   17. MAIN TICK — runs every second
--------------------------------------------------------- */
let lastAlarmTabRender = 0;
function tick() {
  const now = new Date();
  const occWindow = buildOccurrences(now, 8);
  renderHome(now, occWindow);
  checkAlarms(now, occWindow);
  if (Date.now() - lastAlarmTabRender > 5000 || document.getElementById("screen-alarms").classList.contains("active")) {
    renderAlarmsTab();
    lastAlarmTabRender = Date.now();
  }
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") tick();
});

/* ---------------------------------------------------------
   18. INIT
--------------------------------------------------------- */
function init() {
  applyTheme(loadJSON(LS.theme, "dark"));
  loadSettings();
  initCourse();
  syncSettingsUI();
  renderWeekTabs();
  renderWeekList();
  renderEditorList();

  const savedTab = loadJSON(LS.activeTab, "screen-home");
  showScreen(savedTab);

  tick();
  setInterval(tick, 1000);

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js").catch(() => { /* offline-first: ignore reg failures */ });
  }
}

document.addEventListener("DOMContentLoaded", init);
