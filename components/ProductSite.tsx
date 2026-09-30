"use client";

// The hosted deploy's front page since the desktop app (v0.12): a product site
// in ZTO's shape — hero + download, how it works, features, AI, pricing, data,
// FAQ. The editor itself runs in the desktop app (or `bun dev` from source).
// Copy lives here, not in lib/i18n.tsx, because nothing else uses it.
import { LangProvider, useLang } from "@/lib/i18n";
import {
  BUY_URL,
  CONTACT_EMAIL,
  DOWNLOAD_MAC_ARM,
  DOWNLOAD_MAC_INTEL,
  GITHUB_URL,
  PRICE_ONE_TIME,
} from "@/lib/site";
import LogoMark from "./LogoMark";
import LangSwitch from "./LangSwitch";
import HowItWorks from "./HowItWorks";

type L = [string, string];

const C = {
  nav_features: ["기능", "Features"],
  nav_pricing: ["요금", "Pricing"],
  nav_faq: ["FAQ", "FAQ"],
  nav_download: ["다운로드", "Download"],
  overline: ["AI 카드뉴스 스튜디오 · macOS", "AI CAROUSEL STUDIO · macOS"],
  h1a: ["레퍼런스 하나,", "One reference,"],
  h1b: ["카드뉴스 한 세트.", "one full carousel."],
  sub: [
    "잘 된 게시물 링크와 하고 싶은 이야기를 주면, Claude가 그 형식으로 한 세트를 설계해요. 캔버스와 AI 채팅으로 다듬고 PNG로 내보내세요. 전부 내 컴퓨터에서.",
    "Give it a post that worked and the story you want to tell — Claude designs a set in that format. Polish it on the canvas and in AI chat, export PNGs. All on your own computer.",
  ],
  dl_arm: ["Mac용 다운로드 (Apple Silicon)", "Download for Mac (Apple Silicon)"],
  dl_intel: ["Intel Mac", "Intel Mac"],
  dl_note: [
    `3일 무료 · 이후 ${PRICE_ONE_TIME} 한 번 결제로 평생 · 소스 빌드는 언제나 무료`,
    `3 days free · then ${PRICE_ONE_TIME} once, yours for life · source builds are always free`,
  ],
  feat_title: ["만드는 방식 그대로", "Built the way carousels get made"],
  ai_title: ["AI는 이미 가진 걸로", "AI you already pay for"],
  ai_body: [
    "Claude 구독이 있다면(Claude Code 로그인) 키 없이 그대로 돌아가요 — 생성 비용 $0. API 키를 쓰고 싶다면 Anthropic·OpenAI·Gemini 키를 넣으면 되고, 키는 macOS 키체인에 암호화해 이 컴퓨터에만 저장돼요. 우리 서버는 끼어들지 않습니다.",
    "Have a Claude subscription (logged in to Claude Code)? It just works — no key, $0 per generation. Prefer an API key? Add Anthropic, OpenAI or Gemini; it's encrypted with the macOS keychain and stays on this computer. Our servers are never in the loop.",
  ],
  price_title: ["요금", "Pricing"],
  price_sub: ["한 번 사면 끝. 구독 없어요.", "Buy once. No subscription."],
  p_src_name: ["소스 빌드", "Source build"],
  p_src_price: ["무료", "Free"],
  p_src_1: ["GitHub에서 직접 빌드", "Build it yourself from GitHub"],
  p_src_2: ["모든 기능, 키 필요 없음", "Every feature, no key"],
  p_src_3: ["업데이트는 git pull로", "Update with git pull"],
  p_src_cta: ["소스 보기", "View source"],
  p_std_name: ["Card News Studio", "Card News Studio"],
  p_std_price: [`${PRICE_ONE_TIME} · 평생`, `${PRICE_ONE_TIME} · lifetime`],
  p_std_1: ["서명·공증된 Mac 앱, 설치 한 번", "Signed & notarized Mac app, one install"],
  p_std_2: ["자동 업데이트", "Automatic updates"],
  p_std_3: ["AI는 내 Claude 구독이나 API 키로", "AI on your own Claude plan or API key"],
  p_std_4: ["3일 무료로 먼저 써보기", "Try it free for 3 days first"],
  p_std_cta: ["구매하기", "Buy"],
  p_plus_name: ["Plus", "Plus"],
  p_plus_price: ["준비 중", "Coming soon"],
  p_plus_1: ["키도 구독도 없이 바로 AI", "AI with no key and no subscription"],
  p_plus_2: ["월 정액, 언제든 해지", "Monthly, cancel any time"],
  data_title: ["데이터는 내 컴퓨터에만", "Your data stays on your computer"],
  data_body: [
    "프로젝트·레퍼런스·사진은 앱 데이터 폴더의 파일로 저장돼요. 계정도, 클라우드 동기화도, 우리 서버도 없습니다. 폴더를 복사하면 그게 백업이고, 설정 → 내 데이터에서 언제든 전부 지울 수 있어요. 라이선스 확인만 결제 대행사(Lemon Squeezy) API와 직접 통신합니다.",
    "Projects, references and photos are plain files in the app's data folder. No account, no cloud sync, no server of ours. Copying the folder is your backup, and Settings → Your data erases everything. The only outside call we make is license verification, straight to our payment provider (Lemon Squeezy).",
  ],
  faq_title: ["자주 묻는 질문", "FAQ"],
  footer_terms: ["이용약관", "Terms"],
  footer_refunds: ["환불 정책", "Refunds"],
  footer_privacy: ["개인정보", "Privacy"],
  footer_export: ["웹 버전 프로젝트 내보내기", "Export web-version projects"],
} satisfies Record<string, L>;

