"use client";

// Lightweight i18n: a flat [ko, en] dictionary + context. Language persists in
// localStorage and defaults to the browser locale. Template copy is localized
// separately in lib/templates.ts (getTemplates), and the AI routes receive
// `lang` so generated copy matches the UI language.
import { createContext, useContext, useEffect, useState } from "react";

export type Lang = "ko" | "en";

const D = {
  // nav / hero
  nav_keys: ["API 키", "API Keys"],
  hero_overline: ["AI CARD NEWS TOOL", "AI CARD NEWS TOOL"],
  hero_h1_1: ["주제 하나,", "One topic,"],
  hero_h1_2: ["카드뉴스 한 세트.", "one full card set."],
  hero_sub: [
    "Claude가 카피와 레이아웃을 설계합니다. 캔버스에서 자유롭게 다듬고, PNG로 내보내세요.",
    "Claude drafts the copy and layout. Polish it on the canvas, export as PNG.",
  ],
  hero_ph: ["주제, 원문, 또는 YouTube 링크를 붙여넣으세요…", "Paste a topic, an article, or a YouTube link…"],
  gen_btn: ["카드 생성", "Generate"],
  gen_btn_yt: ["🎬 영상으로 생성", "🎬 From video"],
  gen_busy: ["생성 중…", "Generating…"],
  st_yt: ["유튜브 자막 가져오는 중…", "Fetching captions…"],
  st_design: ["카드 설계 중…", "Designing cards…"],
  fmt_11: ["정사각형 · 인스타 피드", "Square · IG feed"],
  fmt_45: ["세로 · 피드 점유율 최대", "Portrait · max feed presence"],
  fmt_916: ["풀스크린 · 스토리/릴스", "Full screen · Stories/Reels"],
  model_soon: ["준비 중", "soon"],
  ref_none: ["스타일 참고 없음", "No style reference"],
  accent_label: ["포인트", "Accent"],
  accent_auto: ["자동", "Auto"],
  brand_label: ["브랜드", "Brand"],
  brand_ignore: ["무시", "Ignore"],
  brand_title: [
    "브랜드 포인트 색 — 바꾸면 이 색을 쓰던 요소가 전부 자동으로 바뀝니다. '무시'를 켜면 이 세트만 브랜드에서 분리됩니다.",
    "Brand point color — changing it recolors every element using it. Turn on 'Ignore' to detach just this set from the brand.",
  ],
  accent_title: [
    "브랜드 포인트 색 — 항상 이 색으로 강조하고 저장됩니다. '자동'이면 AI가 고릅니다.",
    "Brand accent — always used as the point color and saved. 'Auto' lets the AI pick.",
  ],
  blank_start: ["또는 빈 캔버스에서 시작 →", "Or start from a blank canvas →"],
  blank_card: ["빈 캔버스로 시작", "Blank canvas"],
  banner_none: ["연결된 API 키가 없어요 — ", "No API key connected — "],
  banner_none_cta: ["원하는 키 연결하기", "connect one"],
  banner_need_mid: ["모델은", "needs an"],
  banner_need_tail: ["키가 필요해요 — ", "key — "],
  banner_need_cta: ["연결하기", "connect"],
  modal_title: ["API 키 관리", "API Keys"],
  tpl_title: ["템플릿으로 시작", "Start from a template"],
  tpl_sub: [
    "클릭하면 바로 편집할 수 있는 예시 세트가 열립니다. 색·문구·레이아웃 전부 내 것으로 바꿔보세요.",
    "Click any set to open it in the editor — make the colors, copy, and layout yours.",
  ],
  proj_title: ["내 프로젝트", "My projects"],
  cards_unit: ["장", " cards"],
  new_project_name: ["새 카드뉴스", "New card set"],
  empty_title_text: ["타이틀을 입력하세요", "Your title here"],
  yt_fallback_name: ["유튜브 카드뉴스", "YouTube card set"],

  // how it works
  how_h2: ["주제가 카드가 되는 과정", "From topic to finished cards"],
  how_sub: [
    "Claude가 카피·색·레이아웃을 JSON으로 설계하고, 캔버스에서는 요소를 집어 옮기기만 하면 됩니다. 수정은 채팅 한 줄로도 끝나요.",
    "Claude designs the copy, colors, and layout as JSON. On the canvas you just drag things around — or fix anything with one chat message.",
  ],
  how_cap1_t: ["01 · AI가 설계", "01 · AI drafts"],
  how_cap1_b: [
    "주제 하나로 훅 → 본문 → CTA까지, 카드 세트 전체를 구조화된 JSON으로 뽑아냅니다.",
    "One topic becomes a full hook → body → CTA card set, emitted as structured JSON.",
  ],
  how_cap2_t: ["02 · 캔버스에서 다듬기", "02 · Refine on canvas"],
  how_cap2_b: [
    "드래그하면 다른 요소에 딱 맞게 스냅되고, 채팅으로 “더 강하게” 한마디면 AI가 고칩니다.",
    "Elements snap to each other as you drag, and “make it punchier” in chat is all it takes.",
  ],
  demo_typing: ["퇴근 후 사이드프로젝트 시작하는 법", "How to start a side project after work"],
  demo_title_txt: ["타이틀은 크게", "Make it bold"],
  demo_chat: ["“타이틀 더 강하게” → 적용됨 ✓", "“Punch up the title” → applied ✓"],

  // footer
  footer_desc_1: ["오픈소스 AI 카드뉴스 스튜디오.", "Open-source AI card news studio."],
  footer_desc_2: [
    "로컬에서 돌아가고, 데이터는 브라우저에만 남습니다.",
    "Runs locally — your data stays in your browser.",
  ],
  footer_star_soon_1: ["GitHub 저장소 곧 공개 —", "GitHub repo coming soon —"],
  footer_star_soon_2: ["오픈하면 Star 한 번씩 부탁드려요 ⭐", "drop a star when it lands ⭐"],
  footer_star: ["⭐ GitHub에서 Star 하기", "⭐ Star on GitHub"],
  footer_follow: ["만든 사람 팔로우", "Follow the maker"],
  footer_follow_note: [
    "만드는 과정을 공유하고 있어요. 팔로우해 주시면 큰 힘이 됩니다 🙌",
    "Building in public — a follow means a lot 🙌",
  ],

  // key panel
  keys_get: ["키 발급 ↗", "Get key ↗"],
  keys_has: ["등록됨", "Connected"],
  keys_none: ["키 없음", "No key"],
  keys_ph_new: ["키 붙여넣기", "Paste key"],
  keys_ph_replace: ["새 키로 교체하기", "Replace with a new key"],
  keys_save: ["저장", "Save"],
  keys_fail: ["저장에 실패했습니다.", "Failed to save."],
  keys_unwritable: [
    "배포 환경에서는 환경 변수로 설정하세요. (로컬 dev에서만 저장 가능)",
    "Set env vars on your deployment platform. (In-app save works in local dev only)",
  ],
  keys_hint: [
    ".env.local에 저장 · 즉시 적용 · 값은 서버에만 남습니다. 키를 연결하면 해당 프로바이더 모델이 바로 열립니다.",
    "Saved to .env.local · applied instantly · never leaves the server. Connect a key and that provider's models unlock immediately.",
  ],

  // editor
  ed_back: ["← 목록", "← Back"],
  ed_undo: ["↩ 실행취소", "↩ Undo"],
  ed_export_one: ["이 카드 PNG", "Card PNG"],
  ed_export_all: ["전체 내보내기", "Export all"],
  ed_exporting: ["내보내는 중…", "Exporting…"],
  ed_add_card: ["+ 카드 추가", "+ Add card"],
  ed_slideshow: ["▶ 슬라이드쇼", "▶ Slideshow"],
  ed_export_fail: ["PNG 내보내기에 실패했습니다.", "PNG export failed."],
  ed_model_title: ["AI 모델", "AI model"],
  ed_key_missing: ["KEY 없음", "no key"],
  th_up: ["위로", "Up"],
  th_down: ["아래로", "Down"],
  th_dup: ["복제", "Duplicate"],
  th_del: ["삭제", "Delete"],
  sel_card: ["카드", "Card"],
  sel_text: ["텍스트", "Text"],
  sel_shape: ["도형", "Shape"],
  sel_image: ["이미지", "Image"],

  // usage popover
  usage_title: ["이 프로젝트의 AI 사용량", "AI usage for this project"],
  usage_total: ["총 비용", "Total cost"],
  usage_calls: ["AI 호출", "AI calls"],
  usage_in: ["입력 토큰", "Input tokens"],
  usage_out: ["출력 토큰", "Output tokens"],
  usage_cache: ["캐시 읽기 / 쓰기", "Cache read / write"],
  usage_note: [
    "이 프로젝트 누적 · 로컬 추정치 (청구 기준과 미세 차이 가능)",
    "Project total · local estimate (may differ slightly from billing)",
  ],

  // inspector
  insp_title: ["속성", "Properties"],
  insp_add_text: ["+ 텍스트", "+ Text"],
  insp_add_shape: ["+ 도형", "+ Shape"],
  insp_add_image: ["+ 이미지", "+ Image"],
  insp_content: ["내용", "Text"],
  insp_size: ["크기", "Size"],
  insp_weight: ["굵기", "Weight"],
  insp_color: ["색상", "Color"],
  insp_lh: ["행간", "Leading"],
  insp_ls: ["자간 (em)", "Tracking (em)"],
  insp_font: ["폰트", "Font"],
  insp_font_theme: ["테마 기본", "Theme default"],
  insp_font_sans: ["고딕 (Pretendard)", "Sans (Pretendard)"],
  insp_font_serif: ["명조 (Serif)", "Serif"],
  insp_align: ["정렬", "Align"],
  insp_left: ["왼쪽", "Left"],
  insp_center: ["가운데", "Center"],
  insp_right: ["오른쪽", "Right"],
  insp_fit: ["채우기", "Fit"],
  insp_fit_cover: ["꽉 채움 (cover)", "Fill (cover)"],
  insp_fit_contain: ["원본 비율 (contain)", "Fit (contain)"],
  insp_radius: ["둥글기", "Radius"],
  insp_dim: ["딤 (어둡게)", "Dim"],
  insp_delete: ["요소 삭제", "Delete element"],
  insp_opacity: ["투명도 (알파)", "Opacity"],
  insp_layers: ["레이어", "Layers"],
  insp_layer: ["레이어 순서", "Layer order"],
  layer_dim: ["딤 배경", "Dim overlay"],
  layer_bg_image: ["배경 이미지", "Background image"],
  lyr_back: ["맨뒤", "Back"],
  lyr_backward: ["뒤로", "Down"],
  lyr_forward: ["앞으로", "Up"],
  lyr_front: ["맨앞", "Front"],
  insp_card_bg: ["카드 배경", "Card background"],
  insp_bg_css: ["배경 (색상/그라디언트 CSS)", "Background (color/gradient CSS)"],
  insp_bg_pick: ["배경 색상 선택", "Pick a background color"],
  insp_theme: ["테마 (새 카드 기본값)", "Theme (defaults for new cards)"],
  insp_theme_bg: ["배경", "BG"],
  insp_theme_text: ["텍스트", "Text"],
  insp_theme_accent: ["포인트", "Accent"],
  insp_hint: [
    "요소를 클릭하면 속성이, 더블클릭하면 텍스트 편집이 열립니다. 드래그 중에는 다른 요소와 자동 정렬(스냅)됩니다.",
    "Click an element for properties, double-click text to edit inline. Dragging snaps to other elements.",
  ],

  // chat panel
  chat_title: ["AI 편집", "AI edit"],
  chat_hint: [
    "선택한 카드/요소를 자연어로 수정하세요. 이미지를 붙여넣거나 끌어다 놓으면 카드에 넣어달라고 요청할 수 있습니다.",
    "Edit the selected card or element in plain language. Paste or drop images and ask to place them on a card.",
  ],
  chat_thinking: ["생각 중…", "Thinking…"],
  chat_ph: ["수정 요청을 입력하세요… (이미지 붙여넣기 가능)", "Ask for changes… (you can paste images)"],
  chat_send: ["보내기", "Send"],
  chat_attach: ["이미지 첨부", "Attach image"],
  chat_q1: ["이 카드 타이틀 더 강하게", "Punch up this card's title"],
  chat_q2: ["전체 색 일관성 정리해줘", "Unify colors across cards"],
  chat_q3: ["마지막에 CTA 카드 추가", "Add a CTA card at the end"],
  chat_q4: ["어울리는 배경 사진 깔아줘", "Add fitting photo backgrounds"],
  chat_img_fail: ["이미지를 읽을 수 없습니다.", "Couldn't read that image."],
  chat_req_fail: ["요청에 실패했습니다.", "Request failed."],
  chat_applied: ["개 반영됨", " changes applied"],
  chat_no_change: ["완료 · 변경 없음", "Done · no change"],
  chat_tpl: ["템플릿 참조", "Reference template"],
  chat_tpl_pick: ["참조할 템플릿 선택", "Pick a template to reference"],
  chat_tpl_active: ["스타일 참조 중", "referenced as style"],

  // model picker
  mp_more: ["모든 모델 보기", "All models"],
  mp_less: ["주력만 보기", "Recommended only"],
  mp_connect: ["키 연결", "Connect key"],
  mp_speed: ["속도", "Speed"],

  // generation (home → editor streaming)
  gen_designing: ["카드 설계 중…", "Designing cards…"],

  // hosted deploy — "this is a preview, run it locally" banner + install guide
  hosted_banner: [
    "미리보기예요 — Card News Studio는 내 컴퓨터에서 실행됩니다.",
    "This is a preview — Card News Studio runs on your own computer.",
  ],
  hosted_banner_cta: ["설치 방법 보기", "How to install"],
  hosted_nav_install: ["로컬 설치", "Install locally"],
  inst_title: ["내 컴퓨터에서 실행하기", "Run it on your computer"],
  inst_lede: [
    "Card News Studio는 여러분의 컴퓨터에서 직접 돌아갑니다. 이 페이지는 미리보기예요 — 실제로 카드를 만들려면 아래 3단계로 설치하세요. 처음 한 번만 설정하면 됩니다.",
    "Card News Studio runs entirely on your own computer. This page is a preview — to actually make cards, install it with the three steps below. You only set it up once.",
  ],
  inst_badge_free: ["무료 · 오픈소스 (MIT)", "Free · open source (MIT)"],
  inst_badge_local: ["100% 로컬 실행", "Runs 100% locally"],
  inst_badge_key: ["데이터·API 키가 이 컴퓨터를 안 떠남", "Data & keys never leave your machine"],
  inst_os_mac: ["macOS", "macOS"],
  inst_os_win: ["Windows", "Windows"],
  inst_s1_t: ["준비물 설치하기", "Install the essentials"],
  inst_s1_mac: [
    "Node.js와 Git이 필요합니다. 아래 버튼으로 각각 설치하세요. Homebrew를 쓴다면 터미널에 아래 한 줄이면 끝납니다.",
    "You need Node.js and Git. Install each with the buttons below — or, if you use Homebrew, one line does it:",
  ],
  inst_s1_win: [
    "Node.js와 Git이 필요합니다. 아래 버튼으로 설치 파일을 받아 '다음'만 눌러 설치하세요. Node.js에는 npm이 함께 들어 있습니다.",
    "You need Node.js and Git. Download each installer below and click through the prompts. Node.js includes npm.",
  ],
  inst_get_node: ["Node.js 받기 ↗", "Get Node.js ↗"],
  inst_get_git: ["Git 받기 ↗", "Get Git ↗"],
  inst_s2_t: ["코드 받아서 실행하기", "Download it and start"],
  inst_s2_desc: [
    "터미널(Windows는 PowerShell)을 열고 아래 명령을 한 줄씩 붙여넣으세요.",
    "Open Terminal (PowerShell on Windows) and paste these commands one line at a time.",
  ],
  inst_s2_note: [
    "마지막 줄(npm run dev)은 켜 둔 채로 두세요 — 이 창을 닫으면 앱도 멈춥니다.",
    "Leave the last line (npm run dev) running — closing that window stops the app.",
  ],
  inst_s3_t: ["열고, 키 연결하기", "Open it and connect a key"],
  inst_s3_desc: [
    "브라우저에서 localhost:3000을 여세요. 오른쪽 위 🔑 API 키를 눌러 Anthropic(Claude) 또는 OpenAI 키를 붙여넣으면 바로 카드 생성이 열립니다. 키는 이 컴퓨터의 .env.local 파일에만 저장됩니다.",
    "Open localhost:3000 in your browser. Click 🔑 API Keys (top right) and paste an Anthropic (Claude) or OpenAI key — generation unlocks instantly. The key is saved only to .env.local on your computer.",
  ],
  inst_s3_key_a: ["Anthropic 키 발급 ↗", "Get an Anthropic key ↗"],
  inst_s3_key_o: ["OpenAI 키 발급 ↗", "Get an OpenAI key ↗"],
  inst_copy: ["복사", "Copy"],
  inst_copied: ["복사됨 ✓", "Copied ✓"],
  inst_browser_hint: ["여기서 카드 생성·편집·PNG 내보내기를 합니다.", "Generate, edit, and export PNGs right here."],
  inst_source: ["소스 코드 보기 (GitHub) ↗", "View source on GitHub ↗"],
} as const;

export type DictKey = keyof typeof D;

const LangCtx = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({
  lang: "ko",
  setLang: () => {},
});

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("ko");
  useEffect(() => {
    const saved = window.localStorage.getItem("cardnews.lang");
    if (saved === "ko" || saved === "en") setLangState(saved);
    else if (!navigator.language?.startsWith("ko")) setLangState("en");
  }, []);
  const setLang = (l: Lang) => {
    setLangState(l);
    window.localStorage.setItem("cardnews.lang", l);
  };
  return <LangCtx.Provider value={{ lang, setLang }}>{children}</LangCtx.Provider>;
}

export function useLang() {
  const { lang, setLang } = useContext(LangCtx);
  const t = (key: DictKey) => D[key][lang === "ko" ? 0 : 1];
  return { lang, setLang, t };
}
