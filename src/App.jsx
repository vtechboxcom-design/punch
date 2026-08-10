import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Calendar as CalendarIcon,
  ListChecks,
  Settings as SettingsIcon,
  Plus,
  X,
  Check,
  AlertTriangle,
  Moon,
  Sun,
  Pencil,
  Trash2,
  ClipboardList,
} from "lucide-react";

/* ----------------------------------------------------------------------- */
/* THEME                                                                    */
/* ----------------------------------------------------------------------- */

const LIGHT = {
  bg: "#F6F5F1",
  surface: "#FFFFFF",
  surfaceAlt: "#F0EEE8",
  ink: "#1B1C20",
  muted: "#6E7178",
  faint: "#A8AAB1",
  border: "#E6E4DD",
  primary: "#2C4FC4",
  primarySoft: "#E9EEFC",
  success: "#1C8F5E",
  successSoft: "#E2F5EB",
  warning: "#C97A1F",
  warningSoft: "#FBEEDC",
  danger: "#D34B41",
  dangerSoft: "#FBE7E4",
  shadow: "0 1px 2px rgba(20,20,25,0.04), 0 8px 24px -12px rgba(20,20,25,0.12)",
};

const DARK = {
  bg: "#101115",
  surface: "#181A1F",
  surfaceAlt: "#1F2127",
  ink: "#EDEDEF",
  muted: "#9497A1",
  faint: "#5A5D66",
  border: "#2A2C33",
  primary: "#7C97F0",
  primarySoft: "#1B2440",
  success: "#4FCB93",
  successSoft: "#173226",
  warning: "#E4A653",
  warningSoft: "#392A11",
  danger: "#EB7A70",
  dangerSoft: "#3A1917",
  shadow: "0 1px 2px rgba(0,0,0,0.3), 0 8px 24px -12px rgba(0,0,0,0.5)",
};

const MONO = 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace';
const SANS =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

