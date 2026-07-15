"use client";

// Privacy notice (/privacy) — a plain-language statement of what this app does
// and does not do with data. Every claim mirrors the actual architecture:
// localStorage-only projects, BYOK keys sent browser→provider (hosted), Vercel
// Web Analytics (cookieless). If the architecture changes, update this page in
// the same PR.
import { LangProvider, useLang } from "@/lib/i18n";
import { GITHUB_URL } from "@/lib/site";
import LogoMark from "@/components/LogoMark";
import LangSwitch from "@/components/LangSwitch";

const UPDATED = "2026-07-15";

type Section = { h: [string, string]; body: [string, string][] };

const SECTIONS: Section[] = [
  {
    h: ["작업물과 설정", "Your projects and settings"],
    body: [
      [
        "브라우저에서 쓸 때, 만든 카드뉴스·채팅 기록·설정은 전부 이 브라우저(localStorage)에만 저장됩니다. 서버에 업로드되거나 저장되지 않으며, 운영자는 볼 수 없습니다. 브라우저 데이터를 지우면 함께 사라지니 ⬇ 내보내기로 백업하세요.",
        "In the browser, everything you make — card sets, chat history, settings — is stored only in this browser (localStorage). Nothing is uploaded to or stored on a server, and the operator cannot see it. Clearing browser data erases it, so back up with ⬇ export.",
      ],
      [
        "로컬 설치에서 쓸 때는 작업물이 당신 컴퓨터의 파일(data/projects)로 저장됩니다. 어디로도 전송되지 않습니다.",
        "In a local install, projects are saved as files on your own computer (data/projects). They are never transmitted anywhere.",
      ],
    ],
  },
  {
    h: ["API 키", "API keys"],
    body: [
      [
        "브라우저에서 AI 기능을 쓰려면 본인의 API 키를 입력합니다. 키는 이 브라우저에만 저장되고(기본은 탭을 닫으면 삭제, '기억' 선택 시 localStorage), AI 사용 시 브라우저에서 선택한 제공자의 API(예: api.anthropic.com)로 직접 전송됩니다. 이 사이트의 서버는 키도, AI 요청 내용도 전달받지 않습니다. 지출 한도를 걸어둔 전용 키 사용을 권장합니다.",
        "To use AI features in the browser you provide your own API key. It is stored only in this browser (session-only by default; localStorage if you check \"remember\") and sent directly from your browser to your chosen provider's API (e.g. api.anthropic.com). This site's server receives neither your key nor your AI requests. We recommend a dedicated key with a spend limit.",
      ],
      [
        "로컬 설치에서는 키가 당신 컴퓨터의 .env.local 파일에만 있으며 컴퓨터 밖으로 나가지 않습니다.",
        "In a local install the key lives only in .env.local on your machine and never leaves it.",
      ],
    ],
  },
  {
    h: ["AI 제공자로 전송되는 것", "What goes to the AI provider"],
    body: [
      [
        "AI 생성/편집을 실행하면 입력한 주제·카드 내용·첨부 이미지(유튜브 링크를 쓰면 해당 영상의 자막 포함)가 당신이 선택한 제공자(Anthropic, OpenAI, Google)의 API로 전송됩니다. 그 데이터의 취급은 각 제공자의 개인정보 정책을 따릅니다: anthropic.com/privacy · openai.com/policies/privacy-policy · policies.google.com/privacy",
        "When you run an AI generation or edit, the topic, card contents and attached images you provide (plus video captions if you used a YouTube link) are sent to the provider you selected (Anthropic, OpenAI, or Google). That data is then governed by the provider's own privacy policy: anthropic.com/privacy · openai.com/policies/privacy-policy · policies.google.com/privacy",
      ],
      [
        "유튜브 링크의 자막·썸네일을 가져오는 것과 무료 사진 라이브러리 프록시는 키나 개인 데이터 없이 이 사이트의 서버를 경유합니다.",
        "Fetching YouTube captions/thumbnails and the free photo-library proxy do pass through this site's server — with no key and no personal data attached.",
      ],
    ],
  },
  {
    h: ["방문 통계", "Analytics"],
    body: [
      [
        "이 사이트는 Vercel Web Analytics를 사용합니다: 쿠키 없이, 개인을 식별하지 않는 집계 데이터(페이지뷰, 대략적인 지역·기기 종류)만 수집됩니다. 일부 버튼 클릭(생성 실행, 템플릿 선택, PNG 내보내기 등)이 익명 이벤트로 기록될 수 있으나, 입력한 내용·작업물·키는 절대 포함되지 않습니다.",
        "This site uses Vercel Web Analytics: cookieless, aggregated, non-identifying data only (page views, approximate region and device type). Some button clicks (generate, template select, PNG export, …) may be recorded as anonymous events — never with your typed content, projects, or keys.",
      ],
    ],
  },
  {
    h: ["오픈소스와 문의", "Open source & contact"],
    body: [
      [
        "이 앱은 MIT 라이선스 오픈소스입니다 — 위 내용 전부를 코드로 직접 확인할 수 있습니다. 질문이나 문제는 GitHub 이슈로 남겨주세요.",
        "This app is MIT-licensed open source — every claim above can be verified in the code. Questions or issues: open a GitHub issue.",
      ],
    ],
  },
];

function PrivacyBody() {
  const { lang, t } = useLang();
  const i = lang === "ko" ? 0 : 1;
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
        <h1>{t("keyd_privacy")}</h1>
        <p className="privacy-updated">
          {lang === "ko" ? "마지막 갱신" : "Last updated"}: {UPDATED}
        </p>
        {SECTIONS.map((s) => (
          <section key={s.h[1]}>
            <h2>{s.h[i]}</h2>
            {s.body.map((b, j) => (
              <p key={j}>{b[i]}</p>
            ))}
          </section>
        ))}
        {GITHUB_URL && (
          <p>
            <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="privacy-repo">
              GitHub ↗
            </a>
          </p>
        )}
      </main>
    </div>
  );
}

export default function PrivacyPage() {
  return (
    <LangProvider>
      <PrivacyBody />
    </LangProvider>
  );
}
