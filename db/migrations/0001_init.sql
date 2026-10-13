create table if not exists students (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 100),
  note text check (char_length(note) <= 500),
  created_at timestamptz not null default now()
);

create table if not exists lessons (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students (id) on delete restrict,
  start_at timestamp not null check (date_trunc('minute', start_at) = start_at),
  duration_min integer not null check (duration_min between 5 and 480),
  note text check (char_length(note) <= 500),
  created_at timestamptz not null default now(),
  constraint lessons_no_overlap exclude using gist (
    (tsrange(start_at, start_at + duration_min * interval '1 minute')) with &&
  )
);

create index if not exists lessons_start_at_idx on lessons (start_at);
