"use strict";

/* Keeps the homework requirement visible during an exercise without competing with the task. */

(() => {
  const THREE_STAR_SCORE = Number(config.scoreThresholds?.threeStars ?? 13);

  const style = document.createElement("style");
  style.textContent = `
    .exercise-page > .homework-goal-banner.exercise-compact {
      position: static;
      z-index: auto;
      align-items: center;
      flex-direction: row;
      flex-wrap: nowrap;
      justify-content: space-between;
      gap: 0.45rem;
      margin: 0 0 0.35rem;
      padding: 0.26rem 0.5rem;
      border-radius: 0.52rem;
      box-shadow: none;
      backdrop-filter: none;
      font-size: 0.72rem;
      line-height: 1.1;
    }

    .exercise-page > .homework-goal-banner.exercise-compact .homework-goal-title {
      display: inline;
      margin: 0;
      font-size: 0.74rem;
      white-space: nowrap;
    }

    .exercise-page > .homework-goal-banner.exercise-compact .homework-goal-progress {
      padding: 0.18rem 0.4rem;
      font-size: 0.66rem;
      line-height: 1;
      white-space: nowrap;
    }

    @media (max-width: 620px) {
      .exercise-page > .homework-goal-banner.exercise-compact {
        padding: 0.24rem 0.42rem;
      }
    }
  `;
  document.head.appendChild(style);

  function compactExerciseGoalBanner() {
    const exercisePage = app.querySelector(".exercise-page");
    if (!exercisePage) return;

    const banner = exercisePage.querySelector(":scope > .homework-goal-banner");
    if (!banner || banner.dataset.exerciseCompact === "true") return;

    const progressText = banner.querySelector(".homework-goal-progress")?.textContent || "";
    const achievedMatch = progressText.match(/(\d+)\/(\d+)\s+exercises at 3 stars/i);
    const achieved = achievedMatch ? achievedMatch[1] : "0";
    const total = achievedMatch ? achievedMatch[2] : "24";
    const complete = banner.classList.contains("complete");

    banner.classList.add("exercise-compact");
    banner.dataset.exerciseCompact = "true";
    banner.setAttribute(
      "aria-label",
      complete
        ? "Homework requirement achieved."
        : `Homework goal: earn three stars by scoring ${THREE_STAR_SCORE} out of 15 or higher on every exercise.`
    );
    banner.innerHTML = `
      <span class="homework-goal-title">
        ${complete ? "Homework complete" : `Goal: ★★★ (${THREE_STAR_SCORE}/15)`}
      </span>
      <span class="homework-goal-progress">${achieved}/${total} achieved</span>`;
  }

  const observer = new MutationObserver(() => {
    window.requestAnimationFrame(compactExerciseGoalBanner);
  });

  observer.observe(app, { childList: true, subtree: true });
  compactExerciseGoalBanner();
})();
