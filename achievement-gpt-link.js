"use strict";

/* Adds the custom GPT link to the completed-homework popup. */

(() => {
  const MODAL_ID = "homework-achievement-modal";

  const style = document.createElement("style");
  style.textContent = `
    #${MODAL_ID} .achievement-actions {
      display: flex;
      align-items: stretch;
      justify-content: center;
      gap: 0.75rem;
      flex-wrap: wrap;
    }

    #${MODAL_ID} .achievement-actions .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: min(220px, 100%);
      text-decoration: none;
    }

    @media (max-width: 520px) {
      #${MODAL_ID} .achievement-actions {
        flex-direction: column;
      }

      #${MODAL_ID} .achievement-actions .btn {
        width: 100%;
      }
    }
  `;
  document.head.appendChild(style);

  function enhanceAchievementModal() {
    const modal = document.getElementById(MODAL_ID);
    if (!modal || modal.querySelector(".achievement-actions")) return;

    const title = modal.querySelector("#achievement-title");
    if (!title || !title.textContent.includes("Homework requirement achieved")) return;

    const closeButton = modal.querySelector("#close-achievement-modal");
    const url = String(config.customGptUrl || "").trim();
    if (!closeButton || !url) return;

    const practiceLink = document.createElement("a");
    practiceLink.className = "btn btn-primary";
    practiceLink.href = url;
    practiceLink.target = "_blank";
    practiceLink.rel = "noopener noreferrer";
    practiceLink.textContent = config.customGptButtonLabel || "アウトプット練習へGO!";
    practiceLink.setAttribute("aria-label", "前置詞のアウトプット練習を新しいタブで開く");

    closeButton.textContent = "Close";
    closeButton.classList.remove("btn-primary");
    closeButton.classList.add("btn-secondary");

    const actions = document.createElement("div");
    actions.className = "achievement-actions";
    closeButton.parentNode.insertBefore(actions, closeButton);
    actions.append(practiceLink, closeButton);
  }

  const observer = new MutationObserver(() => {
    window.requestAnimationFrame(enhanceAchievementModal);
  });

  observer.observe(document.body, { childList: true, subtree: true });
  window.addEventListener("pageshow", enhanceAchievementModal);
  enhanceAchievementModal();
})();
