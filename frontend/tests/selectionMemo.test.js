import test from "node:test";
import assert from "node:assert/strict";
import { addSelectionToMemo } from "../src/game/selectionMemo.js";
import { createRunData } from "../src/game/state.js";
test("selection requires approval and preserves existing notes on cancel", () => {
  const run = createRunData(1); run.memo = "직접 쓴 메모";
  assert.equal(addSelectionToMemo(run, "선택 내용", () => false), false);
  assert.equal(run.memo, "직접 쓴 메모");
  assert.equal(addSelectionToMemo(run, "  선택 내용\n둘째 줄  ", (text) => {
    assert.equal(text, "선택 내용\n둘째 줄"); return true;
  }), true);
  assert.equal(run.memo, "직접 쓴 메모\n\n선택 내용\n둘째 줄");
  assert.equal(createRunData(1).memo, "");
});
test("empty selection never asks for approval or changes the note", () => {
 const run = createRunData(1);
 assert.equal(addSelectionToMemo(run, "   ", () => { throw Error("unexpected approval"); }), false);
 assert.equal(run.memo, "");
 assert.equal(addSelectionToMemo(run, "텍스트", () => true), true);
 assert.equal(run.memo, "텍스트");
});