/* ----------------------------------------------------------------------- */
/* DATE / TIME HELPERS                                                      */
/* ----------------------------------------------------------------------- */

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const WEEKDAY_FULL = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const MONTH_LABELS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function pad(n) {
  return String(n).padStart(2, "0");
}
function dateKey(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function parseDateKey(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function daysInMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate();
}
function timeToMinutes(t) {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
function fmtDuration(totalMinutes) {
  if (totalMinutes === null || totalMinutes === undefined) return "––";
  const sign = totalMinutes < 0 ? "-" : "";
  const abs = Math.abs(Math.round(totalMinutes));
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  if (h === 0) return `${sign}${m}m`;
  return `${sign}${h}h ${pad(m)}m`;
}
function fmtClock(t) {
  if (!t) return "––:––";
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  let hh = h % 12;
  if (hh === 0) hh = 12;
  return `${hh}:${pad(m)} ${period}`;
}
function nowTimeString() {
  const now = new Date();
  return `${pad(now.getHours())}:${pad(now.getMinutes())}`;
}
function jsDow(d) {
  return d.getDay();
}
function computeWorked(timeIn, timeOut, breakMinutes) {
  if (!timeIn || !timeOut) return null;
  let start = timeToMinutes(timeIn);
  let end = timeToMinutes(timeOut);
  // Only treat time out as "next day" if it's strictly earlier than time in.
  // Equal time in/out on the same date means zero worked minutes, not 24 hours.
  if (end < start) end += 24 * 60;
  const worked = end - start - (breakMinutes || 0);
  return Math.max(0, worked);
}
function fmtMonthDay(key) {
  const d = parseDateKey(key);
  return `${MONTH_LABELS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

/* ----------------------------------------------------------------------- */
/* DATA MODEL                                                               */
/* ----------------------------------------------------------------------- */

const STORAGE_KEY = "punch-app-data-v1";

const DEFAULT_DATA = {
  settings: { requiredMinutes: 480, breakMinutes: 60 },
  schedule: {
    0: { isDayOff: true },
    1: { isDayOff: false, start: "08:00", end: "17:00" },
    2: { isDayOff: false, start: "08:00", end: "17:00" },
    3: { isDayOff: false, start: "08:00", end: "17:00" },
    4: { isDayOff: false, start: "08:00", end: "17:00" },
    5: { isDayOff: false, start: "08:00", end: "17:00" },
    6: { isDayOff: true },
  },
  overrides: {},
  attendance: {},
  workLogs: {},
};

function mergeWithDefaults(saved) {
  if (!saved) return DEFAULT_DATA;
  return {
    settings: { ...DEFAULT_DATA.settings, ...(saved.settings || {}) },
    schedule: { ...DEFAULT_DATA.schedule, ...(saved.schedule || {}) },
    overrides: saved.overrides || {},
    attendance: saved.attendance || {},
    workLogs: saved.workLogs || {},
  };
}

function getScheduleFor(data, key) {
  const ov = data.overrides[key];
  if (ov) {
    return {
      isDayOff: !!ov.isDayOff,
      start: ov.start,
      end: ov.end,
      breakMinutes: ov.breakMinutes ?? data.settings.breakMinutes,
      isOverride: true,
      note: ov.note,
    };
  }
  const d = parseDateKey(key);
  const s = data.schedule[jsDow(d)] || { isDayOff: true };
  return {
    isDayOff: !!s.isDayOff,
    start: s.start,
    end: s.end,
    breakMinutes: data.settings.breakMinutes,
    isOverride: false,
  };
}

function getCellInfo(data, key, todayKey) {
  const sched = getScheduleFor(data, key);
  const att = data.attendance[key];
  const hasLog = !!data.workLogs[key];

  if (att && att.timeIn && att.timeOut) {
    return {
      type: "completed",
      timeIn: att.timeIn,
      timeOut: att.timeOut,
      overtime: att.overtimeMinutes || 0,
      worked: att.workedMinutes || 0,
      hasLog,
    };
  }
  if (att && att.timeIn && !att.timeOut) {
    if (key === todayKey) return { type: "in_progress", timeIn: att.timeIn };
    return { type: "missing_timeout", timeIn: att.timeIn };
  }
  if (sched.isDayOff) return { type: "off", note: sched.note };
  return { type: "scheduled", start: sched.start, end: sched.end };
}

function getCutoffRange(year, monthIndex, cutoff) {
  if (cutoff === 1) {
    return { start: new Date(year, monthIndex, 1), end: new Date(year, monthIndex, 15) };
  }
  const last = daysInMonth(year, monthIndex);
  return { start: new Date(year, monthIndex, 16), end: new Date(year, monthIndex, last) };
}

function summarizeCutoff(data, year, monthIndex, cutoff) {
  const { start, end } = getCutoffRange(year, monthIndex, cutoff);
  let workingDays = 0,
    daysOff = 0,
    daysWorked = 0,
    totalMinutes = 0,
    overtimeMinutes = 0,
    requiredMinutes = 0;
  const records = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const key = dateKey(d);
    const sched = getScheduleFor(data, key);
    if (sched.isDayOff) daysOff++;
    else {
      workingDays++;
      requiredMinutes += data.settings.requiredMinutes;
    }
    const att = data.attendance[key];
    if (att && att.timeIn && att.timeOut) {
      daysWorked++;
      totalMinutes += att.workedMinutes || 0;
      overtimeMinutes += att.overtimeMinutes || 0;
      records.push({ key, ...att });
    } else if (att && att.timeIn) {
      records.push({ key, ...att, incomplete: true });
    }
  }
  records.sort((a, b) => (a.key < b.key ? 1 : -1));
  return {
    workingDays,
    daysOff,
    daysWorked,
    totalMinutes,
    overtimeMinutes,
    requiredMinutes,
    start,
    end,
    records,
  };
}

/* ----------------------------------------------------------------------- */
/* SMALL UI PRIMITIVES                                                      */
/* ----------------------------------------------------------------------- */

function StatusDot({ color }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: 7,
        height: 7,
        borderRadius: 999,
        background: color,
      }}
    />
  );
}

function Pill({ children, bg, fg, style }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "3px 9px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: 0.2,
        background: bg,
        color: fg,
        ...style,
      }}
    >
      {children}
    </span>
  );
}

function BigButton({ children, onClick, bg, fg, disabled, style }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: "100%",
        background: disabled ? "#9AA0AC" : bg,
        color: fg,
        fontWeight: 700,
        fontSize: 15,
        letterSpacing: 0.2,
        padding: "15px 20px",
        borderRadius: 16,
        border: "none",
        opacity: disabled ? 0.6 : 1,
        cursor: disabled ? "default" : "pointer",
        transition: "transform 0.08s ease, opacity 0.15s ease",
        ...style,
      }}
      onMouseDown={(e) => {
        if (!disabled) e.currentTarget.style.transform = "scale(0.98)";
      }}
      onMouseUp={(e) => {
        e.currentTarget.style.transform = "scale(1)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "scale(1)";
      }}
    >
      {children}
    </button>
  );
}

/* ----------------------------------------------------------------------- */
/* MAIN APP                                                                 */
/* ----------------------------------------------------------------------- */

export default function PunchApp() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(DEFAULT_DATA);
  const [darkMode, setDarkMode] = useState(false);
  const [tab, setTab] = useState("calendar");
  const [viewDate, setViewDate] = useState(new Date());
  const [sheetKey, setSheetKey] = useState(null); // date details bottom sheet
  const [workLogKey, setWorkLogKey] = useState(null); // work log modal
  const [toast, setToast] = useState(null);
  const [cutoff, setCutoff] = useState(null); // 1 or 2, null = auto
  const [, forceTick] = useState(0);

  const T = darkMode ? DARK : LIGHT;
  const todayKey = dateKey(new Date());

  /* ---- load ---- */
  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get(STORAGE_KEY, false);
        if (res && res.value) {
          setData(mergeWithDefaults(JSON.parse(res.value)));
        }
      } catch (e) {
        // no saved data yet - use defaults
      }
      try {
        const prefs = await window.storage.get(STORAGE_KEY + "-prefs", false);
        if (prefs && prefs.value) {
          const p = JSON.parse(prefs.value);
          if (typeof p.darkMode === "boolean") setDarkMode(p.darkMode);
        }
      } catch (e) {}
      setLoading(false);
    })();
  }, []);

  /* ---- live elapsed-time ticker ---- */
  useEffect(() => {
    const id = setInterval(() => forceTick((n) => n + 1), 30000);
    return () => clearInterval(id);
  }, []);

  /* ---- persistence ---- */
  const persist = useCallback(async (newData) => {
    setData(newData);
    try {
      await window.storage.set(STORAGE_KEY, JSON.stringify(newData), false);
    } catch (e) {
      setToast({ text: "Couldn't save — check your connection and try again.", tone: "danger" });
    }
  }, []);

  const toggleDark = () => {
    const next = !darkMode;
    setDarkMode(next);
    window.storage
      .set(STORAGE_KEY + "-prefs", JSON.stringify({ darkMode: next }), false)
      .catch(() => {});
  };

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  /* ---- attendance actions ---- */
  function recalc(record, breakMinutes, requiredMinutes) {
    const worked = computeWorked(record.timeIn, record.timeOut, breakMinutes);
    const overtime = worked !== null ? Math.max(0, worked - requiredMinutes) : null;
    return { ...record, workedMinutes: worked, overtimeMinutes: overtime };
  }

  const handleTimeIn = (key) => {
    const existing = data.attendance[key];
    if (existing && existing.timeIn) return;
    const timeStr = nowTimeString();
    const rec = { timeIn: timeStr, timeOut: existing?.timeOut || null };
    const sched = getScheduleFor(data, key);
    const final = recalc(rec, sched.breakMinutes, data.settings.requiredMinutes);
    persist({ ...data, attendance: { ...data.attendance, [key]: final } });
    setToast({ text: `Time in recorded — ${fmtClock(timeStr)}`, tone: "success" });
  };

  const handleTimeOut = (key) => {
    const existing = data.attendance[key];
    if (!existing || !existing.timeIn) return;
    const timeStr = nowTimeString();
    const sched = getScheduleFor(data, key);
    const final = recalc({ ...existing, timeOut: timeStr }, sched.breakMinutes, data.settings.requiredMinutes);
    persist({ ...data, attendance: { ...data.attendance, [key]: final } });
    setToast({ text: `Time out recorded — ${fmtClock(timeStr)}`, tone: "success" });
    setSheetKey(null);
    setWorkLogKey(key);
  };

  const handleManualEdit = (key, timeIn, timeOut) => {
    const sched = getScheduleFor(data, key);
    const final = recalc({ timeIn: timeIn || null, timeOut: timeOut || null }, sched.breakMinutes, data.settings.requiredMinutes);
    persist({ ...data, attendance: { ...data.attendance, [key]: final } });
    setToast({ text: "Record updated", tone: "success" });
  };

  const handleSetOverride = (key, override) => {
    const newOverrides = { ...data.overrides };
    if (override === null) delete newOverrides[key];
    else newOverrides[key] = override;
    const nextData = { ...data, overrides: newOverrides };
    let newAttendance = data.attendance;
    if (data.attendance[key]) {
      const sched = getScheduleFor(nextData, key);
      newAttendance = {
        ...data.attendance,
        [key]: recalc(data.attendance[key], sched.breakMinutes, data.settings.requiredMinutes),
      };
    }
    persist({ ...nextData, attendance: newAttendance });
    setToast({ text: override ? "Schedule set for this date" : "Reset to default schedule", tone: "success" });
  };

  const handleSaveWorkLog = (key, log) => {
    persist({ ...data, workLogs: { ...data.workLogs, [key]: log } });
    setToast({ text: "Work log saved", tone: "success" });
    setWorkLogKey(null);
  };

  const handleSaveSettings = (settings, schedule) => {
    // recalc all attendance with new required/break minutes
    const newAttendance = {};
    Object.keys(data.attendance).forEach((key) => {
      const rec = data.attendance[key];
      const ov = data.overrides[key];
      const bm = ov?.breakMinutes ?? settings.breakMinutes;
      newAttendance[key] = recalc(rec, bm, settings.requiredMinutes);
    });
    persist({ ...data, settings, schedule, attendance: newAttendance });
    setToast({ text: "Schedule updated", tone: "success" });
  };

  /* ---- missing timeout lookup ---- */
  const missingKey = Object.keys(data.attendance)
    .filter((k) => k < todayKey && data.attendance[k].timeIn && !data.attendance[k].timeOut)
    .sort()
    .pop();

  const todayAtt = data.attendance[todayKey];
  const clockedIn = !!(todayAtt && todayAtt.timeIn && !todayAtt.timeOut);

  if (loading) {
    return (
      <div
        style={{
          minHeight: 520,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: T.bg,
          fontFamily: SANS,
          color: T.muted,
          borderRadius: 20,
        }}
      >
        Loading your data…
      </div>
    );
  }

  return (
    <div
      className="punch-root"
      style={{
        background: T.bg,
        fontFamily: SANS,
        color: T.ink,
        minHeight: 640,
        maxWidth: 440,
        width: "100%",
        margin: "0 auto",
        borderRadius: 28,
        overflow: "hidden",
        position: "relative",
        boxShadow: T.shadow,
        border: `1px solid ${T.border}`,
      }}
    >
      <style>{`
        * { box-sizing: border-box; }
        input[type=time]::-webkit-calendar-picker-indicator { filter: ${darkMode ? "invert(1)" : "none"}; }
        @keyframes slideUp { from { transform: translateY(24px); opacity:0; } to { transform: translateY(0); opacity:1; } }
        @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
        @keyframes pulseDot { 0%,100% { opacity:1; } 50% { opacity:0.35; } }
        .punch-scroll::-webkit-scrollbar { width: 0; height: 0; }
      `}</style>

      {/* ---------------- HEADER ---------------- */}
      <div
        style={{
          padding: "18px 20px 14px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: `1px solid ${T.border}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontFamily: MONO, fontWeight: 800, fontSize: 19, letterSpacing: -0.5 }}>
            Punch
          </span>
          <Pill
            bg={clockedIn ? T.warningSoft : T.successSoft}
            fg={clockedIn ? T.warning : T.success}
          >
            <StatusDot color={clockedIn ? T.warning : T.success} />
            {clockedIn ? "Clocked in" : "Clocked out"}
          </Pill>
        </div>
        <button
          onClick={toggleDark}
          aria-label="Toggle dark mode"
          style={{
            border: "none",
            background: T.surfaceAlt,
            width: 34,
            height: 34,
            borderRadius: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: T.muted,
            cursor: "pointer",
          }}
        >
          {darkMode ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>

      {/* ---------------- MISSING TIMEOUT BANNER ---------------- */}
      {missingKey && tab !== "settings" && (
        <button
          onClick={() => setSheetKey(missingKey)}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 20px",
            background: T.dangerSoft,
            color: T.danger,
            border: "none",
            borderBottom: `1px solid ${T.border}`,
            fontSize: 12.5,
            fontWeight: 600,
            textAlign: "left",
            cursor: "pointer",
          }}
        >
          <AlertTriangle size={15} />
          Missing time out on {fmtMonthDay(missingKey)} — tap to fix
        </button>
      )}

      {/* ---------------- BODY ---------------- */}
      <div
        className="punch-scroll"
        style={{ padding: "16px 18px 100px", minHeight: 480, maxHeight: 620, overflowY: "auto" }}
      >
        {tab === "calendar" && (
          <CalendarTab
            T={T}
            data={data}
            viewDate={viewDate}
            setViewDate={setViewDate}
            todayKey={todayKey}
            onSelectDate={(k) => setSheetKey(k)}
          />
        )}
        {tab === "today" && (
          <TodayTab
            T={T}
            data={data}
            todayKey={todayKey}
            onTimeIn={() => handleTimeIn(todayKey)}
            onTimeOut={() => handleTimeOut(todayKey)}
            onViewLog={() => setWorkLogKey(todayKey)}
            onOpenSheet={() => setSheetKey(todayKey)}
          />
        )}
        {tab === "records" && (
          <RecordsTab
            T={T}
            data={data}
            viewDate={viewDate}
            setViewDate={setViewDate}
            cutoff={cutoff}
            setCutoff={setCutoff}
            todayKey={todayKey}
            onSelectDate={(k) => setSheetKey(k)}
          />
        )}
        {tab === "settings" && (
          <SettingsTab T={T} data={data} onSave={handleSaveSettings} />
        )}
      </div>

      {/* ---------------- FAB (calendar tab only) ---------------- */}
      {tab === "calendar" && (
        <button
          onClick={() => (clockedIn ? handleTimeOut(todayKey) : handleTimeIn(todayKey))}
          style={{
            position: "absolute",
            right: 18,
            bottom: 84,
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "12px 18px",
            borderRadius: 999,
            border: "none",
            background: clockedIn ? T.warning : T.primary,
            color: "#fff",
            fontWeight: 700,
            fontSize: 13.5,
            boxShadow: T.shadow,
            cursor: "pointer",
          }}
        >
          <Clock size={15} />
          {clockedIn ? "Clock out" : "Clock in"}
        </button>
      )}

      {/* ---------------- BOTTOM NAV ---------------- */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          background: T.surface,
          borderTop: `1px solid ${T.border}`,
          display: "flex",
          padding: "8px 6px 10px",
        }}
      >
        {[
          { id: "calendar", label: "Calendar", Icon: CalendarIcon },
          { id: "today", label: "Today", Icon: Clock },
          { id: "records", label: "Records", Icon: ListChecks },
          { id: "settings", label: "Settings", Icon: SettingsIcon },
        ].map(({ id, label, Icon }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              onClick={() => setTab(id)}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 3,
                background: "none",
                border: "none",
                padding: "6px 2px",
                cursor: "pointer",
                color: active ? T.primary : T.muted,
              }}
            >
              <Icon size={19} strokeWidth={active ? 2.4 : 1.9} />
              <span style={{ fontSize: 10.5, fontWeight: active ? 700 : 500 }}>{label}</span>
            </button>
          );
        })}
      </div>

      {/* ---------------- TOAST ---------------- */}
      {toast && (
        <div
          style={{
            position: "absolute",
            top: 12,
            left: 16,
            right: 16,
            padding: "10px 14px",
            borderRadius: 12,
            background: toast.tone === "danger" ? T.danger : T.ink,
            color: darkMode ? "#101115" : "#fff",
            fontSize: 12.5,
            fontWeight: 600,
            textAlign: "center",
            boxShadow: T.shadow,
            animation: "fadeIn 0.2s ease",
            zIndex: 60,
          }}
        >
          {toast.text}
        </div>
      )}

      {/* ---------------- DATE SHEET ---------------- */}
      {sheetKey && (
        <DateSheet
          T={T}
          data={data}
          dateKeyStr={sheetKey}
          todayKey={todayKey}
          onClose={() => setSheetKey(null)}
          onTimeIn={() => handleTimeIn(sheetKey)}
          onTimeOut={() => handleTimeOut(sheetKey)}
          onManualEdit={(ti, to) => handleManualEdit(sheetKey, ti, to)}
          onSetOverride={(override) => handleSetOverride(sheetKey, override)}
          onOpenWorkLog={() => {
            setWorkLogKey(sheetKey);
          }}
        />
      )}

      {/* ---------------- WORK LOG MODAL ---------------- */}
      {workLogKey && (
        <WorkLogModal
          T={T}
          data={data}
          dateKeyStr={workLogKey}
          onClose={() => setWorkLogKey(null)}
          onSave={(log) => handleSaveWorkLog(workLogKey, log)}
        />
      )}
    </div>
  );
}

