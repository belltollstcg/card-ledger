-- Card Ledger: delete a trade in one transaction.
-- Run once in Supabase: SQL Editor > New query > paste > Run.
-- Safe to run again; it only replaces the function.
--
-- Undoes what record_trade() did:
--   * cards traded away go back to in stock (trade fields cleared)
--   * cards received in the trade are deleted
--   * the trade row is deleted
-- Refuses if any received card has since been sold or traded on, because
-- deleting it would erase that later sale or trade.
-- Returns the storage paths of the deleted cards' photos so the app can
-- remove them from the slabs bucket.
-- Runs as the signed-in user (security invoker), so Row Level Security applies.
create or replace function public.delete_trade(p_trade_id text)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_trade_id public.trades.id%type;
  v_blocking text;
  v_photos jsonb;
  v_restored int;
  v_deleted int;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  select t.id into v_trade_id
    from public.trades t
   where t.id::text = p_trade_id
     for update;
  if v_trade_id is null then
    raise exception 'Trade not found';
  end if;

  -- Lock every card in the trade.
  perform 1 from public.cards c
   where c.acquired_trade_id = v_trade_id or c.disposed_trade_id = v_trade_id
     for update;

  select string_agg(trim(concat_ws(' ', c.grader, c.grade, c.name)) || ' #' || c.cert
                    || ' (' || case c.status when 'sold' then 'sold' else 'traded again' end || ')', ', ')
    into v_blocking
    from public.cards c
   where c.acquired_trade_id = v_trade_id
     and (c.status <> 'inventory' or c.disposed_trade_id is not null);
  if v_blocking is not null then
    raise exception 'Can''t delete this trade. These cards from it have been sold or traded since: %. Undo that first.', v_blocking;
  end if;

  select coalesce(jsonb_agg(c.photo) filter (where c.photo is not null), '[]'::jsonb)
    into v_photos
    from public.cards c
   where c.acquired_trade_id = v_trade_id;

  delete from public.cards c where c.acquired_trade_id = v_trade_id;
  get diagnostics v_deleted = row_count;

  update public.cards c
     set status            = 'inventory',
         disposed_trade_id = null,
         trade_value_out   = null,
         trade_gain        = null
   where c.disposed_trade_id = v_trade_id;
  get diagnostics v_restored = row_count;

  delete from public.trades t where t.id = v_trade_id;

  return jsonb_build_object('restored', v_restored, 'deleted', v_deleted, 'photos', v_photos);
end;
$$;

revoke execute on function public.delete_trade(text) from public, anon;
grant execute on function public.delete_trade(text) to authenticated;
