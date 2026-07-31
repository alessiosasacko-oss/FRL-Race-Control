-- Existing themes intentionally remain null and resolve through the validated
-- FRL fallback. New drafts persist the full background configuration here.
ALTER TABLE "DesignTheme" ADD COLUMN "backgroundSettings" JSONB;