/* ----------------------------------------------------------------------- */
/* CALENDAR TAB                                                             */
/* ----------------------------------------------------------------------- */

function CalendarTab({ T, data, viewDate, setViewDate, todayKey, onSelectDate }) {
  const year = viewDate.getFullYear();
  const monthIndex = viewDate.getMonth();
  const first = new Date(year, monthIndex, 1);
  const offset = (jsDow(first) + 6) % 7; // Monday-start offset
  const totalDays = daysInMonth(year, monthIndex);
  const cells = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= totalDays; d++) cells.push(d);

  const goto = (delta) => setViewDate(new Date(year, monthIndex + delta, 1));

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <NavBtn T={T} onClick={() => goto(-1)}>
            <ChevronLeft size={17} />
          </NavBtn>
          <NavBtn T={T} onClick={() => goto(1)}>
            <ChevronRight size={17} />
          </NavBtn>
        </div>
        <div style={{ fontWeight: 800, fontSize: 16, letterSpacing: -0.2 }}>
          {MONTH_LABELS[monthIndex]} {year}
        </div>
        <button
          onClick={() => setViewDate(new Date())}
          style={{
            border: `1px solid ${T.border}`,
            background: T.surface,
            color: T.primary,
            fontSize: 11.5,
            fontWeight: 700,
            padding: "6px 10px",
            borderRadius: 9,
            cursor: "pointer",
          }}
        >
          Today
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 6 }}>
        {WEEKDAY_LABELS.map((w) => (
          <div key={w} style={{ textAlign: "center", fontSize: 10.5, fontWeight: 700, color: T.faint, letterSpacing: 0.5 }}>
            {w}
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
        {cells.map((d, i) => {
          if (d === null) return <div key={"b" + i} />;
          const dateObj = new Date(year, monthIndex, d);
          const key = dateKey(dateObj);
          const info = getCellInfo(data, key, todayKey);
          const isToday = key === todayKey;
          return (
            <DayCell key={key} T={T} day={d} info={info} isToday={isToday} onClick={() => onSelectDate(key)} />
          );
        })}
      </div>

      <Legend T={T} />
    </div>
  );
}

function NavBtn({ T, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 28,
        height: 28,
        borderRadius: 8,
        border: `1px solid ${T.border}`,
        background: T.surface,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: T.ink,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function DayCell({ T, day, info, isToday, onClick }) {
  let barColor = "transparent";
  let content = null;

  if (info.type === "off") {
    barColor = T.faint;
    content = (
      <span style={{ fontSize: 8.5, fontWeight: 700, color: T.faint, letterSpacing: 0.4 }}>OFF</span>
    );
  } else if (info.type === "scheduled") {
    barColor = T.primary;
    content = info.start ? (
      <span style={{ fontFamily: MONO, fontSize: 8, color: T.muted }}>
        {info.start.replace(":00", "")}
      </span>
    ) : null;
  } else if (info.type === "in_progress") {
    barColor = T.warning;
    content = (
      <span style={{ display: "flex", alignItems: "center", gap: 2 }}>
        <span style={{ animation: "pulseDot 1.4s infinite" }}>
          <StatusDot color={T.warning} />
        </span>
      </span>
    );
  } else if (info.type === "missing_timeout") {
    barColor = T.danger;
    content = <AlertTriangle size={10} color={T.danger} />;
  } else if (info.type === "completed") {
    barColor = info.overtime > 0 ? T.warning : T.success;
    content = (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", lineHeight: 1.15 }}>
        <span style={{ fontFamily: MONO, fontSize: 8, color: T.muted }}>
          {info.timeIn?.replace(/^0/, "")}
        </span>
        <span style={{ fontFamily: MONO, fontSize: 8, color: T.muted }}>
          {info.timeOut?.replace(/^0/, "")}
        </span>
      </div>
    );
  }

  return (
    <button
      onClick={onClick}
      style={{
        aspectRatio: "1",
        borderRadius: 10,
        border: isToday ? `1.5px solid ${T.primary}` : `1px solid ${T.border}`,
        background: T.surface,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 3,
        padding: 2,
        cursor: "pointer",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: barColor }} />
      <span style={{ fontSize: 11.5, fontWeight: isToday ? 800 : 600, color: isToday ? T.primary : T.ink }}>
        {day}
      </span>
      {content}
      {info.hasLog && (
        <ClipboardList size={7} color={T.muted} style={{ position: "absolute", top: 3, right: 3 }} />
      )}
    </button>
  );
}

function Legend({ T }) {
  const items = [
    { c: T.primary, l: "Scheduled" },
    { c: T.success, l: "Completed" },
    { c: T.warning, l: "Overtime / in progress" },
    { c: T.danger, l: "Missing time out" },
    { c: T.faint, l: "Day off" },
  ];
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 16, padding: "10px 12px", background: T.surfaceAlt, borderRadius: 12 }}>
      {items.map((it) => (
        <div key={it.l} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10.5, color: T.muted, fontWeight: 600 }}>
          <span style={{ width: 6, height: 6, borderRadius: 999, background: it.c }} />
          {it.l}
        </div>
      ))}
    </div>
  );
}

