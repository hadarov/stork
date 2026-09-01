type Child = Node | string | number | null | undefined | false;

type Props = Record<string, unknown>;

/**
 * Children are only ever appended as text nodes, never as markup, so a baby's
 * name or notes cannot inject anything no matter what is typed or imported.
 */
function appendChildren(node: Node, children: Child[]): void {
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    node.appendChild(
      child instanceof Node ? child : document.createTextNode(String(child)),
    );
  }
}

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Props = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);

  for (const [key, value] of Object.entries(props)) {
    if (value === null || value === undefined || value === false) continue;

    if (key.startsWith("on") && typeof value === "function") {
      node.addEventListener(key.slice(2).toLowerCase(), value as EventListener);
    } else if (key === "class") {
      node.className = String(value);
    } else if (key === "dataset") {
      Object.assign(node.dataset, value as Record<string, string>);
    } else if (key === "value" || key === "checked" || key === "disabled") {
      // These have to be set as properties or the DOM ignores later changes.
      Reflect.set(node, key, value);
    } else {
      node.setAttribute(key, value === true ? "" : String(value));
    }
  }

  appendChildren(node, children);
  return node;
}

export function fragment(...children: Child[]): DocumentFragment {
  const frag = document.createDocumentFragment();
  appendChildren(frag, children);
  return frag;
}

export function clear(node: Node): void {
  while (node.firstChild) node.removeChild(node.firstChild);
}

export function replace(node: Node, ...children: Child[]): void {
  clear(node);
  appendChildren(node, children);
}

/** Downloads a generated file without needing a server round trip. */
export function downloadFile(filename: string, mimeType: string, contents: string): void {
  downloadBlob(filename, new Blob([contents], { type: `${mimeType};charset=utf-8` }));
}

export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = el("a", { href: url, download: filename });
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoking immediately can cancel the download on some mobile browsers.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
