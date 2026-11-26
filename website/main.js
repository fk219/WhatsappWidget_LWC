const root = document.documentElement;
const body = document.body;
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const finePointer = window.matchMedia("(pointer: fine)");

/* ---------------------------------------------------------
   Header, page progress, mobile menu
   --------------------------------------------------------- */

const header = document.querySelector("[data-header]");
const menuToggle = document.querySelector(".menu-toggle");
const mobileMenu = document.querySelector(".mobile-menu");
const mobileLinks = mobileMenu ? mobileMenu.querySelectorAll("a") : [];
const progress = document.querySelector(".page-progress");
const main = document.querySelector("main");
const footer = document.querySelector(".site-footer");
const menuLabel = menuToggle ? menuToggle.querySelector("span") : null;

let menuOpen = false;
let scrollTicking = false;

function onScroll() {
  const scrollTop = window.scrollY || window.pageYOffset;
  const max = document.documentElement.scrollHeight - window.innerHeight;
  const ratio = max > 0 ? Math.min(scrollTop / max, 1) : 0;

  if (header) {
    header.classList.toggle("is-scrolled", scrollTop > 24);
  }
  if (progress) {
    progress.style.setProperty("--progress", ratio.toFixed(4));
  }

  updateFeatures();
  updateHeroStage(scrollTop);
}

function requestScrollUpdate() {
  if (scrollTicking) return;
  scrollTicking = true;
  requestAnimationFrame(() => {
    onScroll();
    scrollTicking = false;
  });
}

window.addEventListener("scroll", requestScrollUpdate, { passive: true });
window.addEventListener("resize", requestScrollUpdate);

function openMenu() {
  if (!mobileMenu || !menuToggle) return;
  menuOpen = true;
  mobileMenu.classList.add("is-open");
  mobileMenu.setAttribute("aria-hidden", "false");
  mobileMenu.inert = false;
  menuToggle.setAttribute("aria-expanded", "true");
  body.classList.add("menu-open");
  if (menuLabel) menuLabel.textContent = "Close";
  if (main) main.inert = true;
  if (footer) footer.inert = true;
  const first = mobileLinks[0];
  if (first) first.focus({ preventScroll: true });
}

function closeMenu({ restoreFocus = true } = {}) {
  if (!mobileMenu || !menuToggle) return;
  menuOpen = false;
  mobileMenu.classList.remove("is-open");
  mobileMenu.setAttribute("aria-hidden", "true");
  mobileMenu.inert = true;
  menuToggle.setAttribute("aria-expanded", "false");
  body.classList.remove("menu-open");
  if (menuLabel) menuLabel.textContent = "Menu";
  if (main) main.inert = false;
  if (footer) footer.inert = false;
  if (restoreFocus) menuToggle.focus({ preventScroll: true });
}

if (menuToggle) {
  menuToggle.addEventListener("click", () => {
    if (menuOpen) closeMenu();
    else openMenu();
  });
}

mobileLinks.forEach((link) => {
  link.addEventListener("click", () => closeMenu({ restoreFocus: false }));
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && menuOpen) {
    closeMenu();
  }
});

/* ---------------------------------------------------------
   Reveal on scroll
   --------------------------------------------------------- */

const revealItems = [...document.querySelectorAll("[data-reveal]")];

if ("IntersectionObserver" in window) {
  revealItems.forEach((item, index) => {
    item.classList.add("reveal-init");
    if (item.closest(".enterprise-grid")) {
      item.style.transitionDelay = `${(index % 3) * 60}ms`;
    }
  });

  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { rootMargin: "0px 0px -12% 0px", threshold: 0.05 }
  );

  revealItems.forEach((item) => revealObserver.observe(item));
} else {
  revealItems.forEach((item) => item.classList.add("is-visible"));
}

/* ---------------------------------------------------------
   Product feature scrollytelling
   --------------------------------------------------------- */

const features = [...document.querySelectorAll("[data-feature]")];
const views = [...document.querySelectorAll("[data-view]")];
const stageLabel = document.querySelector("[data-stage-label]");
const labels = ["01 / Inbox", "02 / Templates", "03 / Consent", "04 / Routing"];

function setActiveFeature(index) {
  features.forEach((feature, i) => {
    feature.classList.toggle("is-active", i === index);
  });
  views.forEach((view, i) => {
    view.classList.toggle("is-active", i === index);
  });
  if (stageLabel && labels[index]) {
    stageLabel.textContent = labels[index];
  }
}

function updateFeatures() {
  if (!features.length) return;
  const section = document.querySelector("#product");
  if (!section) return;

  const rect = section.getBoundingClientRect();
  if (rect.bottom < 0 || rect.top > window.innerHeight) return;

  const anchor = window.innerHeight * 0.46;
  let active = 0;

  features.forEach((feature, index) => {
    const featureRect = feature.getBoundingClientRect();
    if (featureRect.top <= anchor) active = index;
  });

  setActiveFeature(active);
}

/* ---------------------------------------------------------
   Hero console: subtle pointer tilt and scroll drift
   --------------------------------------------------------- */

const stage = document.querySelector(".console-wrap");
const hero = document.querySelector(".hero");
let pointerX = 0;
let pointerY = 0;
let targetX = 0;
let targetY = 0;
let tiltFrame = null;

