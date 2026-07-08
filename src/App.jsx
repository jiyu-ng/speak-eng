import { useState, useEffect, useRef, useCallback } from "react";
import { supabase, SPEAK_CONFIG_ROW } from "./supabase.js";

// ── 시나리오 (원본, 저작권 프리) ─────────────────────────────
const SCENARIOS = [
  // 여행
  { key: "cafe",     emoji: "☕", label: "카페에서 주문", desc: "카페에서 커피·디저트 주문하기" },
  { key: "restaurant", emoji: "🍽️", label: "식당에서", desc: "식당에서 자리 잡고 음식 주문하기" },
  { key: "airport",  emoji: "✈️", label: "공항 체크인", desc: "공항 카운터에서 체크인하고 짐 부치기" },
  { key: "hotel",    emoji: "🏨", label: "호텔 체크인", desc: "호텔 프런트에서 체크인하기" },
  { key: "directions", emoji: "🗺️", label: "길 묻기", desc: "길을 잃고 행인에게 길 물어보기" },
  { key: "taxi",     emoji: "🚕", label: "택시 타기", desc: "택시/우버에서 목적지 말하고 대화하기" },
  { key: "shopping", emoji: "🛍️", label: "쇼핑", desc: "옷 가게에서 물건 고르고 사기" },
  { key: "sightsee", emoji: "📸", label: "관광 안내소", desc: "관광 안내소에서 볼거리 물어보기" },
  { key: "carrental", emoji: "🚗", label: "렌터카", desc: "렌터카 빌리고 조건 확인하기" },
  // 생활
  { key: "pharmacy", emoji: "💊", label: "약국·병원", desc: "약국이나 병원에서 증상 설명하기" },
  { key: "bank",     emoji: "🏦", label: "은행 업무", desc: "은행에서 계좌·환전 등 처리하기" },
  { key: "phone",    emoji: "📞", label: "전화 통화", desc: "예약·문의 전화 걸어서 대화하기" },
  { key: "complaint", emoji: "🧾", label: "환불·컴플레인", desc: "물건 교환·환불이나 불만 제기하기" },
  { key: "salon",    emoji: "💇", label: "미용실", desc: "미용실에서 원하는 스타일 말하기" },
  { key: "housing",  emoji: "🏠", label: "집 구하기", desc: "부동산에서 방·집 조건 물어보기" },
  // 사람·일
  { key: "smalltalk", emoji: "💬", label: "가벼운 잡담", desc: "날씨·취미·주말 이야기 같은 스몰토크" },
  { key: "makeplans", emoji: "📅", label: "약속 잡기", desc: "친구랑 만날 약속·계획 잡기" },
  { key: "date",     emoji: "💕", label: "소개팅·데이트", desc: "처음 만난 사람과 가볍게 대화하기" },
  { key: "meeting",  emoji: "🧑‍💻", label: "직장 회의", desc: "회의에서 의견 나누고 발표하기" },
  { key: "networking", emoji: "🤝", label: "네트워킹", desc: "행사에서 자기소개하고 인맥 만들기" },
  { key: "interview", emoji: "🧑‍💼", label: "영어 면접", desc: "간단한 영어 면접 연습" },
  { key: "free",     emoji: "🎲", label: "자유 대화", desc: "주제 없이 자유롭게 대화하기" },
];

const LEVELS = [
  { key: "beginner", label: "초급" },
  { key: "intermediate", label: "중급" },
  { key: "advanced", label: "고급" },
];

// 녹음 지원 여부 (마이크로 발음평가). HTTPS + MediaRecorder 필요.
const HAS_REC = typeof window !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof window.MediaRecorder !== "undefined";

const scoreColor = (n) => (n >= 80 ? "#63c187" : n >= 60 ? "#e0b64a" : "#e8724a");

// ── 화면 잠금 (PIN) ── 화면 가림막용. 통과 시 그 기기에선 다음부터 자동.
const PIN = "0211";
const PIN_KEY = "speak_unlocked_v1";

