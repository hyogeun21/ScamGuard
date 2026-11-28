export function smartphoneData(run) {
  run.smartphoneData ??= { messages: {}, call: { asked: [], turns: [], lastPath: [] } };
  return run.smartphoneData;
}
export function messageThread(run, messageId) {
  const data = smartphoneData(run);
  return data.messages[messageId] ??= { asked: [], turns: [] };
}
export function askMessageQuestion(run, message, questionId) {
  const question = (message.questions ?? []).find(q => q.id === questionId);
  if (!question) throw new Error("메시지 질문을 찾을 수 없습니다.");
  const thread = messageThread(run, message.id);
  if (thread.asked.includes(questionId)) return false;
  thread.asked.push(questionId);
  thread.turns.push({ role: "outgoing", text: question.title }, { role: "incoming", text: question.answer });
  return true;
}
export function resolveCallQuestion(scenario, path) {
  let questions = scenario.callQuestions ?? [], found;
  for (const id of path) { found = questions.find(q => q.id === id); if (!found) return null; questions = found.followUps ?? []; }
  return found ?? null;
}
export function callChoices(run, scenario) {
  const call = smartphoneData(run).call;
  const question = resolveCallQuestion(scenario, call.lastPath);
  if (question?.followUps?.length) return question.followUps.map(q => ({ question: q, path: [...call.lastPath, q.id] }));
  return (scenario.callQuestions ?? []).map(q => ({ question: q, path: [q.id] }));
}
export function askCallQuestion(run, scenario, path) {
  const question = resolveCallQuestion(scenario, path);
  if (!question) throw new Error("전화 질문을 찾을 수 없습니다.");
  const call = smartphoneData(run).call, id = path.join("/");
  call.lastPath = [...path];
  if (call.asked.includes(id)) return false;
  call.asked.push(id);
  call.turns.push({ role: "outgoing", text: question.title }, { role: "incoming", text: question.answer });
  return true;
}
