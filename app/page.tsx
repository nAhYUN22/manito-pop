"use client";
import { useEffect, useState, useRef } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  Plus,
  X,
  Users,
  LockKeyhole,
  Shuffle,
  Copy,
  Check,
  Heart,
  ChevronLeft,
  EyeOff,
  Sparkles,
  RefreshCw,
  Link as LinkIcon,
  ShieldCheck,
} from "lucide-react";

type Room = {
  title: string;
  count: number;
  round: number;
  drawnAt?: string;
  people?: { name: string; registered: boolean; seen: boolean }[];
};
type Result = { name: string; target: string; round: number };
function Flower({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 40 40"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M20 10C6-9-9 6 10 20-9 34 6 49 20 30c14 19 29 4 10-10C49 6 34-9 20 10Z" />
      <circle cx="20" cy="20" r="4" fill="#fffaf2" />
    </svg>
  );
}
function Illustration({ small = false }: { small?: boolean }) {
  return (
    <div className={`illustration ${small ? "small" : ""}`} aria-hidden="true">
      <span className="orbit o1" />
      <span className="orbit o2" />
      <span className="tiny-star s1">✧</span>
      <span className="tiny-star s2">✦</span>
      <span className="tiny-star s3">✧</span>
      <div className="secret-card back">
        <span>TO. SOMEONE SPECIAL</span>
        <div className="smile">
          <i />
          <i />
          <b />
        </div>
      </div>
      <div className="secret-card front">
        <span>쉿! 너에게만 알려줄게</span>
        <Heart size={51} strokeWidth={1.7} />
        <strong>나의 마니또는?</strong>
        <div className="card-dots">● ● ●</div>
      </div>
      <div className="sticker">
        <Flower />
        <span>
          just for
          <br />
          you!
        </span>
      </div>
      <span className="handnote">
        작은 친절이 시작되는 순간{" "}
        <svg viewBox="0 0 55 30">
          <path
            d="M2 5Q22 30 50 8m-10 0 11-1-2 11"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
          />
        </svg>
      </span>
    </div>
  );
}
async function api<T>(body: object, admin = "") {
  const r = await fetch("/api/rooms", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(admin ? { Authorization: `Bearer ${admin}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const d = (await r.json()) as T & { error?: string };
  if (!r.ok) throw Error(d.error || "요청을 처리하지 못했어요.");
  return d;
}
export default function Home() {
  const dialogRef = useRef<HTMLElement>(null);
  const [view, setView] = useState<"create" | "admin" | "join">("create");
  const [id, setId] = useState("");
  const [admin, setAdmin] = useState("");
  const [room, setRoom] = useState<Room | null>(null);
  const [title, setTitle] = useState("");
  const [names, setNames] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [first, setFirst] = useState(true);
  const [result, setResult] = useState<Result | null>(null);
  const [confirmShuffle, setConfirmShuffle] = useState(false);
  const [help, setHelp] = useState(false);
  const [origin, setOrigin] = useState("");
  const [saved, setSaved] = useState<{
    id: string;
    title: string;
    admin: string;
  } | null>(null);
  useEffect(() => {
    setOrigin(location.origin);
    const q = new URLSearchParams(location.search);
    const rid = q.get("room");
    const key = new URLSearchParams(location.hash.slice(1)).get("admin") || "";
    try {
      const s = localStorage.getItem("manito-last-room");
      if (s) setSaved(JSON.parse(s));
    } catch {}
    if (rid) {
      setId(rid);
      setAdmin(key);
      setView(key ? "admin" : "join");
      fetch(`/api/rooms?id=${encodeURIComponent(rid)}`, {
        headers: key ? { Authorization: `Bearer ${key}` } : {},
      })
        .then(async (r) => {
          const d = (await r.json()) as Room & { error?: string };
          if (!r.ok) throw Error(d.error || "모임을 불러오지 못했어요.");
          setRoom(d);
        })
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
    } else setLoading(false);
  }, []);
  useEffect(() => {
    if (!id) return;
    const refresh = () =>
      fetch(`/api/rooms?id=${encodeURIComponent(id)}`, {
        headers: admin ? { Authorization: `Bearer ${admin}` } : {},
      })
        .then((r) => (r.ok ? (r.json() as Promise<Room>) : null))
        .then((d) => {
          if (d) {
            setRoom(d);
            setResult((previous) =>
              previous && previous.round !== d.round ? null : previous,
            );
          }
        })
        .catch(() => {});
    const timer = setInterval(refresh, 15000);
    window.addEventListener("focus", refresh);
    const hide = () => {
      if (document.hidden) setResult(null);
    };
    document.addEventListener("visibilitychange", hide);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", hide);
    };
  }, [id, admin]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 3500);
    return () => clearTimeout(t);
  }, [notice]);
  function addNames() {
    const added = draft
      .split(/[,\n]/)
      .map((n) => n.normalize("NFC").trim().replace(/\s+/g, " "))
      .filter(Boolean);
    if (!added.length) return;
    if ([...names, ...added].some((n) => n.length > 20)) {
      setError("이름은 20자 이내로 적어주세요.");
      return;
    }
    const merged = [...names, ...added];
    if (new Set(merged.map((n) => n.toLowerCase())).size !== merged.length) {
      setError("같은 이름이 있어요. 성이나 별명을 붙여 구분해주세요.");
      return;
    }
    if (merged.length > 100) {
      setError("최대 100명까지 함께할 수 있어요.");
      return;
    }
    setNames(merged);
    setDraft("");
    setError("");
  }
  async function create() {
    setBusy(true);
    setError("");
    try {
      const added = draft
        .split(/[,\n]/)
        .map((n) => n.trim())
        .filter(Boolean);
      const d = await api<Room & { id: string; admin: string }>({
        action: "create",
        title,
        names: [...names, ...added],
      });
      setId(d.id);
      setAdmin(d.admin);
      setRoom(d);
      setView("admin");
      history.replaceState(null, "", `/?room=${d.id}#admin=${d.admin}`);
      try {
        localStorage.setItem(
          "manito-last-room",
          JSON.stringify({ id: d.id, title: d.title, admin: d.admin }),
        );
      } catch {}
      window.scrollTo(0, 0);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function shuffle() {
    if (!room) return;
    setConfirmShuffle(false);
    setBusy(true);
    setError("");
    try {
      const d = await api<Room>(
        { action: "shuffle", id, round: room.round },
        admin,
      );
      setRoom(d);
      setResult(null);
      setNotice("두근두근! 모두의 마니또가 정해졌어요.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function reveal(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      setResult(
        await api<Result>({
          action: "reveal",
          id,
          name,
          pin,
          pinConfirm: first ? pinConfirm : undefined,
        }),
      );
      setFirst(false);
      setPin("");
      setPinConfirm("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const invite = `${origin}/?room=${id}`;
  const adminLink = `${invite}#admin=${admin}`;
  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setNotice(`${label} 복사했어요.`);
    } catch {
      setNotice("복사할 수 없어요. 아래 링크를 길게 눌러 복사해주세요.");
    }
  }
  useEffect(() => {
    if (!help && !confirmShuffle) return;
    const previous = document.activeElement as HTMLElement | null;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setHelp(false);
        setConfirmShuffle(false);
      }
      if (event.key === "Tab") {
        const items = dialogRef.current?.querySelectorAll<HTMLElement>(
          'button, a, input, [tabindex="0"]',
        );
        if (!items?.length) return;
        const first = items[0],
          last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [help, confirmShuffle]);
  const joinPanel = (
    <>
      <div className="panel-head">
        <span className="mini-label">
          <LockKeyhole size={14} /> ONLY FOR YOU
        </span>
        <h2>당신은 누구인가요?</h2>
        <p>이름을 알려주면, 당신만의 비밀을 열어드릴게요.</p>
      </div>
      <form onSubmit={reveal}>
        <label htmlFor="my-name">내 이름</label>
        <input
          id="my-name"
          placeholder="등록된 이름을 입력해주세요"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={20}
          autoComplete="off"
        />
        <div className="toggle-row">
          <button
            type="button"
            className={first ? "selected" : ""}
            onClick={() => setFirst(true)}
          >
            처음 확인해요
          </button>
          <button
            type="button"
            className={!first ? "selected" : ""}
            onClick={() => setFirst(false)}
          >
            다시 확인해요
          </button>
        </div>
        <label htmlFor="pin">
          {first ? "나만의 확인번호 만들기" : "나만의 확인번호"}
        </label>
        <input
          id="pin"
          type="password"
          inputMode="numeric"
          pattern="[0-9]{6}"
          maxLength={6}
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder="숫자 6자리"
          autoComplete="off"
          required
        />
        {first && (
          <>
            <label htmlFor="confirm-pin">확인번호 한 번 더</label>
            <input
              id="confirm-pin"
              type="password"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              value={pinConfirm}
              onChange={(e) => setPinConfirm(e.target.value)}
              placeholder="같은 번호를 다시 입력해주세요"
              autoComplete="off"
              required
            />
            <p className="field-note">
              처음 설정한 번호로 다음에도 확인해요. 잊지 않게 기억해주세요.
            </p>
          </>
        )}
        <button className="primary" disabled={busy || !room?.round}>
          {busy
            ? "비밀을 여는 중…"
            : room?.round
              ? "나의 마니또 확인하기"
              : "아직 추첨을 기다리고 있어요"}
          <ArrowRight size={18} />
        </button>
        <p className="privacy">
          <LockKeyhole size={13} /> 내 결과만 살짝 보여드려요.
        </p>
        <p className="honor-note">
          첫 등록은 이름을 기준으로 해요. 꼭 본인 이름으로만 참여해주세요.
        </p>
      </form>
    </>
  );
  return (
    <div className="site">
      <header className="header">
        <a className="brand" href="/">
          <Flower />
          마니또<span>팝</span>
          <i>!</i>
        </a>
        <div className="header-right">
          <span className="header-caption">A LITTLE SECRET, A LOT OF JOY</span>
          <button className="help-link" onClick={() => setHelp(true)}>
            이용 방법 <ArrowUpRight size={15} />
          </button>
        </div>
      </header>
      <main>
        {loading ? (
          <div className="loading">
            <Flower />
            <p>우리의 작은 비밀을 준비하고 있어요…</p>
          </div>
        ) : (
          <>
            <div className="breadcrumb">
              <span className="status-dot" />
              {view === "create"
                ? "우리만의 비밀을 만드는 곳"
                : room?.title || "초대받은 모임"}
              <span className="crumb-tail">
                {view === "admin"
                  ? "관리자 공간"
                  : view === "join"
                    ? "참가자 공간"
                    : "SECRET FRIEND CLUB"}
              </span>
            </div>
            <div
              className={`main-grid ${view === "admin" ? "admin-grid" : ""}`}
            >
              <section className="story">
                <div className="eyebrow">
                  <span>작은 친절을 주고받는 우리</span>
                  <Sparkles size={16} />
                </div>
                <h1>
                  {view === "create" ? (
                    <>
                      우리 사이,
                      <br />
                      작은 <span className="underline">비밀</span> 하나.
                    </>
                  ) : view === "admin" ? (
                    <>
                      비밀 친구가
                      <br />
                      <span className="underline">이어지는</span> 순간.
                    </>
                  ) : (
                    <>
                      누군가의 하루에
                      <br />
                      <span className="underline">다정함</span>을 팝!
                    </>
                  )}
                </h1>
                <p className="intro">
                  {view === "create" ? (
                    <>
                      누가 나의 마니또가 될까요?
                      <br />
                      이름을 모아 섞으면, 설레는 우연이 시작돼요.
                    </>
                  ) : view === "admin" ? (
                    <>
                      모두에게 한 명씩, 겹치지 않는 마니또.
                      <br />
                      관리자인 당신도 이 설렘에 함께하세요.
                    </>
                  ) : (
                    <>
                      오직 당신만 알 수 있는 한 사람.
                      <br />티 나지 않게, 마음은 가득 담아 챙겨주세요.
                    </>
                  )}
                </p>
                <Illustration small={view === "admin"} />
                <div className="story-bottom">
                  <span>
                    <ShieldCheck size={15} /> 겹치지 않는 배정
                  </span>
                  <span>
                    <EyeOff size={15} /> 나만 아는 결과
                  </span>
                </div>
              </section>
              <section
                className="workspace"
                aria-label={
                  view === "create"
                    ? "모임 설정"
                    : view === "admin"
                      ? "모임 관리"
                      : "마니또 확인"
                }
              >
                {view === "create" ? (
                  <>
                    <div className="steps">
                      <span className="active">
                        <b>1</b> 이름 모으기
                      </span>
                      <i />
                      <span>
                        <b>2</b> 마니또 섞기
                      </span>
                      <i />
                      <span>
                        <b>3</b> 링크 나누기
                      </span>
                    </div>
                    <div className="panel">
                      <div className="panel-head">
                        <span className="mini-label">LET’S GET TOGETHER</span>
                        <h2>어떤 사람들과 함께하나요?</h2>
                        <p>모임을 만들고, 비밀 친구들을 초대해보세요.</p>
                      </div>
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          create();
                        }}
                      >
                        <label htmlFor="room-title">
                          모임 이름 <span>필수</span>
                        </label>
                        <input
                          id="room-title"
                          maxLength={40}
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          placeholder="예: 우리들의 연말 마니또"
                          required
                        />
                        <div className="label-row">
                          <label htmlFor="person-name">
                            참가자 이름 <span>나도 꼭 포함해요</span>
                          </label>
                          <span className="count">{names.length}명</span>
                        </div>
                        <div className="input-with-button">
                          <input
                            id="person-name"
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (
                                e.key === "Enter" &&
                                !e.nativeEvent.isComposing
                              ) {
                                e.preventDefault();
                                addNames();
                              }
                            }}
                            placeholder="이름을 입력하고 추가"
                          />
                          <button
                            type="button"
                            className="add-button"
                            onClick={addNames}
                            aria-label="참가자 추가"
                          >
                            <Plus size={21} />
                          </button>
                        </div>
                        <p className="field-note">
                          여러 명은 쉼표로 구분해요. 최소 2명부터 시작할 수
                          있어요.
                        </p>
                        <div
                          className={`name-box ${!names.length ? "empty" : ""}`}
                        >
                          {names.length ? (
                            names.map((n, i) => (
                              <span
                                className={`name-chip chip-${i % 4}`}
                                key={n}
                              >
                                <span className="avatar-dot">
                                  {n.slice(0, 1)}
                                </span>
                                {n}
                                <button
                                  type="button"
                                  aria-label={`${n} 삭제`}
                                  onClick={() =>
                                    setNames(names.filter((x) => x !== n))
                                  }
                                >
                                  <X size={13} />
                                </button>
                              </span>
                            ))
                          ) : (
                            <>
                              <Users size={27} />
                              <p>함께할 친구들의 이름을 모아주세요.</p>
                              <span>
                                관리자도 참가자에 넣으면 함께할 수 있어요!
                              </span>
                            </>
                          )}
                        </div>
                        <div className="soft-note">
                          <span>✳</span>
                          <p>
                            동명이인은 성이나 별명으로 구분해주세요.
                            <br />
                            자기 자신을 뽑지 않고, 한 명씩 공평하게 배정해요.
                          </p>
                        </div>
                        <button className="primary" disabled={busy}>
                          {busy ? "모임을 만드는 중…" : "우리 모임 만들기"}
                          <ArrowRight size={18} />
                        </button>
                        <p className="privacy">
                          <LockKeyhole size={13} /> 전체 결과는 관리자에게도
                          공개되지 않아요.
                        </p>
                      </form>
                    </div>
                    {saved && (
                      <a
                        className="saved-room"
                        href={`/?room=${saved.id}#admin=${saved.admin}`}
                      >
                        <span>이전에 만든 모임 · {saved.title}</span>
                        <ArrowUpRight size={16} />
                      </a>
                    )}
                  </>
                ) : view === "admin" && room ? (
                  <>
                    <div className="panel admin-panel">
                      <div className="panel-head">
                        <div className="label-row">
                          <span className="mini-label">YOUR SECRET CLUB</span>
                          <span
                            className={`badge ${room.round ? "ready" : ""}`}
                          >
                            {room.round
                              ? `${room.round}회차 · 배정 완료`
                              : "추첨 준비 중"}
                          </span>
                        </div>
                        <h2>{room.title}</h2>
                        <p>{room.count}명의 작은 비밀이 모였어요.</p>
                      </div>
                      <div className="participant-list">
                        {room.people?.map((p, i) => (
                          <div className="participant" key={p.name}>
                            <span className={`avatar-dot chip-${i % 4}`}>
                              {p.name.slice(0, 1)}
                            </span>
                            <strong>{p.name}</strong>
                            <span className={p.seen ? "seen" : ""}>
                              {p.seen ? (
                                <>
                                  <Check size={13} /> 확인 완료
                                </>
                              ) : (
                                "아직 확인 전"
                              )}
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="soft-note">
                        <Shuffle size={23} />
                        <p>
                          {room.round ? (
                            <>
                              결과가 저장됐어요. 다시 섞기 전까지 같아요.
                              <br />
                              다시 섞으면 모두 새 결과를 확인해야 해요.
                            </>
                          ) : (
                            <>
                              한 번 섞으면 각자의 마니또가 정해져요.
                              <br />
                              모두의 결과는 비밀로 저장돼요.
                            </>
                          )}
                        </p>
                      </div>
                      <button
                        className="primary"
                        disabled={busy}
                        onClick={() =>
                          room.round ? setConfirmShuffle(true) : shuffle()
                        }
                      >
                        <Shuffle size={18} />
                        {busy
                          ? "두근두근, 섞는 중…"
                          : room.round
                            ? "마니또 다시 섞기"
                            : "두근두근, 마니또 섞기"}
                        <ArrowRight size={18} />
                      </button>
                      {room.count === 2 && (
                        <p className="field-note center">
                          2명일 때는 서로가 마니또예요. 다시 섞어도 같아요.
                        </p>
                      )}
                    </div>
                    <div className="panel share-panel">
                      <span className="mini-label">
                        <LinkIcon size={13} /> SPREAD THE SECRET
                      </span>
                      <h3>이제, 친구들을 초대해요.</h3>
                      <p>아래 참가자 링크를 단체 채팅방에 보내주세요.</p>
                      <div className="copy-field">
                        <input
                          aria-label="참가자 초대 링크"
                          readOnly
                          value={invite}
                        />
                        <button
                          onClick={() => copy(invite, "참가자 링크를")}
                          aria-label="참가자 링크 복사"
                        >
                          <Copy size={18} />
                        </button>
                      </div>
                      <button
                        className="secondary"
                        onClick={() => {
                          setView("join");
                          setError("");
                          setResult(null);
                        }}
                      >
                        나도 마니또 확인하기 <ArrowUpRight size={16} />
                      </button>
                      <details>
                        <summary>관리자 전용 링크 보관하기</summary>
                        <p>
                          이 링크를 가진 사람은 다시 섞을 수 있어요. 다른
                          사람에게 공유하지 마세요. 같은 기기에서는 최근 모임을
                          다시 열 수 있어요.
                        </p>
                        <div className="copy-field">
                          <input
                            aria-label="관리자 전용 링크"
                            value={adminLink}
                            readOnly
                          />
                          <button
                            onClick={() => copy(adminLink, "관리자 링크를")}
                            aria-label="관리자 링크 복사"
                          >
                            <Copy size={18} />
                          </button>
                        </div>
                      </details>
                    </div>
                  </>
                ) : room ? (
                  <>
                    <div className="join-top">
                      <span className="badge ready">
                        {room.round
                          ? `${room.round}회차 · 비밀이 도착했어요`
                          : "아직 추첨 전이에요"}
                      </span>
                      {admin && (
                        <button
                          className="text-button"
                          onClick={() => {
                            setView("admin");
                            setResult(null);
                            setError("");
                          }}
                        >
                          <ChevronLeft size={14} /> 관리자로 돌아가기
                        </button>
                      )}
                    </div>
                    <div className="panel join-panel">
                      {result ? (
                        <div className="result">
                          <span className="mini-label">
                            A SECRET, JUST FOR YOU
                          </span>
                          <span className="result-heart">
                            <Heart size={45} />
                          </span>
                          <p>{result.name} 님이 몰래 챙겨줄 마니또는</p>
                          <h2>
                            {result.target}
                            <span> 님</span>
                          </h2>
                          <span className="badge">
                            {result.round}회차 배정 결과
                          </span>
                          <div className="result-note">
                            오늘부터 이 사람의 비밀 친구가 되어주세요.
                            <br />
                            작은 간식, 따뜻한 한마디면 충분해요.
                          </div>
                          <button
                            className="secondary"
                            onClick={() => setResult(null)}
                          >
                            <EyeOff size={17} /> 비밀 다시 숨기기
                          </button>
                          <p className="field-note">
                            화면을 벗어나면 결과를 숨겨드려요.
                            <br />
                            관리자가 다시 섞으면 새로운 결과로 바뀝니다.
                          </p>
                        </div>
                      ) : (
                        joinPanel
                      )}
                    </div>
                  </>
                ) : (
                  <div className="panel">
                    <h2>초대 링크를 확인해주세요.</h2>
                    <p>관리자에게 모임 링크를 다시 받아주세요.</p>
                    <a className="secondary" href="/">
                      새 모임 만들기 <ArrowRight size={16} />
                    </a>
                  </div>
                )}
                {error && (
                  <div className="error" role="alert">
                    {error}
                    <button onClick={() => setError("")} aria-label="오류 닫기">
                      <X size={16} />
                    </button>
                  </div>
                )}
              </section>
            </div>
            <section className="how-strip">
              <div>
                <span>01</span>
                <p>
                  <strong>우리 이름을 모으고</strong>
                  <small>관리자도 빠짐없이 함께!</small>
                </p>
              </div>
              <ArrowRight size={17} />
              <div>
                <span>02</span>
                <p>
                  <strong>두근두근, 한 번 섞고</strong>
                  <small>나 자신은 빼고, 겹치지 않게.</small>
                </p>
              </div>
              <ArrowRight size={17} />
              <div>
                <span>03</span>
                <p>
                  <strong>나의 마니또만 살짝</strong>
                  <small>링크를 열어 비밀을 확인해요.</small>
                </p>
              </div>
            </section>
          </>
        )}
      </main>
      <footer>
        <a className="footer-brand" href="/">
          manito pop<span>✳</span>
        </a>
        <p>작은 비밀이, 우리를 조금 더 가깝게.</p>
        <span>MADE FOR LITTLE ACTS OF KINDNESS</span>
      </footer>
      {notice && (
        <div className="toast" role="status">
          <Check size={17} />
          {notice}
        </div>
      )}
      {(confirmShuffle || help) && (
        <div
          className="modal-backdrop"
          onClick={() => {
            setHelp(false);
            setConfirmShuffle(false);
          }}
        >
          <section
            ref={dialogRef}
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close"
              onClick={() => {
                setHelp(false);
                setConfirmShuffle(false);
              }}
              aria-label="닫기"
              autoFocus
            >
              <X />
            </button>
            <span className="modal-icon">
              {help ? <Heart /> : <RefreshCw />}
            </span>
            <h2 id="modal-title">
              {help
                ? "우리의 작은 비밀, 이렇게 시작해요."
                : "모두의 마니또를 다시 섞을까요?"}
            </h2>
            {help ? (
              <>
                <ol>
                  <li>
                    <b>모임 만들기</b>
                    <p>
                      모임 이름과 참가자 이름을 적어요. 관리자 이름도 꼭
                      넣어주세요.
                    </p>
                  </li>
                  <li>
                    <b>한 번 섞고, 링크 공유하기</b>
                    <p>
                      관리자 화면에서 추첨한 뒤 참가자 링크를 나눠요. 배정
                      결과는 서버에 저장됩니다.
                    </p>
                  </li>
                  <li>
                    <b>나의 마니또만 확인하기</b>
                    <p>
                      본인 이름과 직접 정한 확인번호 6자리로 결과를 확인해요.
                      다음에도 같은 번호를 입력하세요.
                    </p>
                  </li>
                </ol>
                <div className="soft-note">
                  <LockKeyhole size={20} />
                  <p>
                    이름만으로는 본인 여부를 확인할 수 없어요. 첫 등록은 서로를
                    믿고 본인 이름으로 진행해주세요. 확인번호를 잊으면 기존
                    결과를 다시 열 수 없어요.
                  </p>
                </div>
              </>
            ) : (
              <p>
                이전 결과는 무효가 되고 새 결과로 바뀌어요.
                <br />
                이미 확인한 친구들에게 다시 확인해달라고 알려주세요.
              </p>
            )}
            <button
              className="primary"
              onClick={() => (help ? setHelp(false) : shuffle())}
            >
              {help ? "좋아요, 시작해볼게요" : "네, 전체 다시 섞기"}
              <ArrowRight size={17} />
            </button>
            {!help && (
              <button
                className="text-button cancel"
                onClick={() => setConfirmShuffle(false)}
              >
                지금 결과 유지하기
              </button>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