function updateHeroStage(scrollTop) {
  if (!stage || reduceMotion.matches) return;
  const heroHeight = hero ? hero.offsetHeight : window.innerHeight;
  const shift = Math.min(scrollTop * 0.06, 24);
  stage.style.setProperty("--stage-shift", `${shift.toFixed(2)}px`);
  stage.style.setProperty("--hero-p", Math.min(scrollTop / heroHeight, 1).toFixed(4));
}

function animateTilt() {
  if (!stage) return;
  targetX += (pointerX - targetX) * 0.08;
  targetY += (pointerY - targetY) * 0.08;
  stage.style.setProperty("--stage-rx", `${(-targetY * 1.4).toFixed(3)}deg`);
  stage.style.setProperty("--stage-ry", `${(targetX * 1.8).toFixed(3)}deg`);

  if (Math.abs(pointerX - targetX) > 0.01 || Math.abs(pointerY - targetY) > 0.01) {
    tiltFrame = requestAnimationFrame(animateTilt);
  } else {
    tiltFrame = null;
  }
}

if (stage && finePointer.matches && !reduceMotion.matches) {
  window.addEventListener(
    "pointermove",
    (event) => {
      const rect = stage.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      pointerX = (event.clientX - centerX) / Math.max(rect.width, 1);
      pointerY = (event.clientY - centerY) / Math.max(rect.height, 1);
      if (!tiltFrame) tiltFrame = requestAnimationFrame(animateTilt);
    },
    { passive: true }
  );

  window.addEventListener("pointerleave", () => {
    pointerX = 0;
    pointerY = 0;
    if (!tiltFrame) tiltFrame = requestAnimationFrame(animateTilt);
  });
}

/* ---------------------------------------------------------
   Cursor
   --------------------------------------------------------- */

const dot = document.querySelector(".cursor-dot");
const ring = document.querySelector(".cursor-ring");

if (dot && ring && finePointer.matches && !reduceMotion.matches) {
  body.classList.add("has-cursor");
  let mouseX = window.innerWidth / 2;
  let mouseY = window.innerHeight / 2;
  let ringX = mouseX;
  let ringY = mouseY;
  let cursorFrame = null;

  const moveCursor = () => {
    ringX += (mouseX - ringX) * 0.16;
    ringY += (mouseY - ringY) * 0.16;
    dot.style.transform = `translate3d(${mouseX}px, ${mouseY}px, 0) translate(-50%, -50%)`;
    ring.style.transform = `translate3d(${ringX}px, ${ringY}px, 0) translate(-50%, -50%)`;

    if (Math.abs(mouseX - ringX) > 0.1 || Math.abs(mouseY - ringY) > 0.1) {
      cursorFrame = requestAnimationFrame(moveCursor);
    } else {
      cursorFrame = null;
    }
  };

  window.addEventListener(
    "pointermove",
    (event) => {
      mouseX = event.clientX;
      mouseY = event.clientY;
      if (!cursorFrame) cursorFrame = requestAnimationFrame(moveCursor);
    },
    { passive: true }
  );

  document
    .querySelectorAll("a, button, [data-magnetic], [data-cursor]")
    .forEach((element) => {
      element.addEventListener("pointerenter", () =>
        body.classList.add("cursor-hover")
      );
      element.addEventListener("pointerleave", () =>
        body.classList.remove("cursor-hover")
      );
    });
}

/* ---------------------------------------------------------
   Magnetic buttons
   --------------------------------------------------------- */

if (finePointer.matches && !reduceMotion.matches) {
  document.querySelectorAll("[data-magnetic]").forEach((element) => {
    element.addEventListener("pointermove", (event) => {
      const rect = element.getBoundingClientRect();
      const x = (event.clientX - rect.left - rect.width / 2) * 0.12;
      const y = (event.clientY - rect.top - rect.height / 2) * 0.18;
      element.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(
        2
      )}px, 0)`;
    });
    element.addEventListener("pointerleave", () => {
      element.style.transform = "";
    });
  });
}

/* ---------------------------------------------------------
   Template countdown
   --------------------------------------------------------- */

const timer = document.querySelector(".tc-timer");
if (timer) {
  let remaining = 2 * 3600 + 14 * 60 + 8;

  const renderTimer = () => {
    const hours = Math.floor(remaining / 3600);
    const minutes = Math.floor((remaining % 3600) / 60);
    const seconds = remaining % 60;
    const parts = timer.querySelectorAll("span");
    if (parts.length === 3) {
      parts[0].textContent = String(hours).padStart(2, "0");
      parts[1].textContent = String(minutes).padStart(2, "0");
      parts[2].textContent = String(seconds).padStart(2, "0");
    }
    remaining = remaining > 0 ? remaining - 1 : 0;
  };

  renderTimer();
  if (!reduceMotion.matches) {
    setInterval(renderTimer, 1000);
  }
}

/* ---------------------------------------------------------
   Initial state
   --------------------------------------------------------- */

onScroll();
updateFeatures();

/* Recalculate after fonts settle to avoid layout drift. */
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(() => {
    onScroll();
    updateFeatures();
  });
}
