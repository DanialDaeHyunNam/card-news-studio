import LegalPage, { type LegalSection } from "@/components/LegalPage";
import { CONTACT_EMAIL, PRICE_ONE_TIME } from "@/lib/site";

export const metadata = { title: "Refund Policy — Card News Studio" };

const SECTIONS: LegalSection[] = [
  {
    h: ["먼저 써보세요", "Try it first"],
    body: [
      [
        "공식 빌드는 3일 무료로 모든 기능을 쓸 수 있고, 소스로 직접 빌드하면 언제나 무료입니다. 그래도 사고 나서 맞지 않았다면 아래처럼 환불해 드려요.",
        "Official builds include a free 3-day full-feature period, and building from source is always free. If you bought it and it isn't working out, here's how refunds work.",
      ],
    ],
  },
  {
    h: [`단건 구매 (${PRICE_ONE_TIME})`, `One-time purchase (${PRICE_ONE_TIME})`],
    body: [
      [
        "구매 후 14일 안에 이메일로 요청하시면 이유를 묻지 않고 전액 환불해 드립니다. 환불 후 라이선스 키는 비활성화됩니다.",
        "14-day money-back guarantee. Email us within 14 days of purchase and we'll refund you in full, no questions asked. Your license key will be deactivated after the refund.",
      ],
    ],
  },
  {
    h: ["요청 방법", "How to request"],
    body: [
      [
        `구매에 쓴 이메일로 ${CONTACT_EMAIL}에 연락하거나 Lemon Squeezy 영수증 메일에 회신해 주세요. 환불은 결제 대행사(Lemon Squeezy)를 통해 처리되며 보통 영업일 5~10일 안에 반영됩니다.`,
        `Email ${CONTACT_EMAIL} from the address you purchased with, or reply to your Lemon Squeezy receipt. Payments are processed by Lemon Squeezy (our merchant of record), so approved refunds are issued through them and typically appear in 5–10 business days.`,
      ],
    ],
  },
];

export default function RefundsPage() {
  return <LegalPage title={["환불 정책", "Refund Policy"]} updated="2026-10-01" sections={SECTIONS} />;
}
