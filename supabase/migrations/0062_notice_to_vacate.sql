-- A resident's notice that they're leaving, recorded when they give it.
--
-- Until now the only place a notice to vacate existed was inside the move-out
-- walk-through notes, which are written weeks later when the keys come back.
-- So between "I'm leaving at the end of November" and the day they actually
-- went, the system knew nothing: the home still read as settled, the turn
-- couldn't be planned, and the date lived on a sticky note.
--
-- Recording it when it's given is what lets the make-ready be scheduled, the
-- listing go up early, and the owners see what's coming.

alter table unit_occupancy
  add column if not exists notice_given_on date,
  add column if not exists notice_move_out_on date,
  add column if not exists notice_reason text;

comment on column unit_occupancy.notice_given_on is
  'The day the resident told us they are leaving.';
comment on column unit_occupancy.notice_move_out_on is
  'The day they say they will be out — the date the turn gets planned around.';
comment on column unit_occupancy.notice_reason is
  'Why they are leaving, in their words. Useful on the renewal report.';

create index if not exists unit_occupancy_notice_move_out_idx
  on unit_occupancy (notice_move_out_on)
  where notice_move_out_on is not null;
