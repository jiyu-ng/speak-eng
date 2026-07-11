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

// ── 레슨 (일상 표현·패턴, 원본) ─────────────────────────────
// cat: "상황" = 상황별 회화 / "패턴" = 문장 패턴. phrase.note = 사용 팁/뉘앙스.
const LESSON_CATS = ["상황", "패턴"];
const LESSONS = [
  // ── 상황별 ──
  { id: "cafe", cat: "상황", emoji: "☕", title: "카페 필수표현", desc: "음료 주문할 때", roleplay: "카페에서 커피 주문하기", phrases: [
    { en: "I'd like a latte, please.", ko: "라떼 하나 주세요.", note: "'I want'보다 정중한 주문 표현이에요." },
    { en: "For here or to go?", ko: "여기서 드세요, 가져가세요?", note: "점원이 자주 묻는 말 — 미리 알아두면 안 당황해요." },
    { en: "Can I get it iced?", ko: "아이스로 해주시겠어요?", note: "'Can I get ~'은 캐주얼한 주문에 만능이에요." },
    { en: "How much is it?", ko: "얼마예요?", note: "가격 물을 때 기본 표현." },
    { en: "Keep the change.", ko: "잔돈은 괜찮아요.", note: "팁 문화권에서 자주 써요." },
  ] },
  { id: "intro", cat: "상황", emoji: "👋", title: "자기소개", desc: "처음 만났을 때", roleplay: "처음 만난 사람과 자기소개하기", phrases: [
    { en: "Nice to meet you.", ko: "만나서 반가워요.", note: "첫 만남 인사의 정석." },
    { en: "I'm from Korea.", ko: "저는 한국에서 왔어요.", note: "'I come from'도 되지만 'I'm from'이 더 자연스러워요." },
    { en: "What do you do?", ko: "무슨 일 하세요?", note: "직업 물을 때 — 'What's your job?'보다 이게 자연스러워요." },
    { en: "How long have you been here?", ko: "여기 온 지 얼마나 됐어요?", note: "현재완료로 '얼마나 됐는지' 묻는 패턴." },
    { en: "Let's keep in touch.", ko: "앞으로 연락해요.", note: "헤어질 때 관계 이어가자는 표현." },
  ] },
  { id: "restaurant", cat: "상황", emoji: "🍽️", title: "식당에서", desc: "음식 주문·계산", roleplay: "식당에서 주문하고 계산하기", phrases: [
    { en: "A table for two, please.", ko: "두 명 자리 부탁해요.", note: "인원수 + for + 숫자로 자리 요청." },
    { en: "Could I see the menu?", ko: "메뉴 좀 볼 수 있을까요?", note: "'Could I ~'는 아주 공손한 요청." },
    { en: "What do you recommend?", ko: "뭐가 맛있어요?", note: "추천 물을 때 원어민이 실제로 쓰는 표현." },
    { en: "I'll have this one.", ko: "이걸로 할게요.", note: "주문 확정 — 'I'll have ~'가 자연스러워요." },
    { en: "Could we get the check?", ko: "계산서 주시겠어요?", note: "미국은 check, 영국은 bill." },
  ] },
  { id: "directions", cat: "상황", emoji: "🗺️", title: "길 묻기", desc: "길 물어볼 때", roleplay: "길을 잃고 길 물어보기", phrases: [
    { en: "How do I get to the station?", ko: "역에 어떻게 가나요?", note: "'How do I get to + 장소'가 길 묻기 핵심." },
    { en: "Is it far from here?", ko: "여기서 먼가요?", note: "거리 확인할 때." },
    { en: "Turn left at the corner.", ko: "모퉁이에서 왼쪽으로 도세요.", note: "길 안내 들을 때 자주 나오는 말." },
    { en: "How long does it take?", ko: "얼마나 걸려요?", note: "소요 시간 물을 때 — 'take'가 '걸리다'." },
    { en: "Thank you for your help.", ko: "도와주셔서 감사해요.", note: "도움받은 뒤 마무리 인사." },
  ] },
  { id: "smalltalk", cat: "상황", emoji: "💬", title: "스몰토크", desc: "가벼운 대화", roleplay: "가벼운 스몰토크 나누기", phrases: [
    { en: "How's your day going?", ko: "오늘 하루 어때요?", note: "'How are you?'보다 살아있는 안부 표현." },
    { en: "Any plans for the weekend?", ko: "주말에 계획 있어요?", note: "가볍게 대화 트는 스몰토크 단골." },
    { en: "The weather's lovely today.", ko: "오늘 날씨 좋네요.", note: "날씨는 만국 공통 스몰토크 소재." },
    { en: "It was nice talking to you.", ko: "얘기 즐거웠어요.", note: "대화 마무리할 때." },
    { en: "Let's catch up soon.", ko: "조만간 또 봐요.", note: "'catch up' = 밀린 얘기 나누다." },
  ] },
  { id: "airport", cat: "상황", emoji: "✈️", title: "공항·여행", desc: "공항에서", roleplay: "공항에서 체크인하고 이동하기", phrases: [
    { en: "I'd like to check in, please.", ko: "체크인 하려고요.", note: "카운터에서 첫 마디." },
    { en: "Here's my passport.", ko: "여기 여권이요.", note: "'Here's ~' = 여기 있어요(건네줄 때)." },
    { en: "Where's the boarding gate?", ko: "탑승구가 어디예요?", note: "탑승구 찾을 때." },
    { en: "I have nothing to declare.", ko: "신고할 것 없어요.", note: "세관에서 쓰는 고정 표현." },
    { en: "Where can I find a taxi?", ko: "택시는 어디서 타요?", note: "'Where can I find ~'로 위치 묻기." },
  ] },
  { id: "shopping", cat: "상황", emoji: "🛍️", title: "쇼핑", desc: "물건 살 때", roleplay: "가게에서 옷 사기", phrases: [
    { en: "Can I try this on?", ko: "이거 입어봐도 돼요?", note: "'try on' = 입어보다(옷·신발)." },
    { en: "Do you have a smaller size?", ko: "더 작은 사이즈 있어요?", note: "비교급 + size로 사이즈 요청." },
    { en: "How much is this?", ko: "이거 얼마예요?", note: "가격 물을 때." },
    { en: "Do you take cards?", ko: "카드 되나요?", note: "'take cards' = 카드 받다." },
    { en: "I'll take it.", ko: "이걸로 살게요.", note: "구매 확정 — 아주 자주 써요." },
  ] },
  { id: "phone", cat: "상황", emoji: "📞", title: "전화 표현", desc: "전화 통화", roleplay: "예약 전화 걸어서 대화하기", phrases: [
    { en: "Hello, this is Jiyoo.", ko: "여보세요, 저 지유예요.", note: "전화에선 'I am' 아니고 'this is'." },
    { en: "Could I speak to the manager?", ko: "매니저와 통화할 수 있을까요?", note: "'speak to + 사람'으로 연결 요청." },
    { en: "Can I leave a message?", ko: "메시지 남길 수 있을까요?", note: "부재중일 때." },
    { en: "Could you repeat that?", ko: "다시 말씀해 주시겠어요?", note: "못 알아들었을 때 정중하게." },
    { en: "Thanks for your help.", ko: "도와주셔서 감사해요.", note: "통화 마무리." },
  ] },

  // ── 패턴 표현 ──
  { id: "p-want", cat: "패턴", emoji: "🔑", title: "~하고 싶어요", desc: "I'd like to ___", roleplay: "'I'd like to' 표현으로 원하는 것 요청하기", phrases: [
    { en: "I'd like to check in.", ko: "체크인 하고 싶어요.", note: "'I'd like to + 동사' = 정중하게 원하는 것 말하기." },
    { en: "I'd like to make a reservation.", ko: "예약하고 싶어요.", note: "식당·호텔 예약할 때." },
    { en: "I'd like to order now.", ko: "지금 주문할게요.", note: "'I want'보다 부드럽고 정중해요." },
    { en: "I'd like to pay by card.", ko: "카드로 계산할게요.", note: "'pay by + 수단'." },
  ] },
  { id: "p-can", cat: "패턴", emoji: "🔑", title: "~해도 될까요?", desc: "Can I / Could I ___?", roleplay: "'Can I / Could I' 표현으로 허락·요청하기", phrases: [
    { en: "Can I try this on?", ko: "입어봐도 될까요?", note: "'Can I + 동사' = 해도 되는지 허락 구하기." },
    { en: "Could I get some water?", ko: "물 좀 주시겠어요?", note: "'Could I'가 'Can I'보다 더 공손." },
    { en: "Can I sit here?", ko: "여기 앉아도 될까요?", note: "빈자리 확인할 때." },
    { en: "Could I ask you something?", ko: "뭐 좀 물어봐도 될까요?", note: "질문 꺼내기 전 쿠션 표현." },
  ] },
  { id: "p-couldyou", cat: "패턴", emoji: "🔑", title: "~해 주시겠어요?", desc: "Could you ___?", roleplay: "'Could you' 표현으로 부탁하기", phrases: [
    { en: "Could you help me?", ko: "도와주시겠어요?", note: "'Could you + 동사' = 상대에게 정중히 부탁." },
    { en: "Could you say that again?", ko: "다시 말씀해 주시겠어요?", note: "못 들었을 때." },
    { en: "Could you speak slowly?", ko: "천천히 말씀해 주시겠어요?", note: "속도 부탁할 때." },
    { en: "Could you recommend something?", ko: "추천해 주시겠어요?", note: "추천 부탁할 때." },
  ] },
  { id: "p-howabout", cat: "패턴", emoji: "🔑", title: "~하는 게 어때요?", desc: "How about / Why don't we ___?", roleplay: "'How about' 표현으로 제안하기", phrases: [
    { en: "How about grabbing lunch?", ko: "점심 먹는 거 어때요?", note: "'How about + 동사ing' = 가볍게 제안." },
    { en: "How about meeting at six?", ko: "6시에 만나는 거 어때요?", note: "약속 시간 제안." },
    { en: "Why don't we take a break?", ko: "좀 쉬는 게 어때요?", note: "'Why don't we + 동사' = ~하자는 제안." },
    { en: "Why don't we split the bill?", ko: "각자 계산하는 거 어때요?", note: "'split the bill' = 더치페이." },
  ] },
  { id: "p-think", cat: "패턴", emoji: "🔑", title: "~인 것 같아요", desc: "I think / It seems ___", roleplay: "'I think' 표현으로 의견 말하기", phrases: [
    { en: "I think it's a great idea.", ko: "좋은 생각인 것 같아요.", note: "'I think (that) + 문장' = 의견 부드럽게." },
    { en: "It seems a bit expensive.", ko: "좀 비싼 것 같아요.", note: "'It seems + 형용사' = ~해 보이다." },
    { en: "I think I'm lost.", ko: "길을 잃은 것 같아요.", note: "확신 없이 말할 때 쿠션." },
    { en: "I don't think that's right.", ko: "그건 아닌 것 같아요.", note: "부정은 'I don't think'가 자연스러워요." },
  ] },
];

