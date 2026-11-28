// 교육용 예시 데이터입니다. 팀의 확정 콘텐츠로 이 파일만 교체하세요.
// 메시지별 questions 4개를 각각 독립적으로 수정할 수 있습니다.
const titles = [
  "채용 사기",
  "재택부업 사기",
  "투자 리딩방 사기",
  "숙소예약 사기",
];
function questions(prefix) {
  return [
    {
      id: "official",
      title: "이 안내를 공식적으로 확인할 수 있는 곳이 있나요?",
      answer: `${prefix}에 대한 공식 확인 경로 안내입니다.\n\n이 부분을 팀의 시나리오 답변으로 교체하세요.`,
    },
    {
      id: "identity",
      title: "담당자의 소속과 신원을 확인하고 싶습니다.",
      answer: "담당자 신원에 대한 시나리오 답변이 표시됩니다.",
    },
    {
      id: "details",
      title: "요청하는 정보와 그 사용 목적을 자세히 설명해주세요.",
      answer:
        "요청 항목과 목적에 대한 답변입니다.\n\n내용이 길어지면 말풍선의 높이가 늘어나며, 화면을 넘으면 안쪽에서 스크롤할 수 있습니다.",
    },
    {
      id: "process",
      title: "전체 진행 절차를 알려주세요.",
      answer:
        "공식 절차 안내\n\n1. 첫 번째 절차\n2. 두 번째 절차\n3. 세 번째 절차\n\n실제 교육 콘텐츠로 교체해주세요.",
    },
  ];
}
export const SCENARIOS = titles.map((title, index) => ({
  id: index + 1,
  title,
  messages: [
    {
      id: "message-1",
      title: "첫 번째 안내",
      sender: "담당자",
      body: `[${title}]\n안녕하세요. 첫 번째 안내 메시지입니다.`,
      questions: questions("첫 번째 안내"),
    },
    {
      id: "message-2",
      title: "진행 절차 안내",
      sender: "담당자",
      body: "진행 절차를 안내드립니다.\n\n전달받은 내용을 확인하고 필요한 정보를 준비해주세요.\n\n이 메시지는 자동 줄바꿈과 말풍선 높이 조절을 확인하는 예시입니다. 실제 내용은 팀의 시나리오에 맞게 변경하세요.",
      questions: questions("진행 절차"),
    },
    {
      id: "message-3",
      title: "추가 확인 요청",
      sender: "담당자",
      body: "안내 내용을 확인하셨나요?",
      questions: questions("추가 확인"),
    },
  ],
  contact: { name: "공식 연락처", number: "실제 공식 연락처 데이터 연결 예정" },
  callQuestions: [
    {
      id: "call-1",
      title: "현재 안내된 내용을 공식적으로 진행하고 있나요?",
      answer:
        "공식 진행 여부에 대한 답변입니다. 실제 시나리오 내용으로 교체해주세요.",
    },
    {
      id: "call-2",
      title: "문자에 나온 담당자가 실제 소속 담당자인가요?",
      answer: "담당자 확인 결과입니다.",
    },
    {
      id: "call-3",
      title: "제가 받은 메시지를 공식적으로 발송한 것이 맞나요?",
      answer:
        "발송 여부에 대한 답변입니다.\n\n질문과 답변 모두 내용 길이에 따라 표시 크기가 자동으로 바뀝니다.",
    },
    {
      id: "call-4",
      title: "공식 진행 절차와 제출 방법을 확인하고 싶습니다.",
      answer:
        "공식 절차 안내입니다.\n\n팀의 확정된 시나리오 데이터를 이곳에 입력하세요.",
    },
  ],
}));
export function getScenario(id) {
  return SCENARIOS.find((s) => s.id === id) ?? SCENARIOS[0];
}
