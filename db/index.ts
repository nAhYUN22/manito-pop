import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

export type RoomRow = {
  id: string;
  admin_hash: string;
  data: string;
  revision: number;
};

/** Open the on-disk database and apply bounded, transactional schema upgrades. */
export function openDatabase(filename: string): DatabaseSync {
  mkdirSync(dirname(filename), { recursive: true });
  const db = new DatabaseSync(filename, { timeout: 5000 });
  try {
    db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
    db.exec("BEGIN IMMEDIATE");
    try {
      const { user_version: version } = db
        .prepare("PRAGMA user_version")
        .get() as { user_version: number };
      if (version > 1)
        throw new Error(
          "Database schema is newer than this application. Restore the matching application version.",
        );
      if (version < 1) {
        // Keep the existing room shape so an exported D1 rooms table remains compatible.
        db.exec(`CREATE TABLE IF NOT EXISTS rooms (
          id TEXT PRIMARY KEY NOT NULL,
          admin_hash TEXT NOT NULL,
          data TEXT NOT NULL,
          revision INTEGER NOT NULL DEFAULT 0
        ); PRAGMA user_version = 1;`);
      }
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
    return db;
  } catch (error) {
    db.close();
    throw error;
  }
}

const connection = globalThis as typeof globalThis & {
  manitoDatabase?: { path: string; db: DatabaseSync };
};

export function getDb(): DatabaseSync {
  const path = resolve(process.env.DATABASE_PATH || "./data/manito.sqlite");
  if (connection.manitoDatabase?.path !== path) {
    connection.manitoDatabase?.db.close();
    connection.manitoDatabase = { path, db: openDatabase(path) };
  }
  return connection.manitoDatabase.db;
}

export function findRoom(id: string): RoomRow | undefined {
  return getDb()
    .prepare("SELECT id, admin_hash, data, revision FROM rooms WHERE id = ?")
    .get(id) as RoomRow | undefined;
}

export function insertRoom(id: string, adminHash: string, data: string): void {
  getDb()
    .prepare(
      "INSERT INTO rooms (id, admin_hash, data, revision) VALUES (?, ?, ?, 0)",
    )
    .run(id, adminHash, data);
}

/** A single conditional write preserves correctness across concurrent requests. */
export function updateRoom(
  id: string,
  revision: number,
  data: string,
): boolean {
  return (
    getDb()
      .prepare(
        "UPDATE rooms SET data = ?, revision = revision + 1 WHERE id = ? AND revision = ?",
      )
      .run(data, id, revision).changes === 1
  );
}
