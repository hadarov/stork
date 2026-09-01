/*
 * The smallest DOM that will run the screens.
 *
 * There is no browser and no test framework available here, but rendering is
 * the half of the app the pure-function tests cannot reach, so this provides
 * just enough of `document` for the screens to build their trees and be read
 * back. It implements what src/ui actually uses and nothing else.
 */

class ClassList {
  #node;

  constructor(node) {
    this.#node = node;
  }

  #set() {
    return new Set(this.#node.className.split(/\s+/).filter(Boolean));
  }

  #write(set) {
    this.#node.className = [...set].join(" ");
  }

  add(...names) {
    const set = this.#set();
    for (const name of names) set.add(name);
    this.#write(set);
  }

  remove(...names) {
    const set = this.#set();
    for (const name of names) set.delete(name);
    this.#write(set);
  }

  contains(name) {
    return this.#set().has(name);
  }

  toggle(name, force) {
    const on = force ?? !this.contains(name);
    if (on) this.add(name);
    else this.remove(name);
    return on;
  }
}

/** The app tests `child instanceof Node`, so the hierarchy has to be real. */
class StubBaseNode {
  constructor() {
    this.parentNode = null;
  }
}

class StubText extends StubBaseNode {
  constructor(text) {
    super();
    this.nodeType = 3;
    this.data = String(text);
  }

  get textContent() {
    return this.data;
  }
}

class StubNode extends StubBaseNode {
  constructor(tagName) {
    super();
    this.nodeType = 1;
    this.tagName = tagName.toUpperCase();
    this.childNodes = [];
    this.parentNode = null;
    this.attributes = new Map();
    this.listeners = new Map();
    this.dataset = {};
    this.style = {};
    this.className = "";
    this.classList = new ClassList(this);
  }

  /* ------------------------------------------------------------ children */

  get children() {
    return this.childNodes.filter((child) => child.nodeType === 1);
  }

  get firstChild() {
    return this.childNodes[0] ?? null;
  }

  appendChild(child) {
    child.parentNode?.removeChild(child);
    child.parentNode = this;
    this.childNodes.push(child);
    return child;
  }

  append(...children) {
    for (const child of children) this.#insert(child, this.childNodes.length);
  }

  prepend(...children) {
    let at = 0;
    for (const child of children) this.#insert(child, at++);
  }

  #insert(child, index) {
    const node = typeof child === "object" && child?.nodeType ? child : new StubText(child);
    if (node instanceof StubFragment) {
      const moving = [...node.childNodes];
      node.childNodes.length = 0;
      let at = index;
      for (const item of moving) this.#insert(item, at++);
      return;
    }
    node.parentNode?.removeChild(node);
    node.parentNode = this;
    this.childNodes.splice(index, 0, node);
  }

  removeChild(child) {
    const index = this.childNodes.indexOf(child);
    if (index >= 0) this.childNodes.splice(index, 1);
    child.parentNode = null;
    return child;
  }

  remove() {
    this.parentNode?.removeChild(this);
  }

  replaceChildren(...children) {
    for (const child of [...this.childNodes]) this.removeChild(child);
    this.append(...children);
  }

  /* ---------------------------------------------------------- attributes */

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  hasAttribute(name) {
    return this.attributes.has(name);
  }

  removeAttribute(name) {
    this.attributes.delete(name);
  }

  /** Reflected the way a browser reflects it, since the app sets both ways. */
  get hidden() {
    return this.attributes.has("hidden");
  }

  set hidden(value) {
    if (value) this.setAttribute("hidden", "");
    else this.removeAttribute("hidden");
  }

  /* -------------------------------------------------------------- content */

  get textContent() {
    return this.childNodes.map((child) => child.textContent).join("");
  }

  set textContent(value) {
    this.childNodes.length = 0;
    if (value !== "") this.appendChild(new StubText(value));
  }

  /* ------------------------------------------------------------- queries */

  #matches(selector) {
    if (selector.startsWith(".")) return this.classList.contains(selector.slice(1));
    return this.tagName === selector.toUpperCase();
  }

  querySelectorAll(selector) {
    const found = [];
    for (const child of this.children) {
      if (child.#matches(selector)) found.push(child);
      found.push(...child.querySelectorAll(selector));
    }
    return found;
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] ?? null;
  }

  /* -------------------------------------------------------------- events */

  addEventListener(type, handler) {
    const existing = this.listeners.get(type) ?? [];
    existing.push(handler);
    this.listeners.set(type, existing);
  }

  dispatch(type, event = {}) {
    const payload = { type, target: this, currentTarget: this, preventDefault() {}, ...event };
    const results = [];
    for (const handler of this.listeners.get(type) ?? []) results.push(handler(payload));
    return Promise.all(results);
  }

  click() {
    return this.dispatch("click");
  }

  scrollIntoView() {}
}

class StubFragment extends StubNode {
  constructor() {
    super("#fragment");
    this.nodeType = 11;
  }
}

/**
 * A hash-only history, so the router can be driven the way a person drives it:
 * assign to location.hash to go somewhere, call history.back() to come back.
 */
function makeHistory(emit) {
  const stack = ["#/"];

  return {
    location: {
      get hash() {
        return stack[stack.length - 1];
      },
      set hash(value) {
        if (stack[stack.length - 1] === value) return;
        stack.push(value);
        emit("hashchange");
      },
    },
    history: {
      back() {
        if (stack.length > 1) {
          stack.pop();
          emit("hashchange");
        }
      },
    },
    depth: () => stack.length,
  };
}

/** Installs the globals the screens reach for. Returns a teardown function. */
export function installDom() {
  const body = new StubNode("body");

  const documentListeners = new Map();

  const document = {
    body,
    createElement: (tag) => new StubNode(tag),
    createTextNode: (text) => new StubText(text),
    createDocumentFragment: () => new StubFragment(),
    getElementById: () => null,
    hidden: false,
    addEventListener: (type, handler) => {
      const existing = documentListeners.get(type) ?? [];
      existing.push(handler);
      documentListeners.set(type, existing);
    },
    dispatchEvent: (event) => {
      for (const handler of documentListeners.get(event.type) ?? []) handler(event);
    },
  };

  const windowListeners = new Map();
  const emit = (type) => {
    for (const handler of windowListeners.get(type) ?? []) handler({ type });
  };

  const window = {
    addEventListener: (type, handler) => {
      const existing = windowListeners.get(type) ?? [];
      existing.push(handler);
      windowListeners.set(type, existing);
    },
    dispatchEvent: (event) => emit(typeof event === "string" ? event : event.type),
    scrollTo: () => {},
  };

  const { location, history } = makeHistory(emit);

  const previous = new Map();
  const set = (name, value) => {
    previous.set(name, globalThis[name]);
    globalThis[name] = value;
  };

  set("document", document);
  set("Node", StubBaseNode);
  set("window", window);
  set("location", location);
  set("history", history);
  set("alert", () => {});
  set("Blob", class Blob {});
  set("URL", Object.assign(globalThis.URL, {
    createObjectURL: () => "blob:stub",
    revokeObjectURL: () => {},
  }));

  return () => {
    for (const [name, value] of previous) globalThis[name] = value;
  };
}

/** All the text in a rendered tree, for asserting on what a person would see. */
export function textOf(node) {
  return node.textContent.replace(/\s+/g, " ").trim();
}

/** Every element in a tree carrying the given class. */
export function byClass(node, className) {
  return node.querySelectorAll(`.${className}`);
}
