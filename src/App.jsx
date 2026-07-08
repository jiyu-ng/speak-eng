import { useState, useEffect, useRef, useCallback } from "react";
import { supabase, SPEAK_CONFIG_ROW } from "./supabase.js";

// ── 시나리오 (원본, 저작권 프리) ─────────────────────────────
const SCENARIOS = [
  { key: "cafe",     emoji: "☕", label: "카페에서 주문", desc: "카페에서 커피·디저트 주문하기" },
  { key: "airport",  emoji: "✈️", label: "공항 체크인", desc: "공항 카운터에서 체크인하고 짐 부치기" },
  { key: "directions", emoji: "🗺️", label: "길 묻기", desc: "길을 잃고 행인에게 길 물어보기" },
  { key: "hotel",    emoji: "🏨", label: "호텔 체크인", desc: "호텔 프런트에서 체크인하기" },
  { key: "restaurant", emoji: "🍽️", label: "식당에서", desc: "식당에서 자리 잡고 음식 주문하기" },
  { key: "shopping", emoji: "🛍️", label: "쇼핑", desc: "옷 가게에서 물건 고르고 사기" },
  { key: "smalltalk", emoji: "💬", label: "가벼운 잡담", desc: "날씨·취미·주말 이야기 같은 스몰토크" },
  { key: "interview", emoji: "🧑‍💼", label: "영어 면접", desc: "간단한 영어 면접 연습" },
  { key: "free",     emoji: "🎲", label: "자유 대화", desc: "주제 없이 자유롭게 대화하기" },
];

const LEVELS = [
  { key: "beginner", label: "초급" },
  { key: "intermediate", label: "중급" },
  { key: "advanced", label: "고급" },
];

// ── 음성 인식 (Web Speech API, 지원 시에만) ──────────────────
const SR = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);
const HAS_STT = !!SR;

