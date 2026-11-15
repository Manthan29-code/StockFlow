-- Default minimal seed
INSERT OR REPLACE INTO "meta" ("key", "value") VALUES ('revision', '0');

INSERT OR IGNORE INTO "units" ("id", "code", "name", "created_at", "updated_at", "version") VALUES
  ('018a9823-8c78-46f4-b67c-7cea0d4ffea3', 'kg', 'Kilograms', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 1),
  ('382fc8b5-2955-4f20-a3b7-9bda5aae922b', 'nos', 'Numbers / Pieces', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 1);

INSERT OR IGNORE INTO "users" ("id", "username", "password_hash", "role", "is_active", "color", "created_at", "updated_at", "version") VALUES
  ('3814ac5c-4996-450d-b30d-f702b433a49b', 'admin', '$2b$10$erZ88nQkxx9YYvg52LgMgejhf9b2qqQ7wqji9i.I5K./ueSmQszF2', 'admin', 1, '#635BFF', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 1);
