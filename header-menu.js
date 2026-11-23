(() => {
  const nav = document.querySelector(".nav");
  const highlight = nav.querySelector(".nav-highlight");
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

  function spring(value, stiffness, damping) {
    return { value, target: value, velocity: 0, stiffness, damping };
  }

  function settle(state) {
    state.value = state.target;
    state.velocity = 0;
  }

  function advance(state, seconds) {
    const dt = seconds / 4;
    for (let step = 0; step < 4; step++) {
      const force = state.stiffness * (state.target - state.value) - state.damping * state.velocity;
      state.velocity += force * dt;
      state.value += state.velocity * dt;
    }

    const moving = Math.abs(state.target - state.value) > 0.01 || Math.abs(state.velocity) > 0.01;
    if (!moving) settle(state);
    return moving;
  }

  // Stiffness and damping from the Bottom Bar reference.
  const items = Array.from(nav.querySelectorAll(".nav-item"), (element) => ({
    element,
    label: element.querySelector(".nav-label"),
    text: element.querySelector(".nav-label-text"),
    icon: element.querySelector(".nav-icon"),
    labelWidth: spring(0, 300, 26),
    iconScale: spring(1, 520, 14),
  }));
  const highlightX = spring(0, 340, 28);
  const highlightWidth = spring(0, 340, 28);
  const itemSprings = items.flatMap(item => [item.labelWidth, item.iconScale]);

  let selected = items.find(item => item.element.hasAttribute("data-selected"));
  let frameId = 0;
  let lastFrame;

  function paintItems() {
    // Fade in the whole label near full width, within the item's 12px end padding.
    const fadeDistance = 8;
    for (const { label, fullWidth, icon, labelWidth, iconScale } of items) {
      const width = Math.max(0, labelWidth.value);
      const reveal = Math.min(1, Math.max(0, 1 - (fullWidth - width) / fadeDistance));
      label.style.inlineSize = `${width}px`;
      label.style.opacity = reveal;
      icon.style.transform = `scale(${iconScale.value})`;
    }
  }

  function measureHighlight() {
    const item = selected.element.getBoundingClientRect();
    highlightX.target = item.left - nav.getBoundingClientRect().left;
    highlightWidth.target = item.width;
  }

  function paintHighlight() {
    highlight.style.transform = `translateX(${highlightX.value}px)`;
    highlight.style.inlineSize = `${highlightWidth.value}px`;
  }

  function measureLabels() {
    for (const item of items) {
      item.fullWidth = item.text.getBoundingClientRect().width;
      item.labelWidth.target = item === selected ? item.fullWidth : 0;
    }
  }

  function snapToSelection() {
    cancelAnimationFrame(frameId);
    frameId = 0;
    measureLabels();
    itemSprings.forEach(settle);
    paintItems();
    measureHighlight();
    settle(highlightX);
    settle(highlightWidth);
    paintHighlight();
  }

  function frame(now) {
    const seconds = Math.min(Math.max(0, (now - lastFrame) / 1000), 1 / 30);
    lastFrame = now;
    let itemsMoving = false;
    for (const state of itemSprings) {
      const moving = advance(state, seconds);
      itemsMoving ||= moving;
    }
    paintItems();
    measureHighlight();
    const positionMoving = advance(highlightX, seconds);
    const widthMoving = advance(highlightWidth, seconds);
    paintHighlight();
    frameId = itemsMoving || positionMoving || widthMoving ? requestAnimationFrame(frame) : 0;
  }

  function select(item) {
    selected.element.removeAttribute("data-selected");
    selected = item;
    selected.element.setAttribute("data-selected", "");
    for (const tab of items) {
      tab.labelWidth.target = tab === selected ? tab.fullWidth : 0;
    }

    if (reducedMotion.matches) {
      snapToSelection();
      return;
    }

    selected.iconScale.value = 0.72;
    selected.iconScale.velocity = 6;
    if (!frameId) {
      lastFrame = performance.now();
      frameId = requestAnimationFrame(frame);
    }
  }

  for (const item of items) {
    item.element.addEventListener("click", () => select(item));
  }
  const sections = items.map(item => ({
    item,
    section: document.getElementById(item.element.hash.slice(1)),
  })).reverse();
  let visibleSection = items[0];
  let sectionFrame = 0;

  function updateSection() {
    sectionFrame = 0;
    const next = sections.find(({ section }) => section.getBoundingClientRect().top <= innerHeight * 0.8)?.item ?? items[0];
    if (next === visibleSection) return;
    visibleSection.element.removeAttribute("aria-current");
    visibleSection = next;
    next.element.setAttribute("aria-current", "location");
    if (next !== selected) select(next);
  }

  function scheduleSection() {
    if (!sectionFrame) sectionFrame = requestAnimationFrame(updateSection);
  }

  window.addEventListener("scroll", scheduleSection, { passive: true });
  window.addEventListener("resize", scheduleSection);
  window.addEventListener("pageshow", scheduleSection);
  window.addEventListener("resize", snapToSelection);
  reducedMotion.addEventListener("change", snapToSelection);
  nav.classList.add("is-enhanced");
  snapToSelection();
  updateSection();
})();
