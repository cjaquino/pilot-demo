CREATE TABLE IF NOT EXISTS todolists (
  id serial PRIMARY KEY,
  title text UNIQUE NOT NULL CHECK(length(title) > 0 AND length(title) <= 100),
);

CREATE TABLE IF NOT EXISTS todos (
  id serial PRIMARY KEY,
  title text NOT NULL CHECK(length(title) > 0 AND length(title) <= 100),
  done boolean NOT NULL DEFAULT false,
  todolist_id integer NOT NULL REFERENCES todolists (id) ON DELETE CASCADE
);
