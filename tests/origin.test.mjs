import { test } from "node:test";
import assert from "node:assert/strict";
import { hasAllowedOrigin } from "../lib/request-origin.ts";
const request = (headers) =>
  new Request("http://localhost:3000/api/rooms", { headers });
test("allows same-origin local requests and HTTPS requests through Coolify", () => {
  assert.ok(hasAllowedOrigin(request({ origin: "http://localhost:3000" }), ""));
  assert.ok(
    hasAllowedOrigin(
      request({
        origin: "https://manito.example.com",
        host: "manito.example.com",
        "x-forwarded-proto": "https",
      }),
      "",
    ),
  );
  assert.ok(
    hasAllowedOrigin(
      request({ origin: "https://manito.example.com" }),
      "https://manito.example.com/",
    ),
  );
});
test("rejects foreign, malformed, and forged forwarded-host origins", () => {
  assert.equal(
    hasAllowedOrigin(request({ origin: "https://evil.example" }), ""),
    false,
  );
  assert.equal(
    hasAllowedOrigin(
      request({
        origin: "https://evil.example",
        "x-forwarded-host": "evil.example",
        "x-forwarded-proto": "https",
      }),
      "",
    ),
    false,
  );
  assert.equal(
    hasAllowedOrigin(
      request({ origin: "https://evil.example", host: "evil.example" }),
      "https://manito.example.com",
    ),
    false,
  );
  assert.equal(hasAllowedOrigin(request({ origin: "null" }), ""), false);
  assert.equal(
    hasAllowedOrigin(request({ origin: "http://localhost:3000" }), "not-a-url"),
    false,
  );
});