export default function App() {
  const [apiBase, setApiBase] = useState(null);
  const [urlErr, setUrlErr] = useState(false);
  const [view, setView] = useState("home"); // home | chat
  const [scenario, setScenario] = useState(null);
  const [level, setLevel] = useState("intermediate");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState("");
  const [listening, setListening] = useState(false);
  const [showKo, setShowKo] = useState({}); // 번역 토글 {msgIndex: true}
  const recRef = useRef(null);
  const bottomRef = useRef(null);
  const primedRef = useRef(false);

  // iOS 사파리: 음성재생은 사용자 제스처 안에서 한 번 '깨워야' 이후 자동재생이 됨.
  const primeTTS = useCallback(() => {
    try {
      if (!window.speechSynthesis || primedRef.current) return;
      const u = new SpeechSynthesisUtterance(" ");
      u.volume = 0;
      window.speechSynthesis.speak(u);
      primedRef.current = true;
    } catch (e) {}
  }, []);

  // 터널 URL 로드
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

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  // ── TTS ──
  const speak = useCallback((text) => {
    try {
      if (!window.speechSynthesis) return;
      window.speechSynthesis.cancel();
      window.speechSynthesis.resume(); // iOS: 멈춤 상태 방지
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "en-US";
      const v = window.speechSynthesis.getVoices().find((x) => x.lang?.startsWith("en"));
      if (v) u.voice = v;
      u.rate = 0.95;
      window.speechSynthesis.speak(u);
    } catch (e) {}
  }, []);

  // ── 서버 호출 ──
  const fetchTurn = useCallback(async (history, scObj) => {
    if (!apiBase) return null;
    const res = await fetch(`${apiBase}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scenario: scObj.desc,
        level,
        messages: history.map((m) => ({ role: m.role, text: m.text })),
      }),
    });
    if (!res.ok) throw new Error("bad response");
    return res.json();
  }, [apiBase, level]);

  // ── 대화 시작 ──
  const startScenario = async (sc) => {
    primeTTS(); // 사용자 제스처 안에서 음성 깨우기 (iOS 자동재생용)
    setScenario(sc); setView("chat"); setMessages([]); setLoading(true); setInput("");
    try {
      const r = await fetchTurn([], sc);
      const m = { role: "assistant", text: r.reply, ko: r.ko };
      setMessages([m]);
      speak(r.reply);
    } catch (e) {
      setMessages([{ role: "assistant", text: "(연결이 잠깐 불안정해요. 서버가 깨어나는 중일 수 있어요 — 잠시 후 다시 시도해 주세요.)", ko: "", error: true }]);
    } finally { setLoading(false); }
  };

  // ── 메시지 전송 ──
  const send = async (text) => {
    const t = (text ?? input).trim();
    if (!t || loading) return;
    primeTTS();
    const userMsg = { role: "user", text: t };
    const next = [...messages, userMsg];
    setMessages(next); setInput(""); setLoading(true);
    try {
      const r = await fetchTurn(next, scenario);
      setMessages((prev) => {
        const copy = [...prev];
        // 마지막 user 메시지에 교정 붙이기
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

  // ── 음성 인식 ──
  const toggleMic = () => {
    if (!HAS_STT) return;
    primeTTS();
    if (listening) { recRef.current?.stop(); return; }
    const rec = new SR();
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => { const txt = e.results[0][0].transcript; setInput(txt); setTimeout(() => send(txt), 200); };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
  };

  // ── 렌더 ──
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
          <div style={{ display: "flex", gap: 8 }}>
            {LEVELS.map((l) => (
              <button key={l.key} onClick={() => setLevel(l.key)}
                style={{ ...levelBtn, ...(level === l.key ? levelOn : {}) }}>{l.label}</button>
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

  // 채팅 화면
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
                {m.correction && <div style={correctionBox}>💡 {m.correction}</div>}
              </div>
            )}
          </div>
        ))}
        {loading && <div style={aiRow}><div style={{ ...aiBubble, color: "#8b90a6" }}>…</div></div>}
        <div ref={bottomRef} />
      </div>

      <div style={inputBar}>
        {HAS_STT && (
          <button onClick={toggleMic} style={{ ...micBtn, ...(listening ? micOn : {}) }} title="말하기">
            {listening ? "●" : "🎤"}
          </button>
        )}
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder={listening ? "듣는 중…" : "영어로 답해보세요"}
          style={textInput}
        />
        <button onClick={() => send()} disabled={loading || !input.trim()} style={sendBtn}>↑</button>
      </div>
      {!HAS_STT && <p style={sttNote}>ℹ️ 이 브라우저는 음성인식이 안 돼서 타이핑으로 답해요. (크롬/안드로이드는 마이크 지원)</p>}
    </div>
  );
}

// ── 스타일 ─────────────────────────────────────────────────
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
const correctionBox = { maxWidth: "82%", marginTop: 6, background: "#20261c", color: "#c7e7a8", border: "1px solid #33421f", borderRadius: 12, padding: "9px 12px", fontSize: 13, lineHeight: 1.5 };
const inputBar = { display: "flex", gap: 8, alignItems: "center", padding: "12px 14px", borderTop: "1px solid #1e2233", position: "sticky", bottom: 0, background: "#0f1220" };
const micBtn = { width: 44, height: 44, flexShrink: 0, borderRadius: 999, border: "1px solid #262a3d", background: "#171b2c", color: "#eef0f7", fontSize: 18, cursor: "pointer" };
const micOn = { background: "#e8503a", borderColor: "#e8503a", color: "#fff" };
const textInput = { flex: 1, background: "#171b2c", border: "1px solid #262a3d", borderRadius: 999, padding: "12px 16px", color: "#eef0f7", fontSize: 15, outline: "none" };
const sendBtn = { width: 44, height: 44, flexShrink: 0, borderRadius: 999, border: "none", background: "#4c6ef5", color: "#fff", fontSize: 20, fontWeight: 800, cursor: "pointer" };
const sttNote = { color: "#8b90a6", fontSize: 11.5, textAlign: "center", padding: "0 18px 12px", margin: 0 };
