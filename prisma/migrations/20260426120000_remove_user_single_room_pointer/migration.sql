-- Users can participate in many rooms through the implicit Room.participants
-- join table. Remove the legacy single-room pointer on User that conflicts
-- with that model and incorrectly suggests one room per user.
ALTER TABLE "User"
DROP COLUMN IF EXISTS "roomId";
