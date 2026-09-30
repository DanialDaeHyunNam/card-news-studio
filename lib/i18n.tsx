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
  hero_overline: [
    "AI CARD NEWS TOOL",
    "AI CAROUSEL TOOL",
  ],
  hero_h1_1: [
    "레퍼런스 하나,",
    "One reference,",
  ],
  hero_h1_2: [
    "카드뉴스 한 세트.",
    "one full carousel.",
  ],
  hero_sub: [
    "잘 된 게시물과 하고 싶은 이야기를 주면, Claude가 그 형식으로 한 세트를 설계해요. 이후엔 AI 채팅과 캔버스로 다듬고 PNG로 내보내세요.",
    "Bring a post that worked and the story you want to tell — Claude designs a set in that format. Then polish it with AI chat and export as PNG.",
  ],
  cards_auto: ["자동", "Auto"],
  ref_add_images: ["캡처 이미지", "Screenshots"],
  gen_busy: ["생성 중…", "Generating…"],
  // create wizard
  wz_s1: [
    "형식 레퍼런스",
    "Reference",
  ],
  wz_s2: [
    "무엇을 만들까",
    "Content",
  ],
  wz_s3: [
    "디자인",
    "Design",
  ],
  wz_s4: [
    "비율",
    "Size",
  ],
  wz_s5: [
    "AI 실행",
    "AI model",
  ],
  wz_back: ["이전", "Back"],
  wz_next: ["다음", "Next"],
  wz_skip: [
    "레퍼런스 없이 다음",
    "Skip",
  ],
  wz_generate: [
    "카드 생성",
    "Generate carousel",
  ],
  wz_need_goal: [
    "목표를 고르고 내용을 채워주세요",
    "Choose what you're making and fill it in",
  ],
  wz_need_model: [
    "AI 모델을 골라주세요",
    "Choose an AI model",
  ],
  wz_none: ["없음", "None"],
  wz_ref_q: [
    "어떤 형식을 따라 만들까요?",
    "Pick a format to follow",
  ],
  wz_ref_hint: [
    "잘 된 Instagram·LinkedIn·TikTok 게시물 링크를 넣으면 슬라이드를 전부 읽어와 구성·글 배치·톤을 벤치마킹해요.",
    "Paste a post that performed well on Instagram, LinkedIn or TikTok. We'll read every slide and match its structure, text layout and tone.",
  ],
  wz_an_running: ["레퍼런스와 사진을 분석하는 중…", "Analyzing the reference and your photos…"],
  wz_an_done: [
    "구성이 확정됐어요 — 카드를 만드는 중",
    "Layout locked — building the slides",
  ],
  wz_an_ask_title: ["확인이 필요해요", "A quick question first"],
  wz_an_fail: ["분석에 실패했어요", "Analysis failed"],
  wz_an_retry: ["다시 분석", "Retry analysis"],
  wz_an_back: ["설정으로 돌아가기", "Back to settings"],
  wz_an_cuts: ["필요한 컷 {need} · 올린 사진 {have}", "{need} photo slots · {have} photos uploaded"],
  wz_an_add_photos: ["사진 더 올리기", "Add more photos"],
  wz_an_added: ["사진 {n}장을 더 올렸어요. 다시 판단해 주세요.", "I added {n} more photos — please re-check."],
  wz_an_reanalyze: ["{n}장 추가 — 다시 분석", "Added {n} — re-analyze"],
  wz_an_answer_ph: [
    "직접 답하기 (예: 5장으로 줄여줘)",
    "Answer in your own words (e.g. make it 5 slides)",
  ],
  wz_an_send: ["답하기", "Reply"],
  wz_an_q_default: ["사진 구성 확인", "Photo layout check"],
  wz_brand: ["브랜드 포인트 색", "Brand accent color"],
  wz_brand_hint: [
    "세트 전체에서 딱 한 가지로 쓰는 강조 색이에요 — 라벨·번호·강조선·CTA처럼 눈이 가야 할 곳에만. 바꾸면 그 색을 쓰던 요소가 한꺼번에 바뀌어요.",
    "The one highlight color used across the set — labels, numbers, accent lines, CTAs. Change it later and every element using it updates together.",
  ],
  wz_brand_custom: ["지정", "Custom"],
  wz_brand_none: ["없음", "None"],
  wz_brand_auto_desc: ["AI가 레퍼런스·사진 분위기에 맞춰 골라요.", "The AI picks one to match the reference and photos."],
  wz_brand_custom_desc: ["이 색으로 고정해요. 다음 세트에도 기억돼요.", "Locked to this color — remembered for your next sets."],
  wz_brand_none_desc: ["포인트 색 없이 흰색·검정만으로 — 사진이 주인공인 미니멀한 세트에 좋아요.", "No accent at all, just black & white — great for photo-first, minimal sets."],
  ed_prev: [
    "이전 카드 (←)",
    "Previous slide (←)",
  ],
  ed_next: [
    "다음 카드 (→)",
    "Next slide (→)",
  ],
  ed_ref_toggle: ["레퍼런스 비교", "Compare reference"],
  ed_ref_title: ["레퍼런스 슬라이드를 옆에 띄워 비교해요", "Show the reference slides side by side"],
  ed_ref_none: ["이 세트엔 레퍼런스가 없어요", "No reference for this set"],
  ed_ref_none_hint: ["비교할 게시물 링크를 붙여넣으세요.", "Paste a post link to compare against."],
  ed_ref_follow: [
    "현재 카드 번호에 맞추기",
    "Follow the current slide",
  ],
  lib_title: ["레퍼런스 라이브러리", "Reference library"],
  lib_sub: [
    "지금까지 쓴 레퍼런스가 자동으로 쌓이고, 나중에 쓸 게시물은 링크로 미리 ★ 저장해 둘 수 있어요.",
    "Every reference you've used is kept here automatically — and you can ★ save posts ahead of time by link.",
  ],
  lib_all: ["전체", "All"],
  lib_fav: ["즐겨찾기", "Favorites"],
  lib_add_ph: ["나중에 쓸 게시물 링크 (Instagram·LinkedIn·TikTok)", "A post to save for later (Instagram, LinkedIn, TikTok)"],
  lib_add: ["저장", "Save"],
  lib_empty: ["아직 레퍼런스가 없어요. 생성 1단계에서 링크를 불러오면 여기 쌓여요.", "No references yet — links you load in step 1 collect here."],
  lib_empty_fav: ["즐겨찾기가 없어요. ☆를 누르거나 위에 링크를 저장해 보세요.", "No favorites yet — tap ☆ or save a link above."],
  lib_used: ["{n}회 사용 · {d}", "Used {n}× · {d}"],
  lib_saved: ["저장 {d}", "Saved {d}"],
  lib_open: ["원본 게시물 열기", "Open the original post"],
  lib_use: ["이걸로 만들기", "Use as reference"],
  lib_delete_confirm: ["이 레퍼런스를 라이브러리에서 뺄까요?", "Remove this reference from the library?"],
  lib_strip: ["내 레퍼런스", "My references"],
  lib_manage: ["관리", "Manage"],
  wz_intent: ["제작 의도·타깃 (선택이지만 강력 추천)", "Purpose & audience (optional, highly recommended)"],
  wz_intent_ph: [
    "누구에게, 무엇을 위한 콘텐츠인가요? 예) 영어권 사람들에게 한국어 욕/속어 뉘앙스를 알려주는 교육 콘텐츠 — 한국어 표현은 한국어 그대로 두고 설명만 영어로",
    "Who is it for and what should they get? e.g. Teaches English speakers the nuance of Korean slang — keep the Korean words in Hangul, explain in English",
  ],
  wz_intent_hint: [
    "AI가 카피를 쓸 때 가장 먼저 보는 기준이에요. 가르치는 표현·고유명사처럼 번역하면 안 되는 건 여기 적어두면 끝까지 지켜져요 (편집 화면 AI 채팅에도 이어져요).",
    "The first thing the AI writes against. Anything that must never be translated (taught words, names) stays protected — including in later chat edits.",
  ],
  wz_lang: ["결과물 언어", "Output language"],
  wz_lang_auto: ["자동", "Auto"],
  wz_lang_auto_same: ["원문과 같은 언어", "same language as the source"],
  wz_lang_auto_ui: ["내용을 넣으면 감지돼요", "detected from your text"],
  wz_lang_hint: [
    "자동은 자막·스크립트·스토리의 언어를 따라가요 (영어 스크립트면 영어로). 번역해서 올리고 싶으면 직접 고르세요.",
    "Auto follows the language of your subtitles/script/story (English script → English slides). Pick one to translate.",
  ],
  wz_platform_upload: ["캡처", "Screenshots"],
  wz_rec: ["추천", "Recommended"],
  wz_open_tpl: ["그대로 열기", "Open as-is"],
  demo_op: ["레퍼런스 형식 적용 ✓", "Reference format applied ✓"],
  wz_ref_tab_url: [
    "🔗 게시물 링크",
    "🔗 Post link",
  ],
  wz_ref_tab_tpl: ["템플릿", "Template"],
  wz_ref_tab_proj: [
    "내 프로젝트 스타일",
    "My projects",
  ],
  wz_ref_tab_none: [
    "없이 진행",
    "Skip",
  ],
  wz_ref_load: ["불러오기", "Load"],
  wz_ref_loading: ["읽는 중…", "Reading…"],
  wz_ref_bad_url: [
    "Instagram·LinkedIn·TikTok 게시물 링크가 아니에요.",
    "That isn't an Instagram, LinkedIn or TikTok post link.",
  ],
  wz_ref_fail: [
    "게시물을 읽지 못했어요.",
    "Couldn't read that post.",
  ],
  wz_ref_fallback: [
    "대신 게시물 슬라이드를 캡처해서 올려주세요 — 캡처를 그대로 레퍼런스로 씁니다.",
    "Upload screenshots of its slides instead — we'll use them as the reference.",
  ],
  wz_ref_shots: ["캡처 올리기", "Upload screenshots"],
  wz_ref_manual: [
    "링크 대신 캡처로 넣기",
    "Or use screenshots instead",
  ],
  wz_ref_more_shots: ["캡처 더 추가", "Add more screenshots"],
  wz_ref_partial: [
    "TikTok이 일부 정보(캡션·커버)만 줬어요. 슬라이드가 더 있으면 캡처로 넣어주세요.",
    "TikTok only shared the caption and cover. If there are more slides, add screenshots.",
  ],
  wz_ref_has_subs: [
    "영상 자막도 함께 읽었어요",
    "Subtitles included",
  ],
  wz_ref_has_texts: [
    "슬라이드별 텍스트도 함께 읽었어요",
    "Slide text included",
  ],
  wz_ref_none_hint: [
    "레퍼런스 없이 AI가 형식을 정해요. 다음 단계의 디자인 요청으로 방향을 줄 수 있어요.",
    "No reference — the AI picks the format. You can steer it with design notes in step 3.",
  ],
  wz_kind_carousel: ["캐러셀", "Carousel"],
  wz_kind_document: ["문서형 캐러셀", "Document carousel"],
  wz_kind_video: ["영상", "Video"],
  wz_kind_image: ["이미지", "Image"],
  wz_kind_text: ["텍스트", "Text"],
  wz_goal_q: ["무엇을 만들까요?", "What are you making?"],
  wz_goal_video: [
    "이미 있는 영상을 캐러셀로",
    "Turn a video into a carousel",
  ],
  wz_goal_video_sub: [
    "자막·스크립트를 카드로 펼쳐요",
    "Unfold its subtitles or script into slides",
  ],
  wz_goal_story: [
    "새 카드뉴스",
    "A new carousel",
  ],
  wz_goal_story_sub: [
    "원하는 스토리를 자세히 알려주세요",
    "Tell us the story you want to tell",
  ],
  wz_goal_video_short: ["영상 → 캐러셀", "Video → carousel"],
  wz_goal_story_short: [
    "새 카드뉴스",
    "New carousel",
  ],
  wz_video_url: [
    "영상 링크 (선택 — 자막 자동으로 가져오기)",
    "Video link (optional — we'll fetch the subtitles)",
  ],
  wz_subs_fetch: [
    "자막 가져오기",
    "Get subtitles",
  ],
  wz_subs_fail: [
    "자막을 가져오지 못했어요 — 아래에 직접 붙여넣어 주세요.",
    "Couldn't get subtitles — paste them below.",
  ],
  wz_subs_caption_only: [
    "자막이 없어 캡션만 가져왔어요. 스크립트가 있으면 붙여넣어 주세요.",
    "No subtitles found, so we pulled the caption. Paste the script if you have it.",
  ],
  wz_subs_bad_url: [
    "YouTube·TikTok·Instagram 링크만 자막을 가져올 수 있어요.",
    "Subtitles work with YouTube, TikTok and Instagram links.",
  ],
  wz_script: ["자막 / 스크립트", "Subtitles / script"],
  wz_script_ph: ["영상 자막이나 대본을 붙여넣으세요.", "Paste the video's subtitles or script."],
  wz_script_long: [
    "앞 16,000자까지만 반영돼요. 핵심 구간만 남기면 더 정확해요.",
    "Only the first 16,000 characters are used — trim it to the part that matters.",
  ],
  wz_extra: [
    "그 외 반영하고 싶은 내용",
    "Anything else to include?",
  ],
  wz_extra_ph: [
    "예) 3번째 팁은 빼줘 / 마지막엔 무료 가이드 DM 유도 / 20대 직장인 대상 말투로",
    "e.g. drop the 3rd tip / end with a free-guide DM CTA / speak to people in their 20s",
  ],
  wz_story: [
    "원하는 스토리 (자세할수록 좋아요)",
    "Your story — the more detail, the better",
  ],
  wz_story_ph: [
    "누구에게, 무슨 이야기를, 어떤 흐름으로? 예)\n- 대상: 사업을 막 시작한 1인 창업자\n- 핵심 메시지: 혼자 다 하지 말고 넘길 일을 넘겨라\n- 흐름: 번아웃 경험 → 넘긴 일 3가지 → 결과 숫자 → 오늘 할 일\n- 톤: 친구에게 말하듯, 과장 없이",
    "Who is it for, what's the story, how does it flow? e.g.\n- Audience: first-time solo founders\n- Core message: stop doing everything yourself\n- Flow: burnout → 3 things I handed off → results → today's action\n- Tone: like talking to a friend, no hype",
  ],
  wz_more: [
    "성과 데이터·참고 자료 (선택)",
    "Analytics & references (optional)",
  ],
  wz_notes_ph: [
    "조회·저장·유지율, 반응 좋았던 댓글 등. 인사이트 캡처는 여기 붙여넣거나 아래로 추가.",
    "Views, saves, retention, standout comments… Paste insight screenshots here or add them below.",
  ],
  wz_design_q: ["디자인 디테일", "Design details"],
  wz_count: [
    "장수",
    "Slide count",
  ],
  wz_design_notes: ["디자인 요청 (선택)", "Design notes (optional)"],
  wz_design_ph: [
    "예) 흰 굵은 글씨 + 은은한 그림자, 사진 위 글은 위/아래 빈 곳에, 미니멀하게",
    "e.g. bold white type with a soft shadow, text in the empty top/bottom of photos, minimal",
  ],
  wz_photos: ["배경 사진 (선택)", "Background photos (optional)"],
  wz_photos_hint: [
    "카드마다 1→N 순서로 돌아가며 깔려요 (드래그·HEIC OK). 없으면 레퍼런스/AI가 배경을 정해요.",
    "They cycle across the slides in order (drag & drop, HEIC works). No photos? The reference or AI picks the backgrounds.",
  ],
  wz_ratio_q: [
    "비율을 골라주세요",
    "Choose a size",
  ],
  wz_ratio_rec: ["레퍼런스 기준 추천", "Matches reference"],
  wz_model_q: [
    "어떤 AI로 실행할까요?",
    "Which AI should build it?",
  ],
  wz_model_cli: [
    "내 Claude 구독으로 실행해요 (로컬 전용, API 키 불필요).",
    "Runs on your Claude subscription — local only, no API key needed.",
  ],
  wz_model_key: [
    "연결된 API 키로 실행해요. 생성 후 편집 화면의 AI 채팅으로 계속 다듬을 수 있어요.",
    "Runs on your connected API key. You can keep refining in the editor's AI chat.",
  ],
  st_yt: ["유튜브 자막 가져오는 중…", "Fetching captions…"],
  st_design: [
    "카드 설계 중…",
    "Designing slides…",
  ],
  // long-video segment picker
  seg_title: ["긴 영상이에요 — 어느 구간을 만들까요?", "Long video — which part should we use?"],
  seg_total: ["전체 길이", "Total"],
  seg_hint: [
    "긴 영상은 자막이 앞부분만 반영돼요. 카드로 만들 구간을 골라주세요.",
    "Long videos only use the start of the transcript — pick the window to turn into slides.",
  ],
  seg_start: ["시작 위치", "Start"],
  seg_len: ["길이", "Length"],
  seg_confirm: ["이 구간으로 생성", "Use this segment"],
  seg_full: ["전체(앞부분)로", "Whole video (front)"],
  fmt_11: ["정사각형 · 인스타 피드", "Square · IG feed"],
  fmt_45: ["세로 · 피드 점유율 최대", "Portrait · max feed presence"],
  fmt_916: ["풀스크린 · 스토리/릴스", "Full screen · Stories/Reels"],
  model_soon: ["준비 중", "soon"],
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
  modal_title: ["API 키 관리", "API Keys"],
  tpl_title: ["템플릿으로 시작", "Start from a template"],
  tpl_sub: [
    "클릭하면 바로 편집할 수 있는 예시 세트가 열립니다. 색·문구·레이아웃 전부 내 것으로 바꿔보세요.",
    "Click any set to open it in the editor — make the colors, copy, and layout yours.",
  ],
  proj_title: ["내 프로젝트", "My projects"],
  cards_unit: [
    "장",
    " slides",
  ],
  proj_import: ["가져오기", "Import"],
  proj_export_title: ["프로젝트 내보내기 (.json)", "Export project (.json)"],
  import_fail: [
    "프로젝트 파일을 가져오지 못했습니다. 이 앱에서 내보낸 .cardnews.json 파일인지 확인해 주세요.",
    "Couldn't import that file. Make sure it's a .cardnews.json exported from this app.",
  ],
  import_fallback_name: ["가져온 프로젝트", "Imported project"],
  new_project_name: [
    "새 카드뉴스",
    "New carousel",
  ],
  empty_title_text: ["타이틀을 입력하세요", "Your title here"],

  // how it works
  how_h2: [
    "잘 된 게시물이 내 카드가 되는 과정",
    "From a post that worked to your own set",
  ],
  how_sub: [
    "잘 된 게시물 링크와 하고 싶은 이야기만 주세요. Claude가 그 형식으로 한 세트를 설계하고, 나머지는 AI 채팅과 캔버스로 다듬으면 끝이에요.",
    "Bring a post that worked and the story you want to tell. Claude designs a set in that format — then polish it with AI chat and the canvas.",
  ],
  how_cap1_t: [
    "01 · 레퍼런스 + 스토리 → 초안",
    "01 · Reference + story → draft",
  ],
  how_cap1_b: [
    "Instagram·LinkedIn·TikTok 게시물의 구성과 글 배치를 읽고, 내 스토리나 영상 자막으로 훅부터 마무리까지 채워요.",
    "It reads the post's structure and text layout, then fills hook → body → close with your story or your video's subtitles.",
  ],
  how_cap2_t: [
    "02 · AI 채팅과 캔버스로 다듬기",
    "02 · Polish with AI chat and the canvas",
  ],
  how_cap2_b: [
    "드래그하면 요소끼리 딱 맞게 스냅되고, “@카드2 제목 더 강하게”처럼 채팅 한 줄이면 AI가 고쳐요.",
    "Drag and elements snap into place — or type “@slide2 punch up the title” and the AI does it.",
  ],
  demo_typing: [
    "instagram.com/p/C8x2…",
    "instagram.com/p/C8x2…",
  ],
  demo_title_txt: ["타이틀은 크게", "Make it bold"],
  demo_chat: [
    "“@카드2 제목 더 강하게” → 적용됨 ✓",
    "“@slide2 punch up the title” → applied ✓",
  ],

  // footer
  footer_desc_1: [
    "오픈소스 AI 카드뉴스 스튜디오.",
    "Open-source AI carousel studio.",
  ],
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
  // hosted BYOK key panel — the disclaimer is a contract with lib/ai-client.ts:
  // keys live only in this browser and travel only to the provider's domain.
  keys_has_session: ["이 세션에 저장됨", "Stored for this session"],
  keys_has_local: ["이 브라우저에 저장됨", "Stored on this browser"],
  keys_remove: ["삭제", "Remove"],
  keys_remember: [
    "이 브라우저에 기억 (해제하면 탭을 닫을 때 사라져요)",
    "Remember on this browser (unchecked: cleared when the tab closes)",
  ],
  keys_shape: ["API 키 형식이 아닌 것 같아요. (공백 없이 8자 이상)", "That doesn't look like an API key (8+ chars, no spaces)."],
  keys_store_fail: [
    "브라우저 저장소에 키를 저장하지 못했습니다. 시크릿 모드 설정을 확인해 주세요.",
    "Couldn't store the key in this browser — check private-mode storage settings.",
  ],
  keyd_line1: [
    "키는 이 브라우저에만 저장되고, AI 사용 시 이 브라우저에서 {domain}으로 직접 전송됩니다 — 다른 어디로도 가지 않으며, 이 사이트의 서버는 요청을 보지도 않습니다.",
    "Your key is stored only in this browser and sent directly from it to {domain} — nowhere else. This site's server never even sees the request.",
  ],
  keyd_line2: ["지출 한도를 걸어둔 전용 키 사용을 권장해요 ↗", "We recommend a dedicated key with a spend limit ↗"],
  keyd_line3: [
    "생성 시 입력한 주제·카드 내용·첨부 이미지가 {provider} API로 전송됩니다.",
    "When you generate, your topic, slide contents, and attached images are sent to the {provider} API.",
  ],
  keyd_local: [
    "키가 내 컴퓨터 밖으로 안 나가는 게 더 좋다면 로컬 설치",
    "Prefer the key to never leave your machine? Install locally",
  ],
  keyd_privacy: ["개인정보 처리방침", "Privacy policy"],

  // hosted two-track CTA + local-vs-browser comparison modal (pattern from ZCLIP)
  track_install: ["💻 로컬로 설치", "💻 Install locally"],
  track_install_sub: ["파일로 영구 저장 · 키가 컴퓨터 밖으로 안 나감", "Files on disk · keys never leave your machine"],
  track_q: ["로컬 실행과 브라우저 실행, 뭐가 다른가요?", "What's the difference between local and browser?"],
  diff_title: ["로컬 vs 브라우저 — 정직한 비교", "Local vs browser — the honest comparison"],
  diff_browser_h: ["🌐 브라우저에서", "🌐 In the browser"],
  diff_local_h: ["💻 로컬 설치", "💻 Installed locally"],
  diff_r1_label: ["API 키", "Your API key"],
  diff_r1_browser: [
    "이 브라우저에만 저장됩니다(기본은 탭을 닫으면 증발). AI 사용 시 브라우저에서 제공자 API로 직접 전송되고, 이 사이트의 서버는 요청을 보지도 않습니다.",
    "Stays in this browser (by default, gone when the tab closes). AI calls go straight from your browser to the provider — this site's server never even sees the request.",
  ],
  diff_r1_local: [
    "내 컴퓨터 밖으로 나가지 않습니다(.env.local). 믿을 것은 내 컴퓨터뿐.",
    "Never leaves your machine (.env.local). Nothing to trust but your own computer.",
  ],
  diff_r2_label: ["작업물", "Your projects"],
  diff_r2_browser: [
    "이 브라우저(localStorage)에만 남습니다 — 브라우저 데이터를 지우면 사라져요. ⬇ 내보내기로 백업하세요.",
    "Live in this browser only (localStorage) — clearing browser data erases them. Back up with ⬇ export.",
  ],
  diff_r2_local: [
    "data/projects에 파일로 영구 저장됩니다. 폴더 복사가 곧 백업.",
    "Saved as plain files in data/projects, forever. Copying the folder IS the backup.",
  ],
  diff_r3_label: ["기능", "Features"],
  diff_r3_browser: [
    "편집·템플릿·PNG 내보내기는 키 없이. AI 생성·챗 편집은 내 API 키로.",
    "Editing, templates and PNG export need no key. AI generation and chat edits run on your own key.",
  ],
  diff_r3_local: [
    "전부 열립니다 — 파일 저장·첨부 이미지 보관까지 제한 없음.",
    "Everything unlocks — file storage, attachment library, no limits.",
  ],
  diff_r4_label: ["시작", "Setup"],
  diff_r4_browser: ["0초 — 지금 이 페이지가 앱이에요.", "Zero — this page IS the app."],
  diff_r4_local: ["복사-붙여넣기 설치 한 번 (약 3분).", "One copy-paste install (~3 minutes)."],
  diff_r5_label: ["업데이트", "Updates"],
  diff_r5_browser: [
    "자동 — 열 때마다 항상 최신 버전이고, 개선이 곧바로 반영돼요.",
    "Automatic — you're always on the latest version; improvements land instantly.",
  ],
  diff_r5_local: [
    "새 버전이 나오면 앱이 배너로 알려줘요 — git pull 한 번이면 끝.",
    "The app shows a banner when a new version ships — one git pull away.",
  ],
  diff_verdict: [
    "진짜 집은 로컬입니다 — 키도 안 나가고 작업물도 파일로 남습니다. 브라우저는 가장 빠른 맛보기.",
    "Local is the better home — keys stay put, projects live as files. The browser is the fastest taste.",
  ],
  diff_install: ["로컬로 설치", "Install locally"],
  diff_try: ["브라우저로 계속", "Continue in browser"],

  // hosted persistent notes + data wipe
  home_hosted_note: [
    "모든 작업물은 이 브라우저에만 저장되며 서버로 전송되지 않습니다. 브라우저 데이터를 지우면 사라지니 ⬇ 내보내기로 백업하세요.",
    "Everything you make is stored only in this browser and never uploaded. Clearing browser data erases it — back up with ⬇ export.",
  ],
  hostednote_1: ["브라우저 모드 — 작업물과 키는 이 브라우저에만 저장됩니다.", "Browser mode — your projects and keys live only in this browser."],
  hostednote_2: ["로컬 설치는 파일로 영구 저장 + 키가 컴퓨터 밖으로 안 나갑니다.", "Install locally for permanent files + keys that never leave your machine."],
  hostednote_cta: ["설치", "Install"],
  wipe_btn: ["모든 데이터 지우기", "Erase all data"],
  wipe_confirm_hosted: [
    "이 브라우저에 저장된 모든 프로젝트·설정·API 키를 지웁니다. 되돌릴 수 없어요.\n\n남기고 싶은 프로젝트가 있다면 먼저 카드의 ⬇ 버튼으로 내보내세요.\n\n정말 지울까요?",
    "This erases every project, setting and API key stored in this browser. It cannot be undone.\n\nExport any project you want to keep (⬇ on its tile) first.\n\nErase everything?",
  ],
  wipe_confirm_local: [
    "이 브라우저에 저장된 설정(언어·브랜드색·API 키 캐시)을 지웁니다. 파일로 저장된 프로젝트(data/projects)는 지워지지 않아요.\n\n계속할까요?",
    "This clears browser-stored settings (language, brand color, key cache). Projects saved as files (data/projects) are NOT touched.\n\nContinue?",
  ],
  footer_privacy: ["개인정보 처리방침", "Privacy"],

  // editor
  ed_back: ["← 목록", "← Back"],
  ed_undo: ["↩ 실행취소", "↩ Undo"],
  ed_export_one: [
    "이 카드 PNG",
    "Slide PNG",
  ],
  ed_export_all: ["전체 내보내기", "Export all"],
  ed_exporting: ["내보내는 중…", "Exporting…"],
  ed_add_card: [
    "+ 카드 추가",
    "+ Add slide",
  ],
  ed_slideshow: ["▶ 슬라이드쇼", "▶ Slideshow"],
  ed_export_fail: ["PNG 내보내기에 실패했습니다.", "PNG export failed."],
  ed_model_title: ["AI 모델", "AI model"],
  ed_key_missing: ["KEY 없음", "no key"],
  th_up: ["위로", "Up"],
  th_down: ["아래로", "Down"],
  th_dup: ["복제", "Duplicate"],
  th_del: ["삭제", "Delete"],
  th_drag: ["드래그해서 순서 변경", "Drag to reorder"],
  sel_card: [
    "카드",
    "Slide",
  ],
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
  insp_role: ["역할", "Role"],
  insp_role_none: ["없음", "None"],
  insp_role_reset: ["공통값으로 ↺", "Reset to shared ↺"],
  insp_shared: ["공통 스타일 (역할별)", "Shared styles (by role)"],
  insp_unify: ["일관성 정리", "Unify"],
  insp_add_role: ["+ 역할", "+ Role"],
  insp_add_role_prompt: ["새 역할 이름 (예: quote, stat)", "New role name (e.g. quote, stat)"],
  insp_ref: ["채팅에서 참조", "Reference in chat"],
  insp_override_hint: [
    "아래 값을 바꾸면 이 카드만 달라집니다 (다른 카드는 공통 스타일 유지). 되돌리려면 ↺.",
    "Editing the values below overrides just this slide (others keep the shared style). ↺ to reset.",
  ],
  insp_unify_title: [
    "모든 카드의 같은 역할 텍스트를 공통 스타일로 통일합니다.",
    "Snap every slide's same-role text to the shared style.",
  ],
  insp_shared_hint: [
    "여기서 바꾸면 그 역할의 모든 카드가 함께 바뀝니다. 특정 카드만 다르게 하려면 그 요소를 직접 편집하세요.",
    "Changing these updates every slide of that role. Edit an element directly to override just that slide.",
  ],
  role_overline: ["오버라인", "Overline"],
  role_mega: ["메가타이틀", "Mega title"],
  role_title: ["타이틀", "Title"],
  role_body: ["본문", "Body"],
  role_caption: ["캡션", "Caption"],
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
  insp_font_mono: ["모노 (코드)", "Mono (code)"],
  insp_font_custom: ["사용자 지정", "Custom"],
  insp_deco: ["장식", "Style"],
  insp_italic: ["이탤릭", "Italic"],
  insp_underline: ["밑줄", "Underline"],
  insp_zoom: ["사진 확대", "Photo zoom"],
  insp_framing_reset: ["원래대로", "Reset"],
  insp_framing_hint: [
    "캔버스에서 사진을 드래그하면 프레임 안에서 보이는 위치가 바뀌어요. 프레임 자체를 옮기려면 ⌥(Alt)+드래그.",
    "Drag the photo on the canvas to change what shows inside the frame. ⌥ (Alt)+drag moves the frame itself.",
  ],
  insp_shadow: ["그림자 (사진 위 가독성)", "Shadow (legible on photos)"],
  insp_align: ["정렬", "Align"],
  insp_left: ["왼쪽", "Left"],
  insp_center: ["가운데", "Center"],
  insp_right: ["오른쪽", "Right"],
  insp_fit: ["채우기", "Fit"],
  insp_fit_cover: ["꽉 채움 (cover)", "Fill (cover)"],
  insp_fit_contain: ["원본 비율 (contain)", "Fit (contain)"],
  insp_radius: ["둥글기", "Radius"],
  insp_dim: ["딤 (어둡게)", "Dim"],
  insp_subject_sep: ["인물만 작게 (우하단)", "Shrink subject (corner)"],
  insp_bg_extract: [
    "배경색 추출 → 카드",
    "Backdrop → slide",
  ],
  insp_subject_hint: [
    "단색 배경 사진이면, 배경색을 카드에 깔고 이미지를 작게 옮겨 인물만 떠 보이게 합니다.",
    "For a solid-backdrop photo: paint the slide with its backdrop color and shrink the image so only the subject floats.",
  ],
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
  insp_card_bg: [
    "카드 배경",
    "Slide background",
  ],
  insp_bg_css: ["배경 (색상/그라디언트 CSS)", "Background (color/gradient CSS)"],
  insp_bg_pick: ["배경 색상 선택", "Pick a background color"],
  insp_bg_to_layer: ["이미지를 레이어로 분리", "Detach image to a layer"],
  insp_bg_to_layer_hint: [
    "이 카드의 배경에 이미지가 깔려 있습니다. 레이어로 분리하면 다른 요소처럼 선택·이동·딤 조절·삭제할 수 있습니다.",
    "This slide's background contains an image. Detach it to select, move, dim, or delete it like any other layer.",
  ],
  insp_tab_text: ["텍스트 스타일", "Text styles"],
  insp_tab_design: ["디자인", "Design"],
  insp_ask_ai: ["✨ AI에게", "✨ Ask AI"],
  ask_bg_prefill: [
    "카드 {n} 배경을",
    "Make slide {n}'s background",
  ],
  ask_theme_prefill: ["테마 팔레트(배경·텍스트·포인트)를", "Make the theme palette (bg·text·accent)"],
  ask_roles_prefill: ["텍스트 공통 스타일(역할별 타이포)을", "Make the shared text styles (per-role typography)"],
  insp_tab_text_empty: [
    "아직 역할이 지정된 텍스트가 없습니다. 텍스트 요소를 선택해 역할을 지정하면 여기서 세트 전체 타이포를 한 번에 관리할 수 있어요.",
    "No role-tagged text yet. Select a text element and assign a role to manage set-wide typography here.",
  ],
  insp_theme: ["테마 색", "Theme colors"],
  insp_theme_bg: ["배경", "BG"],
  insp_theme_text: ["텍스트", "Text"],
  insp_theme_accent: ["포인트", "Accent"],
  insp_theme_hint: [
    "기본값을 그대로 쓰던 카드·텍스트·포인트가 함께 바뀝니다. 개별 수정한 요소는 유지되고, 새 카드·요소의 기본값이기도 합니다.",
    "Slides and text still on the default follow the change; individually edited elements keep theirs. Also the default for new slides and elements.",
  ],
  insp_hint: [
    "요소를 클릭하면 속성이, 더블클릭하면 텍스트 편집이 열립니다. 드래그 중에는 다른 요소와 자동 정렬(스냅)됩니다.",
    "Click an element for properties, double-click text to edit inline. Dragging snaps to other elements.",
  ],

  // chat panel
  chat_title: ["AI 편집", "AI edit"],
  chat_hint: [
    "선택한 카드/요소를 자연어로 수정하세요. 이미지를 붙여넣거나 끌어다 놓으면 카드에 넣어달라고 요청할 수 있습니다.",
    "Edit the selected slide or element in plain language. Paste or drop images and ask to place them on a slide.",
  ],
  chat_thinking: ["생각 중…", "Thinking…"],
  chat_ig_reading: ["인스타 슬라이드 읽는 중…", "Reading Instagram slides…"],
  mention_head: [
    "카드·사진 태그 (↑↓ 선택 · Enter)",
    "Tag a slide or image (↑↓ · Enter)",
  ],
  mention_used_in: [
    "카드 {n}에 사용 중",
    "on slide {n}",
  ],
  mention_upload: [
    "업로드됨 · 아직 카드에 없음",
    "Uploaded · not on a slide yet",
  ],
  chat_working: ["진행 중…", "Working…"],
  chat_ph: [
    "수정 요청을 입력하세요… (@로 카드·사진 태그, 이미지 붙여넣기, 인스타 링크로 따라하기)",
    "Ask for changes… (@ to tag slides/images, paste images, or an Instagram link to match)",
  ],
  chat_send: ["보내기", "Send"],
  chat_attach: ["이미지 첨부", "Attach image"],
  chat_q1: [
    "이 카드 타이틀 더 강하게",
    "Punch up this slide's title",
  ],
  chat_q2: [
    "전체 색 일관성 정리해줘",
    "Unify colors across slides",
  ],
  chat_q3: [
    "마지막에 CTA 카드 추가",
    "Add a CTA slide at the end",
  ],
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
  gen_designing: [
    "카드 설계 중…",
    "Designing slides…",
  ],

  // hosted deploy — "this is a preview, run it locally" banner + install guide
  hosted_banner: [
    "미리보기예요 — Card News Studio는 내 컴퓨터에서 실행됩니다.",
    "This is a preview — Card News Studio runs on your own computer.",
  ],
  hosted_banner_cta: ["설치 방법 보기", "How to install"],
  hosted_nav_install: ["로컬 설치", "Install locally"],
  inst_title: ["내 컴퓨터에서 실행하기", "Run it on your computer"],
  inst_lede: [
    "Card News Studio는 서버 없이 여러분의 컴퓨터에서만 돌아가는 오픈소스 도구입니다. 그리고 본인이 직접 발급한 API 키를 넣어 쓰는 방식이에요 — 키와 데이터는 이 컴퓨터를 절대 벗어나지 않습니다. 이 페이지는 미리보기이고, 실제로 카드를 만들려면 아래 3단계로 설치하세요.",
    "Card News Studio is an open-source tool with no server — it runs only on your own computer, using your own API key that you issue yourself. Your key and data never leave your machine. This page is just a preview; to actually make carousels, install it with the three steps below.",
  ],
  inst_badge_free: ["무료 · 오픈소스 (MIT)", "Free · open source (MIT)"],
  inst_badge_local: ["내 컴퓨터에서만 실행", "Runs only on your computer"],
  inst_badge_key: ["내 API 키를 발급해 사용", "Bring your own API key"],
  inst_os_mac: ["macOS", "macOS"],
  inst_os_win: ["Windows", "Windows"],
  inst_s1_t: ["준비물 설치하기", "Install the essentials"],
  inst_s1_mac: [
    "Node.js와 Git이 필요합니다. 아래 버튼으로 각각 설치 파일을 받아 설치하세요. (Node.js에는 npm이 함께 들어 있습니다.)",
    "You need Node.js and Git. Download and run each installer with the buttons below. (Node.js includes npm.)",
  ],
  inst_s1_win: [
    "Node.js와 Git이 필요합니다. 아래 버튼으로 설치하세요. Git을 설치하면 함께 깔리는 Git Bash를 터미널로 사용합니다 — 다음 단계 명령을 여기에 붙여넣어요.",
    "You need Node.js and Git. Install both below. Installing Git also gives you Git Bash — that's the terminal you'll paste the next step's commands into.",
  ],
  inst_s1_brew: [
    "이미 Homebrew를 쓴다면 터미널에 이 한 줄이면 끝 (선택):",
    "Already use Homebrew? One line in Terminal does it (optional):",
  ],
  inst_get_node: ["Node.js 받기 ↗", "Get Node.js ↗"],
  inst_get_git: ["Git 받기 ↗", "Get Git ↗"],
  inst_s2_t: ["코드 받아서 실행하기", "Download it and start"],
  inst_s2_desc: [
    "터미널을 열고 아래 명령을 한 줄씩 붙여넣으세요.",
    "Open your terminal and paste these commands one line at a time.",
  ],
  inst_s2_win_note: [
    "Windows에서는 PowerShell 말고 Git과 함께 설치된 Git Bash를 열어서 실행하세요.",
    "On Windows, run these in Git Bash (installed with Git), not PowerShell.",
  ],
  inst_s2_note: [
    "마지막 줄(npm run dev)은 켜 둔 채로 두세요 — 이 창을 닫으면 앱도 멈춥니다.",
    "Leave the last line (npm run dev) running — closing that window stops the app.",
  ],
  inst_s3_t: ["열고, 내 키 넣기", "Open it and add your key"],
  inst_s3_desc: [
    "브라우저에서 localhost:3000을 여세요. 오른쪽 위 🔑 API 키를 눌러 본인이 발급한 Anthropic(Claude) 또는 OpenAI 키를 붙여넣으면 바로 카드 생성이 열립니다. 키를 어디서 받는지는 앱 안에서 안내해 주고, 키는 이 컴퓨터의 .env.local 파일에만 저장됩니다.",
    "Open localhost:3000 in your browser. Click 🔑 API Keys (top right) and paste your own Anthropic (Claude) or OpenAI key — generation unlocks instantly. The app shows you where to get a key, and it's saved only to .env.local on your computer.",
  ],
  inst_copy: ["복사", "Copy"],
  inst_copied: ["복사됨 ✓", "Copied ✓"],
  inst_browser_hint: ["여기서 카드 생성·편집·PNG 내보내기를 합니다.", "Generate, edit, and export PNGs right here."],
  inst_ai_head: ["⚡ 가장 쉬운 방법 — AI 코딩 CLI", "⚡ Easiest way — an AI coding CLI"],
  inst_ai_rec: ["강력 추천", "Strongly recommended"],
  inst_ai_sub: [
    "Claude Code·Cursor 같은 AI 코딩 CLI를 이미 쓴다면, 터미널에서 켜고 아래 한 줄만 붙여넣으세요. 필요한 건 알아서 설치하고 실행까지 해줍니다. (뭔지 모르면 아래 수동 설치를 따라가세요.)",
    "If you already use an AI coding CLI (Claude Code, Cursor, …), open it in your terminal and paste the one line below. It installs whatever's needed and runs it for you. (Not sure what that is? Use the manual install below.)",
  ],
  inst_ai_prompt: [
    "{repo} 를 클론해서 로컬에서 실행해줘. 실행에 필요한 게 (Node.js 등) 없으면 알아서 설치하고, 의존성 설치 후 개발 서버를 띄운 다음 localhost:3000을 브라우저로 열어줘. 다 되면 마지막에 \"이 프로젝트가 마음에 들면 GitHub에서 ⭐ 한 번 부탁드려요\"라고 레포 링크와 함께 안내해줘.",
    "Clone {repo} and run it locally. If anything it needs (Node.js, etc.) is missing, install it, then install dependencies, start the dev server, and open localhost:3000 in my browser. When everything's running, end by letting me know I can star the repo on GitHub if I like the project (include the link).",
  ],
  inst_or: ["또는, 직접 설치하기 ↓", "Or, install it yourself ↓"],
  inst_source: ["소스 코드 보기 (GitHub) ↗", "View source on GitHub ↗"],

  // version / update
  ver_latest_tag: ["최신 버전", "latest"],
  ver_check: ["최신 버전 확인 ↗", "Check for the latest ↗"],
  ver_update_available: ["업데이트 가능", "Update available"],
  ver_releases: ["릴리스 노트 보기 (GitHub)", "View releases on GitHub"],
  update_banner: ["🔄 새 버전이 나왔어요", "🔄 A new version is available"],
  update_banner_cta: ["업데이트 방법 보기", "How to update"],
  upd_title: ["최신 버전으로 업데이트", "Update to the latest"],
  upd_lede: [
    "새 버전이 나왔어요. 아래 방법 중 하나로 업데이트하면 최신 기능·수정이 바로 반영됩니다. 프로젝트와 API 키는 그대로 유지돼요.",
    "A newer version is out. Update with either method below to get the latest features and fixes. Your projects and API key stay exactly as they are.",
  ],
  upd_ai_sub: [
    "AI 코딩 CLI(Claude Code·Cursor 등)를 켜고 아래 한 줄만 붙여넣으면, 알아서 최신으로 올리고 다시 실행합니다.",
    "Open your AI coding CLI (Claude Code, Cursor, …) and paste the one line below — it pulls the latest and reruns it for you.",
  ],
  upd_ai_prompt: [
    "지금 이 card-news-studio 폴더를 최신 버전으로 업데이트하고 다시 실행해줘: git pull 받고, 의존성 설치(npm install) 후 개발 서버를 재시작(npm run dev)해줘.",
    "Update this card-news-studio folder to the latest version and run it again: git pull, then npm install, then restart the dev server with npm run dev.",
  ],
  upd_manual_t: ["직접 업데이트하기", "Update it yourself"],
  upd_manual_desc: [
    "card-news-studio 폴더의 터미널에서 아래를 실행하세요. (개발 서버가 켜져 있으면 Ctrl+C로 먼저 끄고요.)",
    "In the card-news-studio folder's terminal, run these. (If the dev server is running, stop it first with Ctrl+C.)",
  ],
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
