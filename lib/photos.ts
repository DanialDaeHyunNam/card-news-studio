// Curated free stock photos for AI-picked card backgrounds.
// Source: Lorem Picsum (picsum.photos, Unsplash-licensed — same source as the
// bundled template photos). Served through /api/photo so exports stay
// same-origin. Tags were written by actually viewing every photo — when adding
// entries, look at the image first; never guess tags or IDs.

export interface StockPhoto {
  id: number;
  tags: string; // bilingual keywords so ko/en topics both match
}

export const STOCK_PHOTOS: StockPhoto[] = [
  // work / study / tech
  { id: 1, tags: "노트북 타이핑 어두운 책상 작업 laptop typing dark desk work" },
  { id: 20, tags: "책상 문구 노트 플랫레이 아기자기 desk stationery notebooks flatlay colorful" },
  { id: 48, tags: "카페 맥북 책상 작업 cafe macbook laptop desk" },
  { id: 60, tags: "어두운 데스크셋업 키보드 모니터 dark workstation keyboard monitor setup" },
  { id: 180, tags: "노트북 공책 공부 책상 macbook notebook study desk" },
  { id: 201, tags: "미니멀 원목 책상 노트북 안경 minimal wooden desk laptop glasses" },
  { id: 445, tags: "홈오피스 창가 노트북 따뜻한 home office window laptop warm" },
  // books / writing / vintage
  { id: 24, tags: "펼쳐진 책 독서 open book reading pages" },
  { id: 403, tags: "빈티지 타자기 자판 글쓰기 vintage typewriter keys writing" },
  { id: 486, tags: "타자기 흰 배경 미니멀 글쓰기 typewriter white minimal writing" },
  { id: 998, tags: "오래된 편지 사진 잉크 추억 old letters photos ink memories vintage" },
  { id: 175, tags: "빈티지 시계 흑백 시간 vintage clock black-white time" },
  // coffee / food
  { id: 42, tags: "카페 인테리어 원목 테이블 커피 cafe interior wooden table coffee" },
  { id: 431, tags: "라떼 커피잔 나무 테이블 latte coffee cup wooden table" },
  { id: 1060, tags: "커피 추출 핸드드립 카페 coffee brewing pour-over espresso" },
  { id: 292, tags: "채소 도마 요리 재료 vegetables cutting board cooking ingredients" },
  { id: 312, tags: "꿀 항아리 달콤함 honey jar dipper sweet" },
  { id: 429, tags: "산딸기 컵 디저트 raspberries cup dessert" },
  { id: 1080, tags: "딸기 빨강 과일 가득 strawberries red fruit" },
  { id: 674, tags: "포도 수확 두 손 결실 grapes harvest hands" },
  // nature
  { id: 10, tags: "숲 계곡 소나무 파란하늘 forest valley pines blue sky" },
  { id: 15, tags: "폭포 바위 계곡 waterfall rocks river" },
  { id: 28, tags: "초록 숲 계곡물 바위 green forest stream rocks" },
  { id: 29, tags: "설산 산맥 겨울 웅장 snowy mountains range winter epic" },
  { id: 110, tags: "노을 들판 황금빛 초원 sunset field golden meadow" },
  { id: 502, tags: "햇살 스민 초록 숲 sunlit green forest" },
  { id: 599, tags: "안개 산 숲 몽환 misty mountains forest fog moody" },
  { id: 730, tags: "눈 덮인 겨울 숲 snowy winter forest" },
  { id: 957, tags: "거대한 숲 나무 햇살 tall redwood forest sunbeams" },
  { id: 944, tags: "숲속 나무다리 산책로 forest wooden bridge walkway" },
  { id: 1015, tags: "피오르 강 산 협곡 fjord river mountains norway" },
  { id: 1018, tags: "초록 언덕 절벽 고원 green highlands cliffs hills" },
  { id: 1039, tags: "절벽 폭포 초록 이끼 cliff waterfall green moss" },
  { id: 1043, tags: "요세미티 계곡 강 숲 yosemite valley river forest" },
  { id: 564, tags: "협곡 주황 바위 빛 antelope canyon orange rock light" },
  // sea
  { id: 16, tags: "바다 해안 유목 파랑 sea coast driftwood blue" },
  { id: 124, tags: "청록 바다 빨간 배 한 척 turquoise sea lone red boat" },
  { id: 715, tags: "바다 노을 주황 수평선 ocean sunset orange horizon" },
  { id: 1050, tags: "바다 절벽 해안 항공뷰 sea cliffs coast aerial" },
  { id: 1053, tags: "폭풍 파도 청록 바다 stormy waves teal sea aerial" },
  { id: 338, tags: "겨울 바다 뒷모습 고독 winter sea person alone moody" },
  // night / space
  { id: 683, tags: "별 궤적 밤하늘 star trails night sky" },
  { id: 903, tags: "은하수 밤하늘 실루엣 보라 milky way night silhouette purple" },
  { id: 1002, tags: "성운 추상 금색 파랑 nebula abstract gold blue space" },
  { id: 799, tags: "야경 다리 강 보랏빛 도시 night bridge river purple city lights" },
  // city / architecture / travel
  { id: 49, tags: "산토리니 하얀 마을 여행 santorini white village travel greece" },
  { id: 164, tags: "유럽 운하 옛 건물 보트 european canal old houses boats" },
  { id: 193, tags: "대학 고딕 건물 잔디 university gothic building lawn campus" },
  { id: 857, tags: "도시 스카이라인 극적인 구름 city skyline dramatic clouds dusk" },
  { id: 972, tags: "고층빌딩 올려다본 추상 skyscrapers looking up abstract" },
  { id: 1031, tags: "유리 빌딩 미니멀 건축 glass tower minimal architecture" },
  { id: 1067, tags: "도시 노을 항공뷰 스카이라인 city sunset aerial skyline" },
  { id: 744, tags: "금문교 안개 다리 golden gate bridge fog" },
  { id: 655, tags: "파란 캠퍼밴 여행 로드트립 blue camper van travel roadtrip" },
  // people / mood
  { id: 349, tags: "도시 실루엣 앉은 사람 노을 city silhouette person sitting sunset" },
  { id: 452, tags: "콘서트 관중 손 조명 concert crowd hands stage lights" },
  { id: 548, tags: "모닥불 불씨 어둠 campfire embers dark warm" },
  { id: 646, tags: "골든아워 여성 들판 역광 golden hour woman field backlit" },
  { id: 786, tags: "숲속 뒷모습 사색 person in forest back view contemplative" },
  { id: 823, tags: "카메라 든 여성 사진가 숲 woman photographer camera forest" },
  { id: 883, tags: "호수 반영 산 서있는 사람 lake mirror mountains person standing" },
  { id: 1011, tags: "카누 호수 여성 패들 canoe lake woman paddle calm" },
  // animals
  { id: 237, tags: "강아지 검정 올려다봄 black puppy dog looking up" },
  { id: 1025, tags: "퍼그 담요 귀여움 pug dog blanket cute" },
  { id: 219, tags: "표범 야생 walking leopard wildlife" },
  { id: 1024, tags: "독수리 날개 비행 eagle wings flying" },
  { id: 1069, tags: "해파리 주황 파란 바다 jellyfish orange blue ocean" },
  { id: 1074, tags: "암사자 클로즈업 lioness closeup wildlife" },
  // flowers / soft
  { id: 82, tags: "벚꽃 분홍 봄 cherry blossom pink spring" },
  { id: 106, tags: "봄꽃 파란하늘 분홍 spring flowers blue sky pink" },
  { id: 360, tags: "주황 산호색 꽃 부드러움 coral orange flowers soft" },
];

