-- 112: Clear penalty scores that were stored on a non-level aggregate tie.
-- CAF Confederations League QF leg 2: Gomora United 4-4 Kaizer Chiefs.
-- Leg 1 was Kaizer Chiefs 2-3 Gomora United, so the aggregate is 7-6 to
-- Gomora and the tie never needed a shootout. The portal used to ask for
-- penalties whenever the leg-2 score alone was a draw; those pen values are
-- spurious and are removed here. The aggregate winner is unchanged.
begin;
update public.results r
set pen_home_score = null,
    pen_away_score = null
where r.fixture_id = 'aee8f4d0-dd53-4679-ad80-26f06f811273'
  and r.home_score = 4
  and r.away_score = 4
  and r.pen_home_score = 5
  and r.pen_away_score = 4;
commit;