const FEATURES: { h: L; b: L }[] = [
  {
    h: ["레퍼런스 먼저", "Reference first"],
    b: [
      "Instagram·LinkedIn·TikTok 게시물 링크를 넣으면 슬라이드를 전부 읽어 구성·글 배치·톤을 측정하고 그대로 따라 설계해요.",
      "Paste an Instagram, LinkedIn or TikTok post — every slide is read, its layout, type and tone measured, and your set follows it.",
    ],
  },
  {
    h: ["영상 → 카드뉴스", "Video → carousel"],
    b: [
      "유튜브·틱톡 링크의 자막을 가져와 실제 대사를 인용한 한 세트로 바꿔요.",
      "Pulls captions from a YouTube or TikTok link and turns them into a set that quotes the real lines.",
    ],
  },
  {
    h: ["내 사진으로", "Your own photos"],
    b: [
      "사진을 넣으면 피사체를 피해 글을 배치하고, 레퍼런스의 사진 구도(한 장·위아래·그리드)까지 맞춰요.",
      "Drop in photos — copy is placed off the subject, matching the reference's photo layouts (full, stacked, grid).",
    ],
  },
  {
    h: ["캔버스 + AI 채팅", "Canvas + AI chat"],
    b: [
      "드래그·스마트 가이드로 직접 다듬거나, \"사진 얼굴이 잘렸어\" 처럼 말로 고치세요.",
      "Drag with smart guides, or just say \"the face is cut off\" and let the chat fix it.",
    ],
  },
  {
    h: ["출력 언어 자동", "Output language, automatic"],
    b: [
      "UI 언어와 상관없이 원문 언어로 쓰고, 가르치는 단어(예: 영어 강의 속 한국어)는 번역하지 않아요.",
      "Copy follows the source's language, not the UI's — and the words being taught stay untranslated.",
    ],
  },
  {
    h: ["PNG 내보내기", "PNG export"],
    b: [
      "1080px 기준 그대로, 캔버스에서 본 것과 똑같이 내보내요.",
      "Exports at 1080px, pixel-for-pixel what you saw on the canvas.",
    ],
  },
];

const FAQ: { q: L; a: L }[] = [
  {
    q: ["웹 버전은 어디 갔나요?", "What happened to the web version?"],
    a: [
      "Card News Studio는 이제 데스크톱 앱이에요. 브라우저에서 만든 프로젝트는 그 브라우저에 그대로 있으니, 내보내기 페이지에서 파일로 받은 뒤 앱의 ⬆ 가져오기로 옮기세요.",
      "Card News Studio is now a desktop app. Projects you made in the browser are still in that browser — download them on the export page, then bring them in with ⬆ Import in the app.",
    ],
  },
  {
    q: ["Claude 구독으로 쓰려면?", "How do I use my Claude subscription?"],
    a: [
      "Claude Code를 설치하고 로그인해 두면 앱이 자동으로 찾아요. 모델 선택에 'Claude 구독' 항목이 뜹니다.",
      "Install Claude Code and log in — the app finds it automatically and a 'Claude subscription' group appears in the model picker.",
    ],
  },
  {
    q: ["무료 기간이 끝나면?", "What happens after the free days?"],
    a: [
      "AI 생성·편집이 잠기고, 만든 프로젝트는 그대로 보고 내보낼 수 있어요. 라이선스 키를 넣으면 바로 풀립니다.",
      "AI generation and editing lock; your projects stay viewable and exportable. Enter a license key and everything unlocks.",
    ],
  },
  {
    q: ["Windows는요?", "Windows?"],
    a: [
      "아직 공식 빌드는 Mac만 있어요. Windows에서는 GitHub 소스로 직접 실행할 수 있어요(bun dev).",
      "Official builds are Mac-only for now. On Windows you can run it from source (bun dev).",
    ],
  },
  {
    q: ["환불되나요?", "Can I get a refund?"],
    a: [
      "구매 후 14일 안에 메일 주시면 이유 불문 전액 환불해 드려요.",
      "Email us within 14 days of purchase for a full refund, no questions asked.",
    ],
  },
];