// 녹음 지원 여부 (마이크로 발음평가). HTTPS + MediaRecorder 필요.
const HAS_REC = typeof window !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof window.MediaRecorder !== "undefined";

// ── 로컬 저장: 스트릭 + 복습 노트 ───────────────────────────
const STREAK_KEY = "speak_streak_v1";
const REVIEW_KEY = "speak_review_v1";
const dateStr = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const todayStr = () => dateStr(new Date());
function loadStreak() { try { return JSON.parse(localStorage.getItem(STREAK_KEY)) || { last: "", count: 0 }; } catch { return { last: "", count: 0 }; } }
function bumpStreak() {
  const s = loadStreak();
  const t = todayStr();
  if (s.last === t) return s;
  const y = new Date(); y.setDate(y.getDate() - 1);
  const count = s.last === dateStr(y) ? (s.count || 0) + 1 : 1;
  const ns = { last: t, count };
  try { localStorage.setItem(STREAK_KEY, JSON.stringify(ns)); } catch {}
  return ns;
}
function loadReview() { try { return JSON.parse(localStorage.getItem(REVIEW_KEY)) || []; } catch { return []; } }
function persistReview(items) { try { localStorage.setItem(REVIEW_KEY, JSON.stringify(items.slice(0, 200))); } catch {} }
const BOOKMARK_KEY = "speak_bookmarks_v1";
function loadBookmarks() { try { return JSON.parse(localStorage.getItem(BOOKMARK_KEY)) || []; } catch { return []; } }
function persistBookmarks(items) { try { localStorage.setItem(BOOKMARK_KEY, JSON.stringify(items.slice(0, 300))); } catch {} }

