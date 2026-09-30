"use client";

// /export — the web editor's projects live only in this browser's localStorage.
// Since the hosted deploy became the product site (v0.12), this page is how
// those users take their work to the desktop app: one .cardnews.json per
// project (images inlined), imported there with ⬆ Import.
import { useEffect, useState } from "react";
import { LangProvider, useLang } from "@/lib/i18n";
import { readLocal } from "@/lib/store";
import { exportProject } from "@/lib/transfer";
import type { Project } from "@/lib/types";
import LogoMark from "@/components/LogoMark";
import LangSwitch from "@/components/LangSwitch";

function Body() {
  const { lang } = useLang();
  const ko = lang === "ko";
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => setProjects(readLocal()), []);

  const all = async () => {
    if (!projects) return;
    setBusy(true);
    for (const p of projects) {
      await exportProject(p);
      // Browsers throttle bursts of downloads; a short gap keeps them all.
      await new Promise((r) => setTimeout(r, 400));
    }
    setBusy(false);
  };

  return (
    <div className="privacy-page">
      <header className="home-nav">
        <a className="logo" href="/">
          <LogoMark size={22} /> Card News Studio
        </a>
        <div className="nav-actions">
          <LangSwitch />
        </div>
      </header>
      <main className="privacy-main">
        <h1>{ko ? "웹 버전 프로젝트 내보내기" : "Export your web-version projects"}</h1>
        <p>
          {ko
            ? "브라우저에서 만든 카드뉴스는 이 브라우저에만 저장돼 있어요. 아래에서 파일(.cardnews.json)로 받은 뒤, 데스크톱 앱 홈의 ⬆ 가져오기로 불러오세요. 이 페이지는 아무것도 서버로 보내지 않습니다."
            : "Carousels you made in the browser are stored only in this browser. Download them below as .cardnews.json files, then load them with ⬆ Import on the desktop app's home screen. Nothing on this page is sent to a server."}
        </p>
        {projects === null ? null : projects.length === 0 ? (
          <p>
            {ko
              ? "이 브라우저에는 저장된 프로젝트가 없어요. 다른 브라우저나 기기에서 만들었다면 거기서 이 페이지를 열어 주세요."
              : "No projects are stored in this browser. If you made them in another browser or on another device, open this page there."}
          </p>
        ) : (
          <>
            <p>
              <button className="btn primary" disabled={busy} onClick={all}>
                {ko ? `전체 받기 (${projects.length}개)` : `Download all (${projects.length})`}
              </button>
            </p>
            <ul className="export-list">
              {projects.map((p) => (
                <li key={p.id}>
                  <span>
                    {p.name || (ko ? "제목 없음" : "Untitled")}{" "}
                    <small>
                      · {p.cards?.length ?? 0} {ko ? "장" : "slides"}
                    </small>
                  </span>
                  <button className="btn small ghost" onClick={() => void exportProject(p)}>
                    ⬇
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
        <p>
          <a href="/" className="privacy-repo">
            {ko ? "← 데스크톱 앱 받기" : "← Get the desktop app"}
          </a>
        </p>
      </main>
    </div>
  );
}

export default function ExportPage() {
  return (
    <LangProvider>
      <Body />
    </LangProvider>
  );
}