/* ----------------------------------------------------------------------- */
/* TODAY TAB                                                                */
/* ----------------------------------------------------------------------- */

function TodayTab({ T, data, todayKey, onTimeIn, onTimeOut, onViewLog, onOpenSheet }) {
  const d = new Date();
  const sched = getScheduleFor(data, todayKey);
  const att = data.attendance[todayKey];
  const hasLog = !!data.workLogs[todayKey];

  let elapsed = null;
  if (att && att.timeIn && !att.timeOut) {
    const startMin = timeToMinutes(att.timeIn);
    const nowMin = timeToMinutes(nowTimeString());
    let diff = nowMin - startMin;
    if (diff < 0) diff += 24 * 60;
    elapsed = diff;
  }

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 12.5, color: T.muted, fontWeight: 600 }}>{WEEKDAY_FULL[jsDow(d)]}</div>
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.4 }}>{fmtMonthDay(todayKey)}</div>
      </div>

      <div
        style={{
          background: T.surface,
          border: `1px solid ${T.border}`,
          borderRadius: 20,
          padding: 20,
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, letterSpacing: 0.4, marginBottom: 4 }}>
          {sched.isDayOff ? "DAY OFF" : "TODAY'S SCHEDULE"}
        </div>
        {!sched.isDayOff && (
          <div style={{ fontFamily: MONO, fontSize: 15, fontWeight: 600, color: T.ink, marginBottom: 18 }}>
            {fmtClock(sched.start)} – {fmtClock(sched.end)}
          </div>
        )}
        {sched.isDayOff && <div style={{ height: 14 }} />}

        {!att?.timeIn && (
          <>
            <div style={{ fontSize: 13, color: T.muted, marginBottom: 16 }}>You haven't clocked in yet.</div>
            <BigButton bg={T.primary} fg="#fff" onClick={onTimeIn}>
              Time in
            </BigButton>
          </>
        )}

        {att?.timeIn && !att?.timeOut && (
          <>
            <div style={{ fontFamily: MONO, fontSize: 36, fontWeight: 800, letterSpacing: -1, marginBottom: 2 }}>
              {fmtClock(att.timeIn)}
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.warning, letterSpacing: 0.3, marginBottom: 14 }}>
              TIME IN · CLOCKED IN
            </div>
            <div style={{ display: "flex", justifyContent: "space-around", marginBottom: 18 }}>
              <Stat T={T} label="Elapsed" value={fmtDuration(elapsed)} />
              <Stat T={T} label="Scheduled end" value={sched.end ? fmtClock(sched.end) : "––"} />
            </div>
            <BigButton bg={T.warning} fg="#fff" onClick={onTimeOut}>
              Time out
            </BigButton>
          </>
        )}

        {att?.timeIn && att?.timeOut && (
          <>
            <div style={{ display: "flex", justifyContent: "space-around", marginBottom: 14 }}>
              <Stat T={T} label="Time in" value={fmtClock(att.timeIn)} mono />
              <Stat T={T} label="Time out" value={fmtClock(att.timeOut)} mono />
            </div>
            <div style={{ display: "flex", justifyContent: "space-around", marginBottom: 18 }}>
              <Stat T={T} label="Worked" value={fmtDuration(att.workedMinutes)} big />
              <Stat
                T={T}
                label="Overtime"
                value={fmtDuration(att.overtimeMinutes)}
                big
                color={att.overtimeMinutes > 0 ? T.warning : T.success}
              />
            </div>
            <BigButton bg={T.surfaceAlt} fg={T.ink} onClick={onViewLog} style={{ border: `1px solid ${T.border}` }}>
              {hasLog ? "View work log" : "Add work log"}
            </BigButton>
          </>
        )}
      </div>

      <button
        onClick={onOpenSheet}
        style={{
          marginTop: 12,
          width: "100%",
          background: "none",
          border: "none",
          color: T.primary,
          fontSize: 12.5,
          fontWeight: 700,
          padding: 8,
          cursor: "pointer",
        }}
      >
        Open full details →
      </button>
    </div>
  );
}

