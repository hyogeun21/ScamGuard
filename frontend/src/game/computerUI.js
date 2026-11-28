import layout from "./computer-layout.json" with { type: "json" };
import { resolveComputerPage, followComputerAction, computerBack } from "./computerContent";
import { rememberOnce } from "./state";
export const COMPUTER_LAYOUT = layout;
function element(tag, className, text) {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function action(s, label, callback, className = "sg-com-action") {
  const button = element("button", className, label);
  button.type = "button";
  button.addEventListener("click", () => { if (!s.closing) callback(); });
  return button;
}
function place(node, rect) {
  Object.assign(node.style, { left: `${rect.x}px`, top: `${rect.y}px`, width: `${rect.width}px`, height: `${rect.height}px` });
}
export function renderComputerPanel(s) {
  const graph = s.computerGraph;
  const page = resolveComputerPage(graph, s.computerPageId);
  const rootPage = resolveComputerPage(graph, graph.root);
  const selected = s.computerPageId !== graph.root;
  if (s.run) rememberOnce(s.run.computerPages, s.computerPageId);
  Object.assign(s.root.style, {
    display: "block", width: `${layout.panel.width}px`, height: `${layout.panel.height}px`,
    padding: "0", backgroundImage: 'url("/assets/compopup.png")',
  });
  s.dom.setPosition(960, 600);
  const bar = element("header", "sg-com-browser-bar");
  s.title = element("h2", "sg-com-browser-title", rootPage.title);
  s.title.id = "sg-dialog-title";
  const close = action(s, "×", () => s.close(), "sg-com-close");
  close.setAttribute("aria-label", "컴퓨터 창 닫기");
  Object.assign(close.style, { right: `${layout.close.right}px`, top: `${layout.close.top}px`, width: `${layout.close.size}px`, height: `${layout.close.size}px` });
  bar.append(s.title, close);
  const left = element("nav", "sg-com-list");
  left.setAttribute("aria-label", "컴퓨터 조사 항목");
  place(left, layout.left);
  left.append(element("h3", "sg-com-list-title", "조사 항목"));
  const options = element("div", "sg-com-list-options");
  const navigate = (id, category = s.computerCategoryId) => {
    resolveComputerPage(graph, id);
    s.computerPageId = id;
    s.computerCategoryId = id === graph.root ? null : category;
    s.render();
  };
  rootPage.actions.forEach((entry, index) => {
    const button = action(s, entry.label, () => navigate(followComputerAction(graph, graph.root, index), entry.target), "sg-com-category");
    button.setAttribute("aria-pressed", String(s.computerCategoryId === entry.target));
    button.dataset.pageId = entry.target;
    options.append(button);
  });
  left.append(options);
  const right = element("section", "sg-com-detail");
  right.setAttribute("aria-label", "조사 세부사항");
  place(right, layout.right);
  const detailTitle = selected ? page.title : "조사 항목을 선택하세요";
  const heading = element("h3", "sg-com-detail-title", detailTitle);
  heading.setAttribute("aria-live", "polite");
  s.content = element("div", "sg-content sg-com-body");
  s.content.tabIndex = 0;
  s.content.setAttribute("aria-label", "컴퓨터 조사 세부내용");
  s.footer = element("footer", "sg-com-detail-footer");
  s.content.append(element("div", "sg-com-prose", selected ? page.body : "좌측에서 회사 정보나 조사할 항목을 선택하면 세부내용이 표시됩니다."));
  if (selected) {
    // Only the existing v3 graph supplies transitions; no extra question branch.
    page.actions.forEach((entry, index) => s.content.append(action(s, entry.label,
      () => navigate(followComputerAction(graph, s.computerPageId, index)), "sg-com-question")));
    const back = computerBack(graph, s.computerPageId);
    if (back !== null) s.footer.append(action(s, "뒤로가기", () => navigate(back)));
  }
  right.append(heading, s.content, s.footer);
  s.root.append(bar, left, right);
  s.dom.updateSize();
  s.focusFrame = requestAnimationFrame(() => {
    if (!s.root.isConnected) return;
    (options.querySelector('[aria-pressed="true"]') ?? options.querySelector("button"))?.focus({ preventScroll: true });
  });
}
