-- Default minimal seed
INSERT OR REPLACE INTO "meta" ("key", "value") VALUES ('revision', '0');

INSERT OR IGNORE INTO "units" ("id", "code", "name", "created_at", "updated_at", "version") VALUES
  ('12885b12-c015-4f63-a5f5-268bc88c75c6', 'kg', 'Kilograms', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 1),
  ('07948cb9-5b55-4752-ad79-c17defa751aa', 'nos', 'Numbers / Pieces', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 1);

INSERT OR IGNORE INTO "users" ("id", "username", "password_hash", "role", "is_active", "color", "created_at", "updated_at", "version") VALUES
  ('dae75e24-b5e3-4d13-bd05-f8605fe8d04e', 'admin', '$2b$10$A5efCBDG32pA94mhftWL4eU7/a4UW3fRCgs2WuJ8/gDCfBTeaaxna', 'admin', 1, '#635BFF', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 1);
