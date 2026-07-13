// ψ Studio Floor — the live ops screen. Fetches agent-status.json (published by
// agent-office/publish_status.py) and shows, in two halves, the crew roster and
// the live sessions + activity feed. Genuinely live when the publisher runs in
// --watch beside the site; an honest, time-stamped snapshot when deployed.

import { useEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import './StudioFloor.css';

type Status = 'working' | 'delegate' | 'idle' | 'waiting';
interface Crew {
  key: string; name: string; emoji: string; role: string;
  status: Status; task: string; sessionId: string | null; lastTs: string | null;
}
interface Session {
  id: string; title: string; skill: string | null; status: Status; detail: string; lastTs: string | null;
}
interface Feed { ts: string; kind: string; text: string; session: string; }
interface Status_ {
  generatedAt: string; totalSessions: number; activeCount: number;
  workingCount: number; crewCount: number; crew: Crew[]; sessions: Session[]; feed: Feed[];
}

const BASE = (import.meta.env.BASE_URL || '/').replace(/\/?$/, '/');
const POLL_MS = 4000;

function ago(iso: string | null, now: number): string {
  if (!iso) return '—';
  const s = Math.max(0, Math.floor((now - Date.parse(iso)) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

function Pill({ status }: { status: Status }) {
  if (status === 'working') return <span className="sf-pill working"><i className="sf-dot" />ทำงาน</span>;
  if (status === 'delegate') return <span className="sf-pill delegate"><i className="sf-dot" />มอบงาน</span>;
  return <span className="sf-pill idle"><i className="sf-dot" />ว่าง</span>;
}

export default function StudioFloor() {
  const [data, setData] = useState<Status_ | null>(null);
  const [err, setErr] = useState(false);
  const [now, setNow] = useState(() => 0); // set on mount to avoid SSR mismatch
  const feedRef = useRef<HTMLDivElement>(null);
  const seen = useRef<Set<string>>(new Set());

  // fetch + poll
  useEffect(() => {
    let alive = true;
    const pull = async () => {
      try {
        const r = await fetch(`${BASE}agent-status.json`, { cache: 'no-store' });
        if (!r.ok) throw new Error(String(r.status));
        const j = (await r.json()) as Status_;
        if (alive) { setData(j); setErr(false); }
      } catch {
        if (alive) setErr(true);
      }
    };
    pull();
    const id = setInterval(pull, POLL_MS);
    return () => { alive = false; clearInterval(id); };
  }, []);

  // 1s clock tick so ages stay honest & live
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // animate genuinely-new feed rows
  useEffect(() => {
    if (!data || !feedRef.current) return;
    const fresh: HTMLElement[] = [];
    feedRef.current.querySelectorAll<HTMLElement>('.sf-frow').forEach((el) => {
      const k = el.dataset.k || '';
      if (k && !seen.current.has(k)) { seen.current.add(k); fresh.push(el); }
    });
    if (fresh.length && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gsap.from(fresh, { opacity: 0, x: -12, duration: 0.5, stagger: 0.04, ease: 'power2.out' });
    }
  }, [data]);

  const snapAge = data ? Math.floor((now - Date.parse(data.generatedAt)) / 1000) : 0;
  const isLive = data != null && now > 0 && snapAge < 20;

  const clock = useMemo(() => {
    if (!now) return '';
    const d = new Date(now);
    return d.toLocaleTimeString('en-GB');
  }, [now]);

  if (err && !data) {
    return (
      <div className="sf-screen">
        <div className="sf-empty" style={{ padding: '48px 20px' }}>
          — สำนักงานปิดอยู่ · เปิดไฟล์ <code>agent-status.json</code> ไม่ได้ —
        </div>
      </div>
    );
  }
  if (!data) {
    return <div className="sf-screen"><div className="sf-empty" style={{ padding: '48px 20px' }}>กำลังเชื่อมต่อสำนักงาน…</div></div>;
  }

  return (
    <div className="sf-screen">
      <div className="sf-bar">
        <span className="sf-brand"><i className="sf-recdot" />ψ STUDIO FLOOR</span>
        <span className={`sf-live${isLive ? ' is-live' : ''}`}>
          <i className="sf-livedot" />
          {isLive ? 'LIVE' : `สแนปช็อต · ${ago(data.generatedAt, now)} ที่แล้ว`}
        </span>
        <span className="sf-counts">
          <span><b>{data.workingCount}</b> ทำงาน / {data.crewCount}</span>
          <span><b>{data.activeCount}</b> session สด</span>
          <span><b>{data.totalSessions}</b> รวม</span>
        </span>
        <span className="sf-clock">{clock}</span>
      </div>

      <div className="sf-body">
        {/* ── left: crew roster ── */}
        <div className="sf-col sf-left">
          <div className="sf-panelhead">CREW ROSTER <span className="sf-sub">{data.workingCount} ทำงาน / {data.crewCount} คน</span></div>
          <div className="sf-crew">
            {data.crew.map((c) => {
              const active = c.status === 'working' || c.status === 'delegate';
              const when = c.status === 'delegate' ? 'now' : ago(c.lastTs, now);
              return (
                <div key={c.key} className={`sf-row${active ? ' is-active' : ''}`}>
                  <span className="sf-who"><span className="sf-emoji">{c.emoji}</span><span className="sf-name">{c.name}</span></span>
                  <Pill status={c.status} />
                  <span className="sf-task">{c.task}</span>
                  <span className={`sf-when${when === 'now' ? ' now' : ''}`}>{when}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── right: sessions + feed ── */}
        <div className="sf-col sf-right">
          <div>
            <div className="sf-panelhead">LIVE SESSIONS</div>
            <div className="sf-sessions">
              {data.sessions.length === 0 && <div className="sf-empty">— ตอนนี้ทุกคนว่าง ไม่มี session ทำงาน —</div>}
              {data.sessions.map((s) => (
                <div key={s.id} className="sf-sess">
                  <span className="sf-sid">{s.id}</span>
                  <span className="sf-stitle">{s.title}{s.skill && <span className="sf-skill">/{s.skill}</span>}</span>
                  <Pill status={s.status} />
                </div>
              ))}
            </div>
          </div>
          <div className="sf-feed" ref={feedRef}>
            <div className="sf-panelhead" style={{ paddingLeft: 10, paddingTop: 4 }}>ACTIVITY FEED</div>
            {data.feed.length === 0 && <div className="sf-empty">— ยังไม่มีกิจกรรมสด —</div>}
            {data.feed.map((f) => {
              const k = `${f.ts}-${f.text}-${f.session}`;
              const kind = f.kind === 'delegate' ? 'delegate' : 'tool';
              return (
                <div key={k} data-k={k} className={`sf-frow ${kind}`}>
                  <span className="sf-fago">{ago(f.ts, now)}</span>
                  <span className={`sf-fsym ${kind}`}>{kind === 'delegate' ? '→' : '·'}</span>
                  <span className="sf-ftext">{f.text} <span className="sf-fsess">·{f.session}</span></span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="sf-note">
        {isLive
          ? <><b>● สด</b> — publisher กำลังเขียนสถานะจริงจาก ~/.claude/projects ทุกไม่กี่วินาที</>
          : <><b>สแนปช็อต</b> — เว็บ public เป็น static; นี่คือสถานะล่าสุดที่ publish ไว้. เปิด local + <code>publish_status.py --watch</code> เพื่อดูสด</>}
      </div>
    </div>
  );
}
