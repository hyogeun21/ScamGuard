// Replace these example answers with confirmed scenario content.
// A node can override them with questions: [{id, title, answer}].
export const DEFAULT_COMPUTER_QUESTIONS = [
  { id: "source", title: "이 정보의 출처는 어디인가요?", answer: "교체용 예시 답변입니다. 해당 정보의 출처와 공식 확인 경로를 시나리오에 맞게 입력하세요." },
  { id: "contact", title: "공식 연락처를 확인할 수 있나요?", answer: "교체용 예시 답변입니다. 시나리오에 맞는 공식 연락처 및 확인 결과를 입력하세요." },
  { id: "terms", title: "안내된 조건을 다시 설명해 주세요.", answer: "교체용 예시 답변입니다. 선택한 조사 항목의 세부 조건과 안내 내용을 입력하세요." },
  { id: "evidence", title: "확인할 수 있는 자료가 있나요?", answer: "교체용 예시 답변입니다. 해당 시나리오에서 확인 가능한 자료와 근거를 입력하세요." },
];
export function computerQuestions(page) {
  return page.questions ?? DEFAULT_COMPUTER_QUESTIONS;
}
export function findComputerQuestion(page, id) {
  const question = computerQuestions(page).find((item) => item.id === id);
  if (!question) throw new Error(`추가질문을 찾을 수 없습니다: ${id}`);
  return question;
}
