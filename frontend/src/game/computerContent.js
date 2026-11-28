// 화면 연결은 확정 기획, 본문/선택지 일부는 교체용 예시입니다.
// backTo:null이면 뒤로가기 버튼 없이 X/ESC로 전체 창을 닫습니다.
const detail = (title, backTo, body) => ({
  title,
  backTo,
  body: body ?? `${title}\n\n이곳을 팀의 확정 시나리오 내용으로 교체해주세요.`,
  actions: [],
});
const action = (label, target, buttonKey) => ({
  label,
  target,
  ...(buttonKey ? { buttonKey } : {}),
});
const menu = (title, backTo, actions, body = "") => ({
  title,
  backTo,
  body,
  actions,
});

const hiring = {
  root: "home",
  nodes: {
    home: menu("컴퓨터 · 채용 정보", null, [
      action("채용 공고", "posting"),
      action("기업 홈페이지", "company"),
      action("채용 절차", "process"),
      action("서류 제출 안내", "documents"),
    ]),
    posting: detail(
      "채용 공고",
      "home",
      "기업명: 예시 기업\n모집 직무: 예시 직무\n근무 기간: 시나리오 데이터 입력\n근무 형태: 시나리오 데이터 입력\n주요 업무: 시나리오 데이터 입력",
    ),
    company: detail(
      "기업 홈페이지",
      "home",
      "기업 소개\n\n공식 연락처와 기업이 제공하는 채용 정보를 이곳에 입력하세요.\n실제 외부 홈페이지가 아닌 게임 내 조사 화면입니다.",
    ),
    process: detail(
      "채용 절차",
      "home",
      "온라인 지원 → 면접 → 합격 안내 → 근로계약\n\n확정된 시나리오의 채용 절차로 교체해주세요.",
    ),
    documents: detail(
      "서류 제출 안내",
      "home",
      "제출 대상 서류: 예시 안내\n공식 제출 경로: 예시 안내\n\n시나리오에 맞는 문구로 교체해주세요.",
    ),
  },
};
const remote = {
  root: "home",
  nodes: {
    home: menu("컴퓨터 · 재택부업 정보", null, [
      action("부업 공고", "posting"),
      action("업체 홈페이지", "company"),
      action("정산 내역 · 업무 조건", "terms"),
      action("업무 사이트", "tasks"),
    ]),
    posting: detail(
      "부업 공고",
      "home",
      "업체명: 예시 업체\n모집 업무: 예시 업무\n근로 형태: 시나리오 데이터 입력\n보수 지급 방식: 시나리오 데이터 입력",
    ),
    company: detail("업체 홈페이지", "home"),
    terms: detail(
      "정산 내역 · 업무 조건",
      "home",
      "완료 업무 / 수수료 / 누적 수익 / 정산 일정 / 출금 조건\n\n팀의 확정된 내용으로 교체해주세요.",
    ),
    tasks: menu(
      "업무 목록",
      "home",
      [
        action("업무 1 · 상품 정보 확인", "task-1"),
        action("업무 2 · 주문 정보 확인", "task-2"),
        action("업무 3 · 정산 정보 확인", "task-3"),
      ],
      "업무 개수는 고정되어 있지 않습니다. 데이터에 항목을 추가하면 목록이 늘어납니다.",
    ),
    "task-1": detail(
      "업무 1 · 상품 정보 확인",
      "tasks",
      "상품명: 예시 상품\n\n업무 지시 내용과 확인할 정보를 입력하세요.",
    ),
    "task-2": detail(
      "업무 2 · 주문 정보 확인",
      "tasks",
      "주문 번호: 예시 번호\n주문 상태: 예시 상태\n\n실제 주문이나 결제가 발생하지 않는 게임 내 화면입니다.",
    ),
    "task-3": detail(
      "업무 3 · 정산 정보 확인",
      "tasks",
      "정산 예정액: 예시 금액\n정산 조건: 시나리오 데이터 입력",
    ),
  },
};
const investment = {
  root: "home",
  nodes: {
    home: menu("투자앱 · 금융정보", null, [
      action("금융회사 홈페이지", "company"),
      action("등록조회 · 공시", "disclosure"),
      action("투자앱", "app"),
      action("서비스 공식앱 정보", "official"),
    ]),
    company: detail("금융회사 홈페이지", "home"),
    disclosure: detail(
      "등록조회 · 공시",
      "home",
      "회사명 / 등록 정보 / 공시 내용\n\n팀의 확정된 조사 정보를 입력하세요. 실제 등록 상태에 대한 주장이 아닌 예시입니다.",
    ),
    app: menu(
      "투자앱",
      "home",
      [action("투자앱 항목 확인", "app-item")],
      "투자앱의 안내 내용과 항목을 확인할 수 있습니다.",
    ),
    "app-item": menu(
      "투자앱 항목",
      "app",
      [action("가상출금요청", "withdraw", "computerWithdraw")],
      "투자 현황: 예시 데이터\n표시 잔액: 예시 데이터\n출금 조건: 시나리오 데이터 입력",
    ),
    withdraw: detail(
      "가상출금요청 결과",
      "app-item",
      "요청 결과: 거부 (교체용 예시)\n\n요청 승인 또는 거부와 그 사유를 시나리오에 맞게 입력하세요.\n이 화면은 결과 내용을 표시하며 실제 금융 거래를 실행하지 않습니다.",
    ),
    official: menu(
      "공식앱 정보",
      "home",
      [action("공식앱 항목 확인", "official-item")],
      "공식 서비스명과 개발사 등 비교할 정보를 입력하세요.",
    ),
    "official-item": detail(
      "공식앱 항목",
      "official",
      "서비스명: 예시 서비스\n개발사: 예시 개발사\n공식 안내: 시나리오 데이터 입력",
    ),
  },
};
const lodging = {
  root: "home",
  nodes: {
    home: menu("숙소예약정보", null, [
      action("숙소 정보", "lodging-info"),
      action("예약 조건", "conditions"),
      action("숙소검색내용", "search"),
      action("예약 및 결제안내", "payment"),
    ]),
    "lodging-info": detail(
      "숙소 정보",
      "home",
      "숙소명: 예시 숙소\n위치: 예시 위치\n시설 안내: 시나리오 데이터 입력",
    ),
    conditions: detail(
      "예약 조건",
      "home",
      "예약 기간 / 취소 조건 / 환불 안내\n\n이 두 일반 선택지의 제목과 본문은 팀의 확정 내용으로 교체해주세요.",
    ),
    search: menu(
      "숙소검색내용",
      "home",
      [action("숙소검색결과", "search-result")],
      "숙소 검색 내용과 비교할 정보를 입력하세요.",
    ),
    "search-result": menu(
      "숙소검색결과",
      "search",
      [action("예약문의", "inquiry", "computerInquiry")],
      "검색된 숙소 정보\n\n검색결과의 주소·업체명·연락처 등 조사할 정보를 입력하세요.",
    ),
    inquiry: detail(
      "예약문의",
      "search-result",
      "예약 문의에 대한 답변\n\n확정된 시나리오의 문의 내용을 입력하세요.",
    ),
    // 사용자 기획대로 이 화면에는 뒤로가기 버튼이 없습니다.
    payment: menu(
      "예약 및 결제안내",
      null,
      [action("결제안내확인", "payment-confirm", "computerPaymentConfirm")],
      "예약 절차와 결제 안내 내용을 확인하세요.",
    ),
    "payment-confirm": detail(
      "결제안내확인",
      "payment",
      "결제 안내 내용\n\n예금주, 결제 방법 등 팀의 확정된 조사 정보를 입력하세요. 실제 결제를 실행하지 않습니다.",
    ),
  },
};
export const COMPUTER_SCENARIOS = {
  1: hiring,
  2: remote,
  3: investment,
  4: lodging,
};
export function getComputerGraph(scenarioId) {
  return COMPUTER_SCENARIOS[scenarioId] ?? hiring;
}

// UI와 분리한 연결 검증/이동 함수: 잘못된 링크가 빈 화면을 만들지 않도록 합니다.
export function resolveComputerPage(graph, id) {
  const page = graph.nodes[id];
  if (!page) throw new Error(`컴퓨터 화면을 찾을 수 없습니다: ${id}`);
  return page;
}
export function followComputerAction(graph, pageId, index) {
  const page = resolveComputerPage(graph, pageId),
    entry = page.actions[index];
  if (!entry) throw new Error("선택지를 찾을 수 없습니다.");
  resolveComputerPage(graph, entry.target);
  return entry.target;
}
export function computerBack(graph, pageId) {
  const target = resolveComputerPage(graph, pageId).backTo;
  if (target !== null) resolveComputerPage(graph, target);
  return target;
}
