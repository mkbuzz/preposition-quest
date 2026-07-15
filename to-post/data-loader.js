"use strict";

(() => {
  const nativeFetch = window.fetch.bind(window);
  const additionalDataPath = "data/additional-sets.json";
  const BUILD_VERSION = "6";
  const MAX_ATTEMPTS = 4;
  const CHUNK_PATHS = [
    "data/chunks/part-1.txt",
    "data/chunks/part-2.txt",
    "data/chunks/part-3.txt",
    "data/chunks/part-4.txt",
    "data/chunks/part-5.txt",
    "data/chunks/part-6.txt"
  ];

  const wait = (milliseconds) =>
    new Promise((resolve) => window.setTimeout(resolve, milliseconds));

  function exposeLoadError(message) {
    window.TO_POST_LOAD_ERROR = message;
    window.setTimeout(() => {
      const note = document.querySelector("#app .section-note");
      if (note && /TO-POST exercise data \(500\)/.test(note.textContent || "")) {
        note.textContent = message;
      }
    }, 0);
  }

  async function fetchWithRetry(input, init = {}, label = "resource") {
    let lastError = null;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      try {
        const response = await nativeFetch(input, {
          ...init,
          cache: "no-store"
        });

        if (response.ok || (response.status !== 404 && response.status < 500)) {
          return response;
        }

        lastError = new Error(`${label} returned ${response.status}.`);
      } catch (error) {
        lastError = error;
      }

      if (attempt < MAX_ATTEMPTS) {
        await wait(300 * attempt);
      }
    }

    throw new Error(
      `Could not load ${label} after ${MAX_ATTEMPTS} attempts. ${lastError?.message || "Network request failed."}`
    );
  }

  window.fetch = async function toPostFetch(input, init) {
    const requestUrl = typeof input === "string" ? input : input?.url || "";
    const normalizedUrl = new URL(requestUrl, window.location.href);
    const targetUrl = new URL(additionalDataPath, window.location.href);

    if (normalizedUrl.pathname !== targetUrl.pathname) {
      return fetchWithRetry(input, init, normalizedUrl.pathname || "requested resource");
    }

    try {
      const chunkResponses = await Promise.all(
        CHUNK_PATHS.map((path, index) =>
          fetchWithRetry(
            `${path}?build=${BUILD_VERSION}`,
            init,
            `TO-POST data part ${index + 1}`
          )
        )
      );

      const failedIndex = chunkResponses.findIndex((response) => !response.ok);
      if (failedIndex !== -1) {
        throw new Error(
          `TO-POST data part ${failedIndex + 1} returned ${chunkResponses[failedIndex].status}.`
        );
      }

      const chunks = await Promise.all(
        chunkResponses.map(async (response, index) => {
          const text = (await response.text()).replace(/\s+/g, "");
          if (text.length < 1000) {
            throw new Error(`TO-POST data part ${index + 1} is incomplete (${text.length} characters).`);
          }
          return text;
        })
      );

      const base64 = chunks.join("");
      if (base64.length % 4 !== 0) {
        throw new Error(`The combined TO-POST data has an invalid Base64 length (${base64.length}).`);
      }

      const binary = atob(base64);
      const compressed = Uint8Array.from(
        binary,
        (character) => character.charCodeAt(0)
      );

      if (typeof DecompressionStream !== "function") {
        throw new Error("This browser does not support the required gzip decompression feature.");
      }

      const stream = new Blob([compressed])
        .stream()
        .pipeThrough(new DecompressionStream("gzip"));
      const jsonText = await new Response(stream).text();
      const parsed = JSON.parse(jsonText);

      if (!parsed || !Array.isArray(parsed.sets) || parsed.sets.length !== 10) {
        throw new Error(
          `The TO-POST data package is incomplete (${parsed?.sets?.length ?? 0} of 10 additional sets found).`
        );
      }

      return new Response(jsonText, {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store"
        }
      });
    } catch (error) {
      const message = error?.message || "Could not load TO-POST exercise data.";
      console.error("TO-POST data loading failed", error);
      exposeLoadError(message);
      return new Response(
        JSON.stringify({ error: message }),
        {
          status: 500,
          headers: { "Content-Type": "application/json; charset=utf-8" }
        }
      );
    }
  };
})();
