import assert from "node:assert/strict";
const base = process.env.TEST_BASE_URL || "http://127.0.0.1:3000";
const requestOrigin = process.env.TEST_APP_ORIGIN || new URL(base).origin;
async function post(body, admin) {
  const res = await fetch(`${base}/api/rooms`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: requestOrigin,
      ...(admin ? { Authorization: `Bearer ${admin}` } : {}),
    },
    body: JSON.stringify(body),
  });
  return { status: res.status, data: await res.json() };
}
const names = [
  "테스트민지",
  "테스트지우",
  "테스트하린",
  "테스트수호",
  "테스트예린",
  "테스트도윤",
];
const { data: room, status } = await post({
  action: "create",
  title: "자동 검증용 모임",
  names,
});
assert.equal(status, 201);
const id = room.id;
assert.equal(
  (await post({ action: "create", title: "중복", names: ["민지", "민지"] }))
    .status,
  400,
);
assert.equal(
  (await post({ action: "create", title: "한 명", names: ["민지"] })).status,
  400,
);
assert.equal(
  (
    await post({
      action: "reveal",
      id,
      name: names[0],
      pin: "123456",
      pinConfirm: "123456",
    })
  ).status,
  409,
);
assert.equal((await post({ action: "shuffle", id, round: 0 })).status, 403);
const shuffled = await post({ action: "shuffle", id, round: 0 }, room.admin);
assert.equal(shuffled.status, 200);
assert.equal(shuffled.data.round, 1);
assert.equal(JSON.stringify(shuffled.data).includes("targets"), false);
const publicData = await (await fetch(`${base}/api/rooms?id=${id}`)).json();
assert.equal(publicData.people, undefined);
assert.equal(publicData.targets, undefined);
const revealed = await Promise.all(
  names.map((name, i) =>
    post({
      action: "reveal",
      id,
      name,
      pin: `12345${i}`,
      pinConfirm: `12345${i}`,
    }),
  ),
);
revealed.forEach((r, i) => {
  assert.equal(r.status, 200);
  assert.notEqual(r.data.target, names[i]);
  assert.equal(r.data.round, 1);
});
assert.equal(new Set(revealed.map((r) => r.data.target)).size, names.length);
const again = await post({
  action: "reveal",
  id,
  name: names[0],
  pin: "123450",
});
assert.deepEqual(again.data, revealed[0].data);
for (let i = 0; i < 5; i++)
  assert.equal(
    (await post({ action: "reveal", id, name: names[1], pin: "000000" }))
      .status,
    403,
  );
assert.equal(
  (await post({ action: "reveal", id, name: names[1], pin: "123451" })).status,
  429,
);
const races = await Promise.all([
  post({ action: "shuffle", id, round: 1 }, room.admin),
  post({ action: "shuffle", id, round: 1 }, room.admin),
]);
assert.deepEqual(races.map((r) => r.status).sort(), [200, 409]);
const second = await post({
  action: "reveal",
  id,
  name: names[0],
  pin: "123450",
});
assert.equal(second.data.round, 2);
assert.equal(
  (
    await post({
      action: "reveal",
      id,
      name: "다른 사람",
      pin: "123456",
      pinConfirm: "123456",
    })
  ).status,
  404,
);
const foreign = await fetch(`${base}/api/rooms`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Origin: "https://other.example",
  },
  body: JSON.stringify({ action: "shuffle", id, round: 2 }),
});
assert.equal(foreign.status, 403);
const stored = await (
  await fetch(`${base}/api/rooms?id=${id}`, {
    headers: { Authorization: `Bearer ${room.admin}` },
  })
).json();
assert.equal(stored.people.filter((p) => p.seen).length, 1);
console.log(
  "PASS: validation, persisted assignments, simultaneous reveals, no self/duplicate assignments, public privacy, admin authorization, PIN lockout, concurrent reshuffle, round invalidation, and origin checks.",
);
