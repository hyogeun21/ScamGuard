import test from "node:test";
import assert from "node:assert/strict";
import {
  COMPUTER_SCENARIOS,
  getComputerGraph,
  followComputerAction,
  computerBack,
  resolveComputerPage,
} from "../src/game/computerContent.js";
import { createRunData } from "../src/game/state.js";
test("4개 시나리오의 선택지 수와 모든 화면 연결을 검증한다", () => {
  for (const graph of Object.values(COMPUTER_SCENARIOS)) {
    assert.equal(graph.nodes[graph.root].actions.length, 4);
    const reached = new Set(),
      pending = [graph.root];
    while (pending.length) {
      const id = pending.pop();
      if (reached.has(id)) continue;
      reached.add(id);
      const page = resolveComputerPage(graph, id);
      assert.equal(typeof page.title, "string");
      page.actions.forEach((_, i) =>
        pending.push(followComputerAction(graph, id, i)),
      );
      if (computerBack(graph, id) !== null)
        resolveComputerPage(graph, computerBack(graph, id));
    }
    assert.equal(reached.size, Object.keys(graph.nodes).length);
  }
});
test("채용은 선택지 4개 모두 내용 후 메인으로 돌아간다", () => {
  const g = getComputerGraph(1);
  g.nodes.home.actions.forEach((_, i) =>
    assert.equal(computerBack(g, followComputerAction(g, "home", i)), "home"),
  );
});
test("재택부업은 일반 3개와 업무목록→업무내용을 구분한다", () => {
  const g = getComputerGraph(2);
  for (let i = 0; i < 3; i++)
    assert.equal(
      resolveComputerPage(g, followComputerAction(g, "home", i)).actions.length,
      0,
    );
  assert.equal(followComputerAction(g, "home", 3), "tasks");
  assert.equal(computerBack(g, "tasks"), "home");
  g.nodes.tasks.actions.forEach((_, i) =>
    assert.equal(computerBack(g, followComputerAction(g, "tasks", i)), "tasks"),
  );
});
test("숙소검색→결과→문의의 뒤로가기와 결제안내 예외를 지킨다", () => {
  const g = getComputerGraph(4);
  assert.equal(followComputerAction(g, "home", 2), "search");
  assert.equal(followComputerAction(g, "search", 0), "search-result");
  assert.equal(followComputerAction(g, "search-result", 0), "inquiry");
  assert.equal(computerBack(g, "inquiry"), "search-result");
  assert.equal(computerBack(g, "search-result"), "search");
  assert.equal(computerBack(g, "search"), "home");
  assert.equal(computerBack(g, "payment"), null);
  assert.equal(followComputerAction(g, "payment", 0), "payment-confirm");
  assert.equal(computerBack(g, "payment-confirm"), "payment");
});
test("투자앱/공식앱 가지와 출금 결과 뒤로가기를 구분한다", () => {
  const g = getComputerGraph(3);
  assert.equal(followComputerAction(g, "home", 2), "app");
  assert.equal(followComputerAction(g, "app", 0), "app-item");
  assert.equal(followComputerAction(g, "app-item", 0), "withdraw");
  assert.equal(computerBack(g, "withdraw"), "app-item");
  assert.equal(computerBack(g, "app-item"), "app");
  assert.equal(followComputerAction(g, "home", 3), "official");
  assert.equal(followComputerAction(g, "official", 0), "official-item");
  assert.equal(computerBack(g, "official-item"), "official");
});
test("잘못된 링크는 명확한 오류, 새 게임은 컴퓨터 조사 기록도 초기화", () => {
  const g = getComputerGraph(1);
  assert.throws(() => resolveComputerPage(g, "missing"));
  assert.throws(() => followComputerAction(g, "home", 9));
  const old = createRunData(1);
  old.computerPages.push("posting");
  const fresh = createRunData(1);
  assert.deepEqual(fresh.computerPages, []);
  assert.notEqual(old.computerPages, fresh.computerPages);
});