function Site() {
  const { lang } = useLang();
  const i = lang === "ko" ? 0 : 1;
  const c = (k: keyof typeof C) => C[k][i];

  return (
    <div className="site">
      <header className="home-nav">
        <a className="logo" href="/">
          <LogoMark size={22} /> Card News Studio
        </a>
        <div className="nav-actions">
          <a className="btn ghost site-navlink" href="#features">
            {c("nav_features")}
          </a>
          <a className="btn ghost site-navlink" href="#pricing">
            {c("nav_pricing")}
          </a>
          <a className="btn ghost site-navlink" href="#faq">
            {c("nav_faq")}
          </a>
          <LangSwitch />
          {GITHUB_URL && (
            <a className="btn ghost nav-github" href={GITHUB_URL} target="_blank" rel="noreferrer">
              GitHub ⭐
            </a>
          )}
          <a className="btn primary" href="#download">
            {c("nav_download")}
          </a>
        </div>
      </header>

      <section className="hero site-hero" id="download">
        <div className="overline">{c("overline")}</div>
        <h1>
          {c("h1a")}
          <br />
          {c("h1b")}
        </h1>
        <p className="hero-sub">{c("sub")}</p>
        <div className="site-dl">
          <a className="btn primary site-dl-main" href={DOWNLOAD_MAC_ARM}>
            {c("dl_arm")}
          </a>
          <a className="btn ghost" href={DOWNLOAD_MAC_INTEL}>
            {c("dl_intel")}
          </a>
        </div>
        <p className="site-dl-note">{c("dl_note")}</p>
      </section>

      <HowItWorks />

      <section className="site-sec" id="features">
        <h2>{c("feat_title")}</h2>
        <div className="site-grid">
          {FEATURES.map((f) => (
            <div className="site-card" key={f.h[1]}>
              <h3>{f.h[i]}</h3>
              <p>{f.b[i]}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="site-sec narrow">
        <h2>{c("ai_title")}</h2>
        <p className="site-lead">{c("ai_body")}</p>
      </section>

      <section className="site-sec" id="pricing">
        <h2>{c("price_title")}</h2>
        <p className="site-lead center">{c("price_sub")}</p>
        <div className="site-prices">
          <div className="site-price">
            <h3>{c("p_src_name")}</h3>
            <div className="site-amount">{c("p_src_price")}</div>
            <ul>
              <li>{c("p_src_1")}</li>
              <li>{c("p_src_2")}</li>
              <li>{c("p_src_3")}</li>
            </ul>
            {GITHUB_URL && (
              <a className="btn ghost" href={GITHUB_URL} target="_blank" rel="noreferrer">
                {c("p_src_cta")}
              </a>
            )}
          </div>
          <div className="site-price featured">
            <h3>{c("p_std_name")}</h3>
            <div className="site-amount">{c("p_std_price")}</div>
            <ul>
              <li>{c("p_std_1")}</li>
              <li>{c("p_std_2")}</li>
              <li>{c("p_std_3")}</li>
              <li>{c("p_std_4")}</li>
            </ul>
            <a className="btn primary" href={BUY_URL} target="_blank" rel="noreferrer">
              {c("p_std_cta")}
            </a>
          </div>
          <div className="site-price muted">
            <h3>{c("p_plus_name")}</h3>
            <div className="site-amount">{c("p_plus_price")}</div>
            <ul>
              <li>{c("p_plus_1")}</li>
              <li>{c("p_plus_2")}</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="site-sec narrow" id="data">
        <h2>{c("data_title")}</h2>
        <p className="site-lead">{c("data_body")}</p>
      </section>

      <section className="site-sec narrow" id="faq">
        <h2>{c("faq_title")}</h2>
        {FAQ.map((f) => (
          <details className="site-faq" key={f.q[1]}>
            <summary>{f.q[i]}</summary>
            <p>
              {f.a[i]}
              {f.q[1].startsWith("What happened") && (
                <>
                  {" "}
                  <a href="/export">→ /export</a>
                </>
              )}
            </p>
          </details>
        ))}
      </section>

      <footer className="site-foot">
        <div className="logo">
          <LogoMark size={18} /> Card News Studio
        </div>
        <nav>
          <a href="/terms">{c("footer_terms")}</a>
          <a href="/refunds">{c("footer_refunds")}</a>
          <a href="/privacy">{c("footer_privacy")}</a>
          <a href="/export">{c("footer_export")}</a>
          {GITHUB_URL && (
            <a href={GITHUB_URL} target="_blank" rel="noreferrer">
              GitHub
            </a>
          )}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
        </nav>
      </footer>
    </div>
  );
}

export default function SiteRoot() {
  return (
    <LangProvider>
      <Site />
    </LangProvider>
  );
}
