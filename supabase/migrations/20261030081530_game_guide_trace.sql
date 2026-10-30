-- Private owner/consented-player diagnostics; retain existing RLS and log RPCs.
begin;
alter table mdlxdcc_guide_private.game_events
  drop constraint game_events_kind_check;
alter table mdlxdcc_guide_private.game_events
  add constraint game_events_kind_check check (kind in
    ('player_message','agent_response','open_step','set_mode','mark_result','fair_play','cost','error','guide_trace'));
commit;
