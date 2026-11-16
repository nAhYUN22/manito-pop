import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { openDatabase } from "../db/index.ts";

test("SQLite initializes an empty volume and preserves room data across reopen", () => {
  const root = mkdtempSync(join(tmpdir(), "manito-db-"));
  const path = join(root, "nested", "manito.sqlite");
  let db;
  try {
    db = openDatabase(path);
    assert.equal(db.prepare("PRAGMA journal_mode").get().journal_mode, "wal");
    assert.equal(db.prepare("PRAGMA user_version").get().user_version, 1);
    db.prepare(
      "INSERT INTO rooms(id,admin_hash,data,revision) VALUES (?,?,?,0)",
    ).run("room", "hash", '{"round":1}');
    db.close();
    db = openDatabase(path);
    assert.equal(
      db.prepare("SELECT data FROM rooms WHERE id=?").get("room").data,
      '{"round":1}',
    );
    const other = openDatabase(path);
    try {
      const update =
        "UPDATE rooms SET revision=revision+1 WHERE id=? AND revision=?";
      assert.equal(db.prepare(update).run("room", 0).changes, 1);
      assert.equal(other.prepare(update).run("room", 0).changes, 0);
      assert.equal(
        other.prepare("SELECT revision FROM rooms WHERE id=?").get("room")
          .revision,
        1,
      );
    } finally {
      other.close();
    }
  } finally {
    if (db?.isOpen) db.close();
    rmSync(root, { recursive: true, force: true });
  }
});

test("schema initialization preserves an existing D1-shaped rooms table", () => {
  const root = mkdtempSync(join(tmpdir(), "manito-upgrade-"));
  const path = join(root, "db.sqlite");
  let db;
  try {
    db = new DatabaseSync(path);
    db.exec(
      "CREATE TABLE rooms(id TEXT PRIMARY KEY NOT NULL,admin_hash TEXT NOT NULL,data TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 0)",
    );
    db.prepare("INSERT INTO rooms VALUES(?,?,?,?)").run("old", "hash", "{}", 8);
    db.close();
    db = openDatabase(path);
    assert.equal(db.prepare("SELECT revision FROM rooms").get().revision, 8);
    db.exec("PRAGMA user_version=99");
    db.close();
    assert.throws(() => openDatabase(path), /newer/);
  } finally {
    if (db?.isOpen) db.close();
    rmSync(root, { recursive: true, force: true });
  }
});