export default function App() {
  const [apiBase, setApiBase] = useState(null);
  const [urlErr, setUrlErr] = useState(false);
  const [view, setView] = useState("home");
  const [scenario, setScenario] = useState(null);
  const [level, setLevel] = useState("intermediate");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState("");
  const [recording, setRecording] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [showKo, setShowKo] = useState({});
  const [unlocked, setUnlocked] = useState(() => {
    try { return localStorage.getItem(PIN_KEY) === "1"; } catch (e) { return false; }
  });
  const bottomRef = useRef(null);
  const primedRef = useRef(false);
  const mediaRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);

  // iOS: 음성재생은 사용자 제스처 안에서 한 번 '깨워야' 이후 자동재생됨.
  const primeTTS = useCallback(() => {
    try {
      if (!window.speechSynthesis || primedRef.current) return;
      const u = new SpeechSynthesisUtterance(" ");
      u.volume = 0;
      window.speechSynthesis.speak(u);
      primedRef.current = true;
    } catch (e) {}
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase
          .from("tracker_state").select("data").eq("id", SPEAK_CONFIG_ROW).maybeSingle();
        const url = data?.data?.speak_url;
        if (url) setApiBase(url.replace(/\/$/, ""));
        else setUrlErr(true);
      } catch (e) { setUrlErr(true); }
    })();
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading, analyzing]);

  const speak = useCallback((text) => {
    try {
      if (!window.speechSynthesis) return;
      window.speechSynthesis.cancel();
      window.speechSynthesis.resume();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "en-US";
      // 미국 발음(en-US) 목소리 우선 선택 — 영국(en-GB)으로 잡히는 것 방지
      const voices = window.speechSynthesis.getVoices();
      const norm = (x) => (x || "").replace("_", "-");
      const v =
        voices.find((x) => norm(x.lang) === "en-US" && /US|American|Samantha|Aaron|Nicky|Fred|Alex|Ava|Allison|Susan|Zoe/i.test(x.name)) ||
        voices.find((x) => norm(x.lang) === "en-US") ||
        voices.find((x) => norm(x.lang).startsWith("en-US")) ||
        voices.find((x) => norm(x.lang).startsWith("en"));
      if (v) u.voice = v;
      u.rate = 0.95;
      window.speechSynthesis.speak(u);
    } catch (e) {}
  }, []);

  const fetchTurn = useCallback(async (history, scObj) => {
    const res = await fetch(`${apiBase}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenario: scObj.desc, level, messages: history.map((m) => ({ role: m.role, text: m.text })) }),
    });
    if (!res.ok) throw new Error("bad response");
    return res.json();
  }, [apiBase, level]);

  const startScenario = async (sc) => {
    primeTTS();
    setScenario(sc); setView("chat"); setMessages([]); setLoading(true); setInput("");
    try {
      const r = await fetchTurn([], sc);
      setMessages([{ role: "assistant", text: r.reply, ko: r.ko }]);
      speak(r.reply);
    } catch (e) {
      setMessages([{ role: "assistant", text: "(연결이 잠깐 불안정해요. 서버가 깨어나는 중일 수 있어요 — 잠시 후 다시 시도해 주세요.)", ko: "", error: true }]);
    } finally { setLoading(false); }
  };

  // 유저 메시지 추가 + AI 응답 (pron: 발음평가 결과 있으면 붙임)
  const send = async (text, pron = null) => {
    const t = (text ?? input).trim();
    if (!t || loading) return;
    primeTTS();
    const next = [...messages, { role: "user", text: t, pron }];
    setMessages(next); setInput(""); setLoading(true);
    try {
      const r = await fetchTurn(next, scenario);
      setMessages((prev) => {
        const copy = [...prev];
        for (let i = copy.length - 1; i >= 0; i--) {
          if (copy[i].role === "user") { copy[i] = { ...copy[i], correction: r.correction }; break; }
        }
        return [...copy, { role: "assistant", text: r.reply, ko: r.ko }];
      });
      speak(r.reply);
    } catch (e) {
      setMessages((prev) => [...prev, { role: "assistant", text: "(응답을 못 받았어요. 다시 시도해 주세요.)", ko: "", error: true }]);
    } finally { setLoading(false); }
  };

  // ── 녹음 → 발음평가 ──
  const startRec = async () => {
    if (!HAS_REC || recording || analyzing || loading) return;
    primeTTS();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const mr = new MediaRecorder(stream);
      mr.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
      mr.onstop = () => onRecStop(mr.mimeType);
      mediaRef.current = mr;
      mr.start();
      setRecording(true);
    } catch (e) {
      alert("마이크를 사용할 수 없어요. 권한을 허용했는지 확인해 주세요. (또는 타이핑으로 답할 수 있어요)");
    }
  };

  const stopRec = () => {
    if (!recording) return;
    try { mediaRef.current?.stop(); } catch (e) {}
    setRecording(false);
  };

  const onRecStop = async (mime) => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    const blob = new Blob(chunksRef.current, { type: mime || "audio/webm" });
    if (!blob.size) return;
    setAnalyzing(true);
    try {
      const res = await fetch(`${apiBase}/pronounce`, {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: blob,
      });
      const r = await res.json();
      setAnalyzing(false);
      if (r.error || r.noMatch || !r.text) {
        alert(r.noMatch || !r.text ? "말이 잘 안 들렸어요. 다시 또박또박 말해볼까요? (타이핑도 OK)" : r.error);
        return;
      }
      // 인식된 문장 + 발음점수를 유저 메시지로, 이어서 AI 응답
      send(r.text, { accuracy: r.accuracy, fluency: r.fluency, prosody: r.prosody, pron: r.pron, words: r.words || [] });
    } catch (e) {
      setAnalyzing(false);
      alert("발음 분석에 실패했어요. 다시 시도해 주세요.");
    }
  };

  // ── 화면 잠금 ──
  if (!unlocked) {
    return <PinGate onOk={() => { try { localStorage.setItem(PIN_KEY, "1"); } catch (e) {} setUnlocked(true); }} />;
  }

  // ── 렌더: 홈 ──
  if (view === "home") {
    return (
      <div style={wrap}>
        <header style={head}>
          <div style={{ fontSize: 30 }}>🗣️</div>
          <h1 style={h1}>스픽메이트</h1>
          <p style={sub}>AI 파트너랑 영어로 대화하며 스피킹 연습</p>
        </header>
        {urlErr && <div style={banner}>⚠️ 회화 서버 주소를 못 불러왔어요. 잠시 후 새로고침해 주세요.</div>}
        <section style={{ marginBottom: 18 }}>
          <p style={sectionLabel}>난이도</p>
          <div style={{ display: "flex", gap: 8, padding: "0 18px" }}>
            {LEVELS.map((l) => (
              <button key={l.key} onClick={() => setLevel(l.key)} style={{ ...levelBtn, ...(level === l.key ? levelOn : {}) }}>{l.label}</button>
            ))}
          </div>
        </section>
        <section>
          <p style={sectionLabel}>상황 고르기</p>
          <div style={grid}>
            {SCENARIOS.map((s) => (
              <button key={s.key} onClick={() => startScenario(s)} disabled={!apiBase} style={scCard}>
                <span style={{ fontSize: 26 }}>{s.emoji}</span>
                <span style={{ fontSize: 14, fontWeight: 700 }}>{s.label}</span>
                <span style={{ fontSize: 11, color: "#8b90a6" }}>{s.desc}</span>
              </button>
            ))}
          </div>
          {!apiBase && !urlErr && <p style={{ textAlign: "center", color: "#8b90a6", fontSize: 13, marginTop: 16 }}>서버 연결 중…</p>}
        </section>
      </div>
    );
  }

  // ── 렌더: 채팅 ──
  return (
    <div style={wrap}>
      <header style={chatHead}>
        <button onClick={() => { window.speechSynthesis?.cancel(); setView("home"); }} style={backBtn}>←</button>
        <div style={{ textAlign: "center", flex: 1 }}>
          <div style={{ fontWeight: 800 }}>{scenario?.emoji} {scenario?.label}</div>
          <div style={{ fontSize: 11, color: "#8b90a6" }}>{LEVELS.find((l) => l.key === level)?.label} · 스픽메이트</div>
        </div>
        <div style={{ width: 34 }} />
      </header>

      <div style={chatBody}>
        {messages.map((m, i) => (
          <div key={i}>
            {m.role === "assistant" ? (
              <div style={aiRow}>
                <div style={aiBubble}>
                  <div style={{ fontSize: 16 }}>{m.text}</div>
                  {m.ko && showKo[i] && <div style={koText}>{m.ko}</div>}
                  {!m.error && (
                    <div style={{ display: "flex", gap: 12, marginTop: 7 }}>
                      <button onClick={() => speak(m.text)} style={miniAction}>🔊 다시 듣기</button>
                      {m.ko && <button onClick={() => setShowKo((s) => ({ ...s, [i]: !s[i] }))} style={miniAction}>
                        {showKo[i] ? "뜻 숨기기" : "🇰🇷 뜻 보기"}</button>}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div style={userRow}>
                <div style={userBubble}>{m.text}</div>
                {m.pron && <PronCard p={m.pron} />}
                {m.correction && <div style={correctionBox}>💡 {m.correction}</div>}
              </div>
            )}
          </div>
        ))}
        {analyzing && <div style={userRow}><div style={{ ...userBubble, background: "#2a2f47", color: "#a8adc4" }}>🎧 발음 분석 중…</div></div>}
        {loading && <div style={aiRow}><div style={{ ...aiBubble, color: "#8b90a6" }}>…</div></div>}
        <div ref={bottomRef} />
      </div>

      <div style={inputBar}>
        {HAS_REC && (
          <button onClick={recording ? stopRec : startRec} disabled={analyzing || loading}
            style={{ ...micBtn, ...(recording ? micOn : {}) }} title="녹음해서 발음 평가">
            {recording ? "■" : "🎤"}
          </button>
        )}
        <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder={recording ? "녹음 중… ■ 눌러 끝내기" : "영어로 답하기 (또는 🎤 말하기)"} style={textInput} disabled={recording} />
        <button onClick={() => send()} disabled={loading || analyzing || !input.trim()} style={sendBtn}>↑</button>
      </div>
      <p style={sttNote}>
        {HAS_REC ? "🎤 마이크로 말하면 AI가 발음까지 분석해줘요 · 타이핑도 OK" : "ℹ️ 이 브라우저는 녹음이 안 돼서 타이핑으로 답해요."}
      </p>
    </div>
  );
}

// 발음 점수 카드
function PronCard({ p }) {
  return (
    <div style={pronCard}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 12, color: "#8b90a6", fontWeight: 700 }}>발음 점수</span>
        <span style={{ fontSize: 22, fontWeight: 800, color: scoreColor(p.pron) }}>{p.pron}</span>
        <span style={{ fontSize: 12, color: "#8b90a6" }}>/ 100</span>
      </div>
      <div style={{ display: "flex", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
        <Metric label="정확도" v={p.accuracy} />
        <Metric label="유창성" v={p.fluency} />
        {p.prosody != null && <Metric label="억양" v={p.prosody} />}
      </div>
      {p.words?.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
          {p.words.map((w, i) => (
            <span key={i} style={{ fontSize: 13, fontWeight: 600, padding: "2px 8px", borderRadius: 7, background: "#1c2136", color: scoreColor(w.accuracy ?? 100) }}>
              {w.word}{w.errorType && w.errorType !== "None" ? " ⚠️" : ""}
            </span>
          ))}
        </div>
      )}
      <p style={{ fontSize: 11, color: "#6b7089", margin: "8px 0 0" }}>⚠️ 표시 단어는 발음을 더 또렷하게 해보세요</p>
    </div>
  );
}

function Metric({ label, v }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 52 }}>
      <span style={{ fontSize: 15, fontWeight: 800, color: scoreColor(v) }}>{v}</span>
      <span style={{ fontSize: 10.5, color: "#8b90a6" }}>{label}</span>
    </div>
  );
}

// 화면 잠금 PIN 입력
function PinGate({ onOk }) {
  const [pin, setPin] = useState("");
  const [shake, setShake] = useState(false);
  const press = (d) => {
    if (pin.length >= 4) return;
    const np = pin + d;
    setPin(np);
    if (np.length === 4) {
      if (np === PIN) setTimeout(onOk, 120);
      else setTimeout(() => { setShake(true); setPin(""); setTimeout(() => setShake(false), 400); }, 120);
    }
  };
  return (
    <div style={{ ...wrap, alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
      <div style={{ fontSize: 40 }}>🔒</div>
      <p style={{ color: "#8b90a6", fontSize: 14, margin: "10px 0 22px" }}>PIN을 입력하세요</p>
      <div style={{ display: "flex", gap: 14, marginBottom: 30, transform: shake ? "translateX(0)" : "none", animation: shake ? "sh .4s" : "none" }}>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} style={{ width: 14, height: 14, borderRadius: 999, background: i < pin.length ? "#4c6ef5" : "#262a3d" }} />
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 68px)", gap: 14 }}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <button key={n} onClick={() => press(String(n))} style={pinKey}>{n}</button>
        ))}
        <span />
        <button onClick={() => press("0")} style={pinKey}>0</button>
        <button onClick={() => setPin((p) => p.slice(0, -1))} style={{ ...pinKey, fontSize: 20, background: "transparent", border: "none" }}>⌫</button>
      </div>
      <style>{`@keyframes sh{0%,100%{transform:translateX(0)}25%{transform:translateX(-8px)}75%{transform:translateX(8px)}}`}</style>
    </div>
  );
}
const pinKey = { width: 68, height: 68, borderRadius: 999, border: "1px solid #262a3d", background: "#171b2c", color: "#eef0f7", fontSize: 24, fontWeight: 700, cursor: "pointer" };

// ── 스타일 ──
const wrap = { minHeight: "100vh", maxWidth: 560, margin: "0 auto", background: "#0f1220", color: "#eef0f7", fontFamily: '-apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", sans-serif', display: "flex", flexDirection: "column" };
const head = { textAlign: "center", padding: "30px 18px 10px" };
const h1 = { fontSize: 26, fontWeight: 800, margin: "6px 0 4px" };
const sub = { color: "#8b90a6", fontSize: 13.5, margin: 0 };
const banner = { background: "#3a2226", color: "#f3b0b0", padding: "10px 14px", borderRadius: 12, fontSize: 13, margin: "0 18px 14px" };
const sectionLabel = { color: "#8b90a6", fontSize: 12.5, fontWeight: 700, margin: "0 0 8px 4px", padding: "0 18px" };
const levelBtn = { flex: 1, padding: "10px 0", borderRadius: 12, border: "1px solid #262a3d", background: "#171b2c", color: "#8b90a6", fontSize: 14, fontWeight: 700, cursor: "pointer" };
const levelOn = { background: "#4c6ef5", color: "#fff", borderColor: "#4c6ef5" };
const grid = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, padding: "0 18px 30px" };
const scCard = { display: "flex", flexDirection: "column", alignItems: "center", gap: 4, textAlign: "center", padding: "16px 8px", borderRadius: 16, border: "1px solid #262a3d", background: "#171b2c", color: "#eef0f7", cursor: "pointer" };
const chatHead = { display: "flex", alignItems: "center", padding: "16px 14px", borderBottom: "1px solid #1e2233", position: "sticky", top: 0, background: "#0f1220", zIndex: 2 };
const backBtn = { width: 34, height: 34, borderRadius: 10, border: "1px solid #262a3d", background: "#171b2c", color: "#eef0f7", fontSize: 18, cursor: "pointer" };
const chatBody = { flex: 1, overflowY: "auto", padding: "16px 14px 8px", display: "flex", flexDirection: "column", gap: 14 };
const aiRow = { display: "flex", justifyContent: "flex-start" };
const aiBubble = { maxWidth: "82%", background: "#1c2136", borderRadius: "4px 16px 16px 16px", padding: "12px 14px" };
const koText = { marginTop: 6, fontSize: 13.5, color: "#a8adc4", borderTop: "1px solid #2a2f47", paddingTop: 6 };
const miniAction = { background: "none", border: "none", color: "#7f9cf5", fontSize: 12.5, fontWeight: 700, cursor: "pointer", padding: 0 };
const userRow = { display: "flex", flexDirection: "column", alignItems: "flex-end" };
const userBubble = { maxWidth: "82%", background: "#4c6ef5", color: "#fff", borderRadius: "16px 4px 16px 16px", padding: "12px 14px", fontSize: 16 };
const pronCard = { maxWidth: "82%", marginTop: 6, background: "#161a2b", border: "1px solid #262a3d", borderRadius: 14, padding: "12px 14px" };
const correctionBox = { maxWidth: "82%", marginTop: 6, background: "#20261c", color: "#c7e7a8", border: "1px solid #33421f", borderRadius: 12, padding: "9px 12px", fontSize: 13, lineHeight: 1.5 };
const inputBar = { display: "flex", gap: 8, alignItems: "center", padding: "12px 14px", borderTop: "1px solid #1e2233", position: "sticky", bottom: 0, background: "#0f1220" };
const micBtn = { width: 44, height: 44, flexShrink: 0, borderRadius: 999, border: "1px solid #262a3d", background: "#171b2c", color: "#eef0f7", fontSize: 18, cursor: "pointer" };
const micOn = { background: "#e8503a", borderColor: "#e8503a", color: "#fff" };
const textInput = { flex: 1, background: "#171b2c", border: "1px solid #262a3d", borderRadius: 999, padding: "12px 16px", color: "#eef0f7", fontSize: 15, outline: "none" };
const sendBtn = { width: 44, height: 44, flexShrink: 0, borderRadius: 999, border: "none", background: "#4c6ef5", color: "#fff", fontSize: 20, fontWeight: 800, cursor: "pointer" };
const sttNote = { color: "#8b90a6", fontSize: 11.5, textAlign: "center", padding: "0 18px 12px", margin: 0 };
