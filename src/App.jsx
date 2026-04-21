import { useState, useEffect } from "react";
import {
  ComposedChart, Bar, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";

const LOGS_KEY = "wco-logs-v2";
const SETTINGS_KEY = "wco-settings-v1";

const getTodayStr = () => new Date().toISOString().split("T")[0];
const getMonthStr = () => new Date().toISOString().slice(0, 7);

const formatDate = (dateStr) => {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("ja-JP", { month: "short", day: "numeric", weekday: "short" });
};

const formatYen = (v) => `¥${Math.round(v).toLocaleString("ja-JP")}`;

const conditionEmoji = (v) => {
  if (v >= 9) return "🌟";
  if (v >= 7) return "😊";
  if (v >= 5) return "😐";
  if (v >= 3) return "😔";
  return "😫";
};

const conditionLabel = (v) => {
  if (v >= 9) return "最高";
  if (v >= 7) return "良好";
  if (v >= 5) return "普通";
  if (v >= 3) return "疲れ";
  return "消耗";
};

const conditionColor = (v) => {
  if (v >= 8) return "#34C759";
  if (v >= 6) return "#30B0C7";
  if (v >= 4) return "#FF9500";
  return "#FF3B30";
};

// ── Input helpers ──
const parseYen = (s) => parseInt(String(s).replace(/[,¥]/g, ""), 10) || 0;

export default function App() {
  const [logs, setLogs] = useState([]);
  const [settings, setSettings] = useState({ monthlyTarget: null, hourlyRate: null });
  const [tab, setTab] = useState("log");

  // Form state
  const [hours, setHours] = useState(6);
  const [earnings, setEarnings] = useState("");
  const [condition, setCondition] = useState(null);
  const [notes, setNotes] = useState("");
  const [savedAnim, setSavedAnim] = useState(false);
  const [ready, setReady] = useState(false);

  // Settings edit state
  const [targetInput, setTargetInput] = useState("");
  const [rateInput, setRateInput] = useState("");
  const [settingsSaved, setSettingsSaved] = useState(false);

  const today = getTodayStr();
  const currentMonth = getMonthStr();
  const todayLog = logs.find((l) => l.date === today);

  useEffect(() => {
    try {
      const savedLogs = localStorage.getItem(LOGS_KEY);
      const savedSettings = localStorage.getItem(SETTINGS_KEY);
      if (savedLogs) {
        const data = JSON.parse(savedLogs);
        setLogs(data);
        const tl = data.find((l) => l.date === today);
        if (tl) {
          setHours(tl.hours);
          setEarnings(tl.earnings ? String(tl.earnings) : "");
          setCondition(tl.condition);
          setNotes(tl.notes || "");
        }
      }
      if (savedSettings) {
        const s = JSON.parse(savedSettings);
        setSettings(s);
        if (s.monthlyTarget) setTargetInput(String(s.monthlyTarget));
        if (s.hourlyRate) setRateInput(String(s.hourlyRate));
      }
    } catch (_) {}
    setReady(true);
  }, []);

  // Auto-fill earnings from hourly rate
  useEffect(() => {
    if (settings.hourlyRate && !todayLog) {
      setEarnings(String(Math.round(settings.hourlyRate * hours)));
    }
  }, [hours, settings.hourlyRate]);

  const persistLogs = (next) => {
    try { localStorage.setItem(LOGS_KEY, JSON.stringify(next)); } catch (_) {}
  };

  const persistSettings = (next) => {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(next)); } catch (_) {}
  };

  const saveLog = () => {
    if (condition === null) return;
    const earningsNum = parseYen(earnings);
    const entry = { date: today, hours, earnings: earningsNum, condition, notes };
    const rest = logs.filter((l) => l.date !== today);
    const next = [...rest, entry].sort((a, b) => a.date.localeCompare(b.date));
    setLogs(next);
    persistLogs(next);
    setSavedAnim(true);
    setTimeout(() => setSavedAnim(false), 1800);
  };

  const deleteLog = (date) => {
    const next = logs.filter((l) => l.date !== date);
    setLogs(next);
    persistLogs(next);
    if (date === today) {
      setHours(6);
      setEarnings(settings.hourlyRate ? String(settings.hourlyRate * 6) : "");
      setCondition(null);
      setNotes("");
    }
  };

  const saveSettings = () => {
    const next = {
      monthlyTarget: targetInput ? parseYen(targetInput) : null,
      hourlyRate: rateInput ? parseYen(rateInput) : null,
    };
    setSettings(next);
    persistSettings(next);
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 1800);
  };

  // ── Analytics ──
  const logsWithData = logs.filter((l) => l.earnings > 0 && l.hours > 0);

  const buildOptimization = () => {
    if (logsWithData.length < 5) return null;

    const withEff = logsWithData.map((l) => ({
      ...l,
      hourlyRate: l.earnings / l.hours,
      efficiency: (l.earnings / l.hours) * (l.condition / 10),
    }));

    const sorted = [...withEff].sort((a, b) => b.efficiency - a.efficiency);
    const topN = Math.max(1, Math.round(sorted.length * 0.35));
    const topDays = sorted.slice(0, topN);

    const optimalHours = +(topDays.reduce((s, d) => s + d.hours, 0) / topDays.length).toFixed(1);
    const optimalHourlyRate = Math.round(topDays.reduce((s, d) => s + d.hourlyRate, 0) / topDays.length);
    const optimalDailyEarnings = Math.round(optimalHours * optimalHourlyRate);

    let plan = null;
    if (settings.monthlyTarget && optimalDailyEarnings > 0) {
      const daysNeeded = Math.ceil(settings.monthlyTarget / optimalDailyEarnings);
      const daysPerWeek = Math.ceil(daysNeeded / 4.3);
      plan = { daysNeeded, daysPerWeek };
    }

    return { optimalHours, optimalHourlyRate, optimalDailyEarnings, plan };
  };

  const getMonthProgress = () => {
    const monthLogs = logs.filter((l) => l.date.startsWith(currentMonth));
    const totalEarned = monthLogs.reduce((s, l) => s + (l.earnings || 0), 0);
    const totalHours = monthLogs.reduce((s, l) => s + l.hours, 0);
    const days = monthLogs.length;
    const avgDaily = days > 0 ? totalEarned / days : 0;
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysLeft = daysInMonth - now.getDate();
    const projectedTotal = days > 0 ? Math.round(totalEarned + avgDaily * daysLeft * 0.7) : 0;
    return { totalEarned, totalHours, days, avgDaily, daysLeft, projectedTotal };
  };

  const opt = buildOptimization();
  const mp = getMonthProgress();
  const recentLogs = [...logs].slice(-21);

  if (!ready) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#F2F2F7", fontFamily: "'Pretendard JP Variable', sans-serif" }}>
      <div style={{ color: "#8E8E93", fontSize: 14 }}>読み込み中...</div>
    </div>
  );

  const S = {
    bg: "#F2F2F7",
    card: "#FFFFFF",
    primary: "#007AFF",
    primaryDark: "#0062CC",
    success: "#34C759",
    text: "#000000",
    textSub: "#3C3C43",
    textMuted: "#8E8E93",
    textLight: "#C7C7CC",
    border: "#C6C6C8",
    borderSub: "#D1D1D6",
    subtle: "#E5E5EA",
    inputBg: "#F2F2F7",
    shadow: "0 2px 12px rgba(0,0,0,0.08)",
    shadowSm: "0 1px 4px rgba(0,0,0,0.06)",
  };

  return (
    <div style={{ fontFamily: "'Pretendard JP Variable', 'Hiragino Sans', 'Yu Gothic', sans-serif", background: S.bg, minHeight: "100vh", maxWidth: 430, margin: "0 auto", display: "flex", flexDirection: "column" }}>

      {/* Header */}
      <div style={{ padding: "20px 24px 12px", background: S.bg, borderBottom: `1px solid ${S.border}`, position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 11, color: S.textMuted, letterSpacing: "0.08em", marginBottom: 2 }}>SHIFT OPTIMIZER</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: S.text, letterSpacing: "-0.02em" }}>最適シフト設計</div>
          </div>
          {mp.days > 0 && (
            <div style={{ background: S.card, border: `1px solid ${S.borderSub}`, borderRadius: 12, padding: "6px 12px", fontSize: 12, color: S.textSub, textAlign: "right" }}>
              <div style={{ fontWeight: 700, color: S.primary }}>{formatYen(mp.totalEarned)}</div>
              <div style={{ fontSize: 10, color: S.textMuted }}>今月 {mp.days}日</div>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", paddingBottom: 80 }}>

        {/* ── 記録 tab ── */}
        {tab === "log" && (
          <div style={{ padding: "20px 24px" }}>
            <div style={{ background: S.card, borderRadius: 20, padding: 24, boxShadow: S.shadow, marginBottom: 16 }}>
              <div style={{ fontSize: 13, color: S.textMuted, marginBottom: 4 }}>{formatDate(today)}</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: S.text, marginBottom: 24 }}>
                今日の記録 {todayLog ? "✓" : ""}
              </div>

              {/* Hours */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: S.textSub, marginBottom: 12 }}>何時間働きましたか？</div>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <button onClick={() => setHours((h) => Math.max(0, +(h - 0.5).toFixed(1)))} style={{ width: 40, height: 40, borderRadius: "50%", background: S.subtle, border: "none", fontSize: 20, cursor: "pointer", color: S.text, display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
                  <div style={{ flex: 1, textAlign: "center" }}>
                    <span style={{ fontSize: 42, fontWeight: 800, color: S.text, letterSpacing: "-0.03em" }}>{hours}</span>
                    <span style={{ fontSize: 16, color: S.textMuted, marginLeft: 4 }}>時間</span>
                  </div>
                  <button onClick={() => setHours((h) => Math.min(24, +(h + 0.5).toFixed(1)))} style={{ width: 40, height: 40, borderRadius: "50%", background: S.subtle, border: "none", fontSize: 20, cursor: "pointer", color: S.text, display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
                </div>
                <input type="range" min={0} max={16} step={0.5} value={hours} onChange={(e) => setHours(+e.target.value)} style={{ width: "100%", marginTop: 12, accentColor: S.primary }} />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: S.textLight, marginTop: 2 }}>
                  <span>0h</span><span>8h</span><span>16h</span>
                </div>
              </div>

              {/* Earnings */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: S.textSub, marginBottom: 8 }}>
                  今日の収入
                  {settings.hourlyRate && <span style={{ fontSize: 11, color: S.textMuted, fontWeight: 400, marginLeft: 6 }}>（¥{settings.hourlyRate.toLocaleString()}/時 × {hours}h で自動入力）</span>}
                </div>
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 16, color: S.textSub, fontWeight: 600 }}>¥</span>
                  <input
                    type="number"
                    value={earnings}
                    onChange={(e) => setEarnings(e.target.value)}
                    placeholder="例: 8500"
                    style={{ width: "100%", padding: "14px 14px 14px 30px", border: `1.5px solid ${S.borderSub}`, borderRadius: 12, fontSize: 18, fontWeight: 700, color: S.text, background: S.inputBg, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
                  />
                </div>
                {earnings && hours > 0 && (
                  <div style={{ marginTop: 6, fontSize: 12, color: S.primary, fontWeight: 600 }}>
                    → 時給効率 ¥{Math.round(parseYen(earnings) / hours).toLocaleString("ja-JP")}/時間
                  </div>
                )}
              </div>

              {/* Condition */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: S.textSub, marginBottom: 12 }}>今日の体調は？</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
                  {[2, 4, 6, 8, 10].map((v) => (
                    <button key={v} onClick={() => setCondition(v)} style={{ padding: "10px 4px", borderRadius: 14, border: condition === v ? `2px solid ${conditionColor(v)}` : "2px solid transparent", background: condition === v ? conditionColor(v) + "20" : S.subtle, cursor: "pointer", transition: "all 0.15s", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                      <span style={{ fontSize: 20 }}>{conditionEmoji(v)}</span>
                      <span style={{ fontSize: 10, color: condition === v ? conditionColor(v) : S.textMuted, fontWeight: 600 }}>{conditionLabel(v)}</span>
                      <span style={{ fontSize: 10, color: S.textLight }}>{v}/10</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: S.textSub, marginBottom: 8 }}>
                  メモ <span style={{ color: S.textLight, fontWeight: 400 }}>（任意）</span>
                </div>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="シフトや体調のメモ" rows={2} style={{ width: "100%", padding: 12, border: `1.5px solid ${S.borderSub}`, borderRadius: 12, fontSize: 13, color: S.text, background: S.inputBg, resize: "none", outline: "none", boxSizing: "border-box", fontFamily: "inherit" }} />
              </div>

              <button onClick={saveLog} disabled={condition === null} style={{ width: "100%", padding: 16, borderRadius: 14, border: "none", background: condition === null ? S.subtle : (savedAnim ? S.success : S.primary), color: condition === null ? S.textMuted : "#fff", fontSize: 15, fontWeight: 700, cursor: condition === null ? "not-allowed" : "pointer", transition: "background 0.3s" }}>
                {savedAnim ? "✓ 保存しました！" : todayLog ? "記録を更新" : "今日の記録を保存"}
              </button>
            </div>

            {/* Quick stats */}
            {mp.days >= 3 && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                {[
                  { label: "今月収入", value: formatYen(mp.totalEarned) },
                  { label: "今月時間", value: `${mp.totalHours}h` },
                  { label: "平均時給", value: mp.totalHours > 0 ? `¥${Math.round(mp.totalEarned / mp.totalHours).toLocaleString()}` : "—" },
                ].map((s) => (
                  <div key={s.label} style={{ background: S.card, borderRadius: 14, padding: "12px 10px", boxShadow: S.shadowSm, textAlign: "center" }}>
                    <div style={{ fontSize: 10, color: S.textMuted, marginBottom: 4 }}>{s.label}</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: S.text }}>{s.value}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── 履歴 tab ── */}
        {tab === "history" && (
          <div style={{ padding: "20px 24px" }}>
            {recentLogs.length >= 3 && (
              <div style={{ background: S.card, borderRadius: 20, padding: 20, marginBottom: 16, boxShadow: S.shadow }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: S.textSub, marginBottom: 4 }}>収入 & 体調の推移</div>
                <div style={{ fontSize: 11, color: S.textMuted, marginBottom: 16 }}>棒 = 収入 · 線 = 体調</div>
                <ResponsiveContainer width="100%" height={200}>
                  <ComposedChart data={recentLogs} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={S.border} />
                    <XAxis dataKey="date" tickFormatter={(d) => { const dt = new Date(d + "T00:00:00"); return (dt.getMonth() + 1) + "/" + dt.getDate(); }} tick={{ fontSize: 10, fill: S.textMuted }} />
                    <YAxis yAxisId="e" tick={{ fontSize: 10, fill: S.textMuted }} tickFormatter={(v) => v >= 10000 ? `${v / 10000}万` : `${v / 1000}k`} />
                    <YAxis yAxisId="c" orientation="right" domain={[0, 10]} tick={{ fontSize: 10, fill: S.primary }} />
                    <Tooltip
                      contentStyle={{ borderRadius: 10, border: `1px solid ${S.borderSub}`, fontSize: 12 }}
                      formatter={(v, n) => n === "condition" ? [`${v}/10`, "体調"] : [formatYen(v), "収入"]}
                    />
                    <Bar yAxisId="e" dataKey="earnings" fill="#D1E4FF" radius={[4, 4, 0, 0]} name="earnings" />
                    <Line yAxisId="c" type="monotone" dataKey="condition" stroke={S.primary} strokeWidth={2} dot={{ r: 3, fill: S.primary }} name="condition" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Log list */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[...logs].reverse().map((log) => (
                <div key={log.date} style={{ background: S.card, borderRadius: 16, padding: "14px 16px", boxShadow: S.shadowSm, display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: conditionColor(log.condition) + "20", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>
                    {conditionEmoji(log.condition)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: S.text }}>{formatDate(log.date)}</div>
                    <div style={{ fontSize: 12, color: S.textMuted, marginTop: 2 }}>
                      {log.hours}h勤務 ·{" "}
                      {log.earnings > 0 ? (
                        <span style={{ color: S.primary, fontWeight: 600 }}>{formatYen(log.earnings)}</span>
                      ) : "収入未入力"}
                      {log.earnings > 0 && log.hours > 0 && (
                        <span style={{ color: S.textLight }}> · ¥{Math.round(log.earnings / log.hours).toLocaleString()}/h</span>
                      )}
                    </div>
                    {log.notes && <div style={{ fontSize: 11, color: S.textLight, marginTop: 2 }}>{log.notes}</div>}
                  </div>
                  <button onClick={() => deleteLog(log.date)} style={{ background: "none", border: "none", color: S.textLight, cursor: "pointer", fontSize: 16, padding: 4 }}>✕</button>
                </div>
              ))}
              {logs.length === 0 && (
                <div style={{ textAlign: "center", padding: "60px 20px", color: S.textLight, fontSize: 14 }}>
                  まだ記録がありません。<br />今日の記録から始めましょう！
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── 最適化 tab ── */}
        {tab === "optimize" && (
          <div style={{ padding: "20px 24px" }}>

            {/* Settings card */}
            <div style={{ background: S.card, borderRadius: 20, padding: 20, marginBottom: 16, boxShadow: S.shadow }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: S.textSub, marginBottom: 16 }}>⚙️ 目標設定</div>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, color: S.textMuted, marginBottom: 6 }}>月収目標</div>
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 14, color: S.textSub, fontWeight: 600 }}>¥</span>
                  <input type="number" value={targetInput} onChange={(e) => setTargetInput(e.target.value)} placeholder="例: 150000" style={{ width: "100%", padding: "12px 12px 12px 28px", border: `1.5px solid ${S.borderSub}`, borderRadius: 10, fontSize: 15, fontWeight: 600, color: S.text, background: S.inputBg, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }} />
                </div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, color: S.textMuted, marginBottom: 6 }}>時給（設定すると収入を自動計算）</div>
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 14, color: S.textSub, fontWeight: 600 }}>¥</span>
                  <input type="number" value={rateInput} onChange={(e) => setRateInput(e.target.value)} placeholder="例: 1200" style={{ width: "100%", padding: "12px 12px 12px 28px", border: `1.5px solid ${S.borderSub}`, borderRadius: 10, fontSize: 15, fontWeight: 600, color: S.text, background: S.inputBg, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }} />
                </div>
              </div>
              <button onClick={saveSettings} style={{ width: "100%", padding: 13, borderRadius: 12, border: "none", background: settingsSaved ? S.success : S.primary, color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", transition: "background 0.3s" }}>
                {settingsSaved ? "✓ 保存しました" : "設定を保存"}
              </button>
            </div>

            {/* Not enough data */}
            {logsWithData.length < 5 && (
              <div style={{ background: S.card, borderRadius: 20, padding: "32px 24px", textAlign: "center", boxShadow: S.shadow, marginBottom: 16 }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📈</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: S.text, marginBottom: 8 }}>データを収集中</div>
                <div style={{ fontSize: 13, color: S.textMuted, lineHeight: 1.7, marginBottom: 16 }}>
                  収入を入力した日が<br />あと <span style={{ color: S.primary, fontWeight: 700 }}>{Math.max(0, 5 - logsWithData.length)}日</span> 分あれば分析できます
                </div>
                <div style={{ background: "#EBF3FF", borderRadius: 12, padding: "12px 16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 12, color: S.textMuted }}>データ収集進捗</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: S.primary }}>{logsWithData.length} / 5日</span>
                  </div>
                  <div style={{ marginTop: 8, background: S.border, borderRadius: 6, height: 6, overflow: "hidden" }}>
                    <div style={{ width: `${Math.min(100, (logsWithData.length / 5) * 100)}%`, height: "100%", background: S.primary, borderRadius: 6, transition: "width 0.4s" }} />
                  </div>
                </div>
              </div>
            )}

            {/* Optimization result */}
            {opt && (
              <>
                {/* Optimal pattern */}
                <div style={{ background: `linear-gradient(135deg, ${S.primary}, ${S.primaryDark})`, borderRadius: 20, padding: "24px", marginBottom: 16, boxShadow: "0 8px 24px rgba(0,122,255,0.28)" }}>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", marginBottom: 4 }}>データから導いた最適パターン</div>
                  <div style={{ fontSize: 14, color: "rgba(255,255,255,0.9)", marginBottom: 20 }}>体調×効率が最も高かった日の平均</div>
                  <div style={{ display: "flex", gap: 24 }}>
                    <div>
                      <div style={{ fontSize: 42, fontWeight: 900, color: "#fff", letterSpacing: "-0.03em" }}>{opt.optimalHours}</div>
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>最適な時間/日</div>
                    </div>
                    <div style={{ borderLeft: "1px solid rgba(255,255,255,0.2)", paddingLeft: 24 }}>
                      <div style={{ fontSize: 42, fontWeight: 900, color: "#fff", letterSpacing: "-0.03em" }}>¥{opt.optimalHourlyRate.toLocaleString()}</div>
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>期待時給</div>
                    </div>
                  </div>
                  <div style={{ marginTop: 16, padding: "10px 14px", background: "rgba(255,255,255,0.12)", borderRadius: 10, fontSize: 13, color: "rgba(255,255,255,0.9)" }}>
                    1日あたりの期待収入 <strong style={{ color: "#fff", fontSize: 15 }}>{formatYen(opt.optimalDailyEarnings)}</strong>
                  </div>
                </div>

                {/* Monthly shift plan */}
                {opt.plan && settings.monthlyTarget && (
                  <div style={{ background: S.card, borderRadius: 20, padding: 20, marginBottom: 16, boxShadow: S.shadow }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: S.textSub, marginBottom: 4 }}>月収 {formatYen(settings.monthlyTarget)} 達成プラン</div>
                    <div style={{ fontSize: 11, color: S.textMuted, marginBottom: 20 }}>最適パターンで働いた場合の計算</div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                      <div style={{ background: "#EBF3FF", borderRadius: 14, padding: 16, textAlign: "center" }}>
                        <div style={{ fontSize: 36, fontWeight: 900, color: S.primary }}>{opt.plan.daysPerWeek}</div>
                        <div style={{ fontSize: 12, color: S.textSub, fontWeight: 600 }}>日/週</div>
                      </div>
                      <div style={{ background: "#EBF3FF", borderRadius: 14, padding: 16, textAlign: "center" }}>
                        <div style={{ fontSize: 36, fontWeight: 900, color: S.primary }}>{opt.optimalHours}</div>
                        <div style={{ fontSize: 12, color: S.textSub, fontWeight: 600 }}>時間/日</div>
                      </div>
                    </div>

                    <div style={{ background: S.subtle, borderRadius: 12, padding: "12px 14px", fontSize: 13, color: S.textSub }}>
                      月 <strong style={{ color: S.text }}>{opt.plan.daysNeeded}日</strong> 勤務で
                      <strong style={{ color: S.primary }}> {formatYen(settings.monthlyTarget)} </strong>
                      達成の見込み
                    </div>
                  </div>
                )}

                {!settings.monthlyTarget && (
                  <div style={{ background: S.card, borderRadius: 16, padding: 16, marginBottom: 16, boxShadow: S.shadowSm, border: `1px dashed ${S.borderSub}`, textAlign: "center", fontSize: 13, color: S.textMuted }}>
                    月収目標を設定するとシフトプランが表示されます
                  </div>
                )}

                {/* This month progress */}
                {mp.days >= 1 && settings.monthlyTarget && (
                  <div style={{ background: S.card, borderRadius: 20, padding: 20, marginBottom: 16, boxShadow: S.shadow }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: S.textSub, marginBottom: 16 }}>今月の進捗</div>

                    {/* Progress bar */}
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: S.textMuted, marginBottom: 6 }}>
                        <span>{formatYen(mp.totalEarned)}</span>
                        <span>目標 {formatYen(settings.monthlyTarget)}</span>
                      </div>
                      <div style={{ background: S.border, borderRadius: 8, height: 10, overflow: "hidden" }}>
                        <div style={{ width: `${Math.min(100, (mp.totalEarned / settings.monthlyTarget) * 100)}%`, height: "100%", background: mp.totalEarned >= settings.monthlyTarget ? S.success : S.primary, borderRadius: 8, transition: "width 0.4s" }} />
                      </div>
                      <div style={{ fontSize: 12, color: S.primary, fontWeight: 600, marginTop: 4 }}>
                        {Math.round((mp.totalEarned / settings.monthlyTarget) * 100)}% 達成
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <div style={{ background: S.subtle, borderRadius: 12, padding: 12 }}>
                        <div style={{ fontSize: 11, color: S.textMuted, marginBottom: 2 }}>残り目標</div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: S.text }}>
                          {mp.totalEarned >= settings.monthlyTarget ? "達成！🎉" : formatYen(settings.monthlyTarget - mp.totalEarned)}
                        </div>
                      </div>
                      <div style={{ background: S.subtle, borderRadius: 12, padding: 12 }}>
                        <div style={{ fontSize: 11, color: S.textMuted, marginBottom: 2 }}>残り日数</div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: S.text }}>{mp.daysLeft}日</div>
                      </div>
                    </div>

                    {mp.totalEarned < settings.monthlyTarget && mp.avgDaily > 0 && (
                      <div style={{ marginTop: 12, padding: "10px 14px", background: "#EBF3FF", borderRadius: 12, fontSize: 13, color: S.textSub }}>
                        あと <strong style={{ color: S.text }}>{Math.ceil((settings.monthlyTarget - mp.totalEarned) / mp.avgDaily)}日</strong> 働けば達成できます
                      </div>
                    )}
                  </div>
                )}

                {/* Tips */}
                <div style={{ background: "#EBF3FF", borderRadius: 20, padding: 20, border: "1px solid #B8D4FF" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#0062CC", marginBottom: 10 }}>📌 活用のヒント</div>
                  <div style={{ fontSize: 13, color: "#1C3A6E", lineHeight: 1.9 }}>
                    • 毎日記録するほどおすすめ精度が上がります<br />
                    • 体調が悪い日は無理せず早上がりも◎<br />
                    • 最適時間より長く働くと時給効率が下がる傾向があります
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Bottom Nav */}
      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 430, background: "rgba(244,242,238,0.95)", backdropFilter: "blur(12px)", borderTop: `1px solid ${S.border}`, display: "flex", padding: "10px 0 20px", zIndex: 20 }}>
        {[
          { id: "log", icon: "✏️", label: "記録" },
          { id: "history", icon: "📊", label: "履歴" },
          { id: "optimize", icon: "🎯", label: "最適化" },
        ].map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ flex: 1, background: "none", border: "none", cursor: "pointer", padding: "6px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, opacity: tab === t.id ? 1 : 0.4, transition: "opacity 0.15s" }}>
            <span style={{ fontSize: 22 }}>{t.icon}</span>
            <span style={{ fontSize: 10, fontWeight: tab === t.id ? 700 : 400, color: tab === t.id ? S.primary : S.textMuted }}>{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
