// Output (copy) language — independent of the UI language. "auto" follows the
// SOURCE content the user gave (subtitles/script → story → extra notes): an
// English script yields an English carousel, a Chinese one a Chinese carousel.
// Pure + isomorphic (used by lib/requests.ts on both tracks and by the wizard).

export const OUTPUT_LANGS = [
  { code: "ko", label: "한국어", prompt: "한국어(Korean)" },
  { code: "en", label: "English", prompt: "영어(English)" },
  { code: "ja", label: "日本語", prompt: "일본어(Japanese)" },
  { code: "zh-Hans", label: "中文 (简体)", prompt: "중국어 간체(Simplified Chinese)" },
  { code: "zh-Hant", label: "中文 (繁體)", prompt: "중국어 번체(Traditional Chinese)" },
  { code: "es", label: "Español", prompt: "스페인어(Spanish)" },
  { code: "fr", label: "Français", prompt: "프랑스어(French)" },
  { code: "de", label: "Deutsch", prompt: "독일어(German)" },
  { code: "pt", label: "Português", prompt: "포르투갈어(Portuguese)" },
  { code: "vi", label: "Tiếng Việt", prompt: "베트남어(Vietnamese)" },
  { code: "th", label: "ไทย", prompt: "태국어(Thai)" },
  { code: "id", label: "Bahasa Indonesia", prompt: "인도네시아어(Indonesian)" },
  { code: "ru", label: "Русский", prompt: "러시아어(Russian)" },
] as const;

export type OutputLang = "auto" | (typeof OUTPUT_LANGS)[number]["code"];

// Script-based detection. Latin-script languages can't be told apart by
// characters alone → "latin" (the prompt then says "same language as the source").
export type Detected = (typeof OUTPUT_LANGS)[number]["code"] | "latin" | null;

export function detectLang(text: string): Detected {
  const s = text.slice(0, 6000);
  const count = (re: RegExp) => (s.match(re) ?? []).length;
  const hangul = count(/[가-힣]/g);
  const kana = count(/[぀-ヿ]/g);
  const han = count(/[一-鿿]/g);
  const thai = count(/[฀-๿]/g);
  const cyr = count(/[Ѐ-ӿ]/g);
  const latin = count(/[A-Za-zÀ-ÿ]/g);
  const total = hangul + kana + han + thai + cyr + latin;
  if (total < 8) return null;
  if (hangul / total > 0.2) return "ko";
  if (kana / total > 0.05) return "ja";
  if (han / total > 0.3) return /[們這說麼個為來時對過還們]/.test(s) ? "zh-Hant" : "zh-Hans";
  if (thai / total > 0.3) return "th";
  if (cyr / total > 0.3) return "ru";
  if (/[ăâđêôơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/i.test(s)) return "vi";
  return "latin";
}

// Where "auto" looks, in priority order: the video's words, then the story,
// then anything else the user typed.
export function sourceText(parts: (string | undefined)[]): string {
  return parts.find((p) => p && p.trim().length >= 8)?.trim() ?? "";
}

export const langLabel = (code: string) => OUTPUT_LANGS.find((l) => l.code === code)?.label ?? code;
const langPrompt = (code: string) => OUTPUT_LANGS.find((l) => l.code === code)?.prompt ?? code;

// The prompt instruction for the copy language — shared by the plan and the
// generate requests so both steps agree.
export function outputLangRule(choice: OutputLang | undefined, source: string, uiLang: "ko" | "en"): string {
  const guard =
    "레퍼런스 게시물의 언어, 이 지시문(한국어), 분석 계획(idea)의 언어에 끌려가지 말 것 — 카피 언어는 오직 이 규칙으로 정함. 원문을 다른 언어로 번역하지 말 것(출력 언어가 원문과 다를 때만 번역).";
  if (choice && choice !== "auto") {
    return `## 출력 언어 (사용자 지정)\n- 모든 카피를 ${langPrompt(choice)}로 작성할 것. ${guard}`;
  }
  const d = detectLang(source);
  if (d === "latin") {
    return `## 출력 언어 (자동 — 원문을 따름)\n- 모든 카피를 원문(자막/스크립트/스토리)과 **같은 언어**로 작성할 것: 원문이 영어면 영어, 스페인어면 스페인어. ${guard}`;
  }
  if (d) {
    return `## 출력 언어 (자동 — 원문 감지 결과)\n- 원문이 ${langPrompt(d)}로 감지됨 → 모든 카피를 ${langPrompt(d)}로 작성할 것. ${guard}`;
  }
  // Nothing to detect from (e.g. photos + reference only) → the UI language.
  return `## 출력 언어\n- 원문이 없어 UI 언어를 따름: 모든 카피를 ${uiLang === "en" ? "영어(English)" : "한국어(Korean)"}로 작성할 것.`;
}
