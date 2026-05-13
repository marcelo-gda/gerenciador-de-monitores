alter table events
  add column if not exists is_paid boolean not null default true;
