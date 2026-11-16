import assert from "node:assert/strict";
import http from "node:http";
import { execFileSync, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";

// Run against an explicitly built, local test image. Never targets an existing deployment.
const image = process.env.TEST_DOCKER_IMAGE || "manito-pop:test";
const suffix = randomUUID().slice(0, 8);
const container = `manito-test-${suffix}`;
const volume = `manito-test-data-${suffix}`;
const origin = "https://manito.example.test";
const docker = (...args) =>
  execFileSync("docker", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
async function start(configureOrigin = true) {
  docker(
    "run",
    "--detach",
    "--rm",
    "--name",
    container,
    "--publish",
    "127.0.0.1::3000",
    "--mount",
    `type=volume,source=${volume},target=/data`,
    ...(configureOrigin ? ["--env", `APP_ORIGIN=${origin}`] : []),
    image,
  );
  const port = docker("port", container, "3000/tcp").split(":").at(-1);
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 120; i++) {
    try {
      if (
        (
          await fetch(`${base}/api/health`, {
            signal: AbortSignal.timeout(1000),
          })
        ).ok
      )
        return base;
    } catch {}
    await delay(500);
  }
  throw new Error("Container health endpoint did not become ready");
}
async function post(base, body, admin) {
  // Node fetch rewrites Host. Use http.request to model a reverse proxy faithfully.
  return new Promise((resolve, reject) => {
    const request = http.request(new URL(`${base}/api/rooms`), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: origin,
        Host: new URL(origin).host,
        "X-Forwarded-Proto": "https",
        ...(admin ? { Authorization: `Bearer ${admin}` } : {}),
      },
    }, response => {
      let raw = "";
      response.setEncoding("utf8");
      response.on("data", chunk => { raw += chunk; });
      response.on("error", reject);
      response.on("end", () => {
        try {
          assert.ok(response.statusCode >= 200 && response.statusCode < 300, `HTTP ${response.statusCode}`);
          resolve(JSON.parse(raw));
        } catch (error) { reject(error); }
      });
    });
    request.setTimeout(10000, () => request.destroy(new Error("Proxy request timed out")));
    request.on("error", reject);
    request.end(JSON.stringify(body));
  });
}

try {
  docker("volume", "create", volume);
  let base = await start();
  assert.equal(docker("exec", container, "id", "-u"), "1001");
  const html = await (await fetch(base)).text();
  assert.ok(html.includes("마니또 팝"));
  const assets = [
    ...new Set(
      [...html.matchAll(/(?:src|href)="([^"\s]+)"/g)]
        .map((m) => m[1])
        .filter((p) => p.startsWith("/") && /\.(?:js|css|svg)(?:\?|$)/.test(p)),
    ),
  ];
  assert.ok(assets.length > 0);
  for (const path of assets)
    assert.equal((await fetch(base + path)).status, 200, path);
  const suite = spawnSync(process.execPath, ["tests/api.integration.mjs"], {
    stdio: "inherit",
    env: { ...process.env, TEST_BASE_URL: base, TEST_APP_ORIGIN: origin },
  });
  assert.equal(suite.status, 0, "API integration suite");
  const room = await post(base, {
    action: "create",
    title: "볼륨 영속성 검증",
    names: ["첫째", "둘째", "셋째"],
  });
  await post(base, { action: "shuffle", id: room.id, round: 0 }, room.admin);
  const result = await post(base, {
    action: "reveal",
    id: room.id,
    name: "첫째",
    pin: "123456",
    pinConfirm: "123456",
  });
  const containerId = docker("inspect", "--format", "{{.Id}}", container);
  docker("stop", container);
  base = await start(false);
  assert.notEqual(
    docker("inspect", "--format", "{{.Id}}", container),
    containerId,
  );
  assert.deepEqual(
    await post(base, {
      action: "reveal",
      id: room.id,
      name: "첫째",
      pin: "123456",
    }),
    result,
  );
  await post(base, { action: "shuffle", id: room.id, round: 1 }, room.admin);
  const updated = await post(base, {
    action: "reveal",
    id: room.id,
    name: "첫째",
    pin: "123456",
  });
  assert.equal(updated.round, 2);
  assert.equal(
    docker(
      "exec",
      container,
      "node",
      "-e",
      "const {DatabaseSync}=require('node:sqlite');const db=new DatabaseSync(process.env.DATABASE_PATH);console.log(db.prepare('PRAGMA integrity_check').get().integrity_check);db.close()",
    ),
    "ok",
  );
  console.log(
    "PASS: Docker Node.js runtime, non-root user, fresh volume, page/assets, HTTPS origin, API suite, and unchanged assignments/PIN/admin access after container replacement.",
  );
} catch (error) {
  try {
    console.error(docker("logs", "--tail", "40", container));
  } catch {}
  throw error;
} finally {
  try {
    docker("stop", container);
  } catch {}
  try {
    docker("volume", "rm", volume);
  } catch {}
}
