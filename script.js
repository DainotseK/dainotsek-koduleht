// Mobile nav toggle
const toggleBtn = document.querySelector(".nav__toggle");
const navLinks = document.querySelector("#navLinks");

if (toggleBtn && navLinks) {
  toggleBtn.addEventListener("click", () => {
    const isOpen = navLinks.classList.toggle("is-open");
    toggleBtn.setAttribute("aria-expanded", String(isOpen));
  });

  // Close menu on link click (mobile)
  navLinks.querySelectorAll("a").forEach((a) => {
    a.addEventListener("click", () => {
      navLinks.classList.remove("is-open");
      toggleBtn.setAttribute("aria-expanded", "false");
    });
  });
}

// Footer year
document.querySelector("#year").textContent = String(new Date().getFullYear());

// Demo: copy contact (you can replace with your real email later)
const copyBtn = document.querySelector("#copyEmailBtn");
const hint = document.querySelector("#copyHint");
const demoEmail = "contact@dainotsek.com";

if (copyBtn && hint) {
  copyBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(demoEmail);
      hint.textContent = `Kopeeritud: ${demoEmail}`;
      setTimeout(() => (hint.textContent = ""), 2500);
    } catch {
      hint.textContent = "Kopeerimine ei õnnestunud (browseri piirang).";
      setTimeout(() => (hint.textContent = ""), 2500);
    }
  });
}
