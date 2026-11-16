CREATE TABLE `rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`admin_hash` text NOT NULL,
	`data` text NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL
);
