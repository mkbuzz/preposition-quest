"use strict";

(() => {
  const nativeFetch = window.fetch.bind(window);
  const additionalDataPath = "data/additional-sets.json";
  const BUILD_VERSION = "4";
  const MAX_ATTEMPTS = 4;
  const setFiles = Array.from({ length: 10 }, (_, index) => `data/sets/set${index + 7}.json`);

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
      const responses = await Promise.all(
        setFiles.map((path, index) =>
          fetchWithRetry(
            `${path}?v=${BUILD_VERSION}`,
            init,
            `Set ${index + 7} data`
          )
        )
      );

      const failedIndex = responses.findIndex((response) => !response.ok);
      if (failedIndex !== -1) {
        const failedResponse = responses[failedIndex];
        throw new Error(`Set ${failedIndex + 7} data returned ${failedResponse.status}.`);
      }

      const sets = await Promise.all(responses.map((response) => response.json()));

      return new Response(JSON.stringify({
        schemaVersion: "to-post-direct-v1",
        label: "TO-POST",
        sets
      }), {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store"
        }
      });
    } catch (error) {
      console.error("TO-POST data loading failed", error);
      return new Response(
        JSON.stringify({ error: error?.message || "Could not load TO-POST set data." }),
        {
          status: 500,
          headers: { "Content-Type": "application/json; charset=utf-8" }
        }
      );
    }
  };
})();