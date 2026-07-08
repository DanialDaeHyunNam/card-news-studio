// Built-in starter templates shown on the home page. `getTemplates(lang)`
// returns fully localized sets — copy is written per language (not machine-
// translated) while layout/colors stay identical. Instantiating deep-copies
// through normalizeCard (fresh ids, validated values) and then enforceRoles,
// which establishes project.styles from each template's roles.
//
// Every template follows the classic card-news look: photo + tinted dim
// overlay + light text, or a flat editorial background. Photos live in
// /public/templates (Lorem Picsum — Unsplash-licensed, free to use).
// IMPORTANT: template copy and accent colors are deliberately ORIGINAL —
// layouts are only *inspired* by common formats; keep it that way.
//
// TEXT ROLES: every text element carries a `role` so templates model the
// consistency system — same role → same style across cards (overline / mega /
// title / body / caption, plus a few custom roles like index/cta/quote/steps).
// Values for a shared role are kept identical here so instantiateTemplate's
// enforceRoles is a no-op on the design (it just records project.styles).
import { enforceRoles, newId, normalizeCard } from "./ops";
import { DEFAULT_FONT, SERIF_FONT, type Format, type Project, type Theme } from "./types";
import type { Lang } from "./i18n";

type RawElement = Record<string, unknown>;
interface RawCard {
  background?: string;
  elements: RawElement[];
}

export interface Template {
  id: string;
  name: string;
  description: string;
  format: Format;
  theme: Omit<Theme, "fontFamily"> & { fontFamily?: string };
  cards: RawCard[];
}

const text = (p: RawElement): RawElement => ({ type: "text", x: 8, w: 84, align: "left", fontWeight: 700, lineHeight: 1.35, color: "#ffffff", ...p });
const bar = (p: RawElement): RawElement => ({ type: "shape", x: 8, w: 12, h: 0.5, radius: 4, ...p });

// Photo + vertical dim: darker at top and bottom where the text sits.
const photo = (file: string, rgb: string, top: number, mid: number, bottom: number) =>
  `linear-gradient(180deg, rgba(${rgb},${top}) 0%, rgba(${rgb},${mid}) 50%, rgba(${rgb},${bottom}) 100%), url(/templates/${file}) center/cover no-repeat`;

const DIM = {
  insight: (t = 0.82, m = 0.6, b = 0.86) => photo("insight.jpg", "10,14,32", t, m, b),
  briefing: (t = 0.78, m = 0.52, b = 0.82) => photo("briefing.jpg", "10,10,16", t, m, b),
  pop: (t = 0.72, m = 0.48, b = 0.78) => photo("pop.jpg", "5,16,44", t, m, b),
  midnight: (t = 0.5, m = 0.3, b = 0.68) => photo("midnight.jpg", "17,12,36", t, m, b),
  forest: (t = 0.76, m = 0.55, b = 0.82) => photo("forest.jpg", "6,28,17", t, m, b),
  paper: (t = 0.78, m = 0.62, b = 0.84) => photo("paper.jpg", "36,24,14", t, m, b),
  story: () =>
    "linear-gradient(180deg, rgba(8,8,8,0.3) 0%, rgba(8,8,8,0.25) 40%, rgba(8,8,8,0.9) 100%), url(/templates/story.jpg) center/cover no-repeat",
  playbook: (file: string, t = 0.78, m = 0.62, b = 0.88) => photo(file, "88,20,42", t, m, b),
  simple: () =>
    "linear-gradient(180deg, rgba(18,18,18,0.15) 0%, rgba(18,18,18,0.35) 45%, rgba(18,18,18,0.85) 100%), url(/templates/simple.jpg) center/cover no-repeat",
};

const WHITE_70 = "rgba(255,255,255,0.72)";
const WHITE_50 = "rgba(255,255,255,0.5)";

