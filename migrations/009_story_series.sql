-- Story series (migration 009): a chapter's number within its level (map), the same as the "#N" in its title.
-- Chapters saved before this have it empty (stories are never edited); the stories page works their number out instead.
ALTER TABLE stories ADD COLUMN series INTEGER CHECK (series IS NULL OR series >= 1);
