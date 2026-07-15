"use strict";

(() => {
  const nativeFetch = window.fetch.bind(window);
  const additionalDataPath = "data/additional-sets.json";

  window.fetch = async function toPostFetch(input, init) {
    const requestUrl = typeof input === "string" ? input : input?.url || "";
    const normalizedUrl = new URL(requestUrl, window.location.href);
    const targetUrl = new URL(additionalDataPath, window.location.href);

    if (normalizedUrl.href !== targetUrl.href) {
      return nativeFetch(input, init);
    }

    const manifestResponse = await nativeFetch("data/manifest.json", { cache: "no-store" });
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
      manifest.chunks.map((path) => nativeFetch(`data/${path}`, { cache: "no-store" }))
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