export function getTemplates(lang: Lang): Template[] {
  const T = (ko: string, en: string) => (lang === "ko" ? ko : en);

  return [
    {
      id: "bold-insight",
      name: T("볼드 인사이트", "Bold Insight"),
      description: T("일·성장 콘텐츠, 네이비 딤 + 스카이 포인트", "Work & growth content, navy dim + sky accent"),
      format: "4:5",
      theme: { background: DIM.insight(), textColor: "#ffffff", accent: "#7dd3fc" },
      cards: [
        {
          background: DIM.insight(),
          elements: [
            text({ role: "overline", y: 12, text: "WEEKLY INSIGHT", fontSize: 26, color: "#7dd3fc" }),
            bar({ y: 17.5, color: "#7dd3fc" }),
            text({ role: "mega", y: 26, text: T("성장하는 팀은\n회고부터 다르다", "Great teams run\nretros differently"), fontSize: 92, fontWeight: 800, lineHeight: 1.22 }),
            text({ role: "body", y: 62, text: T("실리콘밸리 팀들이 매주 반복하는\n회고 루틴 3가지", "3 retro rituals top teams\nrepeat every single week"), fontSize: 36, fontWeight: 400, color: WHITE_70, lineHeight: 1.55 }),
            text({ role: "caption", y: 92, text: "@yourhandle", fontSize: 24, fontWeight: 600, color: WHITE_50 }),
          ],
        },
        {
          background: DIM.insight(0.88, 0.72, 0.9),
          elements: [
            text({ role: "index", y: 8, text: "01", fontSize: 120, fontWeight: 900, color: "#7dd3fc", lineHeight: 1 }),
            text({ role: "title", y: 32, text: T("잘한 것부터 말한다", "Start with the wins"), fontSize: 68, fontWeight: 800, lineHeight: 1.3 }),
            text({ role: "body", y: 50, text: T("문제 지적으로 시작하면 팀이 방어적이 됩니다.\n성과를 먼저 확인하고 개선점으로 넘어가세요.", "Open with problems and people get defensive.\nCelebrate what worked, then move to fixes."), fontSize: 36, fontWeight: 400, color: WHITE_70, lineHeight: 1.55 }),
            bar({ y: 90, w: 20, color: "rgba(125,211,252,0.4)" }),
          ],
        },
        {
          background: DIM.insight(0.8, 0.62, 0.88),
          elements: [
            text({ role: "title", y: 36, text: T("다음 회고에\n바로 써보세요", "Try it in your\nnext retro"), fontSize: 68, fontWeight: 800, lineHeight: 1.3 }),
            text({ role: "body", y: 64, text: T("저장해두고 팀 채널에 공유 →", "Save this & share with your team →"), fontSize: 36, fontWeight: 400, color: WHITE_70, lineHeight: 1.55 }),
          ],
        },
      ],
    },
    {
      id: "clean-briefing",
      name: T("시티 브리핑", "City Briefing"),
      description: T("뉴스·트렌드 요약, 도시 야경 + 레드 포인트", "News & trends recap, skyline + red accent"),
      format: "1:1",
      theme: { background: DIM.briefing(), textColor: "#ffffff", accent: "#ff4d6d" },
      cards: [
        {
          background: DIM.briefing(),
          elements: [
            text({ role: "overline", y: 11, text: "DAILY BRIEFING", fontSize: 26, fontWeight: 800, color: "#ff4d6d" }),
            bar({ y: 16.5, w: 10, h: 0.6, color: "#ff4d6d" }),
            text({ role: "mega", y: 25, text: T("오늘 꼭 알아야 할\n뉴스 세 가지", "Three stories\nyou need today"), fontSize: 86, fontWeight: 800, lineHeight: 1.22 }),
            text({ role: "caption", y: 80, text: T("2026. 7. 6 · 3분 읽기", "Jul 6, 2026 · 3 min read"), fontSize: 27, fontWeight: 400, color: WHITE_50 }),
          ],
        },
        {
          background: DIM.briefing(0.85, 0.68, 0.87),
          elements: [
            text({ role: "index", y: 10, text: "1", fontSize: 96, fontWeight: 900, color: "#ff4d6d", lineHeight: 1 }),
            text({ role: "title", y: 30, text: T("기준금리 동결,\n시장은 안도", "Rates on hold,\nmarkets exhale"), fontSize: 64, fontWeight: 800, lineHeight: 1.3 }),
            text({ role: "body", y: 58, text: T("시장 예상과 일치하는 결정.\n연내 인하 기대는 여전히 유효합니다.", "Right in line with expectations —\nand a cut this year is still on the table."), fontSize: 34, fontWeight: 400, color: WHITE_70, lineHeight: 1.6 }),
          ],
        },
        {
          background: DIM.briefing(),
          elements: [
            text({ role: "title", y: 34, text: T("내일 브리핑도\n놓치지 마세요", "Don't miss\ntomorrow's brief"), fontSize: 64, fontWeight: 800, lineHeight: 1.3 }),
            text({ role: "cta", y: 64, text: T("팔로우하고 매일 아침 받아보기 →", "Follow for your morning recap →"), fontSize: 34, fontWeight: 700, color: "#ff4d6d" }),
          ],
        },
      ],
    },
    {
      id: "yellow-pop",
      name: T("딥블루 팝", "Deep Blue Pop"),
      description: T("이벤트·공지, 비비드 사진 + 옐로 포인트", "Events & announcements, vivid photo + yellow accent"),
      format: "1:1",
      theme: { background: DIM.pop(), textColor: "#ffffff", accent: "#ffd60a" },
      cards: [
        {
          background: DIM.pop(),
          elements: [
            text({ role: "overline", y: 11, text: "NOTICE", fontSize: 28, fontWeight: 800, color: "#ffd60a" }),
            bar({ y: 16.5, w: 9, h: 0.7, color: "#ffd60a" }),
            text({ role: "mega", y: 26, text: T("7월 한정\n이벤트 오픈!", "July only —\ngiveaway is live!"), fontSize: 108, fontWeight: 900, lineHeight: 1.12 }),
            text({ role: "cta", y: 74, text: T("7. 7 — 7. 14 · 딱 일주일", "Jul 7 – 14 · one week only"), fontSize: 34, fontWeight: 700, color: "#ffd60a" }),
          ],
        },
        {
          background: DIM.pop(0.82, 0.66, 0.85),
          elements: [
            text({ role: "overline", y: 12, text: T("참여 방법", "How to enter"), fontSize: 28, fontWeight: 800, color: "#ffd60a" }),
            text({ role: "steps", y: 24, text: T("① 이 게시물 저장\n② 친구 태그\n③ 팔로우", "① Save this post\n② Tag a friend\n③ Follow us"), fontSize: 62, fontWeight: 800, lineHeight: 1.55 }),
            text({ role: "caption", y: 82, text: T("당첨자는 DM으로 안내드려요", "Winners announced by DM"), fontSize: 28, fontWeight: 400, color: WHITE_70 }),
          ],
        },
        {
          background: DIM.pop(),
          elements: [
            text({ role: "title", y: 38, text: T("지금 바로\n참여하기 →", "Enter\nright now →"), fontSize: 96, fontWeight: 900, lineHeight: 1.2 }),
          ],
        },
      ],
    },
    {
      id: "midnight-story",
      name: T("미드나잇 스토리", "Midnight Story"),
      description: T("은하수 감성, 9:16 스토리/릴스 커버", "Milky-way mood, 9:16 Stories/Reels cover"),
      format: "9:16",
      theme: { background: DIM.midnight(), textColor: "#ffffff", accent: "#c084fc" },
      cards: [
        {
          background: DIM.midnight(),
          elements: [
            text({ role: "overline", y: 16, text: "NIGHT ROUTINE", fontSize: 28, color: "#c084fc" }),
            bar({ y: 19.5, h: 0.35, color: "#c084fc" }),
            text({ role: "mega", y: 30, text: T("자기 전 10분,\n하루를 정리하는\n가장 쉬운 방법", "Ten minutes\nbefore bed to\nreset your day"), fontSize: 82, fontWeight: 800, lineHeight: 1.3 }),
            text({ role: "body", y: 86, text: T("위로 올려서 확인하세요 ↑", "Swipe up to see how ↑"), fontSize: 32, fontWeight: 400, color: WHITE_70, lineHeight: 1.6 }),
          ],
        },
        {
          background: DIM.midnight(0.62, 0.45, 0.75),
          elements: [
            text({ role: "overline", y: 20, text: T("오늘의 질문", "Tonight's question"), fontSize: 28, color: "#c084fc" }),
            text({ role: "title", y: 30, text: T("“오늘 나를\n웃게 한 순간은?”", "“What made you\nsmile today?”"), fontSize: 76, fontWeight: 800, lineHeight: 1.35 }),
            text({ role: "body", y: 60, text: T("한 줄이면 충분합니다.\n기록이 쌓이면 패턴이 보여요.", "One line is enough.\nPatterns appear as entries pile up."), fontSize: 32, fontWeight: 400, color: WHITE_70, lineHeight: 1.6 }),
          ],
        },
      ],
    },
    {
      id: "forest-tips",
      name: T("포레스트", "Forest"),
      description: T("자연·라이프스타일 팁, 그린 딤", "Nature & lifestyle tips, green dim"),
      format: "4:5",
      theme: { background: DIM.forest(), textColor: "#ffffff", accent: "#7ce3a8" },
      cards: [
        {
          background: DIM.forest(),
          elements: [
            text({ role: "overline", y: 12, text: "GREEN HABIT", fontSize: 28, fontWeight: 800, color: "#7ce3a8" }),
            bar({ y: 17.5, color: "#7ce3a8" }),
            text({ role: "mega", y: 26, text: T("제로웨이스트,\n오늘부터 가능한\n5가지", "Five zero-waste\nswaps you can\nstart today"), fontSize: 88, fontWeight: 800, lineHeight: 1.25 }),
            text({ role: "body", y: 70, text: T("완벽하지 않아도 됩니다.\n하나씩만 바꿔보세요.", "You don't have to be perfect.\nJust swap one thing at a time."), fontSize: 36, fontWeight: 400, color: WHITE_70, lineHeight: 1.6 }),
          ],
        },
        {
          background: DIM.forest(0.82, 0.66, 0.86),
          elements: [
            text({ role: "overline", y: 9, text: "TIP 1", fontSize: 28, fontWeight: 800, color: "#7ce3a8" }),
            text({ role: "title", y: 30, text: T("텀블러 하나로\n일년에 300개", "One tumbler,\n300 cups a year"), fontSize: 72, fontWeight: 800, lineHeight: 1.3 }),
            text({ role: "body", y: 56, text: T("하루 한 잔 기준, 일회용 컵 300개를\n줄일 수 있어요.", "One coffee a day means ~300\ndisposable cups you never use."), fontSize: 36, fontWeight: 400, color: WHITE_70, lineHeight: 1.6 }),
          ],
        },
        {
          background: DIM.forest(),
          elements: [
            text({ role: "title", y: 38, text: T("다음 팁이\n궁금하다면?", "Want the\nnext tip?"), fontSize: 72, fontWeight: 800, lineHeight: 1.3 }),
            text({ role: "cta", y: 66, text: T("저장 + 팔로우 🌱", "Save + follow 🌱"), fontSize: 38, fontWeight: 700, color: "#7ce3a8" }),
          ],
        },
      ],
    },
    {
      id: "paper-essay",
      name: T("페이퍼", "Paper"),
      description: T("에세이·명언·북 리뷰, 세피아 딤", "Essays, quotes & book reviews, sepia dim"),
      format: "1:1",
      theme: { background: DIM.paper(), textColor: "#f7f0e6", accent: "#ffb46b" },
      cards: [
        {
          background: DIM.paper(),
          elements: [
            text({ role: "overline", y: 14, text: T("오늘의 문장", "Line of the day"), fontSize: 28, fontWeight: 800, color: "#ffb46b" }),
            text({ role: "mega", y: 28, text: T("“완벽한 시작은 없다.\n시작한 것이\n완벽해질 뿐이다.”", "“There is no perfect start.\nOnly starts that get\nperfected.”"), fontSize: 72, fontWeight: 800, color: "#f7f0e6", lineHeight: 1.4 }),
            text({ role: "caption", y: 82, text: T("— 어느 개발자의 회고에서", "— from a developer's retrospective"), fontSize: 28, fontWeight: 400, color: "rgba(247,240,230,0.6)" }),
          ],
        },
        {
          background: DIM.paper(0.84, 0.72, 0.88),
          elements: [
            text({ role: "overline", y: 14, text: T("이 문장을 고른 이유", "Why this line"), fontSize: 28, fontWeight: 800, color: "#ffb46b" }),
            text({ role: "body", y: 28, text: T("미루는 이유의 대부분은\n‘아직 준비가 안 돼서’입니다.\n\n준비는 시작한 다음에\n하는 것이더라고요.", "Most procrastination hides behind\n“I'm not ready yet.”\n\nTurns out readiness is something\nyou build after you begin."), fontSize: 42, fontWeight: 400, color: "#f7f0e6", lineHeight: 1.65 }),
          ],
        },
        {
          background: DIM.paper(),
          elements: [
            text({ role: "title", y: 40, text: T("매일 한 문장씩\n보내드립니다", "One line like this,\nevery single day"), fontSize: 64, fontWeight: 800, color: "#f7f0e6", lineHeight: 1.35 }),
            text({ role: "cta", y: 68, text: T("팔로우 →", "Follow →"), fontSize: 34, fontWeight: 700, color: "#ffb46b" }),
          ],
        },
      ],
    },
    {
      id: "life-story",
      name: T("인생 스토리", "Life Story"),
      description: T("블랙 + 명조, 상단 사진 + 서사형 본문", "Black + serif, framed photo + narrative body"),
      format: "1:1",
      theme: { background: "#0b0b0b", textColor: "#f2efe9", accent: "#d98a6a", fontFamily: SERIF_FONT },
      cards: [
        {
          background: DIM.story(),
          elements: [
            text({ role: "mega", y: 62, text: T("책상 하나로 시작한\n두 번째 직업", "A second career that\nstarted with one desk"), fontSize: 76, fontWeight: 800, lineHeight: 1.4 }),
            text({ role: "caption", y: 90, text: T("손으로 사는 사람들 ①", "People who work with their hands ①"), fontSize: 26, fontWeight: 400, color: "rgba(242,239,233,0.6)" }),
          ],
        },
        {
          elements: [
            { type: "image", x: 8, y: 6, w: 84, h: 40, src: "/templates/story.jpg", fit: "cover", radius: 2 },
            text({ role: "body", y: 52, text: T("회사를 그만둔 날, 통장엔 석 달치 월세뿐.\n계획은 없었고, 대신 오래된 취미가 있었다.\n주말마다 만지던 나무였다.", "The day I quit, I had three months of rent saved.\nNo plan — just an old weekend habit:\nworking with wood."), fontSize: 38, fontWeight: 400, lineHeight: 1.7 }),
            text({ role: "title", y: 76, text: T("잘하는 일 대신,\n오래 하고 싶은 일을 골랐다.", "I didn't pick what I was best at.\nI picked what I could do for decades."), fontSize: 42, fontWeight: 800, lineHeight: 1.6 }),
          ],
        },
        {
          elements: [
            text({ role: "body", y: 14, text: T("처음 반년은 주문이 없었다.\n대신 매일 한 개씩 만들어 올렸다.\n서툰 날은 서툰 대로 기록했다.\n\n그러던 어느 밤, 첫 주문 알림이 울렸다.", "For six months, nothing sold.\nSo I made one piece a day and posted it,\nclumsy days included.\n\nThen one night, the first order came in."), fontSize: 38, fontWeight: 400, lineHeight: 1.7 }),
            text({ role: "title", y: 62, text: T("속도는 느려도,\n방향이 맞으면 도착한다.", "Slow is fine —\nif the direction is right, you arrive."), fontSize: 42, fontWeight: 800, lineHeight: 1.6 }),
            text({ role: "cta", y: 90, text: T("다음 이야기 → 팔로우", "Next story → follow"), fontSize: 27, fontWeight: 400, color: "#d98a6a" }),
          ],
        },
      ],
    },
    {
      id: "playbook",
      name: T("버건디 플레이북", "Burgundy Playbook"),
      description: T("버건디 듀오톤 + 명조, 넘버링 스텝", "Burgundy duotone + serif, numbered steps"),
      format: "4:5",
      theme: {
        background: DIM.playbook("playbook-1.jpg"),
        textColor: "#f6efe4",
        accent: "#e9b8c4",
        fontFamily: SERIF_FONT,
      },
      cards: [
        {
          background: DIM.playbook("playbook-1.jpg"),
          elements: [
            text({ role: "overline", y: 12, text: "FIELD NOTES", fontSize: 27, fontWeight: 700, color: "#e9b8c4" }),
            text({ role: "mega", y: 24, text: T("멈추지 않는\n사람들의\n4가지 습관", "Four habits of\npeople who\nnever stall"), fontSize: 100, fontWeight: 800, lineHeight: 1.3 }),
            text({ role: "caption", y: 88, text: T("혼자 일하는 사람들을 위한 기록", "Notes for people who work alone"), fontSize: 27, fontWeight: 400, color: "rgba(246,239,228,0.65)" }),
          ],
        },
        {
          background: DIM.playbook("playbook-2.jpg", 0.8, 0.64, 0.9),
          elements: [
            text({ role: "title", y: 20, text: T("결과 말고\n과정을 남겨라", "Log the process,\nnot the outcome"), fontSize: 72, fontWeight: 800, lineHeight: 1.4 }),
            text({ role: "body", y: 48, text: T("완성작이 아니라,\n어제보다 나아진 한 줄.\n쌓인 기록이 다음 날의 연료다.", "Not the finished piece —\none line better than yesterday.\nThe log becomes tomorrow's fuel."), fontSize: 37, fontWeight: 400, lineHeight: 1.75, color: "rgba(246,239,228,0.85)" }),
            text({ role: "index", y: 74, x: 60, w: 32, text: "1", fontSize: 170, fontWeight: 700, align: "right", lineHeight: 1, color: "rgba(246,239,228,0.9)" }),
          ],
        },
        {
          background: DIM.playbook("playbook-1.jpg", 0.82, 0.7, 0.92),
          elements: [
            text({ role: "cta", y: 38, text: T("나머지 세 가지 습관은", "The other three habits"), fontSize: 30, fontWeight: 400, color: "#e9b8c4" }),
            text({ role: "title", y: 46, text: T("팔로우하고 이어보세요 →", "Follow to keep reading →"), fontSize: 72, fontWeight: 800, lineHeight: 1.4 }),
          ],
        },
      ],
    },
    {
      id: "simple-guide",
      name: T("한 장 설명", "One-Pager"),
      description: T("쿨 그레이 + 블루 넘버링, 텍스트 설명형", "Cool gray + blue numbering, text-first guide"),
      format: "4:5",
      theme: { background: "#f4f5f7", textColor: "#191919", accent: "#2563eb" },
      cards: [
        {
          background: DIM.simple(),
          elements: [
            bar({ y: 56, w: 20, h: 4.6, radius: 10, color: "#2563eb" }),
            text({ role: "overline", y: 57, x: 8, w: 20, text: T("3분 정리 ⏱", "3-min read ⏱"), fontSize: 28, fontWeight: 700, color: "#ffffff", align: "center", lineHeight: 1.1 }),
            text({ role: "mega", y: 64, text: T("출근 전 30분,\n하루가 달라지는 루틴", "The 30-minute routine\nthat fixes your mornings"), fontSize: 74, fontWeight: 800, color: "#ffffff", lineHeight: 1.35 }),
            text({ role: "caption", y: 92, x: 8, w: 84, text: "@yourbrand", fontSize: 25, fontWeight: 600, color: "#9a9a9a", align: "center" }),
          ],
        },
        {
          elements: [
            text({ role: "quote", y: 16, text: T("‘아침이 무너지면\n하루가 통째로 무너진다’", "“Lose the morning,\nlose the whole day.”"), fontSize: 46, fontWeight: 700, color: "#191919", lineHeight: 1.6 }),
            text({ role: "body", y: 40, text: T("거창한 미라클모닝 말고,\n지킬 수 있는 30분이면 충분해요.\n\n뭐부터 하면 될까요?", "Forget 5AM miracle routines.\nThirty minutes you can actually keep\nis all it takes.\n\nSo where do you start?"), fontSize: 37, fontWeight: 400, color: "#4a4a4a", lineHeight: 1.7 }),
            text({ role: "caption", y: 93, x: 8, w: 84, text: "@yourbrand", fontSize: 25, fontWeight: 600, color: "#9a9a9a", align: "center" }),
          ],
        },
        {
          elements: [
            text({ role: "index", y: 12, x: 8, w: 11, text: "1.", fontSize: 62, fontWeight: 900, color: "#2563eb", lineHeight: 1 }),
            text({ role: "title", y: 13, x: 19, w: 73, text: T("물 한 잔, 창문 열기", "Water first, window open"), fontSize: 48, fontWeight: 800, color: "#191919", lineHeight: 1.2 }),
            text({ role: "body", y: 28, text: T("몸을 깨우는 신호부터 시작해요.\n\n☀️ 물 한 잔 → 뇌에 시동 걸기\n🪟 환기 3분 → 밤새 무거워진 공기 리셋\n📵 폰 확인은 30분 뒤로", "Start with signals that wake the body.\n\n☀️ A glass of water → boots the brain\n🪟 3 min of fresh air → resets the room\n📵 Phone stays off for 30 more minutes"), fontSize: 37, fontWeight: 400, color: "#4a4a4a", lineHeight: 1.7 }),
            text({ role: "caption", y: 93, x: 8, w: 84, text: "@yourbrand", fontSize: 25, fontWeight: 600, color: "#9a9a9a", align: "center" }),
          ],
        },
      ],
    },
  ];
}

export function instantiateTemplate(tpl: Template): Project {
  const theme: Theme = { ...tpl.theme, fontFamily: tpl.theme.fontFamily ?? DEFAULT_FONT };
  const now = Date.now();
  const project: Project = {
    id: newId(),
    name: tpl.name,
    format: tpl.format,
    theme,
    cards: tpl.cards.map((c) => normalizeCard(c, theme)),
    chat: [],
    createdAt: now,
    updatedAt: now,
  };
  // Record project.styles from the roles above so the shared-style panel and the
  // consistency system are live the moment a template opens.
  return enforceRoles(project);
}
