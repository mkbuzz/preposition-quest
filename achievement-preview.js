"use strict";

/* Developer-only preview of the completed homework state. No progress is changed. */

(() => {
  const parameters = new URLSearchParams(window.location.search);
  const developerMode = parameters.get("test") === "1" || parameters.get("admin") === "1";
  if (!developerMode) return;

  const autoPreview = parameters.get("preview") === "complete";
  const MODAL_ID = "homework-achievement-modal";
  let previewActive = false;
  let previewShownAutomatically = false;

  function getTotalExercises() {
    if (!state?.data?.sets) return 0;
    return state.data.sets.reduce(
      (total, set) => total + set.exercises.filter((exercise) => exercise.enabled).length,
      0
    );
  }

  function decorateCompletedBanner() {
    if (!previewActive) return;

    const banner = document.querySelector(".homework-goal-banner");
    if (!banner) return;

    const total = getTotalExercises();
    banner.classList.add("complete");
    banner.innerHTML = `
      <div>
        <span class="homework-goal-title">Homework requirement achieved</span>
        <span>Complete every exercise and earn 3 stars on each one. Three stars = 13/15 or higher.</span>
      </div>
      <span class="homework-goal-progress">
        ${total}/${total} exercises at 3 stars · ${total}/${total} attempted
      </span>`;
  }

  function showCompletionPreview() {
    previewActive = true;
    decorateCompletedBanner();
    document.getElementById(MODAL_ID)?.remove();

    const modal = document.createElement("div");
    modal.id = MODAL_ID;
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", "achievement-title");
    modal.innerHTML = `
      <div class="achievement-dialog">
        <div class="achievement-icon" aria-hidden="true">✓</div>
        <h2 id="achievement-title">Homework requirement achieved!</h2>
        <div class="achievement-stars" aria-hidden="true">★★★</div>
        <p>You earned three stars on every exercise. The minimum requirement for this homework assignment has been achieved.</p>
        <button class="btn btn-primary" type="button" id="close-achievement-modal">Close Preview</button>
      </div>`;

    document.body.appendChild(modal);
    document.body.style.overflow = "hidden";

    const close = () => {
      modal.remove();
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handleKeydown);
    };
    const handleKeydown = (event) => {
      if (event.key === "Escape" || event.key === "Enter") close();
    };

    modal.querySelector("#close-achievement-modal").addEventListener("click", close);
    modal.addEventListener("click", (event) => {
      if (event.target === modal) close();
    });
    document.addEventListener("keydown", handleKeydown);
    modal.querySelector("button").focus();
  }

  function addPreviewButton() {
    const badge = document.getElementById("developer-test-badge");
    if (!badge || badge.querySelector("[data-preview-completion]")) return;

    const button = document.createElement("button");
    button.type = "button";
    button.dataset.previewCompletion = "true";
    button.textContent = "Preview Completion";
    button.addEventListener("click", showCompletionPreview);
    badge.insertBefore(button, badge.querySelector("button"));
  }

  function updatePreviewUi() {
    addPreviewButton();
    decorateCompletedBanner();

    if (autoPreview && !previewShownAutomatically && state?.data && document.querySelector("main")) {
      previewShownAutomatically = true;
      window.setTimeout(showCompletionPreview, 150);
    }
  }

  const observer = new MutationObserver(() => {
    window.requestAnimationFrame(updatePreviewUi);
  });
  observer.observe(document.body, { childList: true, subtree: true });

  updatePreviewUi();
})();
