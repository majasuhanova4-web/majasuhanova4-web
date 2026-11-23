(() => {
  if (!("IntersectionObserver" in window)) return;

  const observer = new IntersectionObserver(entries => {
    for (const { target, isIntersecting } of entries) {
      if (!isIntersecting) continue;
      target.classList.add("is-revealed");
      observer.unobserve(target);
    }
  }, { rootMargin: "0px 0px -8% 0px" });

  document.documentElement.classList.add("has-backdrop-motion");
  document.querySelectorAll("[data-backdrop-reveal]").forEach(element => observer.observe(element));
})();
