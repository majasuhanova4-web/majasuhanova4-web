const hero = document.querySelector(".hero");
const viewport = hero.querySelector(".viewport");
const covers = Array.from(hero.querySelectorAll(".cover")).reverse();
const link = hero.querySelector(".project-link");
const projectTitle = hero.querySelector(".project-title");
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

// These positions come from the supplied 1440 × 722 frame.
const stack = [
  { top: 360.5, size: 235, blur: 0, opacity: 1, shift: 0 },
  { top: 206, size: 107, blur: 1, opacity: 1, shift: 0 },
  { top: 186.5, size: 87, blur: 2, opacity: 0.9, shift: 0 },
  { top: 169, size: 75, blur: 3, opacity: 0.9, shift: 0 },
  { top: 155, size: 65, blur: 4, opacity: 0.75, shift: 0 },
];
const outgoing = { top: 445, size: 175, blur: 3, opacity: 0, shift: -115 };

let current = -1;
let scheduled = false;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const interpolate = (from, to, amount) => from + (to - from) * amount;

function update() {
  scheduled = false;

  const distance = Math.max(0, -hero.getBoundingClientRect().top);
  const stepHeight = Math.min(viewport.clientHeight * 0.62, 512);
  const progress = clamp(distance / stepHeight, 0, covers.length - 1);
  const selected = Math.round(progress);
  const position = reducedMotion.matches ? selected : progress;

  covers.forEach((cover, index) => {
    const depth = index - position;
    const lower = Math.floor(depth);
    const from = stack[lower] ?? outgoing;
    const to = stack[lower + 1] ?? from;
    const amount = depth - lower;
    const mix = (property) => interpolate(from[property], to[property], amount);

    cover.style.setProperty("--size", mix("size"));
    cover.style.setProperty("--top", mix("top"));
    cover.style.setProperty("--blur", `${mix("blur")}px`);
    cover.style.setProperty("--opacity", mix("opacity"));
    cover.style.setProperty("--shift", mix("shift"));
    cover.style.setProperty("--layer", index <= selected ? 10 - index : 4 + selected - index);
  });

  if (current !== selected) {
    hero.querySelector(".cover.is-active")?.classList.remove("is-active");
    current = selected;
    const activeCover = covers[current];
    activeCover.classList.add("is-active");
    projectTitle.textContent = activeCover.dataset.title;

    const projectUrl = activeCover.dataset.projectUrl?.trim();
    if (projectUrl) {
      link.setAttribute("href", projectUrl);
      link.removeAttribute("aria-disabled");
    } else {
      link.removeAttribute("href");
      link.setAttribute("aria-disabled", "true");
    }
  }
}

function scheduleUpdate() {
  if (!scheduled) {
    scheduled = true;
    requestAnimationFrame(update);
  }
}

hero.classList.add("is-animated");
window.addEventListener("scroll", scheduleUpdate, { passive: true });
window.addEventListener("resize", scheduleUpdate);
window.addEventListener("pageshow", scheduleUpdate);
reducedMotion.addEventListener("change", scheduleUpdate);
update();
