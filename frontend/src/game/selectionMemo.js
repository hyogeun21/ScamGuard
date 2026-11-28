export function addSelectionToMemo(run, text, confirm) {
  const value = text.trim();
  if (!run || !value || !confirm(value)) return false;
  run.memo = run.memo ? `${run.memo}\n\n${value}` : value;
  return true;
}

export function installSelectionMemo(scene) {
  let pending = "";
  let action;
  let status;
  const clear = () => {
    pending = "";
    action?.remove();
    status?.remove();
    action = status = null;
  };
  const update = () => {
    if (scene.closing || !["smartphone", "telephone", "computer"].includes(scene.type)) return clear();
    const selection = window.getSelection();
    const content = scene.root.querySelector("[data-memo-scope]") ?? scene.root.querySelector(".sg-content");
    if (!selection?.rangeCount || selection.isCollapsed || !content) return clear();
    const range = selection.getRangeAt(0);
    const element = (node) => node.nodeType === 1 ? node : node.parentElement;
    if (!content.contains(range.startContainer) || !content.contains(range.endContainer) ||
        element(range.startContainer)?.closest("button,input,textarea") ||
        element(range.endContainer)?.closest("button,input,textarea")) return clear();
    const text = selection.toString().trim();
    if (!text) return clear();
    pending = text;
    if (action) return;
    action = scene.imageButton("notebookAddSelection", "조사 메모에 추가", () => {}, 306, 73);
    action.setAttribute("aria-label", "선택한 내용을 조사 메모에 추가");
    // Preserve the selected range when clicking the image button.
    action.addEventListener("pointerdown", (event) => event.preventDefault());
    action.addEventListener("click", () => {
      if (scene.closing) return;
      const snapshot = pending;
      const added = addSelectionToMemo(scene.run, snapshot, (value) =>
        window.confirm(`선택한 내용을 조사 메모에 추가할까요?\n\n${value}`));
      if (!added) return;
      clear();
      window.getSelection()?.removeAllRanges();
      status = document.createElement("div");
      status.className = "sg-selection-status";
      status.setAttribute("role", "status");
      status.textContent = "조사 메모에 추가했습니다.";
      scene.root.append(status);
      scene.content?.focus({ preventScroll: true });
    });
    action.classList.add("sg-selection-add");
    scene.root.append(action);
  };
  document.addEventListener("selectionchange", update);
  document.addEventListener("pointerup", update);
  const reset = () => clear();
  return {
    reset,
    dispose() {
      document.removeEventListener("selectionchange", update);
      document.removeEventListener("pointerup", update);
      clear();
    },
  };
}
