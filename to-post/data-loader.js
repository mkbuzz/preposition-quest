"use strict";

(() => {
  const nativeFetch = window.fetch.bind(window);
  const additionalDataPath = "data/additional-sets.json";
  const BUILD_VERSION = "3";
  const MAX_ATTEMPTS = 5;

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
        await wait(350 * attempt);
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

    const manifestResponse = await fetchWithRetry(
      `data/manifest.json?v=${BUILD_VERSION}`,
      init,
      "the TO-POST data manifest"
    );

    if (!manifestResponse.ok) {
      return new Response(
        JSON.stringify({ error: `Could not load the TO-POST data manifest (${manifestResponse.status}).` }),
        { status: manifestResponse.status, headers: { "Content-Type": "application/json" } }
      );
    }

    const manifest = await manifestResponse.json();
    if (
      !manifest ||
      manifest.encoding !== "gzip-base64" ||
      !Array.isArray(manifest.chunks) ||
      manifest.chunks.length === 0
    ) {
      return new Response(
        JSON.stringify({ error: "The TO-POST data manifest is invalid." }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    if (typeof DecompressionStream !== "function") {
      return new Response(
        JSON.stringify({ error: "This browser cannot open the compressed TO-POST data. Use a current browser." }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
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
      const failedResponse = chunkResponses[failedIndex];
      return new Response(
        JSON.stringify({ error: `Could not load TO-POST data part ${failedIndex + 1} (${failedResponse.status}).` }),
        { status: failedResponse.status, headers: { "Content-Type": "application/json" } }
      );
    }

    const chunks = await Promise.all(chunkResponses.map((response) => response.text()));
    const base64 = chunks.join("").replace(/\s+/g, "");
    const binary = atob(base64);
    const compressed = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const stream = new Blob([compressed])
      .stream()
      .pipeThrough(new DecompressionStream("gzip"));
    const jsonText = await new Response(stream).text();

    return new Response(jsonText, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store"
      }
    });
  };
})();