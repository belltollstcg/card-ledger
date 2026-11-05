-- Card Ledger: save a trade in one transaction.
-- Run once in Supabase: SQL Editor > New query > paste > Run.
-- Safe to run again; it only adds a missing column and replaces the function.

-- Profit on a trade when the cash received is more than the cost of the cards
-- given up (carryover basis would go below zero).
alter table public.trades add column if not exists carryover_gain numeric not null default 0;

-- p = {
--   trade_date: 'YYYY-MM-DD', cash_paid: 0, cash_received: 0, counterparty: '', notes: '',
--   cards_out: [{ id, value }],
--   cards_in:  [{ cert, grader, grade, name, set_name, photo, value }]
-- }
-- Runs as the signed-in user (security invoker), so the existing Row Level
-- Security policies on cards and trades still apply. Any error rolls back
-- the whole trade.
create or replace function public.record_trade(p jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_trade_id public.trades.id%type;
  v_date  date    := coalesce(nullif(p->>'trade_date', '')::date, current_date);
  v_paid  numeric := coalesce(nullif(p->>'cash_paid', '')::numeric, 0);
  v_recv  numeric := coalesce(nullif(p->>'cash_received', '')::numeric, 0);
  v_out   jsonb   := coalesce(p->'cards_out', '[]'::jsonb);
  v_in    jsonb   := coalesce(p->'cards_in', '[]'::jsonb);
  v_n_out int     := jsonb_array_length(coalesce(p->'cards_out', '[]'::jsonb));
  v_n_in  int     := jsonb_array_length(coalesce(p->'cards_in', '[]'::jsonb));
  v_found int;
  v_out_cost numeric;
  v_basis numeric;
  v_gain  numeric := 0;
  v_in_total numeric;
  v_left  numeric;
  v_share numeric;
  v_i     int := 0;
  v_card  jsonb;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  if v_n_out = 0 or v_n_in = 0 then
    raise exception 'A trade needs at least one card going out and one coming in';
  end if;
  if v_paid < 0 or v_recv < 0 then
    raise exception 'Cash amounts cannot be negative';
  end if;
  if exists (select 1 from jsonb_array_elements(v_out || v_in) e
             where coalesce(nullif(e->>'value', '')::numeric, -1) < 0) then
    raise exception 'Every card needs a trade value of 0 or more';
  end if;
  if exists (select 1 from jsonb_array_elements(v_in) e
             where coalesce(trim(e->>'cert'), '') = '') then
    raise exception 'Every incoming card needs a cert number';
  end if;
  if (select count(distinct e->>'id') from jsonb_array_elements(v_out) e) <> v_n_out then
    raise exception 'The same outgoing card is listed twice';
  end if;

  -- Lock the outgoing cards and check they are all still in stock.
  select count(*), coalesce(sum(coalesce(x.cost, 0) + coalesce(x.buy_fees, 0)), 0)
    into v_found, v_out_cost
    from (select c.cost, c.buy_fees
            from public.cards c
           where c.id::text in (select e->>'id' from jsonb_array_elements(v_out) e)
             and c.status = 'inventory'
             for update) x;
  if v_found <> v_n_out then
    raise exception 'One or more outgoing cards are no longer in stock';
  end if;

  -- Carryover basis: cost of cards out + cash paid - cash received, never below 0.
  v_basis := v_out_cost + v_paid - v_recv;
  if v_basis < 0 then
    v_gain  := -v_basis;
    v_basis := 0;
  end if;
  select sum((e->>'value')::numeric) into v_in_total from jsonb_array_elements(v_in) e;

  insert into public.trades (trade_date, cash_paid, cash_received, counterparty, notes, carryover_gain)
  values (v_date, v_paid, v_recv,
          nullif(trim(p->>'counterparty'), ''), nullif(trim(p->>'notes'), ''), v_gain)
  returning id into v_trade_id;

  update public.cards c
     set status            = 'traded',
         disposed_trade_id = v_trade_id,
         trade_value_out   = (e->>'value')::numeric,
         trade_gain        = (e->>'value')::numeric - (coalesce(c.cost, 0) + coalesce(c.buy_fees, 0))
    from jsonb_array_elements(v_out) e
   where c.id::text = e->>'id';

  -- Split the carryover basis by trade value (equally if every value is 0),
  -- rounded to cents; the last card takes the remainder so the split adds up.
  v_left := v_basis;
  for v_card in select value from jsonb_array_elements(v_in) loop
    v_i := v_i + 1;
    if v_i = v_n_in then
      v_share := v_left;
    else
      v_share := case when v_in_total > 0
                      then round(v_basis * (v_card->>'value')::numeric / v_in_total, 2)
                      else round(v_basis / v_n_in, 2) end;
      v_share := least(v_share, v_left);
    end if;
    v_left := v_left - v_share;

    insert into public.cards (cert, grader, grade, name, set_name, photo,
                              cost, buy_fees, bought_on, status,
                              acquired_via, acquired_trade_id, trade_value_in, fmv_basis)
    values (trim(v_card->>'cert'), v_card->>'grader', v_card->>'grade', v_card->>'name',
            v_card->>'set_name', nullif(v_card->>'photo', ''),
            v_share, 0, v_date, 'inventory',
            'trade', v_trade_id, (v_card->>'value')::numeric, (v_card->>'value')::numeric);
  end loop;

  return jsonb_build_object('trade_id', v_trade_id,
                            'carryover_basis', v_basis,
                            'carryover_gain', v_gain);
end;
$$;

revoke execute on function public.record_trade(jsonb) from public, anon;
grant execute on function public.record_trade(jsonb) to authenticated;