// Prompt section listing the library. `cardH` bakes the format's export height
// into the example URL so the AI copies a correctly-sized request.
export function photoLibraryPrompt(cardH: number): string {
  const list = STOCK_PHOTOS.map((p) => `${p.id}: ${p.tags}`).join("\n");
  return `## 무료 배경 사진 라이브러리 (저작권 프리)
- 사용자가 배경에 어울리는 사진을 깔아달라고 하면 아래 라이브러리에서 주제/무드에 맞는 사진을 골라
  update_card(patch.background)로 적용할 것. 형식:
  "linear-gradient(rgba(R,G,B,A), rgba(R,G,B,A)), url(/api/photo?id=ID&w=1080&h=${cardH}) center/cover"
- 스크림(linear-gradient)은 필수 — 텍스트 가독성이 최우선. 테마 배경색 계열의 어두운 rgba(알파 0.5~0.8),
  위쪽을 조금 옅게 아래쪽을 진하게 하는 것도 좋음. 무드 컬러 틴트(딥틸/버건디/네이비 등)도 가능.
- 흑백 duotone 무드가 어울리면 URL에 &g=1을 붙이고 컬러 스크림을 겹칠 것.
- 사진 위 텍스트 색은 스크림과 대비가 확실한 밝은 색으로 유지/조정할 것.
- 아래 목록의 ID만 유효함. 목록에 없는 ID나 외부 URL을 지어내지 말 것.
- 카드별로 다른 사진을 골라도 되고, 시리즈감이 중요하면 같은 사진이나 같은 계열로 통일할 것.

사용 가능한 사진 (id: 키워드):
${list}`;
}
