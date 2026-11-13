"use strict";

const ClientLayout = (() => {
  const storageKey = "arda.layout.v1";
  const client = document.querySelector(".client");
  const screen = document.querySelector(".game-screen");
  const docks = Object.fromEntries(["left", "tracking", "right"].map(id => [id, document.getElementById(`${id}-dock`)]));
  const edges = Object.fromEntries([...screen.querySelectorAll("[data-bar-edge]")].map(element => [element.dataset.barEdge, element]));
  const panels = [...client.querySelectorAll("[data-window]")];
  const bars = [...screen.querySelectorAll("[data-action-window]")];
  const byPanelId = new Map(panels.map(panel => [panel.dataset.window, panel]));
  const byBarId = new Map(bars.map(bar => [bar.dataset.actionWindow, bar]));
  const defaultOrder = Object.fromEntries(Object.entries(docks).map(([id, dock]) => [
    id, [...dock.querySelectorAll("[data-window]")].map(panel => panel.dataset.window),
  ]));
  const defaults = {
    order: defaultOrder,
    sizes: {},
    collapsed: {},
    widths: { left: 154, tracking: 154, right: 178 },
    barOrder: ["primary", "secondary"],
    bars: { primary: { edge: "left", size: 32 }, secondary: { edge: "right", size: 32 } },
    consoleHeight: 81,
  };
  const limits = {
    panel: [48, 600],
    dock: [122, 300],
    bar: [24, 52],
    console: [54, 270],
  };
  const clamp = (value, [min, max]) => Math.max(min, Math.min(max, Math.round(value)));
  const sizing = (value, range, fallback) => Number.isFinite(value) ? clamp(value, range) : fallback;
  let state = restore();
  let gesture = null;
  let editing = false;

  function restore() {
    const next = structuredClone(defaults);
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey));
      if (!saved || typeof saved !== "object") return next;
      const seen = new Set();
      for (const id of Object.keys(docks)) {
        next.order[id] = [];
        if (Array.isArray(saved.order?.[id])) {
          for (const panel of saved.order[id]) {
            if (!byPanelId.has(panel) || seen.has(panel)) continue;
            seen.add(panel);
            next.order[id].push(panel);
          }
        }
        next.widths[id] = sizing(saved.widths?.[id], limits.dock, next.widths[id]);
      }
      for (const [id, order] of Object.entries(defaultOrder)) {
        next.order[id].push(...order.filter(panel => !seen.has(panel)));
      }
      for (const id of byPanelId.keys()) {
        if (Number.isFinite(saved.sizes?.[id])) next.sizes[id] = clamp(saved.sizes[id], limits.panel);
        if (saved.collapsed?.[id] === true) next.collapsed[id] = true;
      }
      for (const id of byBarId.keys()) {
        const bar = saved.bars?.[id];
        if (Object.hasOwn(edges, bar?.edge)) next.bars[id].edge = bar.edge;
        next.bars[id].size = sizing(bar?.size, limits.bar, next.bars[id].size);
      }
      if (Array.isArray(saved.barOrder) && saved.barOrder.length === bars.length &&
          new Set(saved.barOrder).size === bars.length && saved.barOrder.every(id => byBarId.has(id))) {
        next.barOrder = saved.barOrder;
      }
      next.consoleHeight = sizing(saved.consoleHeight, limits.console, next.consoleHeight);
    } catch {
      // The default layout also works when browser storage is unavailable.
    }
    return next;
  }

  function save() {
    try { localStorage.setItem(storageKey, JSON.stringify(state)); } catch {
      // Changes can still be used in this tab.
    }
  }

  function renderPanels() {
    for (const [id, dock] of Object.entries(docks)) {
      const editor = dock.querySelector("#edit-panel");
      for (const panelId of state.order[id]) {
        const panel = byPanelId.get(panelId);
        if (editing && panelId === "map") continue;
        dock.insertBefore(panel, editor);
      }
    }
    if (editing) docks.right.prepend(byPanelId.get("map"));
  }

  function updatePanel(panel) {
    const id = panel.dataset.window;
    const collapsed = !!state.collapsed[id] && !(editing && id === "map");
    const toggle = panel.querySelector(".window-toggle");
    panel.toggleAttribute("data-collapsed", collapsed);
    panel.style.setProperty("--panel-height", !editing && state.sizes[id] && !collapsed ? `${state.sizes[id]}px` : "auto");
    toggle.setAttribute("aria-expanded", String(!collapsed));
    toggle.setAttribute("aria-label", `${collapsed ? "Expand" : "Collapse"} ${panel.querySelector("h3").textContent}`);
  }

  function renderBars() {
    for (const [edge, dock] of Object.entries(edges)) {
      const edgeBars = state.barOrder.filter(id => state.bars[id].edge === edge).map(id => byBarId.get(id));
      let thickness = 0;
      edgeBars.forEach((bar, index) => {
        if (dock.children[index] !== bar) dock.insertBefore(bar, dock.children[index] ?? null);
        const { size } = state.bars[bar.dataset.actionWindow];
        bar.style.setProperty("--action-size", `${size}px`);
        thickness += size + 8;
      });
      screen.style.setProperty(`--bar-${edge}`, `${thickness}px`);
      dock.toggleAttribute("data-empty", edgeBars.length === 0);
    }
  }

  function apply() {
    renderPanels();
    for (const panel of panels) updatePanel(panel);
    for (const [id, width] of Object.entries(state.widths)) client.style.setProperty(`--dock-${id}`, `${width}px`);
    client.style.setProperty("--console-height", `${state.consoleHeight}px`);
    renderBars();
  }

  function setEditor(value) {
    finish(null, true);
    editing = value;
    client.toggleAttribute("data-editing", value);
    for (const id of ["left-dock", "tracking-dock", "status-rail"]) document.getElementById(id).hidden = value;
    document.getElementById("reset-layout").disabled = value;
    for (const panel of panels) panel.firstElementChild.tabIndex = value ? -1 : 0;
    renderPanels();
    updatePanel(byPanelId.get("map"));
  }

  const moveGhost = document.createElement("div");
  moveGhost.className = "layout-ghost";
  moveGhost.hidden = true;
  moveGhost.setAttribute("aria-hidden", "true");
  document.body.append(moveGhost);

  function start(handle, event, operations) {
    if (editing || gesture || event.button !== 0 || !event.isPrimary) return;
    event.preventDefault();
    const pointer = event.pointerId;
    gesture = { pointer, handle, operations, moved: false, x: event.clientX, y: event.clientY };
    handle.setPointerCapture(pointer);
  }

  function clearHighlights() {
    for (const node of client.querySelectorAll("[data-layout-over]")) node.removeAttribute("data-layout-over");
  }

  document.addEventListener("pointermove", event => {
    if (!gesture || event.pointerId !== gesture.pointer) return;
    const dx = event.clientX - gesture.x;
    const dy = event.clientY - gesture.y;
    if (!gesture.moved && Math.hypot(dx, dy) < 4) return;
    gesture.moved = true;
    gesture.operations.move(event, dx, dy);
  });

  function finish(event, cancelled = false) {
    if (!gesture || (event && event.pointerId !== gesture.pointer)) return;
    const current = gesture;
    gesture = null;
    if (current.handle.hasPointerCapture(current.pointer)) current.handle.releasePointerCapture(current.pointer);
    clearHighlights();
    moveGhost.hidden = true;
    if (current.moved) {
      if (cancelled) current.operations.cancel?.();
      else {
        current.operations.commit?.(event);
        save();
      }
    }
  }

  document.addEventListener("pointerup", event => finish(event));
  document.addEventListener("pointercancel", event => finish(event, true));
  document.addEventListener("lostpointercapture", event => finish(event, true));
  window.addEventListener("blur", () => finish(null, true));
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && gesture) finish(null, true);
  });

  function ghost(event, text) {
    moveGhost.textContent = text;
    moveGhost.hidden = false;
    moveGhost.style.left = `${Math.min(event.clientX + 10, innerWidth - moveGhost.offsetWidth)}px`;
    moveGhost.style.top = `${Math.min(event.clientY + 10, innerHeight - moveGhost.offsetHeight)}px`;
  }

  function movePanel(id, dock, before = null) {
    for (const name of Object.keys(docks)) state.order[name] = state.order[name].filter(panel => panel !== id);
    const index = state.order[dock].indexOf(before);
    state.order[dock].splice(index < 0 ? state.order[dock].length : index, 0, id);
    renderPanels();
  }

  function panelDestination(event, panel) {
    const dock = document.elementFromPoint(event.clientX, event.clientY)?.closest(".dock");
    if (!dock) return null;
    const before = [...dock.querySelectorAll("[data-window]")].find(node => {
      if (node === panel || node.hidden) return false;
      const rect = node.getBoundingClientRect();
      return event.clientY < rect.top + rect.height / 2;
    });
    return { dock, before };
  }

  function resizeHandle(handle, label, read, write, delta, range, keys) {
    handle.title = label;
    handle.setAttribute("aria-label", label);
    handle.addEventListener("pointerdown", event => {
      const initial = read();
      start(handle, event, {
        move: (_, dx, dy) => write(clamp(initial + delta(dx, dy), range)),
        cancel: () => write(initial),
      });
    });
    handle.addEventListener("keydown", event => {
      if (editing || !Object.hasOwn(keys, event.key)) return;
      event.preventDefault();
      event.stopPropagation();
      write(clamp(read() + keys[event.key], range));
      save();
    });
  }

  const verticalKeys = { ArrowUp: -12, ArrowDown: 12 };
  for (const panel of panels) {
    const id = panel.dataset.window;
    const title = panel.querySelector("h3");
    const heading = panel.firstElementChild;
    title.title = "Drag to move this panel";
    heading.tabIndex = 0;
    heading.setAttribute("aria-label", `${title.textContent}. Use Alt and arrow keys to move the panel.`);
    heading.addEventListener("keydown", event => {
      if (editing || !event.altKey || event.target !== heading) return;
      const dockNames = Object.keys(docks);
      const dock = panel.parentElement.id.replace("-dock", "");
      const index = state.order[dock].indexOf(id);
      const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -1, ArrowDown: 1 }[event.key];
      if (!step) return;
      event.preventDefault();
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        const destination = dockNames[dockNames.indexOf(dock) + step];
        if (!destination) return;
        movePanel(id, destination);
      } else {
        const order = state.order[dock];
        if (!order[index + step]) return;
        movePanel(id, dock, order[index + (step > 0 ? 2 : -1)]);
      }
      heading.focus({ preventScroll: true });
      save();
    });
    heading.addEventListener("pointerdown", event => {
      if (event.target.closest("button")) return;
      start(heading, event, {
        move: current => {
          clearHighlights();
          const destination = panelDestination(current, panel);
          if (destination) (destination.before ?? destination.dock).setAttribute("data-layout-over", "");
          ghost(current, title.textContent);
        },
        commit: current => {
          const destination = panelDestination(current, panel);
          if (!destination) return;
          const name = destination.dock.id.replace("-dock", "");
          movePanel(id, name, destination.before?.dataset.window);
        },
      });
    });
    const content = document.createElement("div");
    content.className = "panel-content";
    while (heading.nextElementSibling) content.append(heading.nextElementSibling);
    panel.append(content);
    const toggle = document.createElement("button");
    toggle.className = "window-toggle";
    toggle.type = "button";
    toggle.addEventListener("click", () => {
      state.collapsed[id] = !state.collapsed[id];
      updatePanel(panel);
      save();
    });
    heading.append(toggle);
    const handle = document.createElement("button");
    handle.className = "panel-resize";
    handle.type = "button";
    resizeHandle(handle, `Resize ${title.textContent}`, () => panel.offsetHeight, height => {
      state.sizes[id] = height;
      updatePanel(panel);
    }, (_, dy) => dy, limits.panel, verticalKeys);
    panel.append(handle);
  }

  for (const [id, dock] of Object.entries(docks)) {
    const handle = document.createElement("button");
    handle.type = "button";
    handle.className = "dock-resize";
    const sign = id === "left" ? 1 : -1;
    resizeHandle(handle, `Resize ${id} sidebar`, () => state.widths[id], width => {
      state.widths[id] = width;
      client.style.setProperty(`--dock-${id}`, `${width}px`);
    }, dx => dx * sign, limits.dock, { ArrowLeft: -12 * sign, ArrowRight: 12 * sign });
    dock.prepend(handle);
  }

  function barEdge(event) {
    const dock = document.elementFromPoint(event.clientX, event.clientY)?.closest("[data-bar-edge]");
    if (dock) return dock.dataset.barEdge;
    const viewport = screen.querySelector(".viewport").getBoundingClientRect();
    const gaps = {
      left: Math.abs(event.clientX - viewport.left),
      right: Math.abs(event.clientX - viewport.right),
      top: Math.abs(event.clientY - viewport.top),
      bottom: Math.abs(event.clientY - viewport.bottom),
    };
    const nearest = Object.keys(gaps).reduce((best, edge) => gaps[edge] < gaps[best] ? edge : best);
    return gaps[nearest] <= 65 ? nearest : null;
  }

  for (const bar of bars) {
    const id = bar.dataset.actionWindow;
    const name = id === "primary" ? "F1–F6" : "F7–F12";
    const grip = document.createElement("button");
    grip.type = "button";
    grip.className = "bar-grip";
    grip.title = "Drag to dock this action bar on another edge";
    grip.setAttribute("aria-label", `Move ${name} action bar`);
    grip.textContent = "⋮";
    grip.addEventListener("pointerdown", event => start(grip, event, {
      move: current => {
        clearHighlights();
        const edge = barEdge(current);
        if (edge) screen.dataset.barOver = edge;
        else delete screen.dataset.barOver;
        const destination = document.elementFromPoint(current.clientX, current.clientY)?.closest("[data-action-window]");
        if (destination && destination !== bar) destination.setAttribute("data-layout-over", "");
        ghost(current, name);
      },
      commit: current => {
        delete screen.dataset.barOver;
        const edge = barEdge(current);
        if (!edge) return;
        state.bars[id].edge = edge;
        const destination = document.elementFromPoint(current.clientX, current.clientY)?.closest("[data-action-window]");
        if (destination && destination !== bar) {
          const other = destination.dataset.actionWindow;
          const rect = destination.getBoundingClientRect();
          const horizontal = edge === "top" || edge === "bottom" || matchMedia("(max-width: 760px)").matches;
          const after = horizontal ? current.clientY >= rect.top + rect.height / 2 :
            current.clientX >= rect.left + rect.width / 2;
          state.barOrder = state.barOrder.filter(entry => entry !== id);
          state.barOrder.splice(state.barOrder.indexOf(other) + Number(after), 0, id);
        }
        renderBars();
      },
      cancel: () => { delete screen.dataset.barOver; },
    }));
    grip.addEventListener("keydown", event => {
      const edge = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "top", ArrowDown: "bottom" }[event.key];
      if (editing || !edge) return;
      event.preventDefault();
      event.stopPropagation();
      state.bars[id].edge = edge;
      renderBars();
      grip.focus();
      save();
    });
    bar.prepend(grip);
    const handle = document.createElement("button");
    handle.type = "button";
    handle.className = "bar-resize";
    resizeHandle(handle, `Resize ${name} action bar`, () => state.bars[id].size, size => {
      state.bars[id].size = size;
      renderBars();
    }, (dx, dy) => {
      const edge = state.bars[id].edge;
      if (matchMedia("(max-width: 760px)").matches) return dy;
      return { left: dx, right: -dx, top: dy, bottom: -dy }[edge];
    }, limits.bar, { ArrowLeft: -4, ArrowDown: -4, ArrowUp: 4, ArrowRight: 4 });
    bar.append(handle);
  }

  const divider = document.createElement("button");
  divider.type = "button";
  document.getElementById("console-divider").append(divider);
  resizeHandle(divider, "Resize game console", () => state.consoleHeight, height => {
    state.consoleHeight = height;
    client.style.setProperty("--console-height", `${height}px`);
  }, (_, dy) => -dy, limits.console, { ArrowUp: 12, ArrowDown: -12 });

  document.getElementById("reset-layout").addEventListener("click", () => {
    finish(null, true);
    state = structuredClone(defaults);
    apply();
    save();
  });

  apply();
  return { setEditor };
})();
