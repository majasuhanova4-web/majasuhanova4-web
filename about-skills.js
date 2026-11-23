/*
 * Rounded-pill collision and drag solver adapted from Animorio's Skill Pills Tray.
 * https://animorio.com/en/animations/designer-profile-with-skills-in-a-tray-that-tilts/
 * Used under https://animorio.com/en/license/
 */
(() => {
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

  function setup(well) {
    const tray = well.querySelector(".skill-tray");
    const bodies = Array.from(tray.children, (el) => ({
      el, label: el.firstElementChild, alive: false,
      x: 0, y: 0, a: 0, vx: 0, vy: 0, va: 0, sq: 0, sqv: 0,
    }));
    const STEP = 1 / 120;
    const ITER = 10;
    const SLOP = 0.6;
    const GRAVITY = 1;
    const BOUNCE = 0.28;
    const FRICTION = 0.16;
    const FLOOR_GRIP = 0.7;
    const SQUASH = 0.6;
    const INSET = 6;
    const DROP_GAP = 0.14;

    let W = 0;
    let H = 0;
    let CEIL = 0;
    let g = 0;
    let gv = 0;
    let gTarget = 0;
    let held = null;
    let age = 0;
    let accum = 0;
    let frameId = 0;
    let lastFrame = 0;
    let visible = false;

    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
    const look = () => clamp(g * 0.55, -4.5, 4.5);

    function measure() {
      const oldW = W;
      const oldH = H;
      W = Math.max(1, tray.clientWidth - 2 * INSET);
      H = Math.max(1, tray.clientHeight - 2 * INSET);
      CEIL = H * 0.9;
      for (const b of bodies) {
        b.w = b.el.offsetWidth;
        b.h = b.el.offsetHeight;
        b.r = b.h / 2;
        b.hl = Math.max(0, (b.w - b.h) / 2);
        const mass = (b.w * b.h) / 1000;
        b.im = 1 / mass;
        b.ii = 1 / ((mass * (b.w * b.w + b.h * b.h)) / 12 * 2.2);
        if (b.alive) {
          const halfWidth = b.r + b.hl;
          b.x = clamp(b.x * W / oldW, halfWidth, W - halfWidth);
          b.y *= H / oldH;
        }
      }
    }

    function closestOnSeg(px, py, ax, ay, bx, by) {
      const dx = bx - ax, dy = by - ay;
      const L = dx * dx + dy * dy;
      let t = L > 1e-6 ? ((px - ax) * dx + (py - ay) * dy) / L : 0;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      return [ax + dx * t, ay + dy * t];
    }

    function ends(b) {
      const c = Math.cos(b.a) * b.hl, s = Math.sin(b.a) * b.hl;
      return [b.x - c, b.y - s, b.x + c, b.y + s];
    }

    /* contacts: { A, B (null = wall), nx, ny (from A to B), px, py, pen } */
    function collide(out) {
      const live = bodies.filter((b) => b.alive);
      for (let i = 0; i < live.length; i++) {
        const A = live[i];
        const [a1x, a1y, a2x, a2y] = ends(A);
        /* the walls: each end of the segment is a circle */
        for (let k = 0; k < 2; k++) {
          const ex = k ? a2x : a1x, ey = k ? a2y : a1y;
          if (ey + A.r > H - 0.5) out.push({ A, B: null, nx: 0, ny: 1, px: ex, py: H, pen: ey + A.r - H });
          if (ex - A.r < 0.5 && ey > -CEIL) out.push({ A, B: null, nx: -1, ny: 0, px: 0, py: ey, pen: A.r - ex });
          if (ex + A.r > W - 0.5) out.push({ A, B: null, nx: 1, ny: 0, px: W, py: ey, pen: ex + A.r - W });
          if (ey - A.r < -CEIL) out.push({ A, B: null, nx: 0, ny: -1, px: ex, py: -CEIL, pen: -CEIL - (ey - A.r) });
        }
        for (let j = i + 1; j < live.length; j++) {
          const B = live[j];
          const R = A.r + B.r;
          const dx0 = B.x - A.x, dy0 = B.y - A.y;
          const reach = R + A.hl + B.hl;
          if (dx0 * dx0 + dy0 * dy0 > reach * reach) continue;
          const [b1x, b1y, b2x, b2y] = ends(B);
          /* probes: every end against the other segment, and the middle of each against the other */
          const probes = [];
          const probe = (px, py, fromA) => {
            const [qx, qy] = fromA ? closestOnSeg(px, py, b1x, b1y, b2x, b2y) : closestOnSeg(px, py, a1x, a1y, a2x, a2y);
            const ax = fromA ? px : qx, ay = fromA ? py : qy;
            const bx = fromA ? qx : px, by = fromA ? qy : py;
            const dx = bx - ax, dy = by - ay;
            const d = Math.hypot(dx, dy);
            if (d < R + 0.5) probes.push({ d, ax, ay, bx, by, dx, dy });
          };
          probe(a1x, a1y, true); probe(a2x, a2y, true); probe(A.x, A.y, true);
          probe(b1x, b1y, false); probe(b2x, b2y, false); probe(B.x, B.y, false);
          if (!probes.length) continue;
          probes.sort((p, q) => p.d - q.d);
          const keep = [probes[0]];
          for (let k = 1; k < probes.length && keep.length < 2; k++) {
            const p = probes[k];
            const far = Math.hypot(p.ax - keep[0].ax, p.ay - keep[0].ay) > Math.min(A.r, B.r) * 0.8;
            if (far) keep.push(p);
          }
          keep.forEach((p) => {
            let nx, ny;
            if (p.d > 1e-4) { nx = p.dx / p.d; ny = p.dy / p.d; } else {
              const l = Math.hypot(dx0, dy0) || 1; nx = dx0 / l; ny = dy0 / l;
            }
            const pen = R - p.d;
            out.push({ A, B, nx, ny, px: p.ax + nx * (A.r - pen / 2), py: p.ay + ny * (A.r - pen / 2), pen });
          });
        }
      }
    }

    function step(dt) {
      const rad = (g * Math.PI) / 180;
      const G = 1700 * GRAVITY;
      const gx = Math.sin(rad) * G, gy = Math.cos(rad) * G;
      const damp = Math.pow(0.9985, dt * 60), dampA = Math.pow(0.985, dt * 60);
      bodies.forEach((b) => {
        if (!b.alive) return;
        b.vx = (b.vx + gx * dt) * damp;
        b.vy = (b.vy + gy * dt) * damp;
        b.va *= dampA;
      });
      const cs = [];
      collide(cs);
      /* the restitution is decided once, from the speed before the solve */
      cs.forEach((c) => {
        const A = c.A, B = c.B;
        c.rax = c.px - A.x; c.ray = c.py - A.y;
        c.rbx = B ? c.px - B.x : 0; c.rby = B ? c.py - B.y : 0;
        const ran = c.rax * c.ny - c.ray * c.nx;
        const rbn = c.rbx * c.ny - c.rby * c.nx;
        c.kn = A.im + A.ii * ran * ran + (B ? B.im + B.ii * rbn * rbn : 0);
        const tx = -c.ny, ty = c.nx;
        const rat = c.rax * ty - c.ray * tx;
        const rbt = c.rbx * ty - c.rby * tx;
        c.kt = A.im + A.ii * rat * rat + (B ? B.im + B.ii * rbt * rbt : 0);
        const vn = relN(c);
        c.bias = vn < -80 ? -BOUNCE * vn : 0;
        c.jn = 0; c.jt = 0;
        if (vn < -380 && SQUASH > 0) {
          const s = Math.min(1, -vn / 1500) * SQUASH;
          A.sq = Math.max(A.sq, s); A.sqv = 0;
          if (B) { B.sq = Math.max(B.sq, s * 0.7); B.sqv = 0; }
        }
      });
      for (let it = 0; it < ITER; it++) {
        cs.forEach(solve);
        if (held) solveHeld(dt);
      }
      bodies.forEach((b) => {
        if (!b.alive) return;
        const sp = Math.hypot(b.vx, b.vy);
        if (sp > 3200) { b.vx *= 3200 / sp; b.vy *= 3200 / sp; }
        if (b.va > 30) b.va = 30; else if (b.va < -30) b.va = -30;
        b.x += b.vx * dt; b.y += b.vy * dt; b.a += b.va * dt;
      });
      /* push apart what still overlaps: positions only, twice */
      for (let k = 0; k < 2; k++) {
        const ps = [];
        collide(ps);
        ps.forEach((c) => {
          const corr = Math.max(0, c.pen - SLOP) * 0.45;
          if (!corr) return;
          const A = c.A, B = c.B;
          const tot = A.im + (B ? B.im : 0);
          A.x -= c.nx * corr * (A.im / tot); A.y -= c.ny * corr * (A.im / tot);
          if (B) { B.x += c.nx * corr * (B.im / tot); B.y += c.ny * corr * (B.im / tot); }
        });
      }

    }

    function relN(c) {
      const A = c.A, B = c.B;
      let vx = -(A.vx - A.va * c.ray), vy = -(A.vy + A.va * c.rax);
      if (B) { vx += B.vx - B.va * c.rby; vy += B.vy + B.va * c.rbx; }
      return vx * c.nx + vy * c.ny;
    }

    function apply(b, jx, jy, rx, ry, sign) {
      b.vx += sign * jx * b.im; b.vy += sign * jy * b.im;
      b.va += sign * (rx * jy - ry * jx) * b.ii;
    }

    function solve(c) {
      const A = c.A, B = c.B;
      /* normal */
      const vn = relN(c);
      let j = (-vn + c.bias) / c.kn;
      const old = c.jn;
      c.jn = Math.max(0, old + j);
      j = c.jn - old;
      apply(A, c.nx * j, c.ny * j, c.rax, c.ray, -1);
      if (B) apply(B, c.nx * j, c.ny * j, c.rbx, c.rby, 1);
      /* friction */
      const tx = -c.ny, ty = c.nx;
      let vx = -(A.vx - A.va * c.ray), vy = -(A.vy + A.va * c.rax);
      if (B) { vx += B.vx - B.va * c.rby; vy += B.vy + B.va * c.rbx; }
      const vt = vx * tx + vy * ty;
      let jt = -vt / c.kt;
      const mu = FRICTION * (B ? 1 : FLOOR_GRIP);
      const oldT = c.jt;
      c.jt = Math.max(-mu * c.jn, Math.min(mu * c.jn, oldT + jt));
      jt = c.jt - oldT;
      apply(A, tx * jt, ty * jt, c.rax, c.ray, -1);
      if (B) apply(B, tx * jt, ty * jt, c.rbx, c.rby, 1);
    }

    /* the hand: a soft point joint between the point held and the pointer */
    function solveHeld(dt) {
      const b = held.b;
      if (!b.alive) { held = null; return; }
      const c = Math.cos(b.a), s = Math.sin(b.a);
      const rx = held.lx * c - held.ly * s, ry = held.lx * s + held.ly * c;
      const px = b.x + rx, py = b.y + ry;
      const vpx = b.vx - b.va * ry, vpy = b.vy + b.va * rx;
      const dvx = ((held.tx - px) * 0.22) / dt - vpx;
      const dvy = ((held.ty - py) * 0.22) / dt - vpy;
      const k11 = b.im + b.ii * ry * ry, k12 = -b.ii * rx * ry, k22 = b.im + b.ii * rx * rx;
      const det = k11 * k22 - k12 * k12 || 1;
      const soft = 0.35;
      const jx = ((k22 * dvx - k12 * dvy) / det) * soft;
      const jy = ((k11 * dvy - k12 * dvx) / det) * soft;
      apply(b, jx, jy, rx, ry, 1);
      b.va *= 0.985;
    }

    function drop(b, index) {
      const halfWidth = b.r + b.hl;
      const span = Math.max(0, W - 2 * halfWidth);
      b.x = halfWidth + span * (0.12 + 0.76 * ((index * 0.618 + 0.21) % 1));
      b.y = -b.h - 6;
      b.a = (((index * 0.37) % 1) - 0.5) * 0.5;
      b.vx = (((index * 0.53) % 1) - 0.5) * 120;
      b.vy = 140;
      b.va = (((index * 0.71) % 1) - 0.5) * 2;
      b.sq = 0;
      b.sqv = 0;
      b.alive = true;
      b.el.style.opacity = "1";
    }

    function render(dt) {
      tray.style.transform = `rotate(${look().toFixed(3)}deg)`;
      for (const b of bodies) {
        if (!b.alive) continue;
        b.sqv += (-260 * b.sq - 16 * b.sqv) * dt;
        b.sq += b.sqv * dt;
        const lift = held?.b === b ? 1.05 : 1;
        const x = (b.x + INSET - b.w / 2).toFixed(2);
        const y = (b.y + INSET - b.h / 2).toFixed(2);
        b.el.style.transform = `translate(${x}px, ${y}px) rotate(${b.a.toFixed(4)}rad) scale(${lift + 0.07 * b.sq}, ${lift - 0.12 * b.sq})`;
        b.label.style.transform = Math.cos(b.a) < 0 ? "rotate(180deg)" : "";
      }
    }

    function frame(now) {
      const dt = Math.min((now - lastFrame) / 1000, 1 / 20);
      lastFrame = now;
      gv += ((gTarget - g) * 70 - gv * 12) * dt;
      g += gv * dt;
      age += dt;
      for (const [index, b] of bodies.entries()) {
        if (!b.alive && age >= index * DROP_GAP) drop(b, index);
      }
      accum += dt;
      while (accum >= STEP) {
        step(STEP);
        accum -= STEP;
      }
      render(dt);
      frameId = requestAnimationFrame(frame);
    }

    function release(event) {
      if (!held || (event && event.pointerId !== held.id)) return;
      const { id, b } = held;
      held = null;
      b.el.classList.remove("is-held");
      if (tray.hasPointerCapture(id)) tray.releasePointerCapture(id);
      if (!event || event.pointerType !== "mouse") gTarget = 0;
    }

    function sync() {
      if (visible && !reducedMotion.matches && !document.hidden) {
        if (!tray.classList.contains("is-playing")) {
          tray.classList.add("is-playing");
          measure();
        }
        if (!frameId) {
          lastFrame = performance.now();
          frameId = requestAnimationFrame(frame);
        }
        return;
      }

      cancelAnimationFrame(frameId);
      frameId = 0;
      release();
      gTarget = 0;
      if (!reducedMotion.matches) return;

      tray.classList.remove("is-playing");
      tray.style.transform = "";
      for (const b of bodies) {
        b.alive = false;
        b.el.style.opacity = "";
        b.el.style.transform = "";
        b.label.style.transform = "";
      }
      age = accum = g = gv = 0;
    }

    function local(event) {
      const rect = well.getBoundingClientRect();
      const x = event.clientX - rect.left - rect.width / 2;
      const y = event.clientY - rect.top - rect.height / 2;
      const angle = -look() * Math.PI / 180;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      return [x * cos - y * sin + W / 2, x * sin + y * cos + H / 2];
    }

    tray.addEventListener("pointermove", (event) => {
      if (!frameId) return;
      if (event.pointerType === "mouse" && !held) {
        const rect = well.getBoundingClientRect();
        gTarget = clamp(2 * (event.clientX - rect.left) / rect.width - 1, -1, 1) * 9;
      }
      if (held?.id === event.pointerId) [held.tx, held.ty] = local(event);
    });
    tray.addEventListener("pointerleave", () => {
      if (!held) gTarget = 0;
    });
    tray.addEventListener("pointerdown", (event) => {
      const target = event.target.closest("li");
      const b = bodies.find(body => body.el === target);
      if (!frameId || held || !b?.alive || event.button !== 0) return;
      const [tx, ty] = local(event);
      const dx = tx - b.x;
      const dy = ty - b.y;
      held = {
        b, id: event.pointerId, tx, ty,
        lx: dx * Math.cos(b.a) + dy * Math.sin(b.a),
        ly: dy * Math.cos(b.a) - dx * Math.sin(b.a),
      };
      b.el.classList.add("is-held");
      tray.setPointerCapture(event.pointerId);
    });
    for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) {
      tray.addEventListener(type, release);
    }

    window.addEventListener("resize", () => {
      if (tray.classList.contains("is-playing")) measure();
    });
    document.addEventListener("visibilitychange", sync);
    reducedMotion.addEventListener("change", sync);
    new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      sync();
    }, { threshold: 0.08 }).observe(well);
  }

  if ("IntersectionObserver" in window) {
    document.querySelectorAll(".skill-well").forEach(setup);
  }
})();
