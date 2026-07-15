"use strict";

(() => {
  const nativeFetch = window.fetch.bind(window);
  const additionalDataPath = "data/additional-sets.json";
  const BUILD_VERSION = "5";
  const MAX_ATTEMPTS = 4;

  const wait = (milliseconds) =>
    new Promise((resolve) => window.setTimeout(resolve, milliseconds));

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
      const manifestResponse = await fetchWithRetry(
        `data/manifest.json?v=${BUILD_VERSION}`,
        init,
        "the TO-POST data manifest"
      );

      if (!manifestResponse.ok) {
        throw new Error(`The TO-POST data manifest returned ${manifestResponse.status}.`);
      }

      const manifest = await manifestResponse.json();
      if (
        !manifest ||
        manifest.encoding !== "gzip-base64" ||
        !Array.isArray(manifest.chunks) ||
        manifest.chunks.length === 0
      ) {
        throw new Error("The TO-POST data manifest is invalid.");
      }

      if (typeof DecompressionStream !== "function") {
        throw new Error("This browser cannot open the compressed TO-POST data. Use a current browser.");
      }

      const chunkResponses = await Promise.all(
        manifest.chunks.map((path, index) =>
          fetchWithRetry(
            `data/${path}?v=${BUILD_VERSION}`,
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
        chunkResponses.map((response) => response.text())
      );
      const base64 = chunks.join("").replace(/\s+/g, "");
      const binary = atob(base64);
      const compressed = Uint8Array.from(
        binary,
        (character) => character.charCodeAt(0)
      );
      const stream = new Blob([compressed])
        .stream()
        .pipeThrough(new DecompressionStream("gzip"));
      const jsonText = await new Response(stream).text();

      JSON.parse(jsonText);

      return new Response(jsonText, {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store"
        }
      });
    } catch (error) {
      console.error("TO-POST data loading failed", error);
      return new Response(
        JSON.stringify({
          error: error?.message || "Could not load TO-POST exercise data."
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json; charset=utf-8" }
        }
      );
    }
  };
})();