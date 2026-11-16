import { findRoom, insertRoom, updateRoom } from "../../../db";
import { hasAllowedOrigin } from "../../../lib/request-origin";

import { draw } from "../../../lib/draw";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Person = {
  name: string;
  salt?: string;
  pin?: string;
  failures?: number;
  lockedUntil?: number;
  seen?: number;
};
type Room = {
  title: string;
  people: Person[];
  targets: number[];
  round: number;
  drawnAt?: string;
};
class Problem extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
const json = (data: unknown, status = 200) =>
  Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
const token = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(32)), (x) =>
    x.toString(16).padStart(2, "0"),
  ).join("");
async function hash(value: string) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
    (x) => x.toString(16).padStart(2, "0"),
  ).join("");
}
async function pinHash(pin: string, salt: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(pin),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  return Array.from(
    new Uint8Array(
      await crypto.subtle.deriveBits(
        {
          name: "PBKDF2",
          salt: new TextEncoder().encode(salt),
          iterations: 100000,
          hash: "SHA-256",
        },
        key,
        256,
      ),
    ),
    (x) => x.toString(16).padStart(2, "0"),
  ).join("");
}
const normalize = (s: string) => s.normalize("NFC").trim().replace(/\s+/g, " ");
function summary(room: Room, admin: boolean) {
  return {
    title: room.title,
    count: room.people.length,
    round: room.round,
    drawnAt: room.drawnAt,
    ...(admin
      ? {
          people: room.people.map((p) => ({
            name: p.name,
            registered: !!p.pin,
            seen: p.seen === room.round && room.round > 0,
          })),
        }
      : {}),
  };
}
async function getRow(id: string) {
  const row = findRoom(id);
  if (!row)
    throw new Problem("모임을 찾을 수 없어요. 초대 링크를 확인해주세요.", 404);
  return row;
}
export async function GET(req: Request) {
  try {
    const id = new URL(req.url).searchParams.get("id") || "";
    const row = await getRow(id);
    const auth = req.headers.get("Authorization")?.replace(/^Bearer /, "");
    if (auth && (await hash(auth)) !== row.admin_hash)
      throw new Problem("관리자 링크가 올바르지 않아요.", 403);
    return json(summary(JSON.parse(row.data), !!auth));
  } catch (e) {
    return fail(e);
  }
}
function fail(e: unknown) {
  if (!(e instanceof Problem))
    console.error(
      "Room request failed:",
      e instanceof Error ? e.message : "Unknown error",
    );
  return json(
    {
      error:
        e instanceof Problem
          ? e.message
          : "처리하지 못했어요. 잠시 후 다시 시도해주세요.",
    },
    e instanceof Problem ? e.status : 500,
  );
}
export async function POST(req: Request) {
  try {
    if (!hasAllowedOrigin(req))
      throw new Problem("허용되지 않은 요청이에요.", 403);
    const raw = await req.text();
    if (raw.length > 12000) throw new Problem("입력 내용이 너무 길어요.");
    let b;
    try {
      b = JSON.parse(raw);
    } catch {
      throw new Problem("요청 형식이 올바르지 않아요.");
    }
    if (!b || typeof b !== "object")
      throw new Problem("요청 형식이 올바르지 않아요.");
    if (b.action === "create") {
      const title = typeof b.title === "string" ? normalize(b.title) : "";
      if (!title || title.length > 40)
        throw new Problem("모임 이름은 1~40자로 적어주세요.");
      if (
        !Array.isArray(b.names) ||
        b.names.length < 2 ||
        b.names.length > 100 ||
        b.names.some((n: unknown) => typeof n !== "string")
      )
        throw new Problem("참가자는 2~100명이 필요해요.");
      const names = b.names.map(normalize);
      if (names.some((n: string) => !n || n.length > 20))
        throw new Problem("참가자 이름은 1~20자로 적어주세요.");
      if (
        new Set(names.map((n: string) => n.toLocaleLowerCase())).size !==
        names.length
      )
        throw new Problem(
          "같은 이름이 있어요. 성이나 별명을 붙여 구분해주세요.",
        );
      const id = crypto.randomUUID();
      const admin = token();
      const room: Room = {
        title,
        people: names.map((name: string) => ({ name })),
        targets: [],
        round: 0,
      };
      insertRoom(id, await hash(admin), JSON.stringify(room));
      return json({ id, admin, ...summary(room, true) }, 201);
    }
    if (!["shuffle", "reveal"].includes(b.action) || typeof b.id !== "string")
      throw new Problem("올바르지 않은 요청이에요.");
    for (let attempt = 0; attempt < 6; attempt++) {
      const row = await getRow(b.id);
      const room: Room = JSON.parse(row.data);
      let result: unknown;
      let error: Problem | undefined;
      if (b.action === "shuffle") {
        const auth =
          req.headers.get("Authorization")?.replace(/^Bearer /, "") || "";
        if ((await hash(auth)) !== row.admin_hash)
          throw new Problem("관리자만 다시 섞을 수 있어요.", 403);
        if (b.round !== room.round)
          throw new Problem(
            "추첨 상태가 바뀌었어요. 새로고침 후 확인해주세요.",
            409,
          );
        room.targets = draw(room.people.length);
        room.round++;
        room.drawnAt = new Date().toISOString();
        result = summary(room, true);
      } else {
        if (!room.round)
          throw new Problem(
            "아직 추첨 전이에요. 관리자가 섞을 때까지 기다려주세요.",
            409,
          );
        if (
          typeof b.name !== "string" ||
          typeof b.pin !== "string" ||
          !/^\d{6}$/.test(b.pin)
        )
          throw new Problem("이름과 숫자 6자리 확인번호를 입력해주세요.");
        const index = room.people.findIndex(
          (p) =>
            p.name.toLocaleLowerCase() ===
            normalize(b.name).toLocaleLowerCase(),
        );
        if (index < 0)
          throw new Problem(
            "등록된 이름을 확인해주세요. 성이나 별명도 똑같이 입력해주세요.",
            404,
          );
        const person = room.people[index];
        if ((person.lockedUntil || 0) > Date.now())
          throw new Problem(
            "확인번호를 여러 번 틀렸어요. 10분 후 다시 시도해주세요.",
            429,
          );
        if (person.lockedUntil && person.lockedUntil <= Date.now()) {
          person.failures = 0;
          person.lockedUntil = 0;
        }
        if (!person.pin) {
          if (b.pin !== b.pinConfirm)
            throw new Problem("처음 등록할 확인번호를 한 번 더 입력해주세요.");
          person.salt = token();
          person.pin = await pinHash(b.pin, person.salt);
        } else if ((await pinHash(b.pin, person.salt!)) !== person.pin) {
          person.failures = (person.failures || 0) + 1;
          if (person.failures >= 5) person.lockedUntil = Date.now() + 600000;
          error = new Problem(
            "확인번호가 맞지 않아요. 처음 설정한 번호를 입력해주세요.",
            403,
          );
        }
        if (!error) {
          person.failures = 0;
          person.lockedUntil = 0;
          person.seen = room.round;
          result = {
            name: person.name,
            target: room.people[room.targets[index]].name,
            round: room.round,
          };
        }
      }
      const updated = updateRoom(b.id, row.revision, JSON.stringify(room));
      if (updated) {
        if (error) throw error;
        return json(result);
      }
    }
    throw new Problem(
      "다른 요청을 처리 중이에요. 잠시 후 다시 시도해주세요.",
      409,
    );
  } catch (e) {
    return fail(e);
  }
}
