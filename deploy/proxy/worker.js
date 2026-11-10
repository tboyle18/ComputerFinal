// Hosting shim for A-V1, A-V2 and B-V1 (not part of any build's code).
//
// All builds share one free Supabase project. Each of these three builds keeps its data in
// its own Postgres schema (a_v1, a_v2, b_v1) and its own storage buckets ("a-v1-listing-images").
// The build is compiled with VITE_SUPABASE_URL = https://<build>.boyletb8.workers.dev/sb,
// so every Supabase call goes through this Worker, which:
//   - sends /rest/v1 calls to the build's schema (Accept-Profile / Content-Profile headers)
//   - renames storage buckets in /storage/v1 paths to the build's prefixed buckets
//   - passes everything else (auth, realtime, functions) straight through
// Requests that don't start with /sb/ are served from the build's static files.

const BUCKETS = ["listing-images", "avatars"];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/sb/")) return env.ASSETS.fetch(request);

    const upstream = new URL(env.SUPABASE_UPSTREAM);
    let path = url.pathname.slice(3); // drop "/sb"

    if (path.startsWith("/storage/v1/")) {
      path = path
        .split("/")
        .map((seg) => (BUCKETS.includes(seg) ? `${env.BUCKET_PREFIX}-${seg}` : seg))
        .join("/");
    }

    const target = new URL(path + url.search, upstream);
    const headers = new Headers(request.headers);
    headers.delete("host");

    if (path.startsWith("/rest/v1/")) {
      headers.delete("accept-profile");
      headers.delete("content-profile");
      const reads = request.method === "GET" || request.method === "HEAD";
      headers.set(reads ? "Accept-Profile" : "Content-Profile", env.SCHEMA);
    }

    return fetch(new Request(target, {
      method: request.method,
      headers,
      body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
      redirect: "manual",
    }));
  },
};
