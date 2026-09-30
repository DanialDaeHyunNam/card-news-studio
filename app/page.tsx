import AppRoot from "@/components/AppRoot";
import SiteRoot from "@/components/ProductSite";
import { SITE } from "@/lib/runtime-flags";

// Server component: decides at BUILD time (like data-hosted in layout.tsx)
// whether / is the product site or the editor, so the site is server-rendered
// and there's no client-side switch to flash or mismatch on hydration.
export default function Page() {
  return SITE ? <SiteRoot /> : <AppRoot />;
}
