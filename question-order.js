"use strict";

/* Randomizes question order for every attempt and keeps word banks alphabetical. */

(() => {
  const originalStartExercise = window.startExercise;
  const originalRenderSetPage = window.renderSetPage;
  const originalRenderExercise = window.renderExercise;

  function sortWordBank(set) {
    if (!set || !Array.isArray(set.wordBank)) return;
    set.wordBank.sort((a, b) => String(a).localeCompare(String(b), "en", { sensitivity: "base" }));
  }

  function shuffleQuestions(questions) {
    const shuffled = questions.slice();
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
    }
    return shuffled;
  }

  window.startExercise = function startExerciseWithRandomizedQuestions(setId, exerciseId) {
    const set = getSet(setId);
    sortWordBank(set);

    const exercise = set.exercises.find((item) => item.id === exerciseId);
    if (exercise && exercise.enabled && Array.isArray(exercise.questions)) {
      exercise.questions = shuffleQuestions(exercise.questions);
    }

    return originalStartExercise(setId, exerciseId);
  };

  window.renderSetPage = function renderSetPageWithAlphabeticalWordBank() {
    sortWordBank(getSet(state.currentSetId));
    return originalRenderSetPage();
  };

  window.renderExercise = function renderExerciseWithAlphabeticalWordBank(options = {}) {
    sortWordBank(getSet(state.currentSetId));
    return originalRenderExercise(options);
  };
})();
