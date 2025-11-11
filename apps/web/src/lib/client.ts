import { QueryClient } from "@tanstack/react-query";
import type { App } from "@cloud/server";
import { treaty } from "@elysiajs/eden";
import SuperJSON from "superjson";
import { env } from "@/env";

export const queryClient = new QueryClient();

// Build an absolute base URL for treaty. If VITE_SERVER_URL is root-relative
// (e.g. "/api"), resolve it against the current origin to avoid protocol-
// relative URLs like "//api/..." which the browser interprets as host "api".
const baseUrl = env.VITE_SERVER_URL.startsWith("/")
  ? `${window.location.origin}${env.VITE_SERVER_URL}`
  : env.VITE_SERVER_URL;

export const client = treaty<App>(baseUrl, {
  async onResponse(response) {
    const json = await response.json();
    const superjsonMeta = response.headers.get("superjson-meta");
    const val = superjsonMeta
      ? SuperJSON.deserialize({ json, meta: JSON.parse(superjsonMeta) })
      : json;
    if (!response.ok) {
      throw val;
    }
    return val;
  },
  headers: {
    // Let the browser set a correct Origin automatically.
    // Only send our custom header used by the server serializer.
    "use-superjson": "true",
  },
  fetch: {
    credentials: "include",
  },
});