function Stat({ T, label, value, mono, big, color }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, color: T.muted, letterSpacing: 0.3, marginBottom: 3 }}>
        {label.toUpperCase()}
      </div>
      <div
        style={{
          fontFamily: mono || big ? MONO : SANS,
          fontSize: big ? 19 : 14,
          fontWeight: 800,
          color: color || T.ink,
        }}
      >
        {value}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------------- */
/* RECORDS TAB                                                              */
/* ----------------------------------------------------------------------- */

function RecordsTab({ T, data, viewDate, setViewDate, cutoff, setCutoff, todayKey, onSelectDate }) {
  const year = viewDate.getFullYear();
  const monthIndex = viewDate.getMonth();
  const todayDay = parseInt(todayKey.split("-")[2], 10);
  const activeCutoff = cutoff || (todayDay <= 15 ? 1 : 2);

  const summary = summarizeCutoff(data, year, monthIndex, activeCutoff);
  const goto = (delta) => setViewDate(new Date(year, monthIndex + delta, 1));

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <NavBtn T={T} onClick={() => goto(-1)}>
            <ChevronLeft size={17} />
          </NavBtn>
          <NavBtn T={T} onClick={() => goto(1)}>
            <ChevronRight size={17} />
          </NavBtn>
        </div>
        <div style={{ fontWeight: 800, fontSize: 15 }}>
          {MONTH_LABELS[monthIndex]} {year}
        </div>
        <div style={{ width: 62 }} />
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 14, background: T.surfaceAlt, borderRadius: 12, padding: 4 }}>
        {[1, 2].map((c) => (
          <button
            key={c}
            onClick={() => setCutoff(c)}
            style={{
              flex: 1,
              padding: "8px 6px",
              borderRadius: 9,
              border: "none",
              fontSize: 11.5,
              fontWeight: 700,
              cursor: "pointer",
              background: activeCutoff === c ? T.surface : "transparent",
              color: activeCutoff === c ? T.primary : T.muted,
              boxShadow: activeCutoff === c ? T.shadow : "none",
            }}
          >
            {c === 1 ? "1 – 15" : `16 – ${daysInMonth(year, monthIndex)}`}
          </button>
        ))}
      </div>

      {/* Summary card */}
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 18, padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, letterSpacing: 0.3, marginBottom: 10 }}>
          {MONTH_LABELS[monthIndex].toUpperCase()} {activeCutoff === 1 ? "1–15" : `16–${daysInMonth(year, monthIndex)}`}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <SummaryStat T={T} label="Working days" value={summary.workingDays} />
          <SummaryStat T={T} label="Days worked" value={summary.daysWorked} />
          <SummaryStat T={T} label="Days off" value={summary.daysOff} />
          <SummaryStat T={T} label="Total hours" value={fmtDuration(summary.totalMinutes)} />
          <SummaryStat T={T} label="Required hours" value={fmtDuration(summary.requiredMinutes)} />
          <SummaryStat
            T={T}
            label="Overtime"
            value={fmtDuration(summary.overtimeMinutes)}
            color={summary.overtimeMinutes > 0 ? T.warning : T.success}
          />
        </div>
      </div>

      {/* Records list */}
      {summary.records.length === 0 && (
        <div style={{ textAlign: "center", color: T.muted, fontSize: 12.5, padding: "30px 0" }}>
          No attendance recorded for this cutoff yet.
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {summary.records.map((r) => {
          const d = parseDateKey(r.key);
          const log = data.workLogs[r.key];
          return (
            <button
              key={r.key}
              onClick={() => onSelectDate(r.key)}
              style={{
                textAlign: "left",
                background: T.surface,
                border: `1px solid ${T.border}`,
                borderRadius: 14,
                padding: "12px 14px",
                cursor: "pointer",
                position: "relative",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: 3,
                  background: r.incomplete ? T.danger : r.overtimeMinutes > 0 ? T.warning : T.success,
                }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <span style={{ fontWeight: 700, fontSize: 13 }}>
                  {MONTH_LABELS[d.getMonth()].slice(0, 3)} {d.getDate()} · {WEEKDAY_FULL[jsDow(d)].slice(0, 3)}
                </span>
                {!r.incomplete && (
                  <Pill bg={r.overtimeMinutes > 0 ? T.warningSoft : T.successSoft} fg={r.overtimeMinutes > 0 ? T.warning : T.success}>
                    {r.overtimeMinutes > 0 ? `+${fmtDuration(r.overtimeMinutes)}` : "On time"}
                  </Pill>
                )}
                {r.incomplete && (
                  <Pill bg={T.dangerSoft} fg={T.danger}>
                    No time out
                  </Pill>
                )}
              </div>
              <div style={{ fontFamily: MONO, fontSize: 12, color: T.muted, marginBottom: log ? 6 : 0 }}>
                {fmtClock(r.timeIn)} → {fmtClock(r.timeOut)} {!r.incomplete && `· ${fmtDuration(r.workedMinutes)}`}
              </div>
              {log && (
                <div style={{ fontSize: 11.5, color: T.faint, display: "flex", alignItems: "center", gap: 4 }}>
                  <ClipboardList size={11} />
                  {log.tasks?.length ? `${log.tasks.length} task${log.tasks.length > 1 ? "s" : ""} logged` : "Work log added"}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SummaryStat({ T, label, value, color }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, color: T.muted, letterSpacing: 0.3, marginBottom: 2 }}>
        {label.toUpperCase()}
      </div>
      <div style={{ fontFamily: MONO, fontSize: 17, fontWeight: 800, color: color || T.ink }}>{value}</div>
    </div>
  );
}

/* ----------------------------------------------------------------------- */
/* DATE DETAILS BOTTOM SHEET                                                */
/* ----------------------------------------------------------------------- */

function DateSheet({ T, data, dateKeyStr, todayKey, onClose, onTimeIn, onTimeOut, onManualEdit, onSetOverride, onOpenWorkLog }) {
  const d = parseDateKey(dateKeyStr);
  const sched = getScheduleFor(data, dateKeyStr);
  const att = data.attendance[dateKeyStr] || {};
  const hasLog = !!data.workLogs[dateKeyStr];
  const [editMode, setEditMode] = useState(false);
  const [ti, setTi] = useState(att.timeIn || "");
  const [to, setTo] = useState(att.timeOut || "");

  const [schedEditMode, setSchedEditMode] = useState(false);
  const [schedOff, setSchedOff] = useState(sched.isDayOff);
  const [schedStart, setSchedStart] = useState(sched.start || "08:00");
  const [schedEnd, setSchedEnd] = useState(sched.end || "17:00");

  useEffect(() => {
    setTi(att.timeIn || "");
    setTo(att.timeOut || "");
    setEditMode(false);
    setSchedEditMode(false);
    setSchedOff(sched.isDayOff);
    setSchedStart(sched.start || "08:00");
    setSchedEnd(sched.end || "17:00");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateKeyStr]);

  const worked = computeWorked(ti, to, sched.breakMinutes);
  const overtime = worked !== null ? Math.max(0, worked - data.settings.requiredMinutes) : null;

  const isMissingTimeout = att.timeIn && !att.timeOut && dateKeyStr !== todayKey;

  return (
    <div
      style={{ position: "absolute", inset: 0, zIndex: 50, display: "flex", alignItems: "flex-end" }}
      onClick={onClose}
    >
      <div style={{ position: "absolute", inset: 0, background: "rgba(10,10,14,0.45)", animation: "fadeIn 0.15s ease" }} />
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative",
          width: "100%",
          maxHeight: "88%",
          overflowY: "auto",
          background: T.surface,
          borderRadius: "22px 22px 0 0",
          padding: "10px 20px 24px",
          animation: "slideUp 0.2s ease",
        }}
      >
        <div style={{ width: 36, height: 4, borderRadius: 99, background: T.border, margin: "4px auto 14px" }} />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: T.muted }}>{WEEKDAY_FULL[jsDow(d)]}</div>
            <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: -0.3 }}>{fmtMonthDay(dateKeyStr)}</div>
          </div>
          <button onClick={onClose} style={{ border: "none", background: T.surfaceAlt, borderRadius: 9, width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", color: T.muted, cursor: "pointer" }}>
            <X size={15} />
          </button>
        </div>

        {!schedEditMode ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ fontSize: 12.5, color: T.muted }}>
              {sched.isDayOff ? (
                <span>Day off{sched.note ? ` — ${sched.note}` : ""}</span>
              ) : (
                <span>
                  Scheduled {fmtClock(sched.start)} – {fmtClock(sched.end)}
                </span>
              )}
              {sched.isOverride && (
                <span style={{ color: T.primary, fontWeight: 700 }}> · custom for this date</span>
              )}
            </div>
            <button
              onClick={() => setSchedEditMode(true)}
              style={{ border: "none", background: "none", color: T.primary, display: "flex", alignItems: "center", gap: 4, fontSize: 11.5, fontWeight: 700, cursor: "pointer", padding: "2px 0 2px 8px", flexShrink: 0 }}
            >
              <Pencil size={11} /> Edit
            </button>
          </div>
        ) : (
          <div style={{ background: T.primarySoft, borderRadius: 14, padding: 14, marginBottom: 16 }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: T.primary, letterSpacing: 0.3, marginBottom: 10 }}>
              SCHEDULE FOR THIS DATE
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, fontWeight: 600, color: T.ink, marginBottom: schedOff ? 0 : 10, cursor: "pointer" }}>
              <input type="checkbox" checked={schedOff} onChange={(e) => setSchedOff(e.target.checked)} style={{ width: 15, height: 15 }} />
              Day off
            </label>
            {!schedOff && (
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <input
                  type="time"
                  value={schedStart}
                  onChange={(e) => setSchedStart(e.target.value)}
                  style={{ flex: 1, padding: "8px 9px", borderRadius: 9, border: `1px solid ${T.border}`, background: T.surface, color: T.ink, fontFamily: MONO, fontSize: 12.5 }}
                />
                <input
                  type="time"
                  value={schedEnd}
                  onChange={(e) => setSchedEnd(e.target.value)}
                  style={{ flex: 1, padding: "8px 9px", borderRadius: 9, border: `1px solid ${T.border}`, background: T.surface, color: T.ink, fontFamily: MONO, fontSize: 12.5 }}
                />
              </div>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <BigButton
                bg={T.primary}
                fg="#fff"
                style={{ padding: "9px 12px", fontSize: 12.5, borderRadius: 10 }}
                onClick={() => {
                  onSetOverride({ isDayOff: schedOff, start: schedOff ? undefined : schedStart, end: schedOff ? undefined : schedEnd });
                  setSchedEditMode(false);
                }}
              >
                Save
              </BigButton>
              <BigButton
                bg={T.surface}
                fg={T.ink}
                style={{ padding: "9px 12px", fontSize: 12.5, borderRadius: 10, border: `1px solid ${T.border}` }}
                onClick={() => setSchedEditMode(false)}
              >
                Cancel
              </BigButton>
              {sched.isOverride && (
                <BigButton
                  bg="transparent"
                  fg={T.danger}
                  style={{ padding: "9px 12px", fontSize: 12.5, borderRadius: 10 }}
                  onClick={() => {
                    onSetOverride(null);
                    setSchedEditMode(false);
                  }}
                >
                  Reset
                </BigButton>
              )}
            </div>
          </div>
        )}

        {isMissingTimeout && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: T.dangerSoft, color: T.danger, borderRadius: 12, padding: "10px 12px", fontSize: 12, fontWeight: 600, marginBottom: 14 }}>
            <AlertTriangle size={15} /> Missing time out for this day
          </div>
        )}

        {!editMode ? (
          <div style={{ display: "flex", justifyContent: "space-around", background: T.surfaceAlt, borderRadius: 16, padding: "16px 10px", marginBottom: 16 }}>
            <Stat T={T} label="Time in" value={fmtClock(att.timeIn)} mono />
            <Stat T={T} label="Time out" value={fmtClock(att.timeOut)} mono />
            <Stat T={T} label="Worked" value={fmtDuration(att.workedMinutes)} />
            <Stat T={T} label="Overtime" value={fmtDuration(att.overtimeMinutes)} color={att.overtimeMinutes > 0 ? T.warning : undefined} />
          </div>
        ) : (
          <div style={{ background: T.surfaceAlt, borderRadius: 16, padding: 16, marginBottom: 16 }}>
            <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 10.5, fontWeight: 700, color: T.muted }}>TIME IN</label>
                <input
                  type="time"
                  value={ti}
                  onChange={(e) => setTi(e.target.value)}
                  style={{ width: "100%", marginTop: 4, padding: "9px 10px", borderRadius: 10, border: `1px solid ${T.border}`, background: T.surface, color: T.ink, fontFamily: MONO, fontSize: 13 }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 10.5, fontWeight: 700, color: T.muted }}>TIME OUT</label>
                <input
                  type="time"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  style={{ width: "100%", marginTop: 4, padding: "9px 10px", borderRadius: 10, border: `1px solid ${T.border}`, background: T.surface, color: T.ink, fontFamily: MONO, fontSize: 13 }}
                />
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: T.muted, marginBottom: 14 }}>
              <span>
                Worked: <strong style={{ color: T.ink }}>{fmtDuration(worked)}</strong>
              </span>
              <span>
                Overtime: <strong style={{ color: overtime > 0 ? T.warning : T.ink }}>{fmtDuration(overtime)}</strong>
              </span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <BigButton
                bg={T.primary}
                fg="#fff"
                style={{ padding: "11px 14px", fontSize: 13, borderRadius: 12 }}
                onClick={() => {
                  onManualEdit(ti || null, to || null);
                  setEditMode(false);
                }}
              >
                Save
              </BigButton>
              <BigButton
                bg={T.surface}
                fg={T.ink}
                style={{ padding: "11px 14px", fontSize: 13, borderRadius: 12, border: `1px solid ${T.border}` }}
                onClick={() => {
                  setTi(att.timeIn || "");
                  setTo(att.timeOut || "");
                  setEditMode(false);
                }}
              >
                Cancel
              </BigButton>
            </div>
          </div>
        )}

        {!editMode && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {!att.timeIn && (
              <BigButton bg={T.primary} fg="#fff" onClick={onTimeIn}>
                Time in
              </BigButton>
            )}
            {att.timeIn && !att.timeOut && (
              <BigButton bg={T.warning} fg="#fff" onClick={onTimeOut}>
                {dateKeyStr === todayKey ? "Time out" : "Add time out"}
              </BigButton>
            )}
            {att.timeIn && att.timeOut && (
              <BigButton bg={T.surfaceAlt} fg={T.ink} style={{ border: `1px solid ${T.border}` }} onClick={() => setEditMode(true)}>
                <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                  <Pencil size={13} /> Edit record
                </span>
              </BigButton>
            )}
            {att.timeIn && !att.timeOut && dateKeyStr !== todayKey && (
              <button onClick={() => setEditMode(true)} style={{ background: "none", border: "none", color: T.primary, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                Enter times manually
              </button>
            )}
            <BigButton bg="transparent" fg={T.primary} style={{ border: `1px solid ${T.border}` }} onClick={onOpenWorkLog}>
              <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <ClipboardList size={14} /> {hasLog ? "View work log" : "Work log"}
              </span>
            </BigButton>
          </div>
        )}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------------- */
/* WORK LOG MODAL                                                           */
/* ----------------------------------------------------------------------- */

function WorkLogModal({ T, data, dateKeyStr, onClose, onSave }) {
  const existing = data.workLogs[dateKeyStr];
  const [summary, setSummary] = useState(existing?.summary || "");
  const [notes, setNotes] = useState(existing?.notes || "");
  const [tasks, setTasks] = useState(existing?.tasks || []);
  const [newTask, setNewTask] = useState("");
  const inputRef = useRef(null);

  const addTask = () => {
    const text = newTask.trim();
    if (!text) return;
    setTasks((t) => [...t, { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, text, completed: true }]);
    setNewTask("");
    inputRef.current?.focus();
  };

  const toggleTask = (id) => setTasks((t) => t.map((x) => (x.id === id ? { ...x, completed: !x.completed } : x)));
  const removeTask = (id) => setTasks((t) => t.filter((x) => x.id !== id));

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 55, display: "flex", alignItems: "flex-end" }} onClick={onClose}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(10,10,14,0.5)", animation: "fadeIn 0.15s ease" }} />
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative",
          width: "100%",
          maxHeight: "92%",
          overflowY: "auto",
          background: T.surface,
          borderRadius: "22px 22px 0 0",
          padding: "10px 20px 22px",
          animation: "slideUp 0.2s ease",
        }}
      >
        <div style={{ width: 36, height: 4, borderRadius: 99, background: T.border, margin: "4px auto 14px" }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <div style={{ fontSize: 17, fontWeight: 800 }}>What did you do today?</div>
          <button onClick={onClose} style={{ border: "none", background: T.surfaceAlt, borderRadius: 9, width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", color: T.muted, cursor: "pointer" }}>
            <X size={15} />
          </button>
        </div>
        <div style={{ fontSize: 12, color: T.muted, marginBottom: 16 }}>{fmtMonthDay(dateKeyStr)}</div>

        <label style={{ fontSize: 10.5, fontWeight: 700, color: T.muted, letterSpacing: 0.3 }}>WORK SUMMARY</label>
        <textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="Write your work summary..."
          rows={3}
          style={{
            width: "100%",
            marginTop: 6,
            marginBottom: 16,
            padding: 12,
            borderRadius: 12,
            border: `1px solid ${T.border}`,
            background: T.surfaceAlt,
            color: T.ink,
            fontFamily: SANS,
            fontSize: 13.5,
            resize: "vertical",
          }}
        />

        <label style={{ fontSize: 10.5, fontWeight: 700, color: T.muted, letterSpacing: 0.3 }}>TASKS</label>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8, marginBottom: 10 }}>
          {tasks.map((t) => (
            <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 8, background: T.surfaceAlt, borderRadius: 10, padding: "8px 10px" }}>
              <button
                onClick={() => toggleTask(t.id)}
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 5,
                  border: `1.5px solid ${t.completed ? T.success : T.faint}`,
                  background: t.completed ? T.success : "transparent",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                {t.completed && <Check size={12} color="#fff" />}
              </button>
              <span
                style={{
                  flex: 1,
                  fontSize: 13,
                  color: t.completed ? T.ink : T.muted,
                  textDecoration: t.completed ? "none" : "line-through",
                }}
              >
                {t.text}
              </span>
              <button onClick={() => removeTask(t.id)} style={{ border: "none", background: "none", color: T.faint, cursor: "pointer", display: "flex" }}>
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <input
            ref={inputRef}
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addTask()}
            placeholder="Add task"
            style={{ flex: 1, padding: "10px 12px", borderRadius: 10, border: `1px solid ${T.border}`, background: T.surface, color: T.ink, fontSize: 13 }}
          />
          <button
            onClick={addTask}
            style={{ width: 40, borderRadius: 10, border: "none", background: T.primarySoft, color: T.primary, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
          >
            <Plus size={16} />
          </button>
        </div>

        <label style={{ fontSize: 10.5, fontWeight: 700, color: T.muted, letterSpacing: 0.3 }}>NOTES (OPTIONAL)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Additional notes..."
          rows={2}
          style={{
            width: "100%",
            marginTop: 6,
            marginBottom: 18,
            padding: 12,
            borderRadius: 12,
            border: `1px solid ${T.border}`,
            background: T.surfaceAlt,
            color: T.ink,
            fontFamily: SANS,
            fontSize: 13.5,
            resize: "vertical",
          }}
        />

        <div style={{ display: "flex", gap: 8 }}>
          <BigButton bg={T.surfaceAlt} fg={T.ink} style={{ border: `1px solid ${T.border}` }} onClick={onClose}>
            Skip for now
          </BigButton>
          <BigButton bg={T.primary} fg="#fff" onClick={() => onSave({ summary, notes, tasks })}>
            Save work log
          </BigButton>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------------- */
/* SETTINGS TAB                                                             */
/* ----------------------------------------------------------------------- */

function SettingsTab({ T, data, onSave }) {
  const [requiredHours, setRequiredHours] = useState(data.settings.requiredMinutes / 60);
  const [breakMinutes, setBreakMinutes] = useState(data.settings.breakMinutes);
  const [schedule, setSchedule] = useState(data.schedule);
  const [dirty, setDirty] = useState(false);

  const dayOrder = [1, 2, 3, 4, 5, 6, 0]; // Monday-first
  const dayLabel = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  const updateDay = (dow, patch) => {
    setSchedule((s) => ({ ...s, [dow]: { ...s[dow], ...patch } }));
    setDirty(true);
  };

  const save = () => {
    onSave({ requiredMinutes: Math.round(requiredHours * 60), breakMinutes: Number(breakMinutes) }, schedule);
    setDirty(false);
  };

  return (
    <div>
      <SectionLabel T={T}>Daily requirement</SectionLabel>
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, padding: 16, marginBottom: 20, display: "flex", gap: 14 }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 10.5, fontWeight: 700, color: T.muted }}>REQUIRED HOURS</label>
          <input
            type="number"
            min="1"
            max="24"
            step="0.5"
            value={requiredHours}
            onChange={(e) => {
              setRequiredHours(e.target.value);
              setDirty(true);
            }}
            style={{ width: "100%", marginTop: 5, padding: "9px 10px", borderRadius: 10, border: `1px solid ${T.border}`, background: T.surfaceAlt, color: T.ink, fontFamily: MONO, fontSize: 14 }}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 10.5, fontWeight: 700, color: T.muted }}>BREAK (MIN)</label>
          <input
            type="number"
            min="0"
            max="240"
            step="5"
            value={breakMinutes}
            onChange={(e) => {
              setBreakMinutes(e.target.value);
              setDirty(true);
            }}
            style={{ width: "100%", marginTop: 5, padding: "9px 10px", borderRadius: 10, border: `1px solid ${T.border}`, background: T.surfaceAlt, color: T.ink, fontFamily: MONO, fontSize: 14 }}
          />
        </div>
      </div>

      <SectionLabel T={T}>Work schedule</SectionLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
        {dayOrder.map((dow) => {
          const s = schedule[dow] || {};
          return (
            <div key={dow} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: "12px 14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: s.isDayOff ? 0 : 10 }}>
                <span style={{ fontWeight: 700, fontSize: 13.5 }}>{dayLabel[dow]}</span>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: T.muted, fontWeight: 600, cursor: "pointer" }}>
                  Day off
                  <input
                    type="checkbox"
                    checked={!!s.isDayOff}
                    onChange={(e) => updateDay(dow, { isDayOff: e.target.checked })}
                    style={{ width: 15, height: 15 }}
                  />
                </label>
              </div>
              {!s.isDayOff && (
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    type="time"
                    value={s.start || "08:00"}
                    onChange={(e) => updateDay(dow, { start: e.target.value })}
                    style={{ flex: 1, padding: "8px 9px", borderRadius: 9, border: `1px solid ${T.border}`, background: T.surfaceAlt, color: T.ink, fontFamily: MONO, fontSize: 12.5 }}
                  />
                  <input
                    type="time"
                    value={s.end || "17:00"}
                    onChange={(e) => updateDay(dow, { end: e.target.value })}
                    style={{ flex: 1, padding: "8px 9px", borderRadius: 9, border: `1px solid ${T.border}`, background: T.surfaceAlt, color: T.ink, fontFamily: MONO, fontSize: 12.5 }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <BigButton bg={dirty ? T.primary : T.surfaceAlt} fg={dirty ? "#fff" : T.muted} disabled={!dirty} onClick={save}>
        Save schedule
      </BigButton>

      <SectionLabel T={T} style={{ marginTop: 24 }}>
        Privacy
      </SectionLabel>
      <div style={{ background: T.surfaceAlt, borderRadius: 14, padding: 14, fontSize: 12, color: T.muted, lineHeight: 1.5 }}>
        Your attendance records, schedule, and work logs are stored locally in this browser's
        on-device database. Nothing is sent to a server. Data survives closing the app, restarting
        your device, and reopening it later — but it's tied to this browser on this device, so it
        won't show up if you open the app elsewhere unless you add sync or export yourself.
      </div>
    </div>
  );
}

function SectionLabel({ T, children, style }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 800, color: T.muted, letterSpacing: 0.5, marginBottom: 10, ...style }}>
      {children.toUpperCase ? children.toUpperCase() : children}
    </div>
  );
}
