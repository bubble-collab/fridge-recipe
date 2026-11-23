/* =========================================================
   냉장고 파먹기 — app.js
   앱인토스(App in Toss) 비게임 미니앱 프로토타입
   - 첫 화면 1탭 조합 → 바로 결과 · 냉장실 선반 / 문쪽 포켓 구분
   - 냉장고 내부 UI에서 재료 선택 (한 번 더 누르면 🔥 임박)
   - 고른 재료로 만들 수 있는 요리를 매칭률 순으로 제시
   - 레시피 보기 [광고] → 광고 사전 안내 → (데모) 광고 시청 → 상세 레시피
   - 상세: 1인분/2인분 계량 전환 · 단계별 원터치 타이머
   - 1~2개 부족한 재료는 장보기 메모로 모아 복사
   - 순수 클라이언트 사이드 (iframe / eval / SSR 없음)
   ========================================================= */
(function () {
  'use strict';

  /* ---------------------------------------------------------
     1. 설정 (앱인토스 콘솔에서 발급받은 값으로 교체)
     --------------------------------------------------------- */
  var CONFIG = {
    appName: '냉장고 파먹기',

    // 웹 공유 링크
    appUrl: 'https://bubble-collab.github.io/fridge-recipe/',

    /* ★ 앱마다 새로 발급받은 보상형 광고 그룹 ID를 넣어 주세요.
       - 다른 앱에서 쓰던 ID를 재사용하면 정적 분석에서 반려될 수 있어요.
       - 지금 값은 앱인토스 문서의 테스트용 ID예요. */
    rewardedAdGroupId: 'ait-ad-test-rewarded-id',

    // 프로토타입 데모 광고 길이(초) — 실제 앱에서는 SDK 광고가 재생돼요
    demoAdSeconds: 3,

    // 재료를 1~2개만 더 있으면 되는 요리까지 보여 줘요
    maxMissing: 2,

    // 상세 레시피 기본 인분 (계량 기준)
    baseServings: 2,

    // 자주 쓰는 재료 (빈 냉장고에서 시작할 때)
    quickPick: ['rice', 'kimchi', 'pa', 'egg', 'onion'],

    /* 첫 화면 원터치 조합 — 누르면 이 재료들이 담기고 바로 결과로 이동해요
       (한 번에 ‘바로 가능’ 요리가 뜨는 조합으로 골랐어요) */
    combos: [
      { id: 'c-kimchi', emoji: '🍚', label: '김치+밥+대파', items: ['kimchi', 'rice', 'pa'] },
      { id: 'c-potato', emoji: '🥔', label: '감자+당근+양파', items: ['potato', 'carrot', 'onion'] },
      { id: 'c-toast', emoji: '🍞', label: '식빵+계란+치즈', items: ['bread', 'egg', 'cheese'] }
    ]
  };

  /* 선반(카테고리) — tone은 선반 라벨 색, door는 냉장고 문쪽 포켓 */
  var SHELVES = [
    { id: 'fresh', name: '신선칸', sub: '채소·버섯', tone: '#2FAE7D' },
    { id: 'meat', name: '고기칸', sub: '고기·해산물', tone: '#DD6E57' },
    { id: 'dairy', name: '달걀칸', sub: '두부·유제품', tone: '#DFA72C' },
    { id: 'door', name: '문쪽 포켓', sub: '양념·밥·면', tone: '#3C7FB8', door: true }
  ];

  /* 재료 36종 */
  var INGREDIENTS = [
    /* 신선칸 */
    { id: 'pa', name: '대파', shelf: 'fresh', icon: 'pa' },
    { id: 'onion', name: '양파', shelf: 'fresh', icon: 'onion' },
    { id: 'garlic', name: '마늘', shelf: 'fresh', icon: 'garlic' },
    { id: 'potato', name: '감자', shelf: 'fresh', icon: 'potato' },
    { id: 'carrot', name: '당근', shelf: 'fresh', icon: 'carrot' },
    { id: 'zucchini', name: '애호박', shelf: 'fresh', icon: 'zucchini' },
    { id: 'cucumber', name: '오이', shelf: 'fresh', icon: 'cucumber' },
    { id: 'kimchi', name: '김치', shelf: 'fresh', icon: 'kimchi' },
    { id: 'bean', name: '콩나물', shelf: 'fresh', icon: 'bean' },
    { id: 'mushroom', name: '느타리', shelf: 'fresh', icon: 'mushroom' },

    /* 고기·해산물칸 */
    { id: 'pork', name: '돼지고기', shelf: 'meat', icon: 'pork' },
    { id: 'samgyeop', name: '삼겹살', shelf: 'meat', icon: 'samgyeop' },
    { id: 'chicken', name: '닭고기', shelf: 'meat', icon: 'chicken' },
    { id: 'beef', name: '다짐육', shelf: 'meat', icon: 'beef' },
    { id: 'spam', name: '스팸', shelf: 'meat', icon: 'spam' },
    { id: 'sausage', name: '소시지', shelf: 'meat', icon: 'sausage' },
    { id: 'tuna', name: '참치캔', shelf: 'meat', icon: 'tuna' },
    { id: 'eomuk', name: '어묵', shelf: 'meat', icon: 'eomuk' },
    { id: 'shrimp', name: '새우', shelf: 'meat', icon: 'shrimp' },

    /* 달걀·두부·유제품칸 */
    { id: 'egg', name: '계란', shelf: 'dairy', icon: 'egg' },
    { id: 'tofu', name: '두부', shelf: 'dairy', icon: 'tofu' },
    { id: 'sundubu', name: '순두부', shelf: 'dairy', icon: 'sundubu' },
    { id: 'milk', name: '우유', shelf: 'dairy', icon: 'milk' },
    { id: 'cheese', name: '치즈', shelf: 'dairy', icon: 'cheese' },

    /* 문쪽 양념·밥·면칸 */
    { id: 'rice', name: '공깃밥', shelf: 'door', icon: 'rice' },
    { id: 'ramen', name: '라면사리', shelf: 'door', icon: 'ramen' },
    { id: 'somyeon', name: '소면', shelf: 'door', icon: 'somyeon' },
    { id: 'tteok', name: '떡볶이떡', shelf: 'door', icon: 'tteok' },
    { id: 'bread', name: '식빵', shelf: 'door', icon: 'bread' },
    { id: 'flour', name: '밀가루', shelf: 'door', icon: 'flour' },
    { id: 'gochujang', name: '고추장', shelf: 'door', icon: 'gochujang' },
    { id: 'doenjang', name: '된장', shelf: 'door', icon: 'doenjang' },
    { id: 'soy', name: '간장', shelf: 'door', icon: 'soy' },
    { id: 'mayo', name: '마요네즈', shelf: 'door', icon: 'mayo' },
    { id: 'sesameoil', name: '참기름', shelf: 'door', icon: 'sesameoil' },
    { id: 'curry', name: '카레가루', shelf: 'door', icon: 'curry' }
  ];

  var BY_ID = {};
  INGREDIENTS.forEach(function (ing) { BY_ID[ing.id] = ing; });

  /* ---------------------------------------------------------
     2. 레시피 25종 (계량은 2인분 기준)
     --------------------------------------------------------- */
  var RECIPES = [
    {
      id: 'kimchi-fried-rice', name: '김치볶음밥',
      desc: '잘 익은 김치와 공깃밥만 있으면 10분 완성',
      time: 10, level: '쉬움',
      need: ['rice', 'kimchi', 'pa'],
      art: { kind: 'pan', main: '#E2603E', accent: '#F7C64B', bg: '#FFF1E7' },
      measures: [
        { n: '김치', q: 1, u: '컵', id: 'kimchi' },
        { n: '공깃밥', q: 2, u: '공기', id: 'rice' },
        { n: '대파', q: 1, u: '대', id: 'pa' },
        { n: '계란', q: 2, u: '개', id: 'egg' },
        { n: '식용유', q: 1, u: '큰술' }
      ],
      steps: [
        { t: '김치는 잘게 썰고 대파는 송송 썰어요.' },
        { t: '팬에 기름을 두르고 김치를 볶아 신맛을 날려요.', timer: 180, label: '김치 볶기' },
        { t: '공깃밥을 넣고 김치와 섞으며 볶아요.', timer: 120, label: '밥 볶기' },
        { t: '대파와 참기름 반 큰술을 넣고 한 번 더 볶아 마무리해요.' },
        { t: '그릇에 담고 계란 프라이를 올리면 더 든든해요.' }
      ],
      tip: '김치가 너무 시면 설탕 1/2작은술을 넣으면 훨씬 부드러워져요.'
    },
    {
      id: 'egg-roll', name: '계란말이',
      desc: '채소를 다져 넣어 도톰하게 말아요',
      time: 10, level: '쉬움',
      need: ['egg', 'carrot', 'pa'],
      art: { kind: 'omelette', main: '#F8D467', accent: '#E2683F', bg: '#FFF8E4' },
      measures: [
        { n: '계란', q: 4, u: '개', id: 'egg' },
        { n: '당근', q: 0.25, u: '개', id: 'carrot' },
        { n: '대파', q: 0.5, u: '대', id: 'pa' },
        { n: '소금', q: null, u: '약간' },
        { n: '식용유', q: 1, u: '큰술' }
      ],
      steps: [
        { t: '당근과 대파를 잘게 다져요.' },
        { t: '계란을 풀어 소금을 넣고 고르게 섞어요.' },
        { t: '약불로 줄인 팬에 계란의 1/3을 붓고 채소를 올려요.', timer: 90, label: '첫 장 익히기' },
        { t: '한쪽부터 말아 넣고, 남은 계란을 2~3번 나눠 부으며 도톰하게 말아요.', timer: 180, label: '말아 익히기' },
        { t: '한 김 식힌 뒤 먹기 좋게 썰어요.' }
      ],
      tip: '불을 약하게 유지해야 계란이 타지 않고 부드럽게 말려요.'
    },
    {
      id: 'doenjang-stew', name: '된장찌개',
      desc: '감자와 두부로 든든하게 끓여요',
      time: 20, level: '보통',
      need: ['doenjang', 'tofu', 'potato', 'onion', 'zucchini'],
      art: { kind: 'soup', main: '#C9502F', accent: '#E7C56B', bg: '#FFF0E6' },
      measures: [
        { n: '된장', q: 1.5, u: '큰술', id: 'doenjang' },
        { n: '두부', q: 0.5, u: '모', id: 'tofu' },
        { n: '감자', q: 1, u: '개', id: 'potato' },
        { n: '양파', q: 0.5, u: '개', id: 'onion' },
        { n: '애호박', q: 0.5, u: '개', id: 'zucchini' },
        { n: '대파', q: 0.5, u: '대', id: 'pa' },
        { n: '물', q: 600, u: 'ml' }
      ],
      steps: [
        { t: '감자·애호박·양파·두부를 먹기 좋게 썰어요.' },
        { t: '냄비에 물 600ml와 감자를 넣고 끓여요.', timer: 480, label: '감자 익히기' },
        { t: '된장을 체에 걸러 풀고 나머지 채소를 넣어 끓여요.', timer: 420, label: '채소 익히기' },
        { t: '두부와 대파를 넣고 3분 더 끓여요.', timer: 180, label: '마무리 끓이기' },
        { t: '간을 보고 부족하면 된장을 조금 더 풀어요.' }
      ],
      tip: '된장은 체에 걸러 넣으면 덩어리 없이 고르게 풀려요.'
    },
    {
      id: 'tofu-kimchi', name: '두부김치',
      desc: '부드러운 두부에 볶은 김치를 올려요',
      time: 15, level: '쉬움',
      need: ['tofu', 'kimchi', 'pa'],
      art: { kind: 'plate', main: '#E2603E', accent: '#FFF4DC', bg: '#FFF2E8' },
      measures: [
        { n: '두부', q: 1, u: '모', id: 'tofu' },
        { n: '김치', q: 1, u: '컵', id: 'kimchi' },
        { n: '대파', q: 0.5, u: '대', id: 'pa' },
        { n: '참기름', q: 1, u: '작은술', id: 'sesameoil' },
        { n: '설탕', q: 1, u: '작은술' }
      ],
      steps: [
        { t: '두부는 1.5cm 두께로 썰어 물기를 빼요.' },
        { t: '팬에 기름을 두르고 두부를 앞뒤로 노릇하게 부쳐요.', timer: 240, label: '두부 굽기' },
        { t: '다른 팬에 김치를 넣고 설탕·참기름과 볶아요.', timer: 240, label: '김치 볶기' },
        { t: '접시에 두부를 깔고 김치를 올려요.' },
        { t: '대파 채를 올려 마무리해요.' }
      ],
      tip: '두부는 부치기 전에 키친타월로 눌러 물기를 빼야 부서지지 않아요.'
    },
    {
      id: 'soy-egg-rice', name: '간장계란밥',
      desc: '5분이면 되는 가장 빠른 한 끼',
      time: 5, level: '아주 쉬움',
      need: ['rice', 'egg', 'soy', 'sesameoil'],
      art: { kind: 'rice', main: '#E8A93C', accent: '#F7D98A', bg: '#FFF7E6' },
      measures: [
        { n: '공깃밥', q: 2, u: '공기', id: 'rice' },
        { n: '계란', q: 2, u: '개', id: 'egg' },
        { n: '간장', q: 1, u: '큰술', id: 'soy' },
        { n: '참기름', q: 1, u: '작은술', id: 'sesameoil' },
        { n: '대파', q: null, u: '약간', id: 'pa' }
      ],
      steps: [
        { t: '따뜻한 밥에 간장과 참기름을 넣어요.' },
        { t: '계란 프라이를 반숙으로 부쳐요.', timer: 150, label: '반숙 프라이' },
        { t: '밥 위에 계란을 올리고 노른자를 터뜨려 비벼요.' },
        { t: '김가루나 대파를 올려 마무리해요.' }
      ],
      tip: '간장은 1큰술부터, 싱거우면 조금씩 더 넣는 게 좋아요.'
    },
    {
      id: 'spam-mayo-bowl', name: '스팸마요덮밥',
      desc: '구운 스팸과 마요네즈의 국민 조합',
      time: 10, level: '쉬움',
      need: ['rice', 'spam', 'egg', 'mayo'],
      art: { kind: 'rice', main: '#E2764F', accent: '#F8E6A8', bg: '#FFF3EA' },
      measures: [
        { n: '공깃밥', q: 2, u: '공기', id: 'rice' },
        { n: '스팸', q: 160, u: 'g', id: 'spam' },
        { n: '계란', q: 2, u: '개', id: 'egg' },
        { n: '마요네즈', q: 2, u: '큰술', id: 'mayo' },
        { n: '간장', q: 1, u: '작은술', id: 'soy' }
      ],
      steps: [
        { t: '스팸을 1cm 두께로 썰어요.' },
        { t: '팬에 스팸을 올려 겉이 노릇해지게 구워요.', timer: 180, label: '스팸 굽기' },
        { t: '계란을 반숙 스크램블로 부쳐요.', timer: 120, label: '계란 익히기' },
        { t: '밥 위에 스팸과 계란을 올려요.' },
        { t: '마요네즈와 간장을 뿌려 비벼 먹어요.' }
      ],
      tip: '스팸은 겉이 바삭할 때까지 구워야 고소함이 살아나요.'
    },
    {
      id: 'jeyuk', name: '제육볶음',
      desc: '매콤한 양념에 재워 볶아 내는 인기 메뉴',
      time: 25, level: '보통',
      need: ['pork', 'gochujang', 'onion', 'garlic'],
      art: { kind: 'pan', main: '#C64A2F', accent: '#F0C468', bg: '#FFF0E8' },
      measures: [
        { n: '돼지고기', q: 400, u: 'g', id: 'pork' },
        { n: '고추장', q: 2, u: '큰술', id: 'gochujang' },
        { n: '양파', q: 1, u: '개', id: 'onion' },
        { n: '마늘', q: 3, u: '쪽', id: 'garlic' },
        { n: '간장', q: 1, u: '큰술', id: 'soy' },
        { n: '설탕', q: 1, u: '큰술' }
      ],
      steps: [
        { t: '고추장·간장·설탕·다진 마늘로 양념을 만들어요.' },
        { t: '돼지고기에 양념을 버무려 재워요.', timer: 600, label: '양념 재우기' },
        { t: '달군 팬에 고기를 넣고 센 불에서 볶아요.', timer: 240, label: '고기 볶기' },
        { t: '양파와 대파를 넣고 5분 더 볶아요.', timer: 300, label: '채소 볶기' },
        { t: '깨를 뿌려 마무리해요.' }
      ],
      tip: '고기는 냉장고에서 20분 꺼내 두면 속까지 고르게 익어요.'
    },
    {
      id: 'sundubu', name: '순두부찌개',
      desc: '몽글몽글 순두부에 계란을 풀어 넣어요',
      time: 15, level: '쉬움',
      need: ['sundubu', 'egg', 'pa', 'onion'],
      art: { kind: 'soup', main: '#D9553A', accent: '#F6E3B0', bg: '#FFF1E9' },
      measures: [
        { n: '순두부', q: 1, u: '봉', id: 'sundubu' },
        { n: '계란', q: 2, u: '개', id: 'egg' },
        { n: '양파', q: 0.5, u: '개', id: 'onion' },
        { n: '대파', q: 1, u: '대', id: 'pa' },
        { n: '고춧가루', q: 1, u: '큰술' },
        { n: '물', q: 400, u: 'ml' }
      ],
      steps: [
        { t: '팬에 기름과 고춧가루를 넣고 약불에서 고추기름을 내요.', timer: 120, label: '고추기름' },
        { t: '양파와 대파를 넣고 볶다가 물 400ml를 부어요.' },
        { t: '끓어오르면 순두부를 숟가락으로 떠 넣어요.', timer: 180, label: '순두부 넣고 끓이기' },
        { t: '계란을 가운데 풀어 넣고 2분 더 끓여요.', timer: 120, label: '계란 익히기' },
        { t: '간장으로 간을 맞춰요.' }
      ],
      tip: '순두부는 끓는 국물에 넣고 오래 끓이지 말아야 부드러워요.'
    },
    {
      id: 'tuna-kimchi-stew', name: '참치김치찌개',
      desc: '참치캔 하나로 깊은 국물을 내요',
      time: 20, level: '쉬움',
      need: ['tuna', 'kimchi', 'tofu', 'pa'],
      art: { kind: 'soup', main: '#C5402B', accent: '#F3D7A3', bg: '#FFF0E6' },
      measures: [
        { n: '참치캔', q: 1, u: '개', id: 'tuna' },
        { n: '김치', q: 1, u: '컵', id: 'kimchi' },
        { n: '두부', q: 0.5, u: '모', id: 'tofu' },
        { n: '대파', q: 1, u: '대', id: 'pa' },
        { n: '물', q: 500, u: 'ml' }
      ],
      steps: [
        { t: '김치를 먹기 좋게 썰고 참치 기름을 빼요.' },
        { t: '냄비에 김치를 볶다가 물을 부어요.', timer: 300, label: '김치 볶기' },
        { t: '10분 끓인 뒤 참치와 두부를 넣어요.', timer: 600, label: '국물 내기' },
        { t: '대파를 넣고 5분 더 끓여요.', timer: 300, label: '마무리 끓이기' },
        { t: '간을 보고 마무리해요.' }
      ],
      tip: '참치는 기름을 살짝 남겨 넣으면 국물이 더 고소해요.'
    },
    {
      id: 'pork-bean-sprout', name: '삼겹살 콩나물볶음',
      desc: '고소한 삼겹살에 아삭한 콩나물을 더해요',
      time: 15, level: '쉬움',
      need: ['samgyeop', 'bean', 'onion', 'soy'],
      art: { kind: 'pan', main: '#B9713F', accent: '#DCE9B8', bg: '#FFF4EA' },
      measures: [
        { n: '삼겹살', q: 300, u: 'g', id: 'samgyeop' },
        { n: '콩나물', q: 1, u: '줌', id: 'bean' },
        { n: '양파', q: 0.5, u: '개', id: 'onion' },
        { n: '간장', q: 1, u: '큰술', id: 'soy' },
        { n: '마늘', q: 2, u: '쪽', id: 'garlic' }
      ],
      steps: [
        { t: '콩나물은 씻어 물기를 빼요.' },
        { t: '삼겹살을 한입 크기로 썰어 센 불에 구워요.', timer: 240, label: '삼겹살 굽기' },
        { t: '양파와 마늘을 넣고 볶아요.', timer: 120, label: '채소 볶기' },
        { t: '콩나물과 간장을 넣고 2분만 볶아요.', timer: 120, label: '콩나물 볶기' },
        { t: '후추를 뿌려 마무리해요.' }
      ],
      tip: '콩나물은 마지막에 짧게 볶아야 아삭해요.'
    },
    {
      id: 'eomuk-soup', name: '어묵탕',
      desc: '간단한 국물에 어묵을 듬뿍',
      time: 15, level: '아주 쉬움',
      need: ['eomuk', 'pa', 'soy'],
      art: { kind: 'soup', main: '#D9A24C', accent: '#F7EACB', bg: '#FFF8EA' },
      measures: [
        { n: '어묵', q: 4, u: '장', id: 'eomuk' },
        { n: '대파', q: 1, u: '대', id: 'pa' },
        { n: '간장', q: 1, u: '큰술', id: 'soy' },
        { n: '마늘', q: 1, u: '쪽', id: 'garlic' },
        { n: '물', q: 600, u: 'ml' }
      ],
      steps: [
        { t: '어묵은 삼각형으로 썰어요.' },
        { t: '물에 간장·마늘을 넣고 끓여요.', timer: 300, label: '국물 끓이기' },
        { t: '어묵을 넣고 5분 끓여요.', timer: 300, label: '어묵 익히기' },
        { t: '대파를 넣고 2분 더 끓여요.', timer: 120, label: '대파 넣기' },
        { t: '후추로 마무리해요.' }
      ],
      tip: '어묵을 끓는 물에 한 번 데치면 기름과 잡내가 빠져요.'
    },
    {
      id: 'tteokbokki', name: '떡볶이',
      desc: '집에서도 매콤달콤하게',
      time: 15, level: '쉬움',
      need: ['tteok', 'gochujang', 'eomuk', 'pa'],
      art: { kind: 'pan', main: '#D0432F', accent: '#F7D48A', bg: '#FFF1E6' },
      measures: [
        { n: '떡볶이떡', q: 300, u: 'g', id: 'tteok' },
        { n: '고추장', q: 2, u: '큰술', id: 'gochujang' },
        { n: '어묵', q: 2, u: '장', id: 'eomuk' },
        { n: '대파', q: 1, u: '대', id: 'pa' },
        { n: '설탕', q: 1, u: '큰술' },
        { n: '물', q: 400, u: 'ml' }
      ],
      steps: [
        { t: '떡은 물에 불려요.', timer: 600, label: '떡 불리기' },
        { t: '물에 고추장·설탕을 풀어 끓여요.', timer: 180, label: '양념 끓이기' },
        { t: '떡과 어묵을 넣고 끓여요.', timer: 300, label: '떡 익히기' },
        { t: '대파를 넣고 국물이 걸쭉해질 때까지 더 끓여요.', timer: 180, label: '국물 졸이기' },
        { t: '깨를 뿌려 마무리해요.' }
      ],
      tip: '떡을 불려 두면 덜 딱딱하고 양념이 잘 배요.'
    },
    {
      id: 'kimchi-pancake', name: '김치전',
      desc: '김치 국물까지 넣어 바삭하게',
      time: 15, level: '쉬움',
      need: ['kimchi', 'flour', 'pa'],
      art: { kind: 'plate', main: '#E0A03C', accent: '#E2603E', bg: '#FFF5E6' },
      measures: [
        { n: '김치', q: 1, u: '컵', id: 'kimchi' },
        { n: '밀가루', q: 1, u: '컵', id: 'flour' },
        { n: '물', q: 0.75, u: '컵' },
        { n: '대파', q: 0.5, u: '대', id: 'pa' },
        { n: '식용유', q: 3, u: '큰술' }
      ],
      steps: [
        { t: '김치를 잘게 썰고 김치 국물 2큰술을 준비해요.' },
        { t: '밀가루·물·김치국물을 섞어 반죽해요.' },
        { t: '김치와 대파를 넣고 가볍게 섞어요.' },
        { t: '팬에 기름을 넉넉히 두르고 반죽을 펴 부쳐요.', timer: 180, label: '앞면 부치기' },
        { t: '뒤집어 노릇하게 마저 부쳐요.', timer: 180, label: '뒷면 부치기' }
      ],
      tip: '반죽은 묽게, 기름은 넉넉히 넣어야 가장자리가 바삭해요.'
    },
    {
      id: 'bibim-guksu', name: '비빔국수',
      desc: '새콤달콤 양념에 오이를 올려요',
      time: 15, level: '쉬움',
      need: ['somyeon', 'gochujang', 'sesameoil', 'cucumber'],
      art: { kind: 'noodle', main: '#D2693C', accent: '#CFE3A8', bg: '#FFF2E8' },
      measures: [
        { n: '소면', q: 200, u: 'g', id: 'somyeon' },
        { n: '고추장', q: 1.5, u: '큰술', id: 'gochujang' },
        { n: '참기름', q: 1, u: '큰술', id: 'sesameoil' },
        { n: '오이', q: 0.5, u: '개', id: 'cucumber' },
        { n: '설탕', q: 1, u: '큰술' },
        { n: '식초', q: 1, u: '큰술' }
      ],
      steps: [
        { t: '오이는 채 썰어 소금에 살짝 절여요.' },
        { t: '소면을 끓는 물에 삶아요.', timer: 180, label: '면 삶기' },
        { t: '삶은 면을 찬물에 헹궈 물기를 꽉 짜요.' },
        { t: '고추장·설탕·식초·참기름으로 양념장을 만들어요.' },
        { t: '면과 양념장을 비비고 오이를 올려요.' }
      ],
      tip: '면을 헹군 뒤 물기를 꽉 짜야 양념이 묽어지지 않아요.'
    },
    {
      id: 'potato-stirfry', name: '감자채볶음',
      desc: '담백하고 아삭한 기본 반찬',
      time: 15, level: '쉬움',
      need: ['potato', 'carrot', 'onion'],
      art: { kind: 'pan', main: '#E7B75A', accent: '#D9A14B', bg: '#FFFAE9' },
      measures: [
        { n: '감자', q: 2, u: '개', id: 'potato' },
        { n: '당근', q: 0.5, u: '개', id: 'carrot' },
        { n: '양파', q: 0.5, u: '개', id: 'onion' },
        { n: '소금', q: 0.5, u: '작은술' },
        { n: '식용유', q: 1, u: '큰술' }
      ],
      steps: [
        { t: '감자·당근을 채 썰어 물에 담가 전분을 빼요.', timer: 300, label: '전분 빼기' },
        { t: '팬에 기름을 두르고 감자를 볶아요.', timer: 180, label: '감자 볶기' },
        { t: '당근과 양파를 넣고 더 볶아요.', timer: 180, label: '채소 볶기' },
        { t: '소금으로 간하고 마무리해요.' }
      ],
      tip: '감자를 물에 담가 두면 팬에 붙지 않고 아삭해요.'
    },
    {
      id: 'sausage-veg', name: '소시지야채볶음',
      desc: '아이도 좋아하는 달콤한 볶음',
      time: 15, level: '쉬움',
      need: ['sausage', 'onion', 'carrot', 'gochujang'],
      art: { kind: 'pan', main: '#D97A3C', accent: '#F3D07A', bg: '#FFF4E8' },
      measures: [
        { n: '소시지', q: 4, u: '개', id: 'sausage' },
        { n: '양파', q: 1, u: '개', id: 'onion' },
        { n: '당근', q: 0.5, u: '개', id: 'carrot' },
        { n: '고추장', q: 1, u: '큰술', id: 'gochujang' },
        { n: '케첩', q: 1, u: '큰술' }
      ],
      steps: [
        { t: '소시지에 칼집을 내고 한입 크기로 썰어요.' },
        { t: '양파와 당근을 먹기 좋게 썰어요.' },
        { t: '팬에 소시지를 볶아요.', timer: 180, label: '소시지 볶기' },
        { t: '채소를 넣고 볶다가 고추장·케첩을 넣어 버무려요.', timer: 180, label: '양념 버무리기' },
        { t: '깨를 뿌려 마무리해요.' }
      ],
      tip: '소시지에 칼집을 내면 양념이 속까지 배어요.'
    },
    {
      id: 'egg-soup', name: '계란국',
      desc: '부드러운 계란을 풀어 넣은 맑은 국',
      time: 10, level: '아주 쉬움',
      need: ['egg', 'pa', 'soy'],
      art: { kind: 'soup', main: '#E3C05A', accent: '#FBF3D8', bg: '#FFFAEC' },
      measures: [
        { n: '계란', q: 2, u: '개', id: 'egg' },
        { n: '대파', q: 1, u: '대', id: 'pa' },
        { n: '간장', q: 1, u: '큰술', id: 'soy' },
        { n: '물', q: 500, u: 'ml' },
        { n: '소금', q: null, u: '약간' }
      ],
      steps: [
        { t: '물을 끓이고 간장·소금으로 간해요.', timer: 240, label: '물 끓이기' },
        { t: '대파를 넣어요.' },
        { t: '계란을 풀어 천천히 둘러 넣어요.' },
        { t: '계란이 익으면 불을 꺼요.', timer: 60, label: '계란 익히기' }
      ],
      tip: '계란은 불을 줄이고 넣어야 부드러운 국물이 돼요.'
    },
    {
      id: 'curry', name: '카레',
      desc: '채소와 고기를 넣고 뭉근하게',
      time: 25, level: '보통',
      need: ['potato', 'carrot', 'onion', 'beef', 'curry'],
      art: { kind: 'soup', main: '#C08A3E', accent: '#F3DC9C', bg: '#FFF7E4' },
      measures: [
        { n: '카레가루', q: 3, u: '큰술', id: 'curry' },
        { n: '감자', q: 2, u: '개', id: 'potato' },
        { n: '당근', q: 1, u: '개', id: 'carrot' },
        { n: '양파', q: 1, u: '개', id: 'onion' },
        { n: '다짐육', q: 150, u: 'g', id: 'beef' },
        { n: '물', q: 500, u: 'ml' }
      ],
      steps: [
        { t: '채소를 한입 크기로 썰어요.' },
        { t: '팬에 다짐육을 볶다가 채소를 넣어요.', timer: 300, label: '고기·채소 볶기' },
        { t: '물을 부어 끓여요.', timer: 900, label: '채소 익히기' },
        { t: '불을 줄이고 카레가루를 풀어 더 끓여요.', timer: 180, label: '카레 풀기' },
        { t: '밥과 함께 담아요.' }
      ],
      tip: '카레가루는 불을 줄인 뒤 넣어야 뭉치지 않아요.'
    },
    {
      id: 'tuna-mayo-ball', name: '참치마요주먹밥',
      desc: '한입에 쏙, 도시락에도 좋아요',
      time: 10, level: '아주 쉬움',
      need: ['rice', 'tuna', 'mayo'],
      art: { kind: 'roll', main: '#E0A94F', accent: '#F8EBC8', bg: '#FFF8EA' },
      measures: [
        { n: '공깃밥', q: 2, u: '공기', id: 'rice' },
        { n: '참치캔', q: 1, u: '개', id: 'tuna' },
        { n: '마요네즈', q: 1, u: '큰술', id: 'mayo' },
        { n: '소금', q: null, u: '약간' },
        { n: '김', q: null, u: '약간' }
      ],
      steps: [
        { t: '참치 기름을 빼고 마요네즈와 섞어요.' },
        { t: '밥에 소금을 살짝 넣고 섞어요.' },
        { t: '밥을 한입 크기로 펴 참치마요를 넣고 뭉쳐요.' },
        { t: '김을 감싸 모양을 잡아요.' }
      ],
      tip: '손에 물을 묻히면 밥이 손에 붙지 않아요.'
    },
    {
      id: 'rabokki', name: '라볶이',
      desc: '라면과 떡을 한 번에',
      time: 15, level: '쉬움',
      need: ['ramen', 'tteok', 'gochujang', 'pa'],
      art: { kind: 'pan', main: '#D24C33', accent: '#F2CA66', bg: '#FFF1E6' },
      measures: [
        { n: '라면사리', q: 2, u: '개', id: 'ramen' },
        { n: '떡볶이떡', q: 150, u: 'g', id: 'tteok' },
        { n: '고추장', q: 1.5, u: '큰술', id: 'gochujang' },
        { n: '대파', q: 1, u: '대', id: 'pa' },
        { n: '물', q: 400, u: 'ml' }
      ],
      steps: [
        { t: '떡을 물에 불려요.', timer: 300, label: '떡 불리기' },
        { t: '물에 고추장을 풀어 끓여요.', timer: 180, label: '양념 끓이기' },
        { t: '떡을 먼저 넣고 끓여요.', timer: 300, label: '떡 익히기' },
        { t: '라면사리와 대파를 넣고 더 끓여요.', timer: 180, label: '라면 익히기' },
        { t: '국물이 걸쭉해지면 그릇에 담아요.' }
      ],
      tip: '라면은 마지막에 넣어야 퍼지지 않아요.'
    },
    {
      id: 'mushroom-stirfry', name: '느타리버섯볶음',
      desc: '버섯 향 가득한 담백한 반찬',
      time: 10, level: '쉬움',
      need: ['mushroom', 'onion', 'soy', 'sesameoil'],
      art: { kind: 'pan', main: '#8E7A4E', accent: '#E3D9B8', bg: '#FBF8ED' },
      measures: [
        { n: '느타리버섯', q: 1, u: '팩', id: 'mushroom' },
        { n: '양파', q: 0.5, u: '개', id: 'onion' },
        { n: '간장', q: 1, u: '큰술', id: 'soy' },
        { n: '참기름', q: 1, u: '작은술', id: 'sesameoil' },
        { n: '마늘', q: 1, u: '쪽', id: 'garlic' }
      ],
      steps: [
        { t: '버섯은 손으로 찢고 양파는 채 썰어요.' },
        { t: '팬에 기름을 두르고 마늘을 볶아요.', timer: 60, label: '마늘 볶기' },
        { t: '버섯과 양파를 넣고 센 불에 볶아요.', timer: 180, label: '버섯 볶기' },
        { t: '간장과 참기름을 넣고 더 볶아요.', timer: 60, label: '양념 넣기' }
      ],
      tip: '버섯은 물에 씻지 말고 마른 행주로 닦아야 향이 살아나요.'
    },
    {
      id: 'shrimp-fried-rice', name: '새우볶음밥',
      desc: '탱글한 새우와 고소한 계란',
      time: 15, level: '보통',
      need: ['rice', 'shrimp', 'egg', 'pa'],
      art: { kind: 'rice', main: '#E2834E', accent: '#F6C7A6', bg: '#FFF3EA' },
      measures: [
        { n: '공깃밥', q: 2, u: '공기', id: 'rice' },
        { n: '새우', q: 12, u: '마리', id: 'shrimp' },
        { n: '계란', q: 2, u: '개', id: 'egg' },
        { n: '대파', q: 1, u: '대', id: 'pa' },
        { n: '간장', q: 1, u: '작은술', id: 'soy' }
      ],
      steps: [
        { t: '새우는 등쪽 내장을 빼고 소금·후추로 밑간해요.' },
        { t: '팬에 계란을 풀어 반숙으로 볶아 꺼내요.', timer: 90, label: '계란 볶기' },
        { t: '새우와 대파를 볶아요.', timer: 150, label: '새우 볶기' },
        { t: '밥을 넣고 알갱이를 풀며 볶아요.', timer: 240, label: '밥 볶기' },
        { t: '계란과 간장을 넣고 마무리해요.' }
      ],
      tip: '밥은 찬밥을 쓰면 알갱이가 살아 있어요.'
    },
    {
      id: 'cheese-toast', name: '치즈계란토스트',
      desc: '바쁜 아침 10분 브런치',
      time: 10, level: '아주 쉬움',
      need: ['bread', 'egg', 'cheese'],
      art: { kind: 'toast', main: '#E8B43F', accent: '#F7CE63', bg: '#FFF8E6' },
      measures: [
        { n: '식빵', q: 4, u: '장', id: 'bread' },
        { n: '계란', q: 2, u: '개', id: 'egg' },
        { n: '슬라이스치즈', q: 2, u: '장', id: 'cheese' },
        { n: '버터', q: 1, u: '큰술' }
      ],
      steps: [
        { t: '식빵을 팬에 살짝 구워요.', timer: 120, label: '빵 굽기' },
        { t: '계란을 풀어 스크램블로 부쳐요.', timer: 150, label: '계란 익히기' },
        { t: '식빵에 치즈와 계란을 올려요.' },
        { t: '팬에 다시 올려 치즈가 살짝 녹으면 접어요.', timer: 90, label: '치즈 녹이기' }
      ],
      tip: '치즈를 빵 가장자리 안쪽에 올려야 넘치지 않아요.'
    },
    {
      id: 'dakbokkeumtang', name: '닭볶음탕',
      desc: '매콤한 양념에 뭉근하게 끓여요',
      time: 35, level: '보통',
      need: ['chicken', 'potato', 'carrot', 'gochujang'],
      art: { kind: 'soup', main: '#B94A32', accent: '#F0CE7E', bg: '#FFF1E8' },
      measures: [
        { n: '닭고기', q: 600, u: 'g', id: 'chicken' },
        { n: '감자', q: 2, u: '개', id: 'potato' },
        { n: '당근', q: 1, u: '개', id: 'carrot' },
        { n: '고추장', q: 2, u: '큰술', id: 'gochujang' },
        { n: '간장', q: 2, u: '큰술', id: 'soy' },
        { n: '물', q: 400, u: 'ml' }
      ],
      steps: [
        { t: '닭고기를 끓는 물에 데쳐 기름과 잡내를 빼요.', timer: 300, label: '닭 데치기' },
        { t: '감자·당근을 큼직하게 썰어요.' },
        { t: '고추장·간장·물을 섞어 양념을 만들어요.' },
        { t: '닭과 채소에 양념을 부어 끓여요.', timer: 1500, label: '뭉근하게 끓이기' },
        { t: '대파를 올려 마무리해요.' }
      ],
      tip: '닭고기를 데친 뒤 찬물에 헹구면 잡내가 훨씬 줄어요.'
    },
    {
      id: 'milk-egg-steam', name: '우유계란찜',
      desc: '우유를 넣어 더 부드러운 계란찜',
      time: 15, level: '쉬움',
      need: ['egg', 'milk', 'pa'],
      art: { kind: 'soup', main: '#F3D98A', accent: '#FFF6DA', bg: '#FFFBF0' },
      measures: [
        { n: '계란', q: 3, u: '개', id: 'egg' },
        { n: '우유', q: 100, u: 'ml', id: 'milk' },
        { n: '대파', q: null, u: '약간', id: 'pa' },
        { n: '소금', q: 0.5, u: '작은술' }
      ],
      steps: [
        { t: '계란을 풀어 우유와 소금을 넣고 섞어요.' },
        { t: '체에 한 번 걸러 그릇에 부어요.' },
        { t: '찜기에 넣고 뚜껑을 살짝 열어 두고 쪄요.', timer: 780, label: '계란찜 쪄기' },
        { t: '대파를 올려 마무리해요.' }
      ],
      tip: '체에 거르면 기포가 빠져 매끈하게 쪄져요.'
    }
  ];

  var TOTAL_ING = INGREDIENTS.length;

  /* ---------------------------------------------------------
     3. 상태
     --------------------------------------------------------- */
  var state = {
    sel: [],          // 냉장고에서 꺼낸 재료 id
    hot: [],          // 🔥 임박 재료 id
    unlocked: [],     // 이번 세션에서 연 레시피 id
    memo: [],         // 장보기 메모 [{name, checked}]
    memoOpen: false,
    filter: 'all',    // all | ready
    query: '',
    servings: CONFIG.baseServings,
    detailId: null
  };

  function hasSel(id) { return state.sel.indexOf(id) >= 0; }
  function isHot(id) { return state.hot.indexOf(id) >= 0; }
  function isUnlocked(id) { return state.unlocked.indexOf(id) >= 0; }
  function ingName(id) { return BY_ID[id] ? BY_ID[id].name : id; }

  /* ---------------------------------------------------------
     4. 유틸
     --------------------------------------------------------- */
  function $(id) { return document.getElementById(id); }
  function el(sel, root) { return (root || document).querySelector(sel); }
  function all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* 받침에 맞는 조사 (김치를 / 두부를) */
  function josa(word, withFinal, withoutFinal) {
    var code = word.charCodeAt(word.length - 1);
    var hasFinal = (code - 0xAC00) % 28 > 0;
    return word + (hasFinal ? withFinal : withoutFinal);
  }

  var toastTimer = null;
  function toast(msg) {
    var t = $('toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 2200);
  }

  /* 햅틱: 토스 브릿지 → navigator.vibrate 순서 */
  var Haptic = {
    trigger: function (type) {
      var pattern = type === 'success' ? [20, 30, 20] : 15;
      try {
        if (window.FridgeHaptic && typeof window.FridgeHaptic.trigger === 'function') {
          window.FridgeHaptic.trigger(type);
          return;
        }
        if (navigator.vibrate) navigator.vibrate(pattern);
      } catch (e) {}
    }
  };
  window.FridgeHaptic = window.FridgeHaptic || null;

  /* 아주 짧은 알림음 (Web Audio 합성) */
  var audioCtx = null;
  function beep() {
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      audioCtx = audioCtx || new AC();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      [0, 0.18, 0.36].forEach(function (offset, i) {
        var o = audioCtx.createOscillator();
        var g = audioCtx.createGain();
        o.type = 'sine';
        o.frequency.value = i === 2 ? 1046 : 784;
        g.gain.value = 0.0001;
        o.connect(g);
        g.connect(audioCtx.destination);
        var t0 = audioCtx.currentTime + offset;
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(0.16, t0 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.16);
        o.start(t0);
        o.stop(t0 + 0.2);
      });
    } catch (e) {}
  }

  /* ---------------------------------------------------------
     5. 재료 아이콘 (인라인 SVG · 외부 이미지 없음)
     --------------------------------------------------------- */
  function iconSvg(kind) {
    var s = '<svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">';
    switch (kind) {
      case 'pa':
        s += '<path d="M10 27c.2-6 1.4-11 3.8-14.6" stroke="#EAF5DE" stroke-width="4.6" stroke-linecap="round"/>'
          + '<path d="M16 27c.2-6.6.8-12 2.4-15.8" stroke="#9DD177" stroke-width="4.6" stroke-linecap="round"/>'
          + '<path d="M22 27c.4-5.6 1.2-10 2.8-13" stroke="#5FA94A" stroke-width="4.6" stroke-linecap="round"/>';
        break;
      case 'onion':
        s += '<path d="M16 9.4c-4.4 0-8.2 4.2-8.2 9.4 0 4.2 3 7.4 8.2 7.4s8.2-3.2 8.2-7.4c0-5.2-3.8-9.4-8.2-9.4Z" fill="#EFCF9C"/>'
          + '<path d="M16 9.8c-1.9 2.7-2.5 5.6-2.5 8.4s.6 5.4 2.5 7.8M16 9.8c1.9 2.7 2.5 5.6 2.5 8.4s-.6 5.4-2.5 7.8" stroke="#D3AE78" stroke-width="1.1" fill="none"/>'
          + '<path d="M16 9.6c-.7-2.4-.2-4 .8-5.4M16.4 9.8c.9-2 2.1-3 3.4-3.4" stroke="#7FB35F" stroke-width="1.7" stroke-linecap="round"/>';
        break;
      case 'garlic':
        s += '<path d="M16 9.6c-1.4 1.6-3.4 3-4.6 5.4-1.2 2.4-.8 5.4.8 7.2 2 2.2 5.6 2.2 7.6 0 1.6-1.8 2-4.8.8-7.2-1.2-2.4-3.2-3.8-4.6-5.4Z" fill="#FBFAF2" stroke="#E3DCC7" stroke-width="1.1"/>'
          + '<path d="M16 10.6v11.8M12.4 14.2c-.9 3-.6 5.8.6 7.6M19.6 14.2c.9 3 .6 5.8-.6 7.6" stroke="#E3DCC7" stroke-width="1" fill="none"/>'
          + '<path d="M16 9.6c0-2 .4-3.2 1-4M16 9.6c-.6-1.6-1.4-2.6-2.2-3.2" stroke="#B5C596" stroke-width="1.6" stroke-linecap="round"/>';
        break;
      case 'potato':
        s += '<ellipse cx="16" cy="17" rx="9.6" ry="7.4" fill="#E3C08C" transform="rotate(-14 16 17)"/>'
          + '<circle cx="12.5" cy="14.6" r="1" fill="#C9A472"/><circle cx="19" cy="19.4" r="1.1" fill="#C9A472"/>'
          + '<circle cx="17" cy="13.4" r=".8" fill="#C9A472"/>';
        break;
      case 'carrot':
        s += '<path d="M13.4 12.6 18.4 27.2 9.6 22.4Z" fill="#F2913D"/>'
          + '<path d="M13.6 12.4c-1-2.6-.4-4.6 1-6.2M14 12.6c1.2-2.4 2.8-3.6 4.8-4M13 12.8c-2.4-1-4-2.6-4.6-4.4" stroke="#69AE4B" stroke-width="1.9" stroke-linecap="round" fill="none"/>';
        break;
      case 'zucchini':
        s += '<rect x="6.6" y="10.6" width="19.4" height="10.4" rx="5.2" fill="#9ACB6B" transform="rotate(-16 16 16)"/>'
          + '<path d="M11.6 12.4c1.8 1.4 1.8 5.4.2 7.2M17 11.2c1.8 1.4 1.8 5.6.2 7.4" stroke="#7CB154" stroke-width="1.1" fill="none" transform="rotate(-16 16 16)"/>'
          + '<circle cx="24.6" cy="11.6" r="2.2" fill="#B7D98A"/>'
          + '<circle cx="24.6" cy="11.6" r=".9" fill="#8CBB60"/>';
        break;
      case 'cucumber':
        s += '<rect x="4.6" y="13.4" width="22.8" height="6.6" rx="3.3" fill="#3F7F42" transform="rotate(-18 16 16.7)"/>'
          + '<path d="M8.4 18.6c2.6-1.4 5-3 7.2-4.8" stroke="#2F6633" stroke-width="1.1" fill="none" stroke-linecap="round"/>'
          + '<g fill="#9CC884"><circle cx="10.6" cy="15.8" r=".85"/><circle cx="15" cy="14" r=".85"/><circle cx="19.4" cy="17.6" r=".85"/><circle cx="23" cy="15.4" r=".8"/></g>';
        break;
      case 'kimchi':
        s += '<path d="M6.4 17.4h19.2c0 6-4.3 9.8-9.6 9.8s-9.6-3.8-9.6-9.8Z" fill="#F6FAFD" stroke="#DCE7F0" stroke-width="1.1"/>'
          + '<path d="M9.6 17c.6-3.4 2.6-5.6 5-6.4 1.6-.6 2 1 3.4.6 1.8-.4 2 1.2 3.4 1.4 1 .2 1.6 2.2 1.8 4.4Z" fill="#E2603E"/>'
          + '<path d="M11.8 16.6c1-2 2.6-3.2 4.4-3.6M17 13.4c1.4 1 2.2 2.2 2.6 3.4" stroke="#B9472A" stroke-width="1.1" fill="none" stroke-linecap="round"/>';
        break;
      case 'bean':
        s += '<g stroke-linecap="round"><path d="M11 27c-.6-5 .2-8.6 1.8-11" stroke="#F7F3E6" stroke-width="2.4"/>'
          + '<path d="M16 27c-.2-5.6.4-9.4 2-12" stroke="#FBF8EE" stroke-width="2.4"/>'
          + '<path d="M21 27c.4-5 1-8.2 2.4-10.4" stroke="#F7F3E6" stroke-width="2.4"/></g>'
          + '<circle cx="13" cy="14.6" r="2.2" fill="#F3DE8A"/><circle cx="18" cy="13.4" r="2.2" fill="#F3DE8A"/>'
          + '<circle cx="23.4" cy="15.4" r="2.1" fill="#F3DE8A"/>';
        break;
      case 'mushroom':
        s += '<path d="M16 17.4v5.8" stroke="#EFE4D2" stroke-width="5" stroke-linecap="round"/>'
          + '<path d="M5.8 15.6C7 10.6 11 7.6 16 7.6s9 3 10.2 8Z" fill="#CBB292"/>'
          + '<path d="M9 14.2c1-2.4 3-3.8 5.4-4.2" stroke="#E5D5BB" stroke-width="1.3" fill="none" stroke-linecap="round"/>';
        break;
      case 'pork':
        s += '<rect x="6" y="12.6" width="20" height="11.6" rx="4" fill="#F3A8A4"/>'
          + '<path d="M8.4 17.4c2.8 1.4 5.2-1.2 8 0 2.4 1 4-1 6.2.2" stroke="#FCE4E1" stroke-width="1.6" fill="none" stroke-linecap="round"/>'
          + '<path d="M8.4 21.4c2.6 1.2 4.8-1 7.4 0 2.2.8 3.8-.8 5.8.2" stroke="#E58E8A" stroke-width="1.2" fill="none" stroke-linecap="round"/>';
        break;
      case 'samgyeop':
        s += '<rect x="6" y="12" width="20" height="12" rx="3.4" fill="#F4B0AA"/>'
          + '<rect x="6" y="12" width="20" height="4" fill="#FBDDD5"/>'
          + '<rect x="6" y="20" width="20" height="4" fill="#FBDDD5"/>'
          + '<path d="M6 16h20M6 20h20" stroke="#E89790" stroke-width=".9"/>';
        break;
      case 'chicken':
        s += '<path d="M12.6 9.6c4-2 8.6.2 9.6 4.4.9 3.6-1 6.6-4 8.4-2.2 1.3-4.8 1-6.2-.8-1.4-1.8-1.2-4.4.4-6 1.2-1.2 1.4-2.6.2-6Z" fill="#E8B79A"/>'
          + '<path d="M18.4 21.4 13.6 26" stroke="#F9EBDC" stroke-width="3.2" stroke-linecap="round"/>'
          + '<circle cx="12.8" cy="26.6" r="2" fill="#FBF3E6"/>'
          + '<path d="M13.4 12.6c1.8-1 3.8-.8 5.2.4" stroke="#D69C7C" stroke-width="1.2" stroke-linecap="round" fill="none"/>';
        break;
      case 'beef':
        s += '<g fill="#D96C63"><circle cx="12" cy="15.4" r="4.2"/><circle cx="19.4" cy="19.4" r="4.6"/><circle cx="13.6" cy="22.8" r="3.4"/></g>'
          + '<path d="M10.8 13.4c1 .6 1.6 1.4 1.8 2.4M18 17.6c.8.8 1.2 1.8 1.2 2.8" stroke="#F0A79E" stroke-width="1.4" stroke-linecap="round"/>';
        break;
      case 'spam':
        s += '<rect x="6.6" y="11" width="18.8" height="15" rx="3" fill="#F0A0A2"/>'
          + '<rect x="6.6" y="17.2" width="18.8" height="4.4" fill="#4C7FBF"/>'
          + '<rect x="9.6" y="8.6" width="12.8" height="3.2" rx="1.6" fill="#E3EEF6"/>'
          + '<path d="M9.6 13.4h12.8" stroke="#F8CFD0" stroke-width="1.2"/>';
        break;
      case 'sausage':
        s += '<rect x="5.6" y="11.4" width="10.4" height="7.4" rx="3.7" fill="#E38A6B" transform="rotate(-10 10.8 15.1)"/>'
          + '<rect x="15.6" y="15.4" width="10.6" height="7.4" rx="3.7" fill="#D9785A" transform="rotate(-10 20.9 19.1)"/>'
          + '<path d="M8 13.4c1.4 1 2.6 1 4 0" stroke="#F5C6B2" stroke-width="1.2" fill="none" stroke-linecap="round"/>';
        break;
      case 'tuna':
        s += '<rect x="8" y="11" width="16" height="14" rx="2.4" fill="#8FB4D6"/>'
          + '<ellipse cx="16" cy="11" rx="8" ry="2.6" fill="#DCE7F1"/>'
          + '<rect x="8" y="15" width="16" height="5.4" fill="#5E86B8"/>'
          + '<path d="M11 21.4h10" stroke="#DCE7F1" stroke-width="1.2"/>';
        break;
      case 'eomuk':
        s += '<path d="M6.4 27.2 23.6 6.4" stroke="#C6B191" stroke-width="1.8" stroke-linecap="round"/>'
          + '<rect x="9.4" y="11.4" width="12" height="14.4" rx="2.6" fill="#EFCB88" transform="rotate(-8 15.4 18.6)"/>'
          + '<path d="M12 13.6c3.2-1 5.8 3 3.4 7.2-1 1.8-.4 3.4 1.4 4.4" stroke="#D8AE68" stroke-width="1.3" fill="none" stroke-linecap="round"/>';
        break;
      case 'shrimp':
        s += '<path d="M23.2 9.4c-6.8-.8-11.2 4.2-10.8 9.6.3 4 3.4 6.6 7 6.2 2.2-.2 3.8-1.6 4.4-3.4" stroke="#F08A6B" stroke-width="4.8" stroke-linecap="round" fill="none"/>'
          + '<path d="M14.6 10.6c2.2 1.4 3.6 3.4 4.2 5.8M11.4 13.4c2 .8 3.8 2.4 4.8 4.4" stroke="#FBC7B4" stroke-width="1.3" stroke-linecap="round"/>'
          + '<circle cx="23.8" cy="21.4" r="1.6" fill="#F08A6B"/>';
        break;
      case 'egg':
        s += '<ellipse cx="16" cy="17" rx="8.4" ry="10" fill="#FFFDF7" stroke="#EFE9DC" stroke-width="1"/>'
          + '<circle cx="16" cy="17.8" r="4.4" fill="#F7C64B"/>'
          + '<circle cx="14.6" cy="16.4" r="1.4" fill="#FFE8A8" opacity=".9"/>';
        break;
      case 'tofu':
        s += '<rect x="7" y="11" width="14" height="12" rx="2" fill="#FFFEF9" stroke="#E7EBE3" stroke-width="1"/>'
          + '<rect x="11" y="15" width="14" height="12" rx="2" fill="#F8F6EE" stroke="#E7EBE3" stroke-width="1"/>'
          + '<path d="M7 14.4h14M11 18.4h14" stroke="#EDF0E8" stroke-width="1"/>';
        break;
      case 'sundubu':
        s += '<path d="M9 8.6h11l4 4v11.2a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V10.6a2 2 0 0 1 2-2Z" fill="#FCFBF6" stroke="#E7E3D6" stroke-width="1"/>'
          + '<rect x="10.4" y="13.6" width="9" height="5.4" rx="1.2" fill="#E2603E"/>'
          + '<path d="M11.8 16.3h6.2" stroke="#FBD7C9" stroke-width="1.2"/>';
        break;
      case 'milk':
        s += '<path d="M10 12.6h11l2.6 3v9.6a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2V12.6Z" fill="#FFFFFF" stroke="#DDE6EE" stroke-width="1"/>'
          + '<path d="M8 12.6 12.4 6h6.2l3.4 6.6" fill="#EAF3FB" stroke="#DDE6EE" stroke-width="1"/>'
          + '<rect x="8" y="17.2" width="15.6" height="3.6" fill="#5C8FD6"/>';
        break;
      case 'cheese':
        s += '<path d="M6.4 20.6 17.6 9.8c.8-.8 2.1-.6 2.5.5l3.2 8.1c.3.8-.1 1.6-.9 1.8l-14.6 4c-1.2.3-2.2-1-1.4-2.6Z" fill="#F7CE63"/>'
          + '<circle cx="14" cy="17.4" r="1.5" fill="#E8B740"/><circle cx="19.2" cy="15.6" r="1.2" fill="#E8B740"/>'
          + '<circle cx="18.4" cy="20" r="1" fill="#E8B740"/>';
        break;
      case 'rice':
        s += '<path d="M6.4 15.4h19.2c0 5.8-4.3 9.6-9.6 9.6s-9.6-3.8-9.6-9.6Z" fill="#FBF9F3" stroke="#E6E4DA" stroke-width="1.1"/>'
          + '<path d="M8.8 15.2c.4-3 3.2-5 7.2-5s6.8 2 7.2 5Z" fill="#FFFFFF" stroke="#EDEAE0" stroke-width="1"/>';
        break;
      case 'ramen':
        s += '<path d="M5.6 16.6c2.6-2.8 5 2.8 7.6 0s5 2.8 7.6 0 5 2.8 6.6 0" stroke="#F0C24E" stroke-width="3" fill="none" stroke-linecap="round"/>'
          + '<path d="M5.6 21.8c2.6-2.8 5 2.8 7.6 0s5 2.8 7.6 0 5 2.8 6.6 0" stroke="#E7B23E" stroke-width="3" fill="none" stroke-linecap="round"/>';
        break;
      case 'somyeon':
        s += '<path d="M8 9.6c2 6.4 2 12.4 0 18.8M12.4 9.6c2 6.4 2 12.4 0 18.8M16.8 9.6c2 6.4 2 12.4 0 18.8M21.2 9.6c2 6.4 2 12.4 0 18.8" stroke="#EADBB8" stroke-width="2.1" stroke-linecap="round"/>'
          + '<path d="M6.6 14.4h19" stroke="#F0E5CB" stroke-width="2.2" stroke-linecap="round"/>';
        break;
      case 'tteok':
        s += '<g fill="#FDFBF4" stroke="#E9E3D3" stroke-width="1"><rect x="6.6" y="11.4" width="5.8" height="14" rx="2.9"/>'
          + '<rect x="13.2" y="9" width="5.8" height="16" rx="2.9"/>'
          + '<rect x="19.8" y="12.2" width="5.8" height="13" rx="2.9"/></g>';
        break;
      case 'bread':
        s += '<path d="M7 13.4c0-3 2.4-5.4 5.4-5.4h7.2c3 0 5.4 2.4 5.4 5.4v9.4c0 1.2-1 2.2-2.2 2.2H9.2c-1.2 0-2.2-1-2.2-2.2Z" fill="#EFCB96"/>'
          + '<path d="M9.6 13.6c0-2 1.6-3.6 3.6-3.6h5.6c2 0 3.6 1.6 3.6 3.6v8.4H9.6Z" fill="#FBF0DC"/>'
          + '<path d="M12.4 12.4v8.4M16 12v8.8M19.6 12.4v8.4" stroke="#F2E0C4" stroke-width="1"/>';
        break;
      case 'flour':
        s += '<path d="M9 10.6h14v13.2a2 2 0 0 1-2 2H11a2 2 0 0 1-2-2Z" fill="#F2EAD8" stroke="#E0D5BD" stroke-width="1"/>'
          + '<path d="M9 10.6 12 6h8l3 4.6Z" fill="#E7DCC5" stroke="#E0D5BD" stroke-width="1"/>'
          + '<rect x="12" y="15.4" width="8" height="4.2" rx="1" fill="#DCCFB4"/>';
        break;
      case 'gochujang':
        s += '<path d="M8 13h16v9.8a3 3 0 0 1-3 3H11a3 3 0 0 1-3-3Z" fill="#D9533F"/>'
          + '<ellipse cx="16" cy="13" rx="8" ry="2.9" fill="#F2A08F"/>'
          + '<rect x="8" y="16.6" width="16" height="3.4" fill="#C7442F"/>';
        break;
      case 'doenjang':
        s += '<path d="M8 13h16v9.8a3 3 0 0 1-3 3H11a3 3 0 0 1-3-3Z" fill="#8A6236"/>'
          + '<ellipse cx="16" cy="13" rx="8" ry="2.9" fill="#B99164"/>'
          + '<rect x="8" y="16.6" width="16" height="3.4" fill="#75502A"/>';
        break;
      case 'soy':
        s += '<path d="M13 5.8h6v3.6l2 2.8v12.2a2 2 0 0 1-2 2h-6a2 2 0 0 1-2-2V12.2l2-2.8Z" fill="#5C4526"/>'
          + '<rect x="12.6" y="15.2" width="6.8" height="4.6" rx="1" fill="#EADFC2"/>'
          + '<rect x="14.6" y="4" width="2.8" height="2" rx=".8" fill="#3F2F19"/>';
        break;
      case 'mayo':
        s += '<path d="M12 9.8h8v3.4l2 2.6v10.4a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2V15.8l2-2.6Z" fill="#FBFBF7" stroke="#E1E5E9" stroke-width="1"/>'
          + '<rect x="12" y="17.4" width="8" height="3.6" fill="#F0E06A"/>'
          + '<path d="M14.6 6.2h2.8v3.6h-2.8z" fill="#DDE3E8"/>';
        break;
      case 'sesameoil':
        s += '<path d="M12.6 11h6.8v3l1.6 2.4v9.8a2 2 0 0 1-2 2h-6a2 2 0 0 1-2-2v-9.8L12.6 14Z" fill="#B9772F"/>'
          + '<rect x="12.4" y="17.8" width="7.2" height="4" rx="1" fill="#F5E3C4"/>'
          + '<rect x="14" y="6.4" width="4" height="4.8" rx="1" fill="#8E5A22"/>';
        break;
      case 'curry':
        s += '<rect x="8" y="8.8" width="16" height="15.4" rx="2.4" fill="#E9A23B"/>'
          + '<rect x="8" y="8.8" width="16" height="4.6" fill="#D0871F"/>'
          + '<circle cx="16" cy="18.8" r="4" fill="#F8D9A0"/>'
          + '<path d="M13.4 18.8c.9 1.4 1.8 1.4 2.6 0" stroke="#C9761A" stroke-width="1.2" fill="none"/>';
        break;
      default:
        s += '<circle cx="16" cy="16" r="9" fill="#DCE7F0"/>';
    }
    return s + '</svg>';
  }

  /* ---------------------------------------------------------
     6. 요리 일러스트 (인라인 SVG)
     --------------------------------------------------------- */
  function dishArt(a) {
    var s = '<svg class="dish" viewBox="0 0 64 64" role="img" aria-hidden="true">';
    s += '<rect width="64" height="64" rx="15" fill="' + a.bg + '"/>';
    s += '<circle cx="32" cy="33" r="21" fill="#FFFFFF" opacity=".42"/>';

    var steam = '<path d="M25 19c-1.6-2.4 1.6-3.4 0-5.8M32 17.6c-1.6-2.4 1.6-3.4 0-5.8M39 19c-1.6-2.4 1.6-3.4 0-5.8" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" fill="none" opacity=".9"/>';

    if (a.kind === 'soup') {
      s += steam;
      s += '<path d="M9 28h46c0 12-10.3 20-23 20S9 40 9 28Z" fill="#FFFDF8" stroke="#E7E1D6" stroke-width="1.2"/>';
      s += '<ellipse cx="32" cy="29.3" rx="20" ry="5.8" fill="' + a.main + '"/>';
      s += '<rect x="23" y="26.6" width="5.2" height="4.4" rx="1" fill="#FFFDF0"/>';
      s += '<rect x="35" y="27.4" width="4.4" height="3.6" rx="1" fill="#FFFDF0" opacity=".9"/>';
      s += '<circle cx="30" cy="30.4" r="1.3" fill="' + a.accent + '"/>';
      s += '<circle cx="39" cy="30" r="1.5" fill="#7FBF6A"/>';
      s += '<ellipse cx="32" cy="48.6" rx="12" ry="2.4" fill="#2A3A46" opacity=".06"/>';
    } else if (a.kind === 'pan') {
      s += steam;
      s += '<rect x="45" y="38" width="13" height="3.6" rx="1.8" fill="#3C4A57" transform="rotate(14 51 40)"/>';
      s += '<ellipse cx="31" cy="34" rx="19.5" ry="13.4" fill="#485764"/>';
      s += '<ellipse cx="31" cy="32.6" rx="15.6" ry="10.2" fill="#33414D"/>';
      s += '<ellipse cx="31" cy="31.6" rx="13.4" ry="8.2" fill="' + a.main + '"/>';
      s += '<circle cx="26" cy="29" r="2" fill="' + a.accent + '"/>';
      s += '<circle cx="35" cy="33.4" r="1.8" fill="#FFFFFF" opacity=".8"/>';
      s += '<circle cx="33" cy="27.6" r="1.5" fill="#8FC878"/>';
      s += '<circle cx="22" cy="34" r="1.3" fill="#FFFFFF" opacity=".6"/>';
    } else if (a.kind === 'plate') {
      s += '<ellipse cx="32" cy="37.6" rx="24" ry="13.2" fill="#FFFDF8" stroke="#EAE4D8" stroke-width="1.2"/>';
      s += '<ellipse cx="32" cy="35.6" rx="21.4" ry="11" fill="#FBF7EF"/>';
      s += '<ellipse cx="32" cy="33.4" rx="15" ry="8.6" fill="' + a.main + '"/>';
      s += '<rect x="23.4" y="29.6" width="6.2" height="5" rx="1.2" fill="#FFFDF0"/>';
      s += '<rect x="33.6" y="32.4" width="5.6" height="4.6" rx="1.2" fill="#FFFDF0" opacity=".94"/>';
      s += '<path d="M27 36.6c2.4-1 4.6-.6 6.4 1" stroke="' + a.accent + '" stroke-width="1.6" fill="none" stroke-linecap="round"/>';
      s += '<circle cx="38.4" cy="29.6" r="1.6" fill="#8FC878"/>';
      s += '<circle cx="24" cy="36.2" r="1.3" fill="' + a.accent + '"/>';
    } else if (a.kind === 'rice') {
      s += '<path d="M11 29.4h42c0 11.4-9.4 19-21 19s-21-7.6-21-19Z" fill="#FFFDF8" stroke="#E7E1D6" stroke-width="1.2"/>';
      s += '<path d="M17 29.4c.8-7 6.6-11.4 15-11.4s14.2 4.4 15 11.4Z" fill="#FFFFFF" stroke="#EDE7DC" stroke-width="1.1"/>';
      s += '<circle cx="26" cy="24" r="2.4" fill="' + a.main + '"/>';
      s += '<circle cx="36.4" cy="25.4" r="2" fill="' + a.accent + '"/>';
      s += '<circle cx="31.4" cy="20.6" r="1.8" fill="#8FC878"/>';
      s += '<ellipse cx="32" cy="50" rx="12" ry="2.2" fill="#2A3A46" opacity=".06"/>';
    } else if (a.kind === 'noodle') {
      s += steam;
      s += '<path d="M11 28h42c0 11.6-9.4 19.4-21 19.4S11 39.6 11 28Z" fill="#FFFDF8" stroke="#E7E1D6" stroke-width="1.2"/>';
      s += '<path d="M14 27c3.4-3 6.6 3 10 0s6.6 3 10 0 6.6 3 9 0" stroke="#F0C766" stroke-width="2.8" fill="none" stroke-linecap="round"/>';
      s += '<path d="M15.4 31.4c3.2-2.8 6.2 2.8 9.4 0s6.2 2.8 9.4 0 6.2 2.8 8.8 0" stroke="#E7B94F" stroke-width="2.6" fill="none" stroke-linecap="round"/>';
      s += '<ellipse cx="32" cy="25.4" rx="5" ry="3.4" fill="#FFF9E6"/>';
      s += '<circle cx="32" cy="25.4" r="2" fill="#F7C64B"/>';
      s += '<circle cx="23" cy="27.4" r="1.5" fill="#8FC878"/>';
    } else if (a.kind === 'roll') {
      s += '<path d="M15 44 26 21c.6-1.2 2.2-1.2 2.8 0l11 23Z" fill="#FFFDF8" stroke="#E9E3D8" stroke-width="1.2" stroke-linejoin="round"/>';
      s += '<rect x="23.4" y="34" width="7.2" height="10" rx="1.4" fill="#2C4738"/>';
      s += '<circle cx="42" cy="41" r="9.6" fill="#FFFDF8" stroke="#E9E3D8" stroke-width="1.2"/>';
      s += '<rect x="37.4" y="38.6" width="9.2" height="5.4" rx="1.2" fill="#2C4738" opacity=".9"/>';
      s += '<circle cx="28" cy="26" r="1.6" fill="' + a.main + '"/>';
    } else if (a.kind === 'toast') {
      s += '<rect x="11" y="17.4" width="31" height="31" rx="6" fill="#EFCB96"/>';
      s += '<rect x="14.4" y="20.8" width="24.2" height="23" rx="4.4" fill="' + a.main + '"/>';
      s += '<path d="M16.6 30.4h20" stroke="' + a.accent + '" stroke-width="3.6" stroke-linecap="round"/>';
      s += '<circle cx="46.4" cy="26" r="6.2" fill="' + a.accent + '" opacity=".55"/>';
      s += '<circle cx="46.4" cy="40" r="4.2" fill="#FFFDF0" opacity=".7"/>';
    } else if (a.kind === 'omelette') {
      s += '<rect x="9" y="23" width="42" height="19" rx="9.5" fill="#F8D467"/>';
      s += '<path d="M13 32.4c6-4.4 11 4.4 17 0s11 4.4 17 0" stroke="#EFC044" stroke-width="2" fill="none" stroke-linecap="round"/>';
      s += '<circle cx="23" cy="28" r="1.6" fill="#8FC878"/>';
      s += '<circle cx="37" cy="36" r="1.4" fill="' + a.accent + '"/>';
      s += '<rect x="9" cx="9" y="23" width="4" height="19" rx="2" fill="#EFC044" opacity=".5"/>';
    }
    return s + '</svg>';
  }

  /* 하단 시트용 냉장고 빈 상태 그림 */
  function emptyArt() {
    return '<svg viewBox="0 0 120 120" width="84" height="84" fill="none" aria-hidden="true">'
      + '<rect x="24" y="12" width="72" height="96" rx="20" fill="#EFF7FD" stroke="#CFE1EE" stroke-width="2"/>'
      + '<path d="M24 52h72" stroke="#DCE9F4" stroke-width="2"/>'
      + '<rect x="84" y="26" width="4" height="18" rx="2" fill="#C4D8E7"/>'
      + '<rect x="84" y="62" width="4" height="18" rx="2" fill="#C4D8E7"/>'
      + '<path d="M38 44c4-6 11-8.6 18-7.4M39 78c6-4.4 12-5.2 18-3.8" stroke="#DDEBF6" stroke-width="5" stroke-linecap="round"/>'
      + '<circle cx="52" cy="88" r="9" fill="#E4F7EE"/>'
      + '<path d="M48 88.4c1.2 1.4 2.4 2 3.8 2s2.8-1.2 3.4-2.6" stroke="#2CAC7E" stroke-width="2" stroke-linecap="round"/>'
      + '</svg>';
  }
  function cartIcon() {
    return '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
      + '<path d="M3.4 4.4h2.2l2.4 10.2a1.8 1.8 0 0 0 1.8 1.4h7.4a1.8 1.8 0 0 0 1.8-1.4l1.6-6.6H6.2"/>'
      + '<circle cx="9.6" cy="19.2" r="1.4"/><circle cx="17.2" cy="19.2" r="1.4"/></svg>';
  }
  function flameIcon(size) {
    return '<svg viewBox="0 0 24 24" width="' + (size || 11) + '" height="' + (size || 11) + '" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
      + '<path d="M12 3.4c2.6 3.2 1 5.4-.4 6.8-1.4 1.4-1.4 3 .4 4 1.6-1 2-2.6 2-2.6 1.6 1.4 2.6 3.2 2.6 5 0 3-2.6 5.4-6.6 5.4S6 19.6 6 16.6c0-4.6 4.2-6.2 4.6-9.4.2-1.6.6-2.8 1.4-3.8Z"/></svg>';
  }

  /* ---------------------------------------------------------
     7. 냉장고 그리기
     --------------------------------------------------------- */
  function itemHtml(ing) {
    var on = hasSel(ing.id);
    var hot = isHot(ing.id);
    return '<button type="button" class="item' + (on ? ' is-on' : '') + (hot ? ' is-hot' : '') + '"'
      + ' id="ing-' + ing.id + '" data-ing="' + ing.id + '"'
      + ' aria-pressed="' + (on ? 'true' : 'false') + '"'
      + ' aria-label="' + esc(ing.name) + (on ? (hot ? ', 임박 재료' : ', 꺼냄') : '') + '">'
      + '<span class="item__icon">' + iconSvg(ing.icon) + '</span>'
      + '<span class="item__name">' + ing.name + '</span>'
      + '<span class="item__check" aria-hidden="true">'
      + (hot
        ? flameIcon(9)
        : '<svg viewBox="0 0 24 24" width="9" height="9" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m4.5 12.5 5 5 9.5-11"/></svg>')
      + '</span>'
      + '</button>';
  }

  function shelfItems(sh, q) {
    return INGREDIENTS.filter(function (ing) {
      if (ing.shelf !== sh.id) return false;
      if (!q) return true;
      return ing.name.toLowerCase().indexOf(q) >= 0;
    });
  }

  function renderFridge() {
    var q = state.query.trim().toLowerCase();
    var html = '';
    var any = false;
    var room = '';

    SHELVES.forEach(function (sh) {
      var items = shelfItems(sh, q);
      if (!items.length) return;
      any = true;

      var picked = items.filter(function (ing) { return hasSel(ing.id); }).length;
      var pickedTag = picked ? '<span class="shelf__picked">' + picked + '개 꺼냄</span>' : '';

      /* 냉장고 문쪽 포켓은 라벨 판 대신 포켓 머리글로 구분해요 */
      if (sh.door) {
        html += '<div class="pocket" data-shelf="' + sh.id + '">'
          + '<div class="pocket__head">'
          + '<i class="shelf__bar" style="background:' + sh.tone + '" aria-hidden="true"></i>'
          + '<span class="pocket__title">' + sh.name + '</span>'
          + '<span class="pocket__sub">' + sh.sub + '</span>'
          + pickedTag
          + '</div>'
          + '<div class="shelf__items shelf__items--door">'
          + items.map(itemHtml).join('')
          + '</div></div>';
        return;
      }

      room += '<div class="shelf" data-shelf="' + sh.id + '">'
        + '<div class="shelf__items">' + items.map(itemHtml).join('') + '</div>'
        + '<div class="shelf__plate" style="--tone:' + sh.tone + '">'
        + '<i class="shelf__bar" aria-hidden="true"></i>'
        + '<span class="shelf__name">' + sh.name + '</span>'
        + '<span class="shelf__sub">' + sh.sub + '</span>'
        + pickedTag
        + '</div></div>';
    });

    if (room) html = '<div class="room">' + room + '</div>' + html;
    $('fridgeShelves').innerHTML = html;
    $('fridgeEmpty').hidden = any;
  }

  /* ---------------------------------------------------------
     8. 재료 선택 / 임박 표시
     --------------------------------------------------------- */
  function toggleIngredient(id) {
    if (!hasSel(id)) {
      state.sel.push(id);
      Haptic.trigger('tap');
    } else if (!isHot(id)) {
      state.hot.push(id);
      Haptic.trigger('success');
      toast(josa(ingName(id), '을', '를') + ' 🔥 임박으로 표시했어요');
    } else {
      state.sel = state.sel.filter(function (x) { return x !== id; });
      state.hot = state.hot.filter(function (x) { return x !== id; });
      Haptic.trigger('tap');
    }
    renderFridge();
    refresh();
  }

  /* ---------------------------------------------------------
     원터치 빠른 조합 (첫 화면)
     --------------------------------------------------------- */
  function renderCombos() {
    var row = $('comboRow');
    if (!row) return;
    row.innerHTML = CONFIG.combos.map(function (c) {
      var label = c.label || c.items.map(ingName).join('+');
      var on = c.items.every(hasSel);
      return '<button type="button" class="combo' + (on ? ' is-on' : '') + '"'
        + ' data-combo="' + c.id + '" aria-pressed="' + (on ? 'true' : 'false') + '"'
        + ' aria-label="' + esc(label) + ' 조합을 냉장고에서 바로 담기">'
        + '<span class="combo__emoji" aria-hidden="true">' + c.emoji + '</span>'
        + '<span class="combo__label">' + label + '</span>'
        + (on ? '<span class="combo__state" aria-hidden="true">✓</span>' : '')
        + '</button>';
    }).join('');
  }

  function applyCombo(id) {
    var c = CONFIG.combos.filter(function (x) { return x.id === id; })[0];
    if (!c) return;
    state.sel = c.items.filter(function (i) { return !!BY_ID[i]; });
    state.hot = [];
    renderFridge();
    refresh();
    Haptic.trigger('success');

    var ready = 0;
    RECIPES.forEach(function (r) { if (r.need.every(hasSel)) ready++; });
    toast(c.emoji + ' ' + (c.label || c.items.map(ingName).join('+')) + ' 담았어요'
      + (ready ? ' · 바로 되는 요리 ' + ready + '개' : ''));

    setTimeout(function () {
      var res = $('results');
      if (res) res.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 90);
  }

  function refresh() {
    var n = state.sel.length;
    $('selCount').innerHTML = '선택한 재료 <b>' + n + '</b>개' + (state.hot.length ? ' · 🔥 <b class="hot-num">' + state.hot.length + '</b>' : '');
    $('clearBtn').disabled = n === 0;
    $('quickBtn').hidden = n > 0;
    $('dockCount').textContent = n;

    var readyCount = 0;
    RECIPES.forEach(function (r) {
      if (r.need.every(function (id) { return hasSel(id); })) readyCount++;
    });

    var sub;
    if (n === 0) sub = '냉장고에서 재료를 골라 주세요';
    else if (readyCount === 0) sub = '재료를 2~3개 더 고르면 후보가 늘어나요';
    else sub = '지금 바로 ' + readyCount + '개 요리를 만들 수 있어요';
    $('dockSub').textContent = n === 0 ? '재료를 2~3개 골라 보세요' : sub;

    renderCombos();
    renderResults();
    renderMemoFab();
  }

  /* ---------------------------------------------------------
     9. 매칭 계산
     --------------------------------------------------------- */
  function buildMatches() {
    return RECIPES.map(function (r) {
      var owned = r.need.filter(hasSel);
      var miss = r.need.filter(function (id) { return !hasSel(id); });
      var hotUse = owned.filter(isHot);
      return {
        r: r,
        owned: owned,
        miss: miss,
        hot: hotUse,
        pct: Math.round(owned.length / r.need.length * 100)
      };
    });
  }

  function sortMatches(a, b) {
    if (a.miss.length !== b.miss.length) return a.miss.length - b.miss.length;
    if (b.pct !== a.pct) return b.pct - a.pct;
    return a.r.time - b.r.time;
  }

  /* ---------------------------------------------------------
     10. 결과 그리기
     --------------------------------------------------------- */
  function chipHtml(id) {
    var name = ingName(id);
    var hot = isHot(id);
    return '<span class="chip' + (hot ? ' chip--hot' : '') + '">' + (hot ? '🔥 ' : '') + name + '</span>';
  }

  function missChipHtml(id) {
    var name = ingName(id);
    var inMemo = state.memo.some(function (m) { return m.name === name; });
    return '<button type="button" class="chip chip--miss' + (inMemo ? ' is-added' : '') + '"'
      + ' data-chip="' + id + '" aria-label="' + esc(name) + ' 장보기 메모에 ' + (inMemo ? '담김' : '담기') + '">'
      + (inMemo ? '✓ ' : '+ ') + name + '</button>';
  }

  function checkIcon(size) {
    var s = size || 9;
    return '<svg class="ic-check" viewBox="0 0 24 24" width="' + s + '" height="' + s + '" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m4.5 12.5 5 5 9.5-11"/></svg>';
  }
  function playIconSm() {
    return '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8.4"/><path d="M10.4 8.8v6.4L16 12Z" fill="currentColor" stroke="none"/></svg>';
  }

  function cardHtml(m) {
    var r = m.r;
    var badge;
    if (m.miss.length === 0) {
      badge = '<span class="badge badge--now">' + checkIcon(9) + '바로 가능</span>';
    } else if (m.miss.length === 1) {
      badge = '<span class="badge badge--near">+1개만 더</span>';
    } else {
      badge = '<span class="badge badge--far">+' + m.miss.length + '개 필요</span>';
    }
    var unlocked = isUnlocked(r.id);

    var chips = '';
    r.need.forEach(function (id) {
      if (hasSel(id)) chips += chipHtml(id);
      else chips += missChipHtml(id);
    });

    return '<article class="card' + (m.miss.length === 0 ? ' card--ready' : '') + (m.miss.length === 1 ? ' card--miss1' : '') + (m.hot.length ? ' card--hot' : '') + '" data-card="' + r.id + '">'
      + '<div class="card__top">'
      + '<div class="card__art">' + dishArt(r.art) + '</div>'
      + '<div class="card__body">'
      + '<div class="card__row"><h3 class="card__name">' + r.name + '</h3>' + badge + '</div>'
      + '<p class="card__desc">' + r.desc + '</p>'
      + '<div class="card__meta"><span>재료 ' + m.owned.length + '/' + r.need.length + '</span><i></i><span>' + r.time + '분</span><i></i><span>' + r.level + '</span></div>'
      + '</div></div>'
      + '<div class="chips">' + chips + '</div>'
      + '<div class="card__foot">'
      + '<span class="meter' + (m.pct < 70 ? ' meter--low' : '') + '"><span style="width:' + m.pct + '%"></span></span>'
      + '<button type="button" class="card__more' + (unlocked ? ' is-open' : '') + '" data-open="' + r.id + '"'
      + ' aria-label="' + esc(r.name) + (unlocked ? ' 레시피 다시 보기' : ' 레시피 보기, 광고 시청 후 열려요') + '">'
      + (unlocked
        ? checkIcon(12) + '<span>다시 보기</span>'
        : playIconSm() + '<span>레시피 보기</span><span class="card__more-ad">광고</span>')
      + '</button>'
      + '</div></article>';
  }

  function sectionHead(icon, title, count, cls) {
    return '<div class="section-head' + (cls ? ' ' + cls : '') + '"><span class="section-head__icon">' + icon + '</span>'
      + '<span class="section-head__title">' + title + '</span>'
      + '<span class="section-head__count">' + count + '</span></div>';
  }

  function renderResults() {
    var listNode = $('recipeList');
    var built = buildMatches();

    if (state.sel.length === 0) {
      $('resultsSub').textContent = '냉장고에서 재료를 골라 주세요';
      $('filterAllCount').textContent = 0;
      $('filterReadyCount').textContent = 0;
      listNode.innerHTML = '<div class="empty">'
        + '<div class="empty__art">' + emptyArt() + '</div>'
        + '<p class="empty__title">냉장고 문이 활짝 열렸어요</p>'
        + '<p class="empty__desc">재료를 한두 개만 골라도<br />바로 만들 수 있는 요리를 찾아드려요.</p>'
        + '<button type="button" class="empty__btn" data-quick="1">자주 쓰는 재료 5개 담기</button>'
        + '</div>';
      return;
    }

    /* 필터: 부족 재료 2개까지. 결과가 너무 적으면 3개까지 허용 */
    var limit = CONFIG.maxMissing;
    var base = built.filter(function (m) { return m.owned.length > 0 && m.miss.length <= limit; });
    if (base.length < 3) {
      base = built.filter(function (m) { return m.owned.length > 0 && m.miss.length <= 3; });
      limit = 3;
    }
    $('filterAllCount').textContent = base.length;
    $('filterReadyCount').textContent = base.filter(function (m) { return m.miss.length === 0; }).length;

    if (state.filter === 'ready') base = base.filter(function (m) { return m.miss.length === 0; });

    base.sort(sortMatches);

    var hotList = base.filter(function (m) { return m.hot.length > 0; })
      .sort(function (a, b) {
        if (b.hot.length !== a.hot.length) return b.hot.length - a.hot.length;
        return sortMatches(a, b);
      });
    var rest = base.filter(function (m) { return m.hot.length === 0; });

    var hotCount = hotList.length;
    var readyCount = base.filter(function (m) { return m.miss.length === 0; }).length;

    var nearCount = base.filter(function (m) { return m.miss.length === 1; }).length;
    var sub;
    if (readyCount) sub = '바로 가능 <b>' + readyCount + '</b>개';
    else if (nearCount) sub = '1개만 더 있으면 바로 되는 요리 <b>' + nearCount + '</b>개';
    else sub = '재료를 조금 더 고르면 후보가 늘어나요';
    if (hotCount) sub += ' · 🔥 임박 활용 <b>' + hotCount + '</b>개';
    $('resultsSub').innerHTML = sub;

    var html = '';
    if (base.some(function (m) { return m.miss.length > 0; })) {
      html += '<p class="results__tip">'
        + '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3.4 4.4h2.2l2.4 10.2a1.8 1.8 0 0 0 1.8 1.4h7.4a1.8 1.8 0 0 0 1.8-1.4l1.6-6.6H6.2"/><circle cx="9.6" cy="19.2" r="1.4"/><circle cx="17.2" cy="19.2" r="1.4"/></svg>'
        + '<span>부족한 재료 <b>+</b> 표시를 누르면 장보기 메모에 담겨요</span></p>';
    }
    if (hotCount) {
      html += sectionHead(flameIcon(13), '임박 재료 소진 추천', hotCount + '개', 'section-head--hot');
      html += hotList.map(cardHtml).join('');
      if (rest.length) {
        html += sectionHead(
          '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4.6 7.4h14.8l-1.4 11.2a2 2 0 0 1-2 1.8H8a2 2 0 0 1-2-1.8Z"/><path d="M9 7.4V5.6a3 3 0 0 1 6 0v1.8"/></svg>',
          '이 재료로 만들 수 있어요', rest.length + '개');
        html += rest.map(cardHtml).join('');
      }
    } else {
      html += rest.map(cardHtml).join('');
    }

    if (!html) {
      html = '<div class="empty"><p class="empty__title">조건에 맞는 요리가 없어요</p>'
        + '<p class="empty__desc">재료를 조금 더 고르거나<br />필터를「전체」로 바꿔 보세요.</p></div>';
    }
    listNode.innerHTML = html;

    if (limit === 3 && base.length) {
      listNode.insertAdjacentHTML('beforeend',
        '<p class="results__note">재료 3개만 더 있으면 되는 요리까지 함께 보여 드렸어요.</p>');
    }
  }

  /* ---------------------------------------------------------
     11. 장보기 메모
     --------------------------------------------------------- */
  function addMemo(name, ingId) {
    var found = state.memo.filter(function (m) { return m.name === name; })[0];
    var added = false;
    if (found) {
      state.memo = state.memo.filter(function (m) { return m.name !== name; });
      if (!state.memoOpen) toast(josa(name, '을', '를') + ' 장보기 메모에서 뺐어요');
    } else {
      state.memo.push({ name: name, checked: false });
      added = true;
      Haptic.trigger('tap');
      if (!state.memoOpen) toast('🛒 ' + josa(name, '을', '를') + ' 장보기 메모에 담았어요');
    }
    renderMemoFab();
    renderResults();
    if (state.memoOpen) renderMemoList();

    if (added) {
      pulseMemoFab();
      popMemoChip(ingId);
    }
  }

  function addMemoByIng(id) { addMemo(ingName(id), id); }

  /* 장보기 메모에 담긴 순간의 피드백 — 버튼이 튀어오르고 배지가 강조돼요 */
  function pulseMemoFab() {
    var fab = $('memoFab');
    if (!fab) return;
    fab.classList.remove('is-pop');
    void fab.offsetWidth;
    fab.classList.add('is-pop');
    setTimeout(function () { fab.classList.remove('is-pop'); }, 700);
  }

  function popMemoChip(ingId) {
    if (!ingId) return;
    var chip = el('[data-chip="' + ingId + '"]');
    if (!chip) return;
    chip.classList.add('is-pop');
    setTimeout(function () { chip.classList.remove('is-pop'); }, 520);
  }

  function renderMemoFab() {
    var fab = $('memoFab');
    if (!fab) return;
    fab.hidden = state.memo.length === 0;
    var c = $('memoCount');
    if (c) c.textContent = state.memo.length;
  }

  function renderMemoList() {
    var list = $('memoList');
    $('memoSheetCount').textContent = state.memo.length + '개';
    if (!state.memo.length) {
      list.innerHTML = '<li class="memo__empty">담은 재료가 없어요.<br />부족한 재료 배지를 눌러 보세요.</li>';
      return;
    }
    list.innerHTML = state.memo.map(function (m, i) {
      return '<li class="memo__item' + (m.checked ? ' is-done' : '') + '">'
        + '<button type="button" class="memo__check" data-memo-check="' + i + '" aria-label="' + esc(m.name) + ' 구매 완료 표시" aria-pressed="' + (m.checked ? 'true' : 'false') + '">'
        + '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m4.5 12.5 5 5 9.5-11"/></svg>'
        + '</button>'
        + '<span class="memo__name">' + esc(m.name) + '</span>'
        + '<button type="button" class="memo__del" data-memo-del="' + i + '" aria-label="' + esc(m.name) + ' 빼기">'
        + '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="m6 6 12 12M18 6 6 18"/></svg>'
        + '</button></li>';
    }).join('');
  }

  function openMemo() {
    renderMemoList();
    state.memoOpen = true;
    openOverlay('memoSheet');
  }

  function copyMemo() {
    if (!state.memo.length) { toast('장보기 메모가 비어 있어요'); return; }
    var text = '🛒 장보기 메모\n' + state.memo.map(function (m) {
      return (m.checked ? '✓ ' : '· ') + m.name;
    }).join('\n');

    function done() { toast('장보기 메모를 복사했어요'); }
    function fallback() {
      try {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        done();
      } catch (e) {
        toast('복사가 막혔어요. 메모를 길게 눌러 복사해 주세요');
      }
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, fallback);
    } else fallback();
  }

  /* ---------------------------------------------------------
     12. 오버레이 관리
     --------------------------------------------------------- */
  var overlayStack = [];

  function openOverlay(id) {
    var node = $(id);
    node.hidden = false;
    var tb = $('toast');
    if (tb) tb.hidden = true;
    if (overlayStack.indexOf(id) < 0) overlayStack.push(id);
    document.body.style.overflow = 'hidden';
    var focusable = node.querySelector('button');
    if (focusable) setTimeout(function () { focusable.focus({ preventScroll: true }); }, 30);
  }

  function closeOverlay(id) {
    var node = $(id);
    if (!node) return;
    node.hidden = true;
    overlayStack = overlayStack.filter(function (x) { return x !== id; });
    if (id === 'detail') stopTimer(true);
    if (id === 'memoSheet') state.memoOpen = false;
    if (!overlayStack.length) document.body.style.overflow = '';
  }

  function closeTopOverlay() {
    if (!overlayStack.length) return false;
    var top = overlayStack[overlayStack.length - 1];
    if (top === 'adPlayer') return true;      // 광고 중에는 뒤로가기로 닫지 않아요
    closeOverlay(top);
    return true;
  }

  /* ---------------------------------------------------------
     13. 광고 → 상세 레시피
     --------------------------------------------------------- */
  var pendingRecipe = null;
  var adTimer = null;

  var AdBridge = {
    host: null,
    register: function (impl) { AdBridge.host = impl || null; },
    show: function (kind, adGroupId) {
      if (AdBridge.host && typeof AdBridge.host.show === 'function') {
        try {
          return Promise.resolve(AdBridge.host.show(kind, adGroupId));
        } catch (e) {
          return Promise.resolve({ rewarded: false });
        }
      }
      return null; // 호스트 없음 → 데모 광고
    }
  };
  window.FridgeAdBridge = AdBridge;

  function openAdNotice(id) {
    var r = RECIPES.filter(function (x) { return x.id === id; })[0];
    if (!r) return;
    pendingRecipe = id;
    $('adNoticeDesc').innerHTML = '광고를 끝까지 보면 <b>' + r.name + '</b>의 1·2인분 계량과 단계별 조리법, 조리 타이머가 열려요.';
    openOverlay('adNoticeModal');
  }

  function playDemoAd() {
    var seconds = CONFIG.demoAdSeconds;
    var total = seconds * 1000;
    var start = Date.now();

    $('adPlayerTime').textContent = seconds + '초';
    $('adPlayerFill').style.width = '0%';
    $('adPlayerNote').innerHTML = '광고를 끝까지 보면 레시피가 열려요.<br /><span>데모 광고예요. 실제 광고가 아닙니다.</span>';
    $('adPlayer').classList.remove('is-done');
    openOverlay('adPlayer');

    clearInterval(adTimer);
    adTimer = setInterval(function () {
      var left = Math.max(0, total - (Date.now() - start));
      var pct = 100 - (left / total * 100);
      $('adPlayerFill').style.width = pct.toFixed(1) + '%';
      $('adPlayerTime').textContent = Math.ceil(left / 1000) + '초';
      if (left <= 0) {
        clearInterval(adTimer);
        adTimer = null;
        finishAd();
      }
    }, 80);
  }

  function finishAd() {
    var player = $('adPlayer');
    $('adPlayerFill').style.width = '100%';
    $('adPlayerTime').textContent = '완료';
    $('adPlayerNote').innerHTML = '레시피가 열렸어요!<br /><span>잠시 후 상세 레시피로 이동합니다.</span>';
    player.classList.add('is-done');
    Haptic.trigger('success');

    setTimeout(function () {
      closeOverlay('adPlayer');
      if (pendingRecipe) {
        state.unlocked.push(pendingRecipe);
        var id = pendingRecipe;
        pendingRecipe = null;
        renderResults();
        openDetail(id);
      }
    }, 700);
  }

  function startAd() {
    var id = pendingRecipe;
    if (!id) return;
    closeOverlay('adNoticeModal');

    var real = AdBridge.show('recipe', CONFIG.rewardedAdGroupId);
    if (real && typeof real.then === 'function') {
      // 실제 SDK가 연결된 경우
      real.then(function (res) {
        if (res && res.rewarded) {
          state.unlocked.push(id);
          pendingRecipe = null;
          renderResults();
          openDetail(id);
        } else {
          pendingRecipe = null;
          toast('광고를 끝까지 보지 않아 레시피가 열리지 않았어요');
        }
      });
      return;
    }
    playDemoAd();
  }

  /* ---------------------------------------------------------
     14. 상세 레시피 · 인분 전환 · 타이머
     --------------------------------------------------------- */
  function fmtQty(v) {
    if (v >= 1) {
      return Number.isInteger(v) ? String(v) : String(Math.round(v * 10) / 10);
    }
    if (v === 0.25) return '1/4';
    if (v === 0.5) return '1/2';
    if (v === 0.75) return '3/4';
    return String(Math.round(v * 100) / 100);
  }

  function scaledQty(m, servings) {
    if (m.q === null || m.q === undefined) return m.u;
    var factor = servings / CONFIG.baseServings;
    var v = m.q * factor;
    // 0.25 단위로 맞춰요
    v = Math.max(0.25, Math.round(v * 4) / 4);
    return fmtQty(v) + m.u;
  }

  function openDetail(id) {
    var r = RECIPES.filter(function (x) { return x.id === id; })[0];
    if (!r) return;
    state.detailId = id;
    state.servings = CONFIG.baseServings;
    renderDetail();
    openOverlay('detail');
    $('detailScroll').scrollTop = 0;
    Haptic.trigger('tap');
  }

  function renderDetail() {
    var r = RECIPES.filter(function (x) { return x.id === state.detailId; })[0];
    if (!r) return;

    $('detailTitle').textContent = r.name;
    $('detailBarTitle').textContent = r.name;
    $('detailDesc').textContent = r.desc;
    $('detailHero').innerHTML = dishArt(r.art);

    var owned = r.need.filter(hasSel);
    var badge = $('detailBadge');
    if (owned.length === r.need.length) {
      badge.className = 'badge badge--now';
      badge.textContent = '바로 가능';
    } else {
      badge.className = 'badge badge--near';
      badge.textContent = (r.need.length - owned.length) + '개만 더';
    }

    $('detailFacts').innerHTML =
      '<div class="fact"><p class="fact__label">조리 시간</p><p class="fact__value">' + r.time + '분</p></div>'
      + '<div class="fact"><p class="fact__label">난이도</p><p class="fact__value">' + r.level + '</p></div>'
      + '<div class="fact"><p class="fact__label">분량</p><p class="fact__value">' + state.servings + '인분</p></div>';

    $('detailServings').textContent = state.servings + '인분 기준';
    all('#servings [data-serv]').forEach(function (b) {
      var on = Number(b.getAttribute('data-serv')) === state.servings;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });

    $('detailMeasures').innerHTML = r.measures.map(function (m) {
      var dotClass = 'dot--basic';
      if (m.id && hasSel(m.id)) dotClass = 'dot--own';
      else if (m.id) dotClass = 'dot--miss';
      return '<li><i class="dot ' + dotClass + '"></i>'
        + '<span class="measure__name">' + m.n + '</span>'
        + '<span class="measure__qty">' + scaledQty(m, state.servings) + '</span></li>';
    }).join('');

    $('detailSteps').innerHTML = r.steps.map(function (st, i) {
      var timerBtn = st.timer
        ? '<button type="button" class="timer-chip" data-timer="' + st.timer + '" data-step="' + (i + 1) + '" data-label="' + esc(st.label || '') + '">'
          + '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="7.6"/><path d="M12 9.4V13l2.4 1.6M9.4 3.4h5.2"/></svg>'
          + '<span>' + fmtDur(st.timer) + '</span></button>'
        : '';
      return '<li><span class="step__text">' + st.t + '</span>' + timerBtn + '</li>';
    }).join('');

    $('detailTip').textContent = r.tip;
  }

  function setServings(n) {
    if (state.servings === n) return;
    state.servings = n;
    renderDetail();
    Haptic.trigger('tap');
  }

  /* ---- 원터치 타이머 ---- */
  var timer = { id: null, total: 0, left: 0, paused: false, label: '' };

  function fmtDur(sec) {
    if (sec < 60) return sec + '초';
    var m = Math.floor(sec / 60);
    var rest = sec % 60;
    return rest ? m + '분 ' + rest + '초' : m + '분';
  }

  function fmtTime(sec) {
    var m = Math.floor(sec / 60);
    var s = sec % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  function startTimer(sec, stepNo, label) {
    stopTimer(true);
    timer.total = sec;
    timer.left = sec;
    timer.paused = false;
    timer.label = (stepNo ? stepNo + '단계 · ' : '') + (label || '타이머');

    $('timerBar').hidden = false;
    $('timerLabel').textContent = timer.label;
    $('timerTime').textContent = fmtTime(sec);
    $('timerFill').style.width = '100%';
    $('timerBar').classList.remove('is-done');
    $('timerToggle').innerHTML = pauseIcon();

    clearInterval(timer.id);
    timer.id = setInterval(tickTimer, 1000);
    Haptic.trigger('tap');
  }

  function tickTimer() {
    if (timer.paused) return;
    timer.left -= 1;
    if (timer.left <= 0) { timer.left = 0; endTimer(); }
    var pct = timer.total ? (timer.left / timer.total * 100) : 0;
    $('timerTime').textContent = fmtTime(timer.left);
    $('timerFill').style.width = pct + '%';
  }

  function endTimer() {
    clearInterval(timer.id);
    timer.id = null;
    $('timerBar').classList.add('is-done');
    $('timerTime').textContent = '0:00';
    $('timerLabel').textContent = timer.label + ' · 끝!';
    $('timerToggle').innerHTML = replayIcon();
    beep();
    Haptic.trigger('success');
    toast('타이머가 끝났어요 · 불 확인하세요');
  }

  function toggleTimer() {
    if (timer.left <= 0) {
      // 다시 시작
      timer.left = timer.total;
      timer.paused = false;
      $('timerBar').classList.remove('is-done');
      $('timerTime').textContent = fmtTime(timer.left);
      $('timerFill').style.width = '100%';
      $('timerToggle').innerHTML = pauseIcon();
      clearInterval(timer.id);
      timer.id = setInterval(tickTimer, 1000);
      return;
    }
    timer.paused = !timer.paused;
    $('timerToggle').innerHTML = timer.paused ? playIcon() : pauseIcon();
    $('timerBar').classList.toggle('is-paused', timer.paused);
  }

  function stopTimer(silent) {
    clearInterval(timer.id);
    timer.id = null;
    timer.left = 0;
    timer.paused = false;
    var bar = $('timerBar');
    if (bar) {
      bar.hidden = true;
      bar.classList.remove('is-done', 'is-paused');
    }
    if (!silent) toast('타이머를 멈췄어요');
  }

  function pauseIcon() {
    return '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 5.6v12.8M15 5.6v12.8"/></svg>';
  }
  function playIcon() {
    return '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8.4 5.8v12.4L18.6 12Z"/></svg>';
  }
  function replayIcon() {
    return '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M19.4 12a7.4 7.4 0 1 1-2.6-5.6"/><path d="M19.6 4.6v4.2h-4.2"/></svg>';
  }

  /* ---------------------------------------------------------
     15. 공유
     --------------------------------------------------------- */
  function share() {
    var payload = {
      title: '냉장고 파먹기',
      text: '냉장고에 있는 재료만 골라 오늘 뭐 해 먹을지 바로 찾아봐요.',
      url: CONFIG.appUrl
    };

    function done(msg) { toast(msg || '공유했어요'); }

    if (window.FridgeShare && typeof window.FridgeShare.share === 'function') {
      try {
        window.FridgeShare.share(payload);
        done('공유 창을 열었어요');
        return;
      } catch (e) {}
    }
    if (navigator.share) {
      navigator.share(payload).then(function () { done('공유했어요'); }, function (err) {
        if (err && err.name === 'AbortError') return;
        copyLink();
      });
      return;
    }
    copyLink();

    function copyLink() {
      var text = payload.text + '\n' + payload.url;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { done('링크를 복사했어요'); }, fallback);
      } else fallback();
      function fallback() {
        try {
          var ta = document.createElement('textarea');
          ta.value = text;
          ta.style.position = 'fixed';
          ta.style.opacity = '0';
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
          done('링크를 복사했어요');
        } catch (e) { toast('공유를 지원하지 않는 환경이에요'); }
      }
    }
  }

  /* ---------------------------------------------------------
     16. 뒤로가기 · 종료
     --------------------------------------------------------- */
  function requestExit() {
    if (overlayStack.length) { closeTopOverlay(); return; }
    openOverlay('exitModal');
  }

  function initBackGuard() {
    try {
      window.history.pushState({ fridgeRecipe: true }, '');
    } catch (e) {}

    window.addEventListener('popstate', function () {
      if (overlayStack.length) {
        closeTopOverlay();
        try { window.history.pushState({ fridgeRecipe: true }, ''); } catch (e) {}
        return;
      }
      openOverlay('exitModal');
      try { window.history.pushState({ fridgeRecipe: true }, ''); } catch (e) {}
    });
  }

  /* ---------------------------------------------------------
     17. 이벤트 연결
     --------------------------------------------------------- */
  function bind() {
    $('fridgeShelves').addEventListener('click', function (e) {
      var btn = e.target.closest('[data-ing]');
      if (!btn) return;
      toggleIngredient(btn.getAttribute('data-ing'));
    });

    var comboRow = $('comboRow');
    if (comboRow) {
      comboRow.addEventListener('click', function (e) {
        var b = e.target.closest('[data-combo]');
        if (!b) return;
        applyCombo(b.getAttribute('data-combo'));
      });
    }

    $('recipeList').addEventListener('click', function (e) {
      var open = e.target.closest('[data-open]');
      if (open) {
        var id = open.getAttribute('data-open');
        if (isUnlocked(id)) openDetail(id);
        else openAdNotice(id);
        return;
      }
      var chip = e.target.closest('[data-chip]');
      if (chip) { addMemoByIng(chip.getAttribute('data-chip')); return; }
      var quick = e.target.closest('[data-quick]');
      if (quick) { quickPick(); return; }
    });

    $('filters').addEventListener('click', function (e) {
      var b = e.target.closest('[data-filter]');
      if (!b) return;
      state.filter = b.getAttribute('data-filter');
      all('.filter').forEach(function (f) {
        var on = f.getAttribute('data-filter') === state.filter;
        f.classList.toggle('is-on', on);
        f.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      renderResults();
    });

    $('clearBtn').addEventListener('click', function () {
      state.sel = [];
      state.hot = [];
      renderFridge();
      refresh();
      toast('냉장고를 비웠어요');
    });

    $('quickBtn').addEventListener('click', quickPick);

    $('searchInput').addEventListener('input', function (e) {
      state.query = e.target.value;
      $('searchClear').hidden = !state.query;
      renderFridge();
    });
    $('searchClear').addEventListener('click', function () {
      state.query = '';
      $('searchInput').value = '';
      $('searchClear').hidden = true;
      renderFridge();
      $('searchInput').focus();
    });

    $('dockBtn').addEventListener('click', function () {
      $('results').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    $('shareBtn').addEventListener('click', share);
    $('backBtn').addEventListener('click', requestExit);

    /* 광고 안내 */
    $('adCancel').addEventListener('click', function () {
      pendingRecipe = null;
      closeOverlay('adNoticeModal');
    });
    $('adConfirm').addEventListener('click', startAd);
    $('adNoticeModal').addEventListener('click', function (e) {
      if (e.target.closest('[data-close]')) {
        pendingRecipe = null;
        closeOverlay('adNoticeModal');
      }
    });

    /* 상세 */
    $('detailClose').addEventListener('click', function () { closeOverlay('detail'); });
    $('detailBack').addEventListener('click', function () { closeOverlay('detail'); });

    $('detailSteps').addEventListener('click', function (e) {
      var b = e.target.closest('[data-timer]');
      if (!b) return;
      startTimer(Number(b.getAttribute('data-timer')), b.getAttribute('data-step'), b.getAttribute('data-label'));
    });

    $('servings').addEventListener('click', function (e) {
      var b = e.target.closest('[data-serv]');
      if (!b) return;
      setServings(Number(b.getAttribute('data-serv')));
    });

    $('timerToggle').addEventListener('click', toggleTimer);
    $('timerStop').addEventListener('click', function () { stopTimer(false); });

    /* 장보기 메모 */
    $('memoFab').addEventListener('click', openMemo);
    $('memoSheet').addEventListener('click', function (e) {
      if (e.target.closest('[data-close]')) { closeOverlay('memoSheet'); return; }
      var chk = e.target.closest('[data-memo-check]');
      if (chk) {
        var i = Number(chk.getAttribute('data-memo-check'));
        state.memo[i].checked = !state.memo[i].checked;
        renderMemoList();
        Haptic.trigger('tap');
        return;
      }
      var del = e.target.closest('[data-memo-del]');
      if (del) {
        var j = Number(del.getAttribute('data-memo-del'));
        var name = state.memo[j].name;
        state.memo.splice(j, 1);
        renderMemoList();
        renderMemoFab();
        renderResults();
        toast(josa(name, '을', '를') + ' 뺐어요');
      }
    });
    $('memoCopy').addEventListener('click', copyMemo);
    $('memoClear').addEventListener('click', function () {
      state.memo = [];
      renderMemoList();
      renderMemoFab();
      renderResults();
      toast('장보기 메모를 비웠어요');
    });

    /* 종료 */
    $('exitStay').addEventListener('click', function () { closeOverlay('exitModal'); });
    $('exitLeave').addEventListener('click', function () {
      closeOverlay('exitModal');
      if (window.FridgeHost && typeof window.FridgeHost.exit === 'function') {
        window.FridgeHost.exit();
      } else {
        toast('앱을 종료했어요 (프로토타입)');
      }
    });

    /* 공통 닫기 */
    document.addEventListener('click', function (e) {
      var closer = e.target.closest('[data-close]');
      if (closer) {
        var id = closer.getAttribute('data-close');
        if (id === 'adNoticeModal') pendingRecipe = null;
        closeOverlay(id);
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && overlayStack.length) closeTopOverlay();
    });
  }

  function quickPick() {
    CONFIG.quickPick.forEach(function (id) {
      if (!hasSel(id)) state.sel.push(id);
    });
    renderFridge();
    refresh();
    toast('자주 쓰는 재료 5개를 담았어요');
  }

  /* ---------------------------------------------------------
     18. 시작
     --------------------------------------------------------- */
  function init() {
    renderFridge();
    refresh();
    bind();
    initBackGuard();

    // 디버그·검증용 (실사용에는 영향 없음)
    window.FridgeApp = {
      state: state,
      config: CONFIG,
      recipes: RECIPES,
      ingredients: INGREDIENTS,
      toggleIngredient: toggleIngredient,
      renderFridge: renderFridge,
      applyCombo: applyCombo,
      openAdNotice: openAdNotice,
      openDetail: openDetail,
      setServings: setServings,
      startTimer: startTimer,
      getTimer: function () { return { left: timer.left, total: timer.total, paused: timer.paused, running: !!timer.id }; },
      addMemo: addMemo,
      refresh: refresh
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
