const baseUrl = process.env.FRL_LOAD_TEST_URL ?? "http://localhost:3000";
export {};
const url = new URL(baseUrl);
const localHost = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1";

if (!localHost && process.env.FRL_LOAD_TEST_ALLOW_REMOTE !== "true") {
  throw new Error("Der Lasttest ist nur lokal oder mit expliziter Testfreigabe erlaubt.");
}

const paths = ["/dashboard", "/teams", "/drivers", "/notifications"];

async function simulate(users: number) {
  const startedAt = performance.now();
  const responses = await Promise.all(
    Array.from({ length: users }, (_, userIndex) =>
      Promise.all(paths.map(async (path) => {
        const response = await fetch(new URL(path, url), {
          redirect: "manual",
          headers: { "x-frl-load-test-user": String(userIndex + 1) },
        });
        return { path, status: response.status };
      })),
    ),
  );
  return {
    users,
    requests: responses.flat().length,
    durationMs: Math.round(performance.now() - startedAt),
    statuses: [...new Set(responses.flat().map((response) => response.status))],
  };
}

for (const users of [3, 10]) {
  console.info(await simulate(users));
}
