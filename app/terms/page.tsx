import LegalPage, { type LegalSection } from "@/components/LegalPage";
import { CONTACT_EMAIL, PRICE_ONE_TIME } from "@/lib/site";

export const metadata = { title: "Terms of Service — Card News Studio" };

// Adapted from ZTO's terms (same seller, same model). Every claim must match
// the code: local-only data, keychain keys, Lemon Squeezy license API, 3-day
// trial, Settings → Your data wipe. Update this page in the same PR as any
// change to those.
const SECTIONS: LegalSection[] = [
  {
    h: ["1. Card News Studio란", "1. What Card News Studio is"],
    body: [
      [
        "Card News Studio(이하 '소프트웨어')는 독립 개발자(이하 '우리')가 만든, AI로 카드뉴스·캐러셀을 만드는 데스크톱 앱입니다. 사용자의 컴퓨터에서 로컬로 동작합니다.",
        'Card News Studio ("the Software") is a desktop application for making carousels / card news with AI, made by an independent developer ("we", "us"). It runs locally on your computer.',
      ],
    ],
  },
  {
    h: ["2. 구매와 라이선스", "2. Purchases and licensing"],
    body: [
      [
        `공식 빌드는 판매자(Merchant of Record)인 Lemon Squeezy를 통해 판매되며, 결제·영수증·세금은 Lemon Squeezy가 처리합니다(카드 명세서에 그 이름으로 표시될 수 있습니다). 구매(현재 ${PRICE_ONE_TIME}, 1회)하면 공식 빌드를 개인 또는 사내 업무용으로 쓸 수 있는 라이선스 키가 발급됩니다. 소스 코드는 MIT 라이선스 오픈소스이며, 직접 빌드해 쓰는 것은 무료이고 키가 필요 없습니다. 구매는 공식 빌드(서명·공증·자동 업데이트)에 대한 라이선스입니다.`,
        `Official builds are sold through Lemon Squeezy, our merchant of record. Your payment, invoice and applicable taxes are handled by Lemon Squeezy, and the charge may appear under their name. A purchase (currently ${PRICE_ONE_TIME}, one-time) grants you a license key for personal or internal business use of the official builds. The source code is open source under the MIT License — building and using it yourself is free and requires no key. Official builds (signed, notarized, auto-updating) are what a purchase licenses.`,
      ],
    ],
  },
  {
    h: ["3. 무료 사용", "3. Free period"],
    body: [
      [
        "공식 빌드는 처음 실행한 때부터 3일 동안 모든 기능을 무료로 쓸 수 있습니다. 이후에는 라이선스 키를 등록할 때까지 AI 생성·편집이 잠기며, 만든 프로젝트는 계속 열람하고 내보낼 수 있습니다.",
        "Official builds include free use of the full app for 3 days, starting the first time you launch an official build. After that, AI generation and editing are locked until you enter a license key; your projects stay viewable and exportable either way.",
      ],
    ],
  },
  {
    h: ["4. AI 제공자와 콘텐츠", "4. AI providers and your content"],
    body: [
      [
        "AI 기능은 사용자가 고른 제공자로 실행됩니다 — 사용자의 Claude 구독(설치된 Claude Code) 또는 사용자의 API 키(Anthropic·OpenAI·Google). 요청 내용은 사용자의 컴퓨터에서 해당 제공자로 직접 전송되며 각 제공자의 약관·정책을 따릅니다. 레퍼런스 게시물 링크를 넣으면 앱이 그 공개 페이지를 읽습니다. 만든 결과물과 그 게시·사용에 대한 책임(저작권, 각 플랫폼 약관 준수 포함)은 사용자에게 있습니다.",
        "AI features run on the provider you choose — your Claude subscription (your installed Claude Code) or your own API key (Anthropic, OpenAI, Google). Requests go directly from your computer to that provider and are governed by its terms and policies. When you paste a reference post link, the app reads that public page. You are responsible for what you create and how you publish or use it, including copyright and each platform's terms.",
      ],
    ],
  },
  {
    h: ["5. 데이터", "5. Your data"],
    body: [
      [
        "핵심 기능에 우리 서버가 없습니다. 프로젝트·레퍼런스·사진은 사용자의 컴퓨터(앱 데이터 폴더)에만 있고, API 키는 OS 키체인으로 암호화해 저장하며 우리에게 전송되지 않습니다. 라이선스 키는 Lemon Squeezy API로 직접 확인합니다.",
        "Card News Studio has no server of ours for its core features. Projects, references and photos stay on your computer (the app's data folder). API keys are encrypted with your operating system's keychain and are never transmitted to us. License keys are verified directly against the Lemon Squeezy API.",
      ],
    ],
  },
  {
    h: ["6. 데이터 삭제", "6. Deleting your data"],
    body: [
      [
        "데이터가 로컬에만 있으므로 앱을 지워도 데이터는 남습니다. 앱의 설정 → 내 데이터 → 로컬 데이터 전체 삭제로 프로젝트·레퍼런스 라이브러리·사진을 지울 수 있습니다. 라이선스 키와 무료 사용 기록은 남으며, 기기 등록 해제는 설정의 [이 기기에서 해제]로 합니다. 우리 쪽에는 사용자 계정이 없어 지울 것이 없습니다(결제 기록은 Lemon Squeezy가 보관).",
        "Because your data is stored locally, removing the app does not remove your data. Open Settings → Your data → Delete all local data to erase your projects, reference library and photos. Your license key and free-period record are kept so the app can still tell what you are entitled to; use Remove from this device in Settings to unregister. We hold no account for you, so there is nothing on our side to delete — apart from purchase records held by Lemon Squeezy.",
      ],
    ],
  },
  {
    h: ["7. 보증 없음", "7. No warranty"],
    body: [
      [
        "소프트웨어는 '있는 그대로' 제공됩니다. 외부 서비스(AI 제공자, 게시물 페이지)의 동작이나 결과물의 품질을 보장하지 않습니다. 법이 허용하는 한도에서 우리의 책임은 청구 전 12개월 동안 결제한 금액으로 제한됩니다.",
        'The Software is provided "as is", without warranty of any kind. We do not guarantee that third-party services (AI providers, post pages) remain available or behave the same, or the quality of generated output. To the maximum extent permitted by law, our total liability is limited to the amount you paid us in the twelve months before the claim.',
      ],
    ],
  },
  {
    h: ["8. 변경과 문의", "8. Changes and contact"],
    body: [
      [
        `약관은 제품에 맞춰 바뀔 수 있으며, 중요한 변경은 이 페이지에 새 날짜와 함께 표시합니다. 문의: ${CONTACT_EMAIL}`,
        `We may update these terms as the product evolves; material changes will be noted here with a new date. Contact: ${CONTACT_EMAIL}`,
      ],
    ],
  },
];

export default function TermsPage() {
  return <LegalPage title={["이용약관", "Terms of Service"]} updated="2026-10-01" sections={SECTIONS} />;
}
