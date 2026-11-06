-- Avatares de usuario e imágenes de liga guardados en la propia base de datos.

CREATE TABLE user_avatars (
    user_id bigint NOT NULL,
    content_type varchar(50) NOT NULL,
    data bytea NOT NULL,
    size_bytes integer NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT user_avatars_pkey PRIMARY KEY (user_id),
    CONSTRAINT user_avatars_user_id_fkey FOREIGN KEY (user_id) REFERENCES app_users (id) ON DELETE CASCADE
);

CREATE TABLE league_images (
    league_id bigint NOT NULL,
    content_type varchar(50) NOT NULL,
    data bytea NOT NULL,
    size_bytes integer NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT league_images_pkey PRIMARY KEY (league_id),
    CONSTRAINT league_images_league_id_fkey FOREIGN KEY (league_id) REFERENCES leagues (id) ON DELETE CASCADE
);
