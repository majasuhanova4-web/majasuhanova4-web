(() => {
  const section = document.querySelector(".about");
  const intro = section.querySelector(".about-intro");
  const scene = intro.querySelector(".about-scene");
  const details = section.querySelector(".about-details");
  const resume = details.querySelector(".about-resume");
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  let frame = 0;

  function paint() {
    frame = 0;
    const distance = intro.offsetHeight - scene.offsetHeight;
    const scroll = -intro.getBoundingClientRect().top;
    const progress = distance > 0 && !reducedMotion.matches ? Math.max(0, Math.min(1, scroll / distance)) : 0;
    section.style.setProperty("--about-progress", progress);
    if (reducedMotion.matches || (progress >= 0.6 && details.getBoundingClientRect().top < innerHeight - 32)) {
      details.classList.add("is-revealed");
    }
  }

  function schedule() {
    if (!frame) frame = requestAnimationFrame(paint);
  }

  resume.addEventListener("pointerdown", event => {
    if (event.pointerType === "touch") resume.classList.add("is-pressed");
  });
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) {
    resume.addEventListener(type, () => resume.classList.remove("is-pressed"));
  }

  section.classList.add("is-animated");
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule);
  window.addEventListener("pageshow", schedule);
  reducedMotion.addEventListener("change", schedule);
  paint();
})();
