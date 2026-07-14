"use strict";

/*
  Keeps the homework requirement visible during an exercise without allowing it
  to compete with the questions and word bank for attention.
*/

(() => {
  const THREE_STAR_SCORE = Number(config.scoreThresholds?.threeStars ?? 13);

  const style = document.createElement("style");
  style.textContent = `
    .exercise-page > .homework-goal-banner.exercise-compact {
      position: static;
      z-index: auto;
      align-items: center;
      flex-direction: row;
      flex-wrap: wrap;
      justify-content: space-between;
      gap: 0.35rem 0.65rem;
      margin: 0 0 0.55rem;
      padding: 0.38rem 0.62rem;
      border-radius: 0.65rem;
      box-shadow: 0 3px 10px rgba(30, 64, 175, 0.08);
      backdrop-filter: none;
      font-size: 0.78rem;
      line-height: 1.2;
    }

    .exercise-page > .homework-goal-banner.exercise-compact .homework-goal-title {
      display: inline;
      margin: 0;
      font-size: 0.8rem;
    }

    .exercise-page > .homework-goal-banner.exercise-compact .homework-goal-progress {
      padding: 0.22rem 0.48rem;
      font-size: 0.72rem;
      line-height: 1.1;
    }

    @media (max-width: 620px) {
      .exercise-page > .homework-goal-banner.exercise-compact {
        align-items: center;
        flex-direction: row;
        padding: 0.34rem 0.52rem;
      }

      .exercise-page > .homework-goal-banner.exercise-compact .homework-goal-progress {
        white-space: nowrap;
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
        ${complete ? "Homework complete" : `Goal: 3 stars (${THREE_STAR_SCORE}/15)`}
      </span>
      <span class="homework-goal-progress">${achieved}/${total} achieved</span>`;
  }

  const observer = new MutationObserver(() => {
    window.requestAnimationFrame(compactExerciseGoalBanner);
  });

  observer.observe(app, { childList: true, subtree: true });
  compactExerciseGoalBanner();
})();
