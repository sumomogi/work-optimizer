import { useState, useEffect } from "react";
import {
  AreaChart, Area, BarChart, Bar, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine
} from "recharts";

const STORAGE_KEY = "wco-logs-v1";

const getTodayStr = () => new Date().toISOString().split("T")[0];

const formatDate = (dateStr) => {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("ja-JP", { month: "short", day: "numeric", weekday: "short" });
};

const getWeekKey = (dateStr) => {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const mon = new Date(d.setDate(diff));
  return mon.toISOString().split("T")[0];
};

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
  if (v >= 8) return "#4CAF82";
  if (v >= 6) return "#A8C97F";
  if (v >= 4) return "#F2A65A";
  return "#E07070";
};

export default function App() {
  const [logs, setLogs] = useState([]);
  const [tab, setTab] = useState("log");
  const [hours, setHours] = useState(4);
  const [condition, setCondition] = useState(null);
  const [notes, setNotes] = useState("");
  const [savedAnim, setSavedAnim] = useState(false);
  const [ready, setReady] = useState(false);

  const today = getTodayStr();
  const todayLog = logs.find((l) => l.date === today);

  useEffect(() => {
    try {
      const value = localStorage.getItem(STORAGE_KEY);
      if (value) {
        const data = JSON.parse(value);
        setLogs(data);
        const tl = data.find((l) => l.date === today);
        if (tl) {
          setHours(tl.hours);
          setCondition(tl.condition);
          setNotes(tl.notes || "");
        }
      }
    } catch (_) {}
    setReady(true);
  }, []);

  const persist = (newLogs) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newLogs));
    } catch (_) {}
  };

  const saveLog = () => {
    if (condition === null) return;
    const entry = { date: today, hours, condition, notes };
    const rest = logs.filter((l) => l.date !== today);
    const next = [...rest, entry].sort((a, b) => a.date.localeCompare(b.date));
    setLogs(next);
    persist(next);
    setSavedAnim(true);
    setTimeout(() => setSavedAnim(false), 1800);
  };

  const deleteLog = (date) => {
    const next = logs.filter((l) => l.date !== date);
    setLogs(next);
    persist(next);
    if (date === today) {
      setHours(4);
      setCondition(null);
      setNotes("");
    }
  };

  const buildInsights = () => {
    if (logs.length < 5) return null;
    const wMap = {};
    logs.forEach(({ date, hours: h, condition: c }) => {
      const wk = getWeekKey(date);
      if (!wMap[wk]) wMap[wk] = { hours: 0, conds: [], days: 0 };
      wMap[wk].hours += h;
      wMap[wk].conds.push(c);
      wMap[wk].days++;
    });
    const weeks = Object.entries(wMap)
      .filter(([, w]) => w.days >= 2)
      .map(([wk, w]) => ({
        week: wk,
        totalHours: +w.hours.toFixed(1),
        avgCond: +(w.conds.reduce((a, b) => a + b, 0) / w.conds.length).toFixed(1),
        days: w.days,
      }))
      .sort((a, b) => a.week.localeCompare(b.week));
    if (weeks.length < 2) return null;

    const sorted = [...weeks].sort((a, b) => b.avgCond - a.avgCond);
    const topN = Math.max(1, Math.round(sorted.length * 0.35));
    const topWeeks = sorted.slice(0, topN);
    const optimalHours = +(topWeeks.reduce((a, b) => a + b.totalHours, 0) / topWeeks.length).toFixed(1);
    const optimalCond = +(topWeeks.reduce((a, b) => a + b.avgCond, 0) / topWeeks.length).toFixed(1);

    return { weeks, optimalHours, optimalCond, topWeeks };
  };

  const insights = buildInsights();
  const recentLogs = [...logs].slice(-21);
  const avgCondition = logs.length
    ? +(logs.reduce((a, b) => a + b.condition, 0) / logs.length).toFixed(1)
    : null;
  const avgHours = logs.length
    ? +(logs.reduce((a, b) => a + b.hours, 0) / logs.length).toFixed(1)
    : null;

  if (!ready) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#FAF9F6", fontFamily: "'Pretendard JP Variable', 'Hiragino Sans', sans-serif" }}>
      <div style={{ color: "#999", fontSize: 14 }}>読み込み中...</div>
    </div>
  );

  return (
    <div style={{
      fontFamily: "'Pretendard JP Variable', 'Hiragino Sans', 'Yu Gothic', sans-serif",
      background: "#FAF9F6",
      minHeight: "100vh",
      maxWidth: 430,
      margin: "0 auto",
      display: "flex",
      flexDirection: "column",
      position: "relative",
    }}>
      {/* Header */}
      <div style={{
        padding: "20px 24px 12px",
        background: "#FAF9F6",
        borderBottom: "1px solid #F0EDE8",
        position: "sticky",
        top: 0,
        zIndex: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 11, color: "#B0A898", letterSpacing: "0.08em", marginBottom: 2 }}>WORK OPTIMIZER</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#1A1614", letterSpacing: "-0.02em" }}>最適な労働時間</div>
          </div>
          {logs.length > 0 && (
            <div style={{
              background: "#fff",
              border: "1px solid #EDE9E3",
              borderRadius: 12,
              padding: "6px 12px",
              fontSize: 12,
              color: "#6B6157",
            }}>
              {logs.length}日の記録
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", paddingBottom: 80 }}>

        {tab === "log" && (
          <div style={{ padding: "20px 24px" }}>
            <div style={{
              background: "#fff",
              borderRadius: 20,
              padding: "24px",
              boxShadow: "0 2px 16px rgba(0,0,0,0.05)",
              marginBottom: 16,
            }}>
              <div style={{ fontSize: 13, color: "#B0A898", marginBottom: 4 }}>
                {formatDate(today)}
              </div>
              <div style={{ fontSize: 16, fontWeight: 600, color: "#1A1614", marginBottom: 24 }}>
                今日の記録 {todayLog ? "✓" : ""}
              </div>

              <div style={{ marginBottom: 28 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#6B6157", marginBottom: 12 }}>
                  今日は何時間働きましたか？
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <button
                    onClick={() => setHours(h => Math.max(0, +(h - 0.5).toFixed(1)))}
                    style={{
                      width: 40, height: 40, borderRadius: "50%",
                      background: "#F5F2EE", border: "none",
                      fontSize: 20, cursor: "pointer", color: "#1A1614",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                  >−</button>
                  <div style={{ flex: 1, textAlign: "center" }}>
                    <span style={{ fontSize: 42, fontWeight: 800, color: "#1A1614", letterSpacing: "-0.03em" }}>{hours}</span>
                    <span style={{ fontSize: 16, color: "#B0A898", marginLeft: 4 }}>時間</span>
                  </div>
                  <button
                    onClick={() => setHours(h => Math.min(24, +(h + 0.5).toFixed(1)))}
                    style={{
                      width: 40, height: 40, borderRadius: "50%",
                      background: "#F5F2EE", border: "none",
                      fontSize: 20, cursor: "pointer", color: "#1A1614",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                  >+</button>
                </div>
                <input
                  type="range" min={0} max={16} step={0.5}
                  value={hours}
                  onChange={e => setHours(+e.target.value)}
                  style={{ width: "100%", marginTop: 12, accentColor: "#D4845A" }}
                />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#C8BFB5", marginTop: 2 }}>
                  <span>0時間</span><span>8時間</span><span>16時間</span>
                </div>
              </div>

              <div style={{ marginBottom: 28 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#6B6157", marginBottom: 12 }}>
                  今日の体調は？
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
                  {[2, 4, 6, 8, 10].map(v => (
                    <button
                      key={v}
                      onClick={() => setCondition(v)}
                      style={{
                        padding: "10px 4px",
                        borderRadius: 14,
                        border: condition === v ? "2px solid " + conditionColor(v) : "2px solid transparent",
                        background: condition === v ? conditionColor(v) + "20" : "#F5F2EE",
                        cursor: "pointer",
                        transition: "all 0.15s",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <span style={{ fontSize: 20 }}>{conditionEmoji(v)}</span>
                      <span style={{ fontSize: 10, color: condition === v ? conditionColor(v) : "#B0A898", fontWeight: 600 }}>
                        {conditionLabel(v)}
                      </span>
                      <span style={{ fontSize: 10, color: "#D0C8BE" }}>{v}/10</span>
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#6B6157", marginBottom: 8 }}>
                  メモ <span style={{ color: "#C8BFB5", fontWeight: 400 }}>（任意）</span>
                </div>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="特に辛かった部位や状況を書いておきましょう"
                  rows={2}
                  style={{
                    width: "100%", padding: "12px",
                    border: "1.5px solid #EDE9E3",
                    borderRadius: 12, fontSize: 13, color: "#1A1614",
                    background: "#FAFAF8", resize: "none",
                    outline: "none", boxSizing: "border-box",
                    fontFamily: "inherit",
                  }}
                />
              </div>

              <button
                onClick={saveLog}
                disabled={condition === null}
                style={{
                  width: "100%",
                  padding: "16px",
                  borderRadius: 14,
                  border: "none",
                  background: condition === null ? "#EDE9E3" : (savedAnim ? "#4CAF82" : "#D4845A"),
                  color: condition === null ? "#B0A898" : "#fff",
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: condition === null ? "not-allowed" : "pointer",
                  transition: "background 0.3s",
                  letterSpacing: "-0.01em",
                }}
              >
                {savedAnim ? "✓ 保存しました！" : todayLog ? "記録を更新" : "今日の記録を保存"}
              </button>
            </div>

            {logs.length >= 3 && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div style={{ background: "#fff", borderRadius: 16, padding: 16, boxShadow: "0 2px 10px rgba(0,0,0,0.04)" }}>
                  <div style={{ fontSize: 11, color: "#B0A898", marginBottom: 4 }}>平均労働時間/日</div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: "#1A1614" }}>{avgHours}<span style={{ fontSize: 13, fontWeight: 400, color: "#B0A898" }}>h</span></div>
                </div>
                <div style={{ background: "#fff", borderRadius: 16, padding: 16, boxShadow: "0 2px 10px rgba(0,0,0,0.04)" }}>
                  <div style={{ fontSize: 11, color: "#B0A898", marginBottom: 4 }}>平均体調</div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: conditionColor(avgCondition) }}>
                    {avgCondition}<span style={{ fontSize: 13, fontWeight: 400, color: "#B0A898" }}>/10</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "history" && (
          <div style={{ padding: "20px 24px" }}>
            {recentLogs.length >= 3 && (
              <div style={{ background: "#fff", borderRadius: 20, padding: "20px", marginBottom: 16, boxShadow: "0 2px 16px rgba(0,0,0,0.05)" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#6B6157", marginBottom: 16 }}>最近の記録推移</div>
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={recentLogs} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="condGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#D4845A" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#D4845A" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F0EDE8" />
                    <XAxis dataKey="date" tickFormatter={d => { const dt = new Date(d+"T00:00:00"); return (dt.getMonth()+1)+"/"+dt.getDate(); }} tick={{ fontSize: 10, fill: "#B0A898" }} />
                    <YAxis domain={[0, 10]} tick={{ fontSize: 10, fill: "#B0A898" }} />
                    <Tooltip formatter={(v, n) => [n === "condition" ? v+"/10" : v+"h", n === "condition" ? "体調" : "労働時間"]} contentStyle={{ borderRadius: 10, border: "1px solid #EDE9E3", fontSize: 12 }} />
                    <Area type="monotone" dataKey="condition" stroke="#D4845A" fill="url(#condGrad)" strokeWidth={2} dot={{ r: 3, fill: "#D4845A" }} name="condition" />
                  </AreaChart>
                </ResponsiveContainer>

                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 12, color: "#B0A898", marginBottom: 8 }}>労働時間 vs 体調</div>
                  <ResponsiveContainer width="100%" height={140}>
                    <ScatterChart margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F0EDE8" />
                      <XAxis type="number" dataKey="hours" name="労働時間" tick={{ fontSize: 10, fill: "#B0A898" }} label={{ value: "時間/日", position: "insideBottom", offset: -2, fontSize: 10, fill: "#B0A898" }} domain={[0, 12]} />
                      <YAxis type="number" dataKey="condition" name="体調" domain={[0, 10]} tick={{ fontSize: 10, fill: "#B0A898" }} />
                      <Tooltip cursor={{ strokeDasharray: "3 3" }} formatter={(v, n) => [n === "condition" ? v+"/10" : v+"h", n === "condition" ? "体調" : "労働時間"]} contentStyle={{ borderRadius: 10, border: "1px solid #EDE9E3", fontSize: 12 }} />
                      <Scatter data={recentLogs} fill="#D4845A" fillOpacity={0.7} />
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[...logs].reverse().map(log => (
                <div key={log.date} style={{
                  background: "#fff",
                  borderRadius: 16,
                  padding: "14px 16px",
                  boxShadow: "0 1px 8px rgba(0,0,0,0.04)",
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 12,
                    background: conditionColor(log.condition) + "20",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 22, flexShrink: 0,
                  }}>
                    {conditionEmoji(log.condition)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#1A1614" }}>{formatDate(log.date)}</div>
                    <div style={{ fontSize: 12, color: "#B0A898", marginTop: 2 }}>
                      {log.hours}時間労働 · 体調 <span style={{ color: conditionColor(log.condition), fontWeight: 600 }}>{log.condition}/10</span>
                    </div>
                    {log.notes && <div style={{ fontSize: 11, color: "#C8BFB5", marginTop: 2 }}>{log.notes}</div>}
                  </div>
                  <button
                    onClick={() => deleteLog(log.date)}
                    style={{
                      background: "none", border: "none",
                      color: "#D0C8BE", cursor: "pointer", fontSize: 16, padding: 4,
                    }}
                  >✕</button>
                </div>
              ))}
              {logs.length === 0 && (
                <div style={{ textAlign: "center", padding: "60px 20px", color: "#C8BFB5", fontSize: 14 }}>
                  まだ記録がありません。<br />今日の記録から始めましょう！
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "insight" && (
          <div style={{ padding: "20px 24px" }}>
            {!insights ? (
              <div style={{
                background: "#fff", borderRadius: 20, padding: "40px 24px",
                textAlign: "center", boxShadow: "0 2px 16px rgba(0,0,0,0.05)",
              }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: "#1A1614", marginBottom: 8 }}>
                  データがもっと必要です
                </div>
                <div style={{ fontSize: 13, color: "#B0A898", lineHeight: 1.7 }}>
                  最低5日以上記録すると<br />最適な労働時間を分析します。<br />
                  <span style={{ color: "#D4845A", fontWeight: 600 }}>現在 {logs.length}日記録済み</span>
                </div>
                <div style={{ marginTop: 20, background: "#FAF9F6", borderRadius: 12, padding: 12 }}>
                  <div style={{ fontSize: 12, color: "#B0A898" }}>分析まで</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: "#D4845A" }}>{Math.max(0, 5 - logs.length)}日</div>
                  <div style={{ fontSize: 12, color: "#B0A898" }}>記録すれば大丈夫</div>
                </div>
              </div>
            ) : (
              <>
                <div style={{
                  background: "linear-gradient(135deg, #D4845A, #C46A40)",
                  borderRadius: 20, padding: "28px 24px",
                  marginBottom: 16,
                  boxShadow: "0 8px 24px rgba(212,132,90,0.3)",
                }}>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", marginBottom: 4 }}>
                    データに基づく推薦
                  </div>
                  <div style={{ fontSize: 14, color: "rgba(255,255,255,0.9)", marginBottom: 16 }}>
                    体調が最も良かった週の平均
                  </div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    <span style={{ fontSize: 56, fontWeight: 900, color: "#fff", letterSpacing: "-0.04em" }}>
                      {insights.optimalHours}
                    </span>
                    <span style={{ fontSize: 20, color: "rgba(255,255,255,0.8)" }}>時間/週</span>
                  </div>
                  <div style={{ marginTop: 12, fontSize: 13, color: "rgba(255,255,255,0.8)" }}>
                    この時の平均体調：<strong style={{ color: "#fff" }}>{insights.optimalCond}/10</strong>
                  </div>
                </div>

                <div style={{ background: "#fff", borderRadius: 20, padding: "20px", marginBottom: 16, boxShadow: "0 2px 16px rgba(0,0,0,0.05)" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#6B6157", marginBottom: 4 }}>
                    週別労働時間と平均体調
                  </div>
                  <div style={{ fontSize: 11, color: "#B0A898", marginBottom: 16 }}>
                    棒グラフ = 週の総時間 · 折れ線 = 平均体調
                  </div>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={insights.weeks} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F0EDE8" />
                      <XAxis dataKey="week" tickFormatter={w => { const d = new Date(w+"T00:00:00"); return (d.getMonth()+1)+"/"+(d.getDate()); }} tick={{ fontSize: 10, fill: "#B0A898" }} />
                      <YAxis yAxisId="h" domain={[0, 60]} tick={{ fontSize: 10, fill: "#B0A898" }} />
                      <YAxis yAxisId="c" orientation="right" domain={[0, 10]} tick={{ fontSize: 10, fill: "#D4845A" }} />
                      <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #EDE9E3", fontSize: 12 }}
                        formatter={(v, n) => [n === "totalHours" ? v+"h" : v+"/10", n === "totalHours" ? "週の労働" : "平均体調"]} />
                      <Bar yAxisId="h" dataKey="totalHours" fill="#EDE9E3" radius={[6, 6, 0, 0]} name="totalHours" />
                      <ReferenceLine yAxisId="h" y={insights.optimalHours} stroke="#D4845A" strokeDasharray="4 4" strokeWidth={1.5} />
                    </BarChart>
                  </ResponsiveContainer>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, fontSize: 11, color: "#B0A898" }}>
                    <div style={{ width: 20, height: 2, borderTop: "2px dashed #D4845A" }}></div>
                    推奨週間時間 ({insights.optimalHours}h)
                  </div>
                </div>

                <div style={{ background: "#fff", borderRadius: 20, padding: "20px", marginBottom: 16, boxShadow: "0 2px 16px rgba(0,0,0,0.05)" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#6B6157", marginBottom: 14 }}>
                    体調が最高だった週 🏆
                  </div>
                  {insights.topWeeks.map((w, i) => (
                    <div key={w.week} style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "10px 0",
                      borderBottom: i < insights.topWeeks.length - 1 ? "1px solid #F5F2EE" : "none",
                    }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: 8,
                        background: i === 0 ? "#FFD700" : i === 1 ? "#E8E8E8" : "#F5D5B0",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 13, fontWeight: 700, color: i === 0 ? "#9A7200" : "#888",
                        flexShrink: 0,
                      }}>
                        {i + 1}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, color: "#1A1614", fontWeight: 500 }}>
                          {formatDate(w.week)}の週
                        </div>
                        <div style={{ fontSize: 11, color: "#B0A898" }}>
                          {w.totalHours}時間労働 · {w.days}日記録
                        </div>
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: conditionColor(w.avgCond) }}>
                        {w.avgCond}/10
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ background: "#F0FFF6", borderRadius: 20, padding: "20px", border: "1px solid #D4EDDA" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#2D7A50", marginBottom: 10 }}>
                    📌 活用のヒント
                  </div>
                  <div style={{ fontSize: 13, color: "#4A8C65", lineHeight: 1.8 }}>
                    • 推奨時間より多い週に体調が下がる？ → 労働を減らすサイン<br />
                    • 2週連続で体調6以下なら回復週を考えてみましょう<br />
                    • データが増えるほど推薦精度が上がります
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Bottom Nav */}
      <div style={{
        position: "fixed",
        bottom: 0,
        left: "50%",
        transform: "translateX(-50%)",
        width: "100%",
        maxWidth: 430,
        background: "rgba(250,249,246,0.95)",
        backdropFilter: "blur(12px)",
        borderTop: "1px solid #EDE9E3",
        display: "flex",
        padding: "10px 0 20px",
        zIndex: 20,
      }}>
        {[
          { id: "log", icon: "✏️", label: "今日の記録" },
          { id: "history", icon: "📅", label: "履歴" },
          { id: "insight", icon: "💡", label: "分析" },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              flex: 1, background: "none", border: "none",
              cursor: "pointer", padding: "6px 0",
              display: "flex", flexDirection: "column",
              alignItems: "center", gap: 4,
              opacity: tab === t.id ? 1 : 0.4,
              transition: "opacity 0.15s",
            }}
          >
            <span style={{ fontSize: 22 }}>{t.icon}</span>
            <span style={{ fontSize: 10, fontWeight: tab === t.id ? 700 : 400, color: tab === t.id ? "#D4845A" : "#B0A898" }}>
              {t.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