const scoreColor = (n) => (n >= 80 ? "#63c187" : n >= 60 ? "#e0b64a" : "#e8724a");

const shuffle = (a) => { const r = [...a]; for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; };
// 레슨 문장들로 빈칸 채우기 퀴즈 생성 (각 문장에서 가장 긴 단어를 빈칸으로)
function quizFor(lesson) {
  const keyOf = (en) => en.replace(/[.,!?"]/g, "").split(" ").reduce((a, b) => (b.length > a.length ? b : a), "");
  const keys = lesson.phrases.map((p) => keyOf(p.en));
  return lesson.phrases.map((p, idx) => {
    const key = keys[idx];
    const prompt = p.en.replace(new RegExp(`\\b${key}\\b`), "____");
    const pool = [...new Set(keys.filter((w, i) => i !== idx && w.toLowerCase() !== key.toLowerCase()))];
    const options = shuffle([key, ...shuffle(pool).slice(0, 2)]);
    return { idx, prompt, ko: p.ko, answer: key, options };
  });
}

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
  const [analyzing, setAnalyzing] = useState(false);
  const [showKo, setShowKo] = useState({});
  const [homeMode, setHomeMode] = useState("convo"); // convo | lesson | review
  const [lessonCat, setLessonCat] = useState("상황"); // 상황 | 패턴
  const [lesson, setLesson] = useState(null);
  const [lessonStage, setLessonStage] = useState("learn"); // learn | speak | quiz | roleplay
  const [lessonScores, setLessonScores] = useState({}); // {phraseIdx: pronResult}
  const [quizState, setQuizState] = useState({}); // {phraseIdx: {picked, correct}}
  const [recActive, setRecActive] = useState(null); // null | "chat" | phraseIdx
  const recTargetRef = useRef(null); // null=chat, or {idx, ref}
  const [streak, setStreak] = useState(() => loadStreak());
  const [review, setReview] = useState(() => loadReview());
  const [bookmarks, setBookmarks] = useState(() => loadBookmarks());
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
    primeTTS(); markStudied();
    const next = [...messages, { role: "user", text: t, pron }];
    setMessages(next); setInput(""); setLoading(true);
    try {
      const r = await fetchTurn(next, scenario);
      addGrammar(t, r.correction);
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

  // ── 녹음 → 발음평가 (target: null=대화 / {idx, ref}=레슨 따라말하기) ──
  const beginRec = async (target) => {
    if (!HAS_REC || recActive !== null || analyzing || loading) return;
    primeTTS();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      recTargetRef.current = target;
      const mr = new MediaRecorder(stream);
      mr.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
      mr.onstop = () => onRecStop(mr.mimeType);
      mediaRef.current = mr;
      mr.start();
      setRecActive(target === null ? "chat" : target.idx);
    } catch (e) {
      alert("마이크를 사용할 수 없어요. 권한을 허용했는지 확인해 주세요. (또는 타이핑으로 답할 수 있어요)");
    }
  };

  const endRec = () => {
    if (recActive === null) return;
    try { mediaRef.current?.stop(); } catch (e) {}
    setRecActive(null);
  };

  const onRecStop = async (mime) => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    const blob = new Blob(chunksRef.current, { type: mime || "audio/webm" });
    if (!blob.size) return;
    const target = recTargetRef.current;
    setAnalyzing(true);
    try {
      const q = target?.ref ? `?ref=${encodeURIComponent(target.ref)}` : "";
      const res = await fetch(`${apiBase}/pronounce${q}`, {
        method: "POST", headers: { "Content-Type": "application/octet-stream" }, body: blob,
      });
      const r = await res.json();
      setAnalyzing(false);
      if (r.error || r.noMatch || !r.text) {
        alert(r.noMatch || !r.text ? "말이 잘 안 들렸어요. 다시 또박또박 말해볼까요? (타이핑도 OK)" : r.error);
        return;
      }
      markStudied();
      addPronMistakes(r.words, target?.ref || r.text);
      if (target === null) {
        send(r.text, { accuracy: r.accuracy, fluency: r.fluency, prosody: r.prosody, pron: r.pron, words: r.words || [] });
      } else {
        setLessonScores((s) => ({ ...s, [target.idx]: r }));
      }
    } catch (e) {
      setAnalyzing(false);
      alert("발음 분석에 실패했어요. 다시 시도해 주세요.");
    }
  };

  const markStudied = useCallback(() => { setStreak(bumpStreak()); }, []);
  const addPronMistakes = useCallback((words, sentence) => {
    const bad = (words || []).filter((w) => (w.errorType && w.errorType !== "None") || (w.accuracy != null && w.accuracy < 60));
    if (!bad.length) return;
    setReview((prev) => {
      const next = [...prev];
      for (const w of bad) {
        if (!w.word) continue;
        const key = w.word.toLowerCase();
        const item = { type: "pron", word: w.word, accuracy: w.accuracy ?? null, sentence: sentence || "", date: todayStr() };
        const i = next.findIndex((r) => r.type === "pron" && r.word?.toLowerCase() === key);
        if (i >= 0) next.splice(i, 1);
        next.unshift(item);
      }
      persistReview(next);
      return next;
    });
  }, []);
  const addGrammar = useCallback((text, correction) => {
    if (!correction) return;
    setReview((prev) => {
      const next = [{ type: "grammar", text, correction, date: todayStr() }, ...prev];
      persistReview(next);
      return next;
    });
  }, []);
  const removeReview = (idx) => setReview((prev) => { const n = prev.filter((_, i) => i !== idx); persistReview(n); return n; });
  const clearReview = () => { if (window.confirm("복습 노트를 전부 지울까요?")) { setReview([]); persistReview([]); } };

  const isBookmarked = useCallback((en) => bookmarks.some((b) => b.en === en), [bookmarks]);
  const toggleBookmark = useCallback((en, ko = "") => {
    setBookmarks((prev) => {
      const exists = prev.some((b) => b.en === en);
      const next = exists ? prev.filter((b) => b.en !== en) : [{ en, ko, date: todayStr() }, ...prev];
      persistBookmarks(next);
      return next;
    });
  }, []);
  const removeBookmark = (en) => setBookmarks((prev) => { const n = prev.filter((b) => b.en !== en); persistBookmarks(n); return n; });

  const openLesson = (l) => { setLesson(l); setLessonScores({}); setQuizState({}); setLessonStage("learn"); setView("lesson"); };
  const pickQuiz = (idx, choice, answer) => {
    setQuizState((s) => (s[idx]?.correct ? s : { ...s, [idx]: { picked: choice, correct: choice === answer } }));
  };
  const startLessonRoleplay = () => {
    if (!lesson) return;
    startScenario({ key: "lesson-" + lesson.id, emoji: lesson.emoji, label: lesson.title + " 롤플레이", desc: lesson.roleplay });
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
          {streak.count > 0 && (
            <div style={streakBadge}>🔥 {streak.count}일째 공부 중{streak.last === todayStr() ? " · 오늘 완료!" : " · 오늘도 화이팅!"}</div>
          )}
        </header>
        {urlErr && <div style={banner}>⚠️ 회화 서버 주소를 못 불러왔어요. 잠시 후 새로고침해 주세요.</div>}

        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "0 18px", marginBottom: 20 }}>
          <button onClick={() => setHomeMode("convo")} style={{ ...modeTab, ...(homeMode === "convo" ? modeOn : {}) }}>💬 대화</button>
          <button onClick={() => setHomeMode("lesson")} style={{ ...modeTab, ...(homeMode === "lesson" ? modeOn : {}) }}>📚 레슨</button>
          <button onClick={() => setHomeMode("review")} style={{ ...modeTab, ...(homeMode === "review" ? modeOn : {}) }}>📒 복습{review.length ? ` ${review.length}` : ""}</button>
          <button onClick={() => setHomeMode("bookmark")} style={{ ...modeTab, ...(homeMode === "bookmark" ? modeOn : {}) }}>⭐ 북마크{bookmarks.length ? ` ${bookmarks.length}` : ""}</button>
        </div>

        {homeMode === "convo" ? (
          <>
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
            </section>
          </>
        ) : homeMode === "lesson" ? (
          <section>
            <div style={{ display: "flex", gap: 6, padding: "0 18px", marginBottom: 14 }}>
              {LESSON_CATS.map((c) => (
                <button key={c} onClick={() => setLessonCat(c)} style={{ ...catChip, ...(lessonCat === c ? catChipOn : {}) }}>
                  {c === "상황" ? "🗣️ 상황별" : "🔑 패턴 표현"}
                </button>
              ))}
            </div>
            <p style={sectionLabel}>{lessonCat === "상황" ? "상황별 핵심 표현을 배우고 연습해요" : "자주 쓰는 문장 패턴을 익혀요"}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "0 18px" }}>
              {LESSONS.filter((l) => l.cat === lessonCat).map((l) => (
                <button key={l.id} onClick={() => openLesson(l)} disabled={!apiBase} style={lessonItem}>
                  <span style={{ fontSize: 24 }}>{l.emoji}</span>
                  <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", flex: 1 }}>
                    <span style={{ fontSize: 15.5, fontWeight: 700 }}>{l.title}</span>
                    <span style={{ fontSize: 12, color: "#8b90a6" }}>{l.desc} · {l.phrases.length}문장</span>
                  </span>
                  <span style={{ color: "#8b90a6" }}>›</span>
                </button>
              ))}
            </div>
          </section>
        ) : homeMode === "review" ? (
          <ReviewList review={review} onSpeak={speak} onRemove={removeReview} onClear={clearReview} onGoConvo={() => setHomeMode("convo")} />
        ) : (
          <BookmarkList bookmarks={bookmarks} onSpeak={speak} onRemove={removeBookmark} onGoConvo={() => setHomeMode("convo")} />
        )}
        {!apiBase && !urlErr && <p style={{ textAlign: "center", color: "#8b90a6", fontSize: 13, marginTop: 16 }}>서버 연결 중…</p>}
      </div>
    );
  }

  // ── 렌더: 레슨 연습 (4단계) ──
  if (view === "lesson" && lesson) {
    const STAGES = [
      { key: "learn", label: "📖 배우기" },
      { key: "speak", label: "🎤 말하기" },
      { key: "quiz", label: "🧩 퀴즈" },
      { key: "roleplay", label: "🎭 롤플레이" },
    ];
    const quiz = quizFor(lesson);
    const quizDone = quiz.every((q) => quizState[q.idx]?.correct);
    return (
      <div style={wrap}>
        <header style={chatHead}>
          <button onClick={() => { window.speechSynthesis?.cancel(); setView("home"); }} style={backBtn}>←</button>
          <div style={{ textAlign: "center", flex: 1 }}>
            <div style={{ fontWeight: 800 }}>{lesson.emoji} {lesson.title}</div>
            <div style={{ fontSize: 11, color: "#8b90a6" }}>{lesson.cat === "패턴" ? lesson.desc : "핵심표현 배우기"} · 스픽메이트</div>
          </div>
          <div style={{ width: 34 }} />
        </header>

        <div style={{ display: "flex", gap: 5, padding: "12px 12px 0", overflowX: "auto" }}>
          {STAGES.map((s) => (
            <button key={s.key} onClick={() => setLessonStage(s.key)} style={{ ...stageTab, ...(lessonStage === s.key ? stageTabOn : {}) }}>{s.label}</button>
          ))}
        </div>

        <div style={{ padding: "16px 16px 40px", overflowY: "auto" }}>
          {lessonStage === "learn" && (
            <>
              <p style={{ color: "#8b90a6", fontSize: 13, margin: "0 0 14px" }}>표현을 눈으로 익히고 🔊로 들어봐요. 다 보면 🎤 말하기로!</p>
              {lesson.phrases.map((p, idx) => (
                <div key={idx} style={phraseCard}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <div style={{ fontSize: 17, fontWeight: 700 }}>{p.en}</div>
                    <span style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      <button onClick={() => speak(p.en)} style={{ ...phraseBtn, padding: "5px 10px" }}>🔊</button>
                      <button onClick={() => toggleBookmark(p.en, p.ko)} style={{ ...phraseBtn, padding: "5px 10px", ...(isBookmarked(p.en) ? { color: "#f0c860", borderColor: "#5a4a1f" } : {}) }}>{isBookmarked(p.en) ? "⭐" : "☆"}</button>
                    </span>
                  </div>
                  <div style={{ fontSize: 13.5, color: "#a8adc4", marginTop: 3 }}>{p.ko}</div>
                  {p.note && <div style={noteBox}>💡 {p.note}</div>}
                </div>
              ))}
              <button onClick={() => setLessonStage("speak")} style={roleplayBtn}>🎤 따라 말하기 연습 →</button>
            </>
          )}

          {lessonStage === "speak" && (
            <>
              <p style={{ color: "#8b90a6", fontSize: 13, margin: "0 0 14px" }}>🎤로 따라 말하면 발음 점수가 나와요.</p>
              {lesson.phrases.map((p, idx) => {
                const sc = lessonScores[idx];
                const recing = recActive === idx;
                const busy = analyzing && recTargetRef.current?.idx === idx;
                return (
                  <div key={idx} style={phraseCard}>
                    <div style={{ fontSize: 16.5, fontWeight: 700 }}>{p.en}</div>
                    <div style={{ fontSize: 13, color: "#a8adc4", marginTop: 3 }}>{p.ko}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
                      <button onClick={() => speak(p.en)} style={phraseBtn}>🔊 듣기</button>
                      {HAS_REC && (
                        <button onClick={recing ? endRec : () => beginRec({ idx, ref: p.en })}
                          disabled={busy || (recActive !== null && !recing)}
                          style={{ ...phraseBtn, ...(recing ? { background: "#e8503a", color: "#fff", borderColor: "#e8503a" } : {}) }}>
                          {recing ? "■ 끝내기" : busy ? "분석 중…" : "🎤 따라 말하기"}
                        </button>
                      )}
                      {sc && <span style={{ marginLeft: "auto", fontSize: 20, fontWeight: 800, color: scoreColor(sc.pron) }}>{sc.pron}</span>}
                    </div>
                    {sc && (
                      <div style={{ marginTop: 8 }}>
                        <div style={{ display: "flex", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
                          <Metric label="정확도" v={sc.accuracy} />
                          <Metric label="유창성" v={sc.fluency} />
                          {sc.completeness != null && <Metric label="완성도" v={sc.completeness} />}
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                          {(sc.words || []).map((w, i) => (
                            <span key={i} style={{ fontSize: 12.5, fontWeight: 600, padding: "2px 7px", borderRadius: 6, background: "#1c2136", color: scoreColor(w.accuracy ?? 100) }}>
                              {w.word}{w.errorType && w.errorType !== "None" ? " ⚠️" : ""}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              <button onClick={() => setLessonStage("quiz")} style={roleplayBtn}>🧩 퀴즈로 확인하기 →</button>
            </>
          )}

          {lessonStage === "quiz" && (
            <>
              <p style={{ color: "#8b90a6", fontSize: 13, margin: "0 0 14px" }}>빈칸에 알맞은 단어를 골라요. 뜻을 보고 맞춰봐요!</p>
              {quiz.map((q) => {
                const st = quizState[q.idx];
                return (
                  <div key={q.idx} style={phraseCard}>
                    <div style={{ fontSize: 13, color: "#a8adc4", marginBottom: 4 }}>{q.ko}</div>
                    <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 10 }}>{q.prompt}</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {q.options.map((opt) => {
                        const chosen = st?.picked === opt;
                        const isAns = opt === q.answer;
                        let bg = "#1c2136", col = "#cdd2e6", bd = "#2f3550";
                        if (st) {
                          if (isAns && (st.correct || chosen)) { bg = "#1e3324"; col = "#8fe0a8"; bd = "#2f5a3a"; }
                          else if (chosen && !st.correct) { bg = "#33201f"; col = "#f0a0a0"; bd = "#5a2f2f"; }
                        }
                        return (
                          <button key={opt} onClick={() => pickQuiz(q.idx, opt, q.answer)} disabled={st?.correct}
                            style={{ border: `1px solid ${bd}`, background: bg, color: col, fontSize: 14, fontWeight: 700, padding: "9px 14px", borderRadius: 10, cursor: "pointer" }}>
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                    {st && (st.correct ? <div style={{ color: "#8fe0a8", fontSize: 12.5, marginTop: 8 }}>✅ 정답! “{lesson.phrases[q.idx].en}”</div>
                      : <div style={{ color: "#f0a0a0", fontSize: 12.5, marginTop: 8 }}>다시 골라봐요!</div>)}
                  </div>
                );
              })}
              <button onClick={() => setLessonStage("roleplay")} style={{ ...roleplayBtn, opacity: quizDone ? 1 : 0.6 }}>
                {quizDone ? "🎭 롤플레이로 써먹기 →" : "🎭 롤플레이로 넘어가기 (퀴즈 다 풀면 좋아요)"}
              </button>
            </>
          )}

          {lessonStage === "roleplay" && (
            <div style={{ textAlign: "center", padding: "20px 10px" }}>
              <div style={{ fontSize: 40 }}>🎭</div>
              <p style={{ fontSize: 15, fontWeight: 700, margin: "12px 0 6px" }}>배운 표현으로 실전 대화!</p>
              <p style={{ color: "#8b90a6", fontSize: 13.5, lineHeight: 1.6, margin: "0 0 22px" }}>
                AI 파트너와 <b style={{ color: "#cdd2e6" }}>{lesson.roleplay}</b>.<br />방금 배운 표현을 직접 써보세요!
              </p>
              <button onClick={startLessonRoleplay} disabled={!apiBase} style={{ ...roleplayBtn, width: "auto", padding: "14px 28px" }}>🎭 롤플레이 시작하기</button>
            </div>
          )}
        </div>
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
                    <div style={{ display: "flex", gap: 12, marginTop: 7, flexWrap: "wrap" }}>
                      <button onClick={() => speak(m.text)} style={miniAction}>🔊 다시 듣기</button>
                      {m.ko && <button onClick={() => setShowKo((s) => ({ ...s, [i]: !s[i] }))} style={miniAction}>
                        {showKo[i] ? "뜻 숨기기" : "🇰🇷 뜻 보기"}</button>}
                      <button onClick={() => toggleBookmark(m.text, m.ko)} style={miniAction}>{isBookmarked(m.text) ? "⭐ 저장됨" : "☆ 북마크"}</button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div style={userRow}>
                <div style={userBubble}>{m.text}</div>
                {m.pron && <PronCard p={m.pron} sentence={m.text} onSpeak={speak} bookmarked={isBookmarked(m.text)} onBookmark={() => toggleBookmark(m.text)} />}
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
          <button onClick={recActive === "chat" ? endRec : () => beginRec(null)} disabled={analyzing || loading}
            style={{ ...micBtn, ...(recActive === "chat" ? micOn : {}) }} title="녹음해서 발음 평가">
            {recActive === "chat" ? "■" : "🎤"}
          </button>
        )}
        <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder={recActive === "chat" ? "녹음 중… ■ 눌러 끝내기" : "영어로 답하기 (또는 🎤 말하기)"} style={textInput} disabled={recActive === "chat"} />
        <button onClick={() => send()} disabled={loading || analyzing || !input.trim()} style={sendBtn}>↑</button>
      </div>
      <p style={sttNote}>
        {HAS_REC ? "🎤 마이크로 말하면 AI가 발음까지 분석해줘요 · 타이핑도 OK" : "ℹ️ 이 브라우저는 녹음이 안 돼서 타이핑으로 답해요."}
      </p>
    </div>
  );
}

// 발음 점수 카드
function PronCard({ p, sentence, onSpeak, bookmarked, onBookmark }) {
  return (
    <div style={pronCard}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 12, color: "#8b90a6", fontWeight: 700 }}>발음 점수</span>
        <span style={{ fontSize: 22, fontWeight: 800, color: scoreColor(p.pron) }}>{p.pron}</span>
        <span style={{ fontSize: 12, color: "#8b90a6" }}>/ 100</span>
        {(onSpeak || onBookmark) && (
          <span style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
            {onSpeak && sentence && <button onClick={() => onSpeak(sentence)} style={{ ...phraseBtn, padding: "5px 9px" }}>🔊 바른 발음</button>}
            {onBookmark && <button onClick={onBookmark} style={{ ...phraseBtn, padding: "5px 9px", ...(bookmarked ? { color: "#f0c860", borderColor: "#5a4a1f" } : {}) }}>{bookmarked ? "⭐" : "☆"}</button>}
          </span>
        )}
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

// 복습 노트
function ReviewList({ review, onSpeak, onRemove, onClear, onGoConvo }) {
  if (!review.length) {
    return (
      <div style={{ textAlign: "center", padding: "30px 24px" }}>
        <div style={{ fontSize: 34 }}>📒</div>
        <p style={{ color: "#8b90a6", fontSize: 14, lineHeight: 1.6, margin: "12px 0 18px" }}>
          아직 복습할 게 없어요.<br />대화나 레슨을 하면 발음이 어긋난 단어랑<br />문법 교정받은 표현이 여기 자동으로 모여요!
        </p>
        <button onClick={onGoConvo} style={{ ...roleplayBtn, width: "auto", padding: "12px 22px" }}>💬 대화 시작하기</button>
      </div>
    );
  }
  const prons = review.map((r, i) => ({ r, i })).filter((x) => x.r.type === "pron");
  const grams = review.map((r, i) => ({ r, i })).filter((x) => x.r.type === "grammar");
  return (
    <section style={{ padding: "0 18px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <p style={{ color: "#8b90a6", fontSize: 12.5, fontWeight: 700, margin: 0 }}>모아둔 복습 {review.length}개</p>
        <button onClick={onClear} style={{ background: "none", border: "none", color: "#8b90a6", fontSize: 12.5, cursor: "pointer" }}>전체 지우기</button>
      </div>

      {prons.length > 0 && (
        <>
          <p style={{ fontSize: 13, fontWeight: 700, color: "#cdd2e6", margin: "6px 0 8px" }}>🎤 발음 다시 볼 단어</p>
          {prons.map(({ r, i }) => (
            <div key={i} style={reviewCard}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 17, fontWeight: 800, color: scoreColor(r.accuracy ?? 60) }}>{r.word}</span>
                {r.accuracy != null && <span style={{ fontSize: 12, color: "#8b90a6" }}>{r.accuracy}점</span>}
                <button onClick={() => onSpeak(r.word)} style={{ ...phraseBtn, padding: "5px 10px" }}>🔊</button>
                <button onClick={() => onRemove(i)} style={reviewDel}>×</button>
              </div>
              {r.sentence && <div style={{ fontSize: 12.5, color: "#8b90a6", marginTop: 5 }}>“{r.sentence}”</div>}
            </div>
          ))}
        </>
      )}

      {grams.length > 0 && (
        <>
          <p style={{ fontSize: 13, fontWeight: 700, color: "#cdd2e6", margin: "16px 0 8px" }}>💡 다시 볼 표현·문법</p>
          {grams.map(({ r, i }) => (
            <div key={i} style={reviewCard}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <span style={{ fontSize: 13.5, color: "#eef0f7" }}>“{r.text}”</span>
                <button onClick={() => onRemove(i)} style={reviewDel}>×</button>
              </div>
              <div style={{ fontSize: 13, color: "#c7e7a8", marginTop: 6, lineHeight: 1.5 }}>💡 {r.correction}</div>
            </div>
          ))}
        </>
      )}
    </section>
  );
}

// 북마크 목록
function BookmarkList({ bookmarks, onSpeak, onRemove, onGoConvo }) {
  if (!bookmarks.length) {
    return (
      <div style={{ textAlign: "center", padding: "30px 24px" }}>
        <div style={{ fontSize: 34 }}>⭐</div>
        <p style={{ color: "#8b90a6", fontSize: 14, lineHeight: 1.6, margin: "12px 0 18px" }}>
          저장한 표현이 없어요.<br />대화나 레슨에서 마음에 드는 문장에<br />☆ 를 누르면 여기 모여요!
        </p>
        <button onClick={onGoConvo} style={{ ...roleplayBtn, width: "auto", padding: "12px 22px" }}>💬 대화 시작하기</button>
      </div>
    );
  }
  return (
    <section style={{ padding: "0 18px" }}>
      <p style={{ color: "#8b90a6", fontSize: 12.5, fontWeight: 700, margin: "0 0 12px" }}>저장한 표현 {bookmarks.length}개</p>
      {bookmarks.map((b, i) => (
        <div key={i} style={reviewCard}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
            <div style={{ fontSize: 15.5, fontWeight: 700 }}>{b.en}</div>
            <span style={{ display: "flex", gap: 6, flexShrink: 0 }}>
              <button onClick={() => onSpeak(b.en)} style={{ ...phraseBtn, padding: "5px 9px" }}>🔊</button>
              <button onClick={() => onRemove(b.en)} style={{ ...phraseBtn, padding: "5px 9px", color: "#f0c860", borderColor: "#5a4a1f" }}>⭐</button>
            </span>
          </div>
          {b.ko && <div style={{ fontSize: 13, color: "#a8adc4", marginTop: 4 }}>{b.ko}</div>}
        </div>
      ))}
    </section>
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
const modeTab = { flex: 1, padding: "11px 0", borderRadius: 12, border: "1px solid #262a3d", background: "#171b2c", color: "#8b90a6", fontSize: 14, fontWeight: 700, cursor: "pointer" };
const modeOn = { background: "#4c6ef5", color: "#fff", borderColor: "#4c6ef5" };
const lessonItem = { display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderRadius: 14, border: "1px solid #262a3d", background: "#171b2c", color: "#eef0f7", cursor: "pointer", textAlign: "left" };
const phraseCard = { background: "#161a2b", border: "1px solid #262a3d", borderRadius: 14, padding: "14px 16px", marginBottom: 12 };
const phraseBtn = { border: "1px solid #2f3550", background: "#1c2136", color: "#cdd2e6", fontSize: 13, fontWeight: 700, padding: "8px 12px", borderRadius: 10, cursor: "pointer" };
const roleplayBtn = { width: "100%", marginTop: 8, padding: "15px 0", borderRadius: 14, border: "none", background: "#4c6ef5", color: "#fff", fontSize: 15, fontWeight: 800, cursor: "pointer" };
const streakBadge = { display: "inline-block", marginTop: 12, background: "#2a1f14", color: "#f0a860", border: "1px solid #4a3418", borderRadius: 999, padding: "6px 16px", fontSize: 13, fontWeight: 700 };
const reviewCard = { background: "#161a2b", border: "1px solid #262a3d", borderRadius: 12, padding: "12px 14px", marginBottom: 9 };
const reviewDel = { background: "none", border: "none", color: "#6b7089", fontSize: 18, cursor: "pointer", lineHeight: 1, padding: "0 2px" };
const catChip = { flex: 1, padding: "9px 0", borderRadius: 10, border: "1px solid #262a3d", background: "#171b2c", color: "#8b90a6", fontSize: 13, fontWeight: 700, cursor: "pointer" };
const catChipOn = { background: "#2a3358", color: "#cdd7ff", borderColor: "#4c6ef5" };
const stageTab = { flexShrink: 0, padding: "8px 12px", borderRadius: 10, border: "1px solid #262a3d", background: "#171b2c", color: "#8b90a6", fontSize: 12.5, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" };
const stageTabOn = { background: "#4c6ef5", color: "#fff", borderColor: "#4c6ef5" };
const noteBox = { marginTop: 8, background: "#161d18", border: "1px solid #2a3a2c", borderRadius: 10, padding: "8px 11px", fontSize: 12.5, color: "#a8cbb0", lineHeight: 1.5 };
