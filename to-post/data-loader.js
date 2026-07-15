"use strict";

(() => {
  const nativeFetch = window.fetch.bind(window);
  const BUILD_VERSION = "7";
  const LIVE_TARGET = new URL("../data/exercises.json", window.location.href);
  const ADDITIONAL_TARGET = new URL("data/additional-sets.json", window.location.href);

  const REPOSITORY_RAW =
    "https://raw.githubusercontent.com/mkbuzz/preposition-quest/main/";
  const REPOSITORY_CDN =
    "https://cdn.jsdelivr.net/gh/mkbuzz/preposition-quest@main/";

  const wait = (milliseconds) =>
    new Promise((resolve) => window.setTimeout(resolve, milliseconds));

  async function fetchTextWithTimeout(url, timeoutMs = 15000) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await nativeFetch(url, {
        cache: "no-store",
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.text();
    } finally {
      window.clearTimeout(timer);
    }
  }

  async function loadJson(label, candidates) {
    const failures = [];

    for (const candidate of candidates) {
      for (let attempt = 1; attempt <= 2; attempt += 1) {
        try {
          const text = await fetchTextWithTimeout(candidate);
          const parsed = JSON.parse(text);
          return parsed;
        } catch (error) {
          const source = new URL(candidate, window.location.href).hostname;
          failures.push(`${source}: ${error?.message || "request failed"}`);
          if (attempt < 2) await wait(300);
        }
      }
    }

    throw new Error(
      `Could not load ${label}. Tried the staging site and two GitHub mirrors. ${failures.join(" | ")}`
    );
  }

  function jsonResponse(value) {
    return new Response(JSON.stringify(value), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store"
      }
    });
  }

  async function loadLiveData() {
    const localUrl = new URL(`../data/exercises.json?build=${BUILD_VERSION}`, window.location.href).href;
    const rawUrl = `${REPOSITORY_RAW}data/exercises.json?build=${BUILD_VERSION}`;
    const cdnUrl = `${REPOSITORY_CDN}data/exercises.json?build=${BUILD_VERSION}`;

    const data = await loadJson("the current Sets 1–6 data", [localUrl, rawUrl, cdnUrl]);
    if (!data || !Array.isArray(data.sets)) {
      throw new Error("The current Sets 1–6 data has an invalid structure.");
    }
    return data;
  }

  async function loadAdditionalData() {
    const sets = [];

    for (let setNumber = 7; setNumber <= 16; setNumber += 1) {
      const relativePath = `to-post/data/sets/set${setNumber}.json`;
      const localUrl = new URL(`data/sets/set${setNumber}.json?build=${BUILD_VERSION}`, window.location.href).href;
      const rawUrl = `${REPOSITORY_RAW}${relativePath}?build=${BUILD_VERSION}`;
      const cdnUrl = `${REPOSITORY_CDN}${relativePath}?build=${BUILD_VERSION}`;

      const set = await loadJson(`TO-POST Set ${setNumber}`, [localUrl, rawUrl, cdnUrl]);
      if (!set || set.number !== setNumber || !Array.isArray(set.exercises)) {
        throw new Error(`TO-POST Set ${setNumber} has an invalid structure.`);
      }
      sets.push(set);
    }

    return {
      schemaVersion: "to-post-direct-json-v1",
      label: "TO-POST",
      sets
    };
  }

  window.fetch = async function toPostFetch(input, init) {
    const requestUrl = typeof input === "string" ? input : input?.url || "";
    const normalizedUrl = new URL(requestUrl, window.location.href);

    if (normalizedUrl.pathname === LIVE_TARGET.pathname) {
      return jsonResponse(await loadLiveData());
    }

    if (normalizedUrl.pathname === ADDITIONAL_TARGET.pathname) {
      return jsonResponse(await loadAdditionalData());
    }

    return nativeFetch(input, init);
  };
})();
