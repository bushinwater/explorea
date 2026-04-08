-- ============================================================
--  Turistički vodič — PostgreSQL DDL (ažurirana verzija)
--  Izmene: countries tabela, hero_image_url, popularity,
--          lokacija korisnika, country_id na glavnim entitetima
--  PostgreSQL + PostGIS + .NET 8 + EF Core + Npgsql
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ------------------------------------------------------------
-- 1. LOOKUP: REGIONI I GRADOVI
-- ------------------------------------------------------------
CREATE TABLE regions (
    id                SERIAL PRIMARY KEY,
    name              VARCHAR(100) NOT NULL UNIQUE,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by        UUID,
    updated_by        UUID
);

CREATE TABLE cities (
    id                SERIAL PRIMARY KEY,
    region_id         INT REFERENCES regions(id) ON DELETE SET NULL,
    name              VARCHAR(100) NOT NULL,
    latitude          DOUBLE PRECISION NOT NULL,
    longitude         DOUBLE PRECISION NOT NULL,
    location          GEOGRAPHY(POINT, 4326) NOT NULL,
    cover_image_url   VARCHAR(500),
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by        UUID,
    updated_by        UUID,
    UNIQUE (region_id, name),
    CHECK (latitude BETWEEN -90 AND 90),
    CHECK (longitude BETWEEN -180 AND 180)
);

CREATE INDEX idx_cities_region ON cities(region_id);
CREATE INDEX idx_cities_location ON cities USING GIST (location);

-- ------------------------------------------------------------
-- 2. COUNTRIES (novo)
-- ------------------------------------------------------------
CREATE TABLE countries (
    id                SERIAL PRIMARY KEY,
    name              VARCHAR(100) NOT NULL UNIQUE,
    code              VARCHAR(3)   NOT NULL UNIQUE,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by        UUID,
    updated_by        UUID
);

CREATE INDEX idx_countries_code ON countries(code);

-- ------------------------------------------------------------
-- 3. KORISNICI, ULOGE I AUTENTIKACIJA
-- ------------------------------------------------------------
CREATE TABLE roles (
    id                 SERIAL PRIMARY KEY,
    name               VARCHAR(50)  NOT NULL UNIQUE,
    description        VARCHAR(255),
    created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by         UUID,
    updated_by         UUID
);

CREATE TABLE users (
    id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    first_name           VARCHAR(100) NOT NULL,
    last_name            VARCHAR(100) NOT NULL,
    email                VARCHAR(255) NOT NULL UNIQUE,
    password_hash        VARCHAR(512),
    role_id              INT          NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    traveler_rank        VARCHAR(50)  NOT NULL DEFAULT 'explorer',
    total_visits         INT          NOT NULL DEFAULT 0 CHECK (total_visits >= 0),
    member_since         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    email_verified_at    TIMESTAMPTZ,
    last_login_at        TIMESTAMPTZ,
    is_active            BOOLEAN      NOT NULL DEFAULT TRUE,
    gender               VARCHAR(20),
    date_of_birth        DATE,
    profile_image_url    VARCHAR(500),
    current_latitude     DOUBLE PRECISION,
    current_longitude    DOUBLE PRECISION,
    current_location     GEOGRAPHY(POINT, 4326),
    current_city_id      INT REFERENCES cities(id) ON DELETE SET NULL,
    created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by           UUID,
    updated_by           UUID,
    CHECK (password_hash IS NULL OR length(password_hash) >= 20)
);

CREATE INDEX idx_users_role_id ON users(role_id);
CREATE INDEX idx_users_active ON users(is_active);
CREATE INDEX idx_users_current_city ON users(current_city_id);
CREATE INDEX idx_users_current_location ON users USING GIST (current_location);

CREATE TABLE user_auth_accounts (
    id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id            UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider           VARCHAR(50)  NOT NULL,
    provider_user_id   VARCHAR(255),
    email_at_provider  VARCHAR(255),
    is_primary         BOOLEAN      NOT NULL DEFAULT FALSE,
    access_token       TEXT,
    refresh_token      TEXT,
    token_expires_at   TIMESTAMPTZ,
    created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by         UUID,
    updated_by         UUID,
    CHECK (provider IN ('local', 'google', 'facebook', 'apple')),
    CHECK ((provider = 'local' AND provider_user_id IS NULL) OR (provider <> 'local' AND provider_user_id IS NOT NULL))
);

CREATE UNIQUE INDEX uq_user_auth_accounts_provider_uid
    ON user_auth_accounts(provider, provider_user_id)
    WHERE provider_user_id IS NOT NULL;

CREATE UNIQUE INDEX uq_user_auth_accounts_primary_per_user
    ON user_auth_accounts(user_id)
    WHERE is_primary = TRUE;

CREATE INDEX idx_user_auth_accounts_user_id ON user_auth_accounts(user_id);
CREATE INDEX idx_user_auth_accounts_provider ON user_auth_accounts(provider);

CREATE TABLE refresh_tokens (
    id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id            UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash         VARCHAR(512) NOT NULL UNIQUE,
    expires_at         TIMESTAMPTZ  NOT NULL,
    created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by_ip      INET,
    revoked_at         TIMESTAMPTZ,
    revoked_by_ip      INET,
    replaced_by_token  VARCHAR(512),
    device_info        VARCHAR(255),
    is_revoked         BOOLEAN      NOT NULL DEFAULT FALSE,
    created_by         UUID,
    updated_by         UUID,
    CHECK (expires_at > created_at),
    CHECK ((is_revoked = FALSE AND revoked_at IS NULL) OR (is_revoked = TRUE AND revoked_at IS NOT NULL))
);

CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);
CREATE INDEX idx_refresh_tokens_active ON refresh_tokens(user_id, is_revoked, expires_at);

CREATE TABLE password_reset_tokens (
    id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id            UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash         VARCHAR(512) NOT NULL UNIQUE,
    expires_at         TIMESTAMPTZ  NOT NULL,
    used_at            TIMESTAMPTZ,
    created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by         UUID,
    updated_by         UUID,
    CHECK (expires_at > created_at)
);

CREATE INDEX idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
CREATE INDEX idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);

CREATE TABLE email_verifications (
    id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id            UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email              VARCHAR(255) NOT NULL,
    token_hash         VARCHAR(512) NOT NULL UNIQUE,
    expires_at         TIMESTAMPTZ  NOT NULL,
    verified_at        TIMESTAMPTZ,
    created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by         UUID,
    updated_by         UUID,
    CHECK (expires_at > created_at)
);

CREATE INDEX idx_email_verifications_user_id ON email_verifications(user_id);
CREATE INDEX idx_email_verifications_email ON email_verifications(email);
CREATE INDEX idx_email_verifications_expires_at ON email_verifications(expires_at);
CREATE INDEX idx_email_verifications_pending ON email_verifications(user_id, email)
    WHERE verified_at IS NULL;

CREATE TABLE user_preferences (
    id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id               UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    theme                 VARCHAR(20)  NOT NULL DEFAULT 'system',
    language              VARCHAR(10)  NOT NULL DEFAULT 'sr',
    notifications_enabled BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by            UUID,
    updated_by            UUID,
    UNIQUE (user_id)
);

-- ------------------------------------------------------------
-- 4. DESTINACIJE
-- ------------------------------------------------------------
CREATE TABLE destinations (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    city_id           INT REFERENCES cities(id) ON DELETE SET NULL,
    country_id        INT REFERENCES countries(id) ON DELETE SET NULL,
    name              VARCHAR(200)     NOT NULL,
    slug              VARCHAR(220)     NOT NULL,
    description       TEXT,
    latitude          DOUBLE PRECISION NOT NULL,
    longitude         DOUBLE PRECISION NOT NULL,
    location          GEOGRAPHY(POINT, 4326) NOT NULL,
    preview_image_url VARCHAR(500),
    hero_image_url    VARCHAR(500),
    avg_rating        NUMERIC(3,2)     NOT NULL DEFAULT 0,
    popularity        INT              NOT NULL DEFAULT 0 CHECK (popularity >= 0),
    is_featured       BOOLEAN          NOT NULL DEFAULT FALSE,
    is_deleted        BOOLEAN          NOT NULL DEFAULT FALSE,
    deleted_at        TIMESTAMPTZ,
    search_vector     TSVECTOR,
    created_at        TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
    created_by        UUID,
    updated_by        UUID,
    CHECK (latitude BETWEEN -90 AND 90),
    CHECK (longitude BETWEEN -180 AND 180),
    CHECK (avg_rating BETWEEN 0 AND 5),
    CHECK ((is_deleted = FALSE AND deleted_at IS NULL) OR (is_deleted = TRUE AND deleted_at IS NOT NULL))
);

CREATE UNIQUE INDEX uq_destinations_city_slug_active
    ON destinations(city_id, slug)
    WHERE is_deleted = FALSE AND city_id IS NOT NULL;

CREATE UNIQUE INDEX uq_destinations_slug_without_city_active
    ON destinations(slug)
    WHERE is_deleted = FALSE AND city_id IS NULL;

CREATE INDEX idx_destinations_city ON destinations(city_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_destinations_country ON destinations(country_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_destinations_featured ON destinations(is_featured) WHERE is_featured = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_destinations_popularity ON destinations(popularity DESC) WHERE is_deleted = FALSE;
CREATE INDEX idx_destinations_name_trgm ON destinations USING GIN (name gin_trgm_ops);
CREATE INDEX idx_destinations_location ON destinations USING GIST (location) WHERE is_deleted = FALSE;
CREATE INDEX idx_destinations_search_vector ON destinations USING GIN (search_vector);

CREATE TABLE destination_images (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    destination_id    UUID         NOT NULL REFERENCES destinations(id) ON DELETE CASCADE,
    image_url         VARCHAR(500) NOT NULL,
    sort_order        INT          NOT NULL DEFAULT 0,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by        UUID,
    updated_by        UUID
);

-- ------------------------------------------------------------
-- 5. MESTA / OBJEKTI
-- ------------------------------------------------------------
CREATE TABLE place_types (
    id                SERIAL PRIMARY KEY,
    name              VARCHAR(100) NOT NULL UNIQUE,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by        UUID,
    updated_by        UUID
);

CREATE TABLE places (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    city_id           INT REFERENCES cities(id) ON DELETE SET NULL,
    destination_id    UUID REFERENCES destinations(id) ON DELETE SET NULL,
    country_id        INT REFERENCES countries(id) ON DELETE SET NULL,
    type_id           INT REFERENCES place_types(id) ON DELETE SET NULL,
    name              VARCHAR(200)     NOT NULL,
    slug              VARCHAR(220)     NOT NULL,
    description       TEXT,
    address           VARCHAR(300),
    latitude          DOUBLE PRECISION NOT NULL,
    longitude         DOUBLE PRECISION NOT NULL,
    location          GEOGRAPHY(POINT, 4326) NOT NULL,
    price_range       VARCHAR(50),
    phone             VARCHAR(50),
    website_url       VARCHAR(500),
    avg_rating        NUMERIC(3,2)     NOT NULL DEFAULT 0,
    popularity        INT              NOT NULL DEFAULT 0 CHECK (popularity >= 0),
    is_featured       BOOLEAN          NOT NULL DEFAULT FALSE,
    is_deleted        BOOLEAN          NOT NULL DEFAULT FALSE,
    deleted_at        TIMESTAMPTZ,
    search_vector     TSVECTOR,
    created_at        TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
    created_by        UUID,
    updated_by        UUID,
    CHECK (latitude BETWEEN -90 AND 90),
    CHECK (longitude BETWEEN -180 AND 180),
    CHECK (avg_rating BETWEEN 0 AND 5),
    CHECK ((is_deleted = FALSE AND deleted_at IS NULL) OR (is_deleted = TRUE AND deleted_at IS NOT NULL))
);

CREATE UNIQUE INDEX uq_places_city_slug_active
    ON places(city_id, slug)
    WHERE is_deleted = FALSE AND city_id IS NOT NULL;

CREATE UNIQUE INDEX uq_places_slug_without_city_active
    ON places(slug)
    WHERE is_deleted = FALSE AND city_id IS NULL;

CREATE INDEX idx_places_city ON places(city_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_places_country ON places(country_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_places_destination ON places(destination_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_places_type ON places(type_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_places_featured ON places(is_featured) WHERE is_featured = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_places_popularity ON places(popularity DESC) WHERE is_deleted = FALSE;
CREATE INDEX idx_places_name_trgm ON places USING GIN (name gin_trgm_ops);
CREATE INDEX idx_places_location ON places USING GIST (location) WHERE is_deleted = FALSE;
CREATE INDEX idx_places_search_vector ON places USING GIN (search_vector);

CREATE TABLE place_images (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    place_id          UUID         NOT NULL REFERENCES places(id) ON DELETE CASCADE,
    image_url         VARCHAR(500) NOT NULL,
    caption           VARCHAR(300),
    sort_order        INT          NOT NULL DEFAULT 0,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by        UUID,
    updated_by        UUID
);

CREATE TABLE place_amenities (
    id                SERIAL PRIMARY KEY,
    name              VARCHAR(100) NOT NULL UNIQUE,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by        UUID,
    updated_by        UUID
);

CREATE TABLE place_amenity_links (
    place_id          UUID NOT NULL REFERENCES places(id) ON DELETE CASCADE,
    amenity_id        INT  NOT NULL REFERENCES place_amenities(id) ON DELETE CASCADE,
    PRIMARY KEY (place_id, amenity_id)
);

CREATE TABLE place_working_days (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    place_id          UUID         NOT NULL REFERENCES places(id) ON DELETE CASCADE,
    day_of_week       SMALLINT     NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
    is_closed         BOOLEAN      NOT NULL DEFAULT FALSE,
    note              VARCHAR(200),
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by        UUID,
    updated_by        UUID,
    UNIQUE (place_id, day_of_week)
);

CREATE TABLE place_working_hour_intervals (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    working_day_id    UUID         NOT NULL REFERENCES place_working_days(id) ON DELETE CASCADE,
    opens_at          TIME         NOT NULL,
    closes_at         TIME         NOT NULL,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by        UUID,
    updated_by        UUID,
    CHECK (closes_at > opens_at)
);

CREATE INDEX idx_place_working_days_place ON place_working_days(place_id);
CREATE INDEX idx_place_working_intervals_day ON place_working_hour_intervals(working_day_id);

-- ------------------------------------------------------------
-- 6. TIPOVI DOGAĐAJA
-- ------------------------------------------------------------
CREATE TABLE event_types (
    id                SERIAL PRIMARY KEY,
    name              VARCHAR(100) NOT NULL UNIQUE,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by        UUID,
    updated_by        UUID
);

-- ------------------------------------------------------------
-- 7. DOGAĐAJI
-- ------------------------------------------------------------
CREATE TABLE events (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    city_id           INT REFERENCES cities(id) ON DELETE SET NULL,
    destination_id    UUID REFERENCES destinations(id) ON DELETE SET NULL,
    place_id          UUID REFERENCES places(id) ON DELETE SET NULL,
    country_id        INT REFERENCES countries(id) ON DELETE SET NULL,
    type_id           INT              NOT NULL REFERENCES event_types(id) ON DELETE RESTRICT,
    name              VARCHAR(200)     NOT NULL,
    slug              VARCHAR(220)     NOT NULL,
    start_datetime    TIMESTAMPTZ      NOT NULL,
    end_datetime      TIMESTAMPTZ      NOT NULL,
    price             NUMERIC(10,2),
    address           VARCHAR(300),
    latitude          DOUBLE PRECISION,
    longitude         DOUBLE PRECISION,
    location          GEOGRAPHY(POINT, 4326),
    description       TEXT,
    ticket_url        VARCHAR(500),
    popularity        INT              NOT NULL DEFAULT 0 CHECK (popularity >= 0),
    is_featured       BOOLEAN          NOT NULL DEFAULT FALSE,
    is_deleted        BOOLEAN          NOT NULL DEFAULT FALSE,
    deleted_at        TIMESTAMPTZ,
    search_vector     TSVECTOR,
    created_at        TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
    created_by        UUID,
    updated_by        UUID,
    CHECK (end_datetime >= start_datetime),
    CHECK (price IS NULL OR price >= 0),
    CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
    CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180),
    CHECK (((latitude IS NULL) AND (longitude IS NULL) AND (location IS NULL)) OR ((latitude IS NOT NULL) AND (longitude IS NOT NULL) AND (location IS NOT NULL))),
    CHECK ((is_deleted = FALSE AND deleted_at IS NULL) OR (is_deleted = TRUE AND deleted_at IS NOT NULL))
);

CREATE UNIQUE INDEX uq_events_city_slug_active
    ON events(city_id, slug)
    WHERE is_deleted = FALSE AND city_id IS NOT NULL;

CREATE UNIQUE INDEX uq_events_slug_without_city_active
    ON events(slug)
    WHERE is_deleted = FALSE AND city_id IS NULL;

CREATE INDEX idx_events_city ON events(city_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_events_country ON events(country_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_events_destination ON events(destination_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_events_place ON events(place_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_events_type ON events(type_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_events_start ON events(start_datetime) WHERE is_deleted = FALSE;
CREATE INDEX idx_events_start_end ON events(start_datetime, end_datetime) WHERE is_deleted = FALSE;
CREATE INDEX idx_events_featured ON events(is_featured) WHERE is_featured = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_events_popularity ON events(popularity DESC) WHERE is_deleted = FALSE;
CREATE INDEX idx_events_name_trgm ON events USING GIN (name gin_trgm_ops);
CREATE INDEX idx_events_location ON events USING GIST (location) WHERE is_deleted = FALSE AND location IS NOT NULL;
CREATE INDEX idx_events_search_vector ON events USING GIN (search_vector);

CREATE TABLE event_images (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id          UUID         NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    image_url         VARCHAR(500) NOT NULL,
    caption           VARCHAR(300),
    sort_order        INT          NOT NULL DEFAULT 0,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by        UUID,
    updated_by        UUID
);

-- ------------------------------------------------------------
-- 8. KATEGORIJE I SEZONE AKTIVNOSTI
-- ------------------------------------------------------------
CREATE TABLE activity_categories (
    id                SERIAL PRIMARY KEY,
    name              VARCHAR(100) NOT NULL UNIQUE,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by        UUID,
    updated_by        UUID
);

CREATE TABLE seasons (
    id                SERIAL PRIMARY KEY,
    name              VARCHAR(50) NOT NULL UNIQUE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by        UUID,
    updated_by        UUID
);

-- ------------------------------------------------------------
-- 9. AKTIVNOSTI
-- ------------------------------------------------------------
CREATE TABLE activities (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    city_id           INT REFERENCES cities(id) ON DELETE SET NULL,
    destination_id    UUID REFERENCES destinations(id) ON DELETE SET NULL,
    place_id          UUID REFERENCES places(id) ON DELETE SET NULL,
    country_id        INT REFERENCES countries(id) ON DELETE SET NULL,
    category_id       INT              NOT NULL REFERENCES activity_categories(id) ON DELETE RESTRICT,
    season_id         INT REFERENCES seasons(id) ON DELETE SET NULL,
    name              VARCHAR(200)     NOT NULL,
    slug              VARCHAR(220)     NOT NULL,
    description       TEXT,
    price             NUMERIC(10,2),
    duration_minutes  INT,
    difficulty_level  VARCHAR(50),
    distance_km       NUMERIC(8,2),
    start_point       VARCHAR(200),
    avg_rating        NUMERIC(3,2)     NOT NULL DEFAULT 0,
    popularity        INT              NOT NULL DEFAULT 0 CHECK (popularity >= 0),
    search_vector     TSVECTOR,
    extra_data        JSONB,
    latitude          DOUBLE PRECISION,
    longitude         DOUBLE PRECISION,
    location          GEOGRAPHY(POINT, 4326),
    is_featured       BOOLEAN          NOT NULL DEFAULT FALSE,
    is_deleted        BOOLEAN          NOT NULL DEFAULT FALSE,
    deleted_at        TIMESTAMPTZ,
    created_at        TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
    created_by        UUID,
    updated_by        UUID,
    CHECK (price IS NULL OR price >= 0),
    CHECK (duration_minutes IS NULL OR duration_minutes > 0),
    CHECK (distance_km IS NULL OR distance_km >= 0),
    CHECK (avg_rating BETWEEN 0 AND 5),
    CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
    CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180),
    CHECK (((latitude IS NULL) AND (longitude IS NULL) AND (location IS NULL)) OR ((latitude IS NOT NULL) AND (longitude IS NOT NULL) AND (location IS NOT NULL))),
    CHECK ((is_deleted = FALSE AND deleted_at IS NULL) OR (is_deleted = TRUE AND deleted_at IS NOT NULL))
);

CREATE UNIQUE INDEX uq_activities_city_slug_active
    ON activities(city_id, slug)
    WHERE is_deleted = FALSE AND city_id IS NOT NULL;

CREATE UNIQUE INDEX uq_activities_slug_without_city_active
    ON activities(slug)
    WHERE is_deleted = FALSE AND city_id IS NULL;

CREATE INDEX idx_activities_city ON activities(city_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_activities_country ON activities(country_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_activities_destination ON activities(destination_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_activities_place ON activities(place_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_activities_category ON activities(category_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_activities_season ON activities(season_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_activities_featured ON activities(is_featured) WHERE is_featured = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_activities_popularity ON activities(popularity DESC) WHERE is_deleted = FALSE;
CREATE INDEX idx_activities_search_vector ON activities USING GIN (search_vector);
CREATE INDEX idx_activities_location ON activities USING GIST (location) WHERE is_deleted = FALSE AND location IS NOT NULL;
CREATE INDEX idx_activities_extra ON activities USING GIN (extra_data);

CREATE TABLE activity_inclusions (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    activity_id       UUID         NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
    item              VARCHAR(200) NOT NULL,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by        UUID,
    updated_by        UUID
);

CREATE TABLE activity_images (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    activity_id       UUID         NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
    image_url         VARCHAR(500) NOT NULL,
    sort_order        INT          NOT NULL DEFAULT 0,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by        UUID,
    updated_by        UUID
);

-- ------------------------------------------------------------
-- 10. RECENZIJE
-- ------------------------------------------------------------
CREATE TABLE reviews (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id           UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    entity_type       VARCHAR(20)  NOT NULL CHECK (entity_type IN ('destination', 'place', 'event', 'activity')),
    entity_id         UUID         NOT NULL,
    rating            SMALLINT     NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment           TEXT,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by        UUID,
    updated_by        UUID,
    UNIQUE (user_id, entity_type, entity_id)
);

CREATE INDEX idx_reviews_entity ON reviews(entity_type, entity_id);
CREATE INDEX idx_reviews_user ON reviews(user_id);

-- ------------------------------------------------------------
-- 11. SAČUVANE STAVKE
-- ------------------------------------------------------------
CREATE TABLE saved_items (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id           UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    entity_type       VARCHAR(20)  NOT NULL CHECK (entity_type IN ('destination', 'place', 'event', 'activity')),
    entity_id         UUID         NOT NULL,
    saved_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by        UUID,
    updated_by        UUID,
    UNIQUE (user_id, entity_type, entity_id)
);

CREATE INDEX idx_saved_user ON saved_items(user_id);
CREATE INDEX idx_saved_entity ON saved_items(entity_type, entity_id);

-- ------------------------------------------------------------
-- 12. POSETE
-- ------------------------------------------------------------
CREATE TABLE visits (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id           UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    entity_type       VARCHAR(20)  NOT NULL CHECK (entity_type IN ('destination', 'place', 'event', 'activity')),
    entity_id         UUID         NOT NULL,
    visited_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    source_type       VARCHAR(20)  NOT NULL DEFAULT 'manual' CHECK (source_type IN ('manual', 'review_auto')),
    note              VARCHAR(300),
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by        UUID,
    updated_by        UUID,
    UNIQUE (user_id, entity_type, entity_id)
);

CREATE INDEX idx_visits_user ON visits(user_id);
CREATE INDEX idx_visits_entity ON visits(entity_type, entity_id);
CREATE INDEX idx_visits_visited_at ON visits(visited_at);

-- ------------------------------------------------------------
-- 13. PLANER
-- ------------------------------------------------------------
CREATE TABLE trip_plans (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id           UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name              VARCHAR(200) NOT NULL,
    start_at          TIMESTAMPTZ,
    end_at            TIMESTAMPTZ,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by        UUID,
    updated_by        UUID,
    CHECK (end_at IS NULL OR start_at IS NULL OR end_at >= start_at)
);

CREATE INDEX idx_trip_plans_user ON trip_plans(user_id);

CREATE TABLE trip_plan_items (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trip_plan_id      UUID         NOT NULL REFERENCES trip_plans(id) ON DELETE CASCADE,
    entity_type       VARCHAR(20)  NOT NULL CHECK (entity_type IN ('destination', 'place', 'event', 'activity')),
    entity_id         UUID         NOT NULL,
    planned_at        TIMESTAMPTZ,
    note              VARCHAR(300),
    sort_order        INT          NOT NULL DEFAULT 0,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by        UUID,
    updated_by        UUID
);

CREATE INDEX idx_trip_plan_items_plan ON trip_plan_items(trip_plan_id);
CREATE INDEX idx_trip_plan_items_entity ON trip_plan_items(entity_type, entity_id);
CREATE INDEX idx_trip_plan_items_planned_at ON trip_plan_items(planned_at);

-- ------------------------------------------------------------
-- 14. INTERESOVANJA KORISNIKA
-- ------------------------------------------------------------
CREATE TABLE interest_tags (
    id                SERIAL PRIMARY KEY,
    name              VARCHAR(100) NOT NULL UNIQUE,
    icon              VARCHAR(100),
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by        UUID,
    updated_by        UUID
);

CREATE TABLE user_interest_tags (
    user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    interest_tag_id   INT  NOT NULL REFERENCES interest_tags(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, interest_tag_id)
);

CREATE TABLE destination_interest_tags (
    destination_id    UUID NOT NULL REFERENCES destinations(id) ON DELETE CASCADE,
    interest_tag_id   INT  NOT NULL REFERENCES interest_tags(id) ON DELETE CASCADE,
    PRIMARY KEY (destination_id, interest_tag_id)
);

CREATE TABLE place_interest_tags (
    place_id          UUID NOT NULL REFERENCES places(id) ON DELETE CASCADE,
    interest_tag_id   INT  NOT NULL REFERENCES interest_tags(id) ON DELETE CASCADE,
    PRIMARY KEY (place_id, interest_tag_id)
);

CREATE TABLE event_interest_tags (
    event_id          UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    interest_tag_id   INT  NOT NULL REFERENCES interest_tags(id) ON DELETE CASCADE,
    PRIMARY KEY (event_id, interest_tag_id)
);

CREATE TABLE activity_interest_tags (
    activity_id       UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
    interest_tag_id   INT  NOT NULL REFERENCES interest_tags(id) ON DELETE CASCADE,
    PRIMARY KEY (activity_id, interest_tag_id)
);

-- ------------------------------------------------------------
-- 15. AUDIT FOREIGN KEY ODNOSI
-- ------------------------------------------------------------
ALTER TABLE countries ADD CONSTRAINT fk_countries_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE countries ADD CONSTRAINT fk_countries_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE roles ADD CONSTRAINT fk_roles_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE roles ADD CONSTRAINT fk_roles_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE users ADD CONSTRAINT fk_users_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE users ADD CONSTRAINT fk_users_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE user_auth_accounts ADD CONSTRAINT fk_user_auth_accounts_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE user_auth_accounts ADD CONSTRAINT fk_user_auth_accounts_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE refresh_tokens ADD CONSTRAINT fk_refresh_tokens_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE refresh_tokens ADD CONSTRAINT fk_refresh_tokens_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE password_reset_tokens ADD CONSTRAINT fk_password_reset_tokens_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE password_reset_tokens ADD CONSTRAINT fk_password_reset_tokens_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE email_verifications ADD CONSTRAINT fk_email_verifications_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE email_verifications ADD CONSTRAINT fk_email_verifications_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE user_preferences ADD CONSTRAINT fk_user_preferences_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE user_preferences ADD CONSTRAINT fk_user_preferences_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE regions ADD CONSTRAINT fk_regions_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE regions ADD CONSTRAINT fk_regions_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE cities ADD CONSTRAINT fk_cities_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE cities ADD CONSTRAINT fk_cities_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE destinations ADD CONSTRAINT fk_destinations_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE destinations ADD CONSTRAINT fk_destinations_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE destination_images ADD CONSTRAINT fk_destination_images_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE destination_images ADD CONSTRAINT fk_destination_images_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE place_types ADD CONSTRAINT fk_place_types_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE place_types ADD CONSTRAINT fk_place_types_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE places ADD CONSTRAINT fk_places_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE places ADD CONSTRAINT fk_places_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE place_images ADD CONSTRAINT fk_place_images_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE place_images ADD CONSTRAINT fk_place_images_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE place_amenities ADD CONSTRAINT fk_place_amenities_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE place_amenities ADD CONSTRAINT fk_place_amenities_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE place_working_days ADD CONSTRAINT fk_place_working_days_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE place_working_days ADD CONSTRAINT fk_place_working_days_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE place_working_hour_intervals ADD CONSTRAINT fk_place_working_hour_intervals_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE place_working_hour_intervals ADD CONSTRAINT fk_place_working_hour_intervals_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE event_types ADD CONSTRAINT fk_event_types_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE event_types ADD CONSTRAINT fk_event_types_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE events ADD CONSTRAINT fk_events_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE events ADD CONSTRAINT fk_events_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE event_images ADD CONSTRAINT fk_event_images_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE event_images ADD CONSTRAINT fk_event_images_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE activity_categories ADD CONSTRAINT fk_activity_categories_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE activity_categories ADD CONSTRAINT fk_activity_categories_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE seasons ADD CONSTRAINT fk_seasons_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE seasons ADD CONSTRAINT fk_seasons_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE activities ADD CONSTRAINT fk_activities_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE activities ADD CONSTRAINT fk_activities_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE activity_inclusions ADD CONSTRAINT fk_activity_inclusions_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE activity_inclusions ADD CONSTRAINT fk_activity_inclusions_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE activity_images ADD CONSTRAINT fk_activity_images_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE activity_images ADD CONSTRAINT fk_activity_images_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE reviews ADD CONSTRAINT fk_reviews_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE reviews ADD CONSTRAINT fk_reviews_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE saved_items ADD CONSTRAINT fk_saved_items_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE saved_items ADD CONSTRAINT fk_saved_items_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE visits ADD CONSTRAINT fk_visits_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE visits ADD CONSTRAINT fk_visits_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE trip_plans ADD CONSTRAINT fk_trip_plans_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE trip_plans ADD CONSTRAINT fk_trip_plans_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE trip_plan_items ADD CONSTRAINT fk_trip_plan_items_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE trip_plan_items ADD CONSTRAINT fk_trip_plan_items_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE interest_tags ADD CONSTRAINT fk_interest_tags_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE interest_tags ADD CONSTRAINT fk_interest_tags_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;

-- ------------------------------------------------------------
-- 16. TRIGGER FUNKCIJE
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION sync_point_from_lat_lon()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
        NEW.location := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
    ELSE
        NEW.location := NULL;
    END IF;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION sync_user_location()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.current_latitude IS NOT NULL AND NEW.current_longitude IS NOT NULL THEN
        NEW.current_location := ST_SetSRID(
            ST_MakePoint(NEW.current_longitude, NEW.current_latitude), 4326
        )::geography;
    ELSE
        NEW.current_location := NULL;
    END IF;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION sync_search_vector()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('simple', COALESCE(NEW.name, '')), 'A') ||
        setweight(to_tsvector('simple', COALESCE(NEW.description, '')), 'B');
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_destination_rating_upsert()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    UPDATE destinations
    SET avg_rating = (
        SELECT COALESCE(AVG(rating), 0)
        FROM reviews
        WHERE entity_type = 'destination' AND entity_id = NEW.entity_id
    )
    WHERE id = NEW.entity_id;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_destination_rating_delete()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    UPDATE destinations
    SET avg_rating = (
        SELECT COALESCE(AVG(rating), 0)
        FROM reviews
        WHERE entity_type = 'destination' AND entity_id = OLD.entity_id
    )
    WHERE id = OLD.entity_id;
    RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION update_place_rating_upsert()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    UPDATE places
    SET avg_rating = (
        SELECT COALESCE(AVG(rating), 0)
        FROM reviews
        WHERE entity_type = 'place' AND entity_id = NEW.entity_id
    )
    WHERE id = NEW.entity_id;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_place_rating_delete()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    UPDATE places
    SET avg_rating = (
        SELECT COALESCE(AVG(rating), 0)
        FROM reviews
        WHERE entity_type = 'place' AND entity_id = OLD.entity_id
    )
    WHERE id = OLD.entity_id;
    RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION update_activity_rating_upsert()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    UPDATE activities
    SET avg_rating = (
        SELECT COALESCE(AVG(rating), 0)
        FROM reviews
        WHERE entity_type = 'activity' AND entity_id = NEW.entity_id
    )
    WHERE id = NEW.entity_id;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_activity_rating_delete()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    UPDATE activities
    SET avg_rating = (
        SELECT COALESCE(AVG(rating), 0)
        FROM reviews
        WHERE entity_type = 'activity' AND entity_id = OLD.entity_id
    )
    WHERE id = OLD.entity_id;
    RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION sync_user_total_visits()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    target_user_id UUID;
BEGIN
    target_user_id := COALESCE(NEW.user_id, OLD.user_id);
    UPDATE users
    SET total_visits = (
        SELECT COUNT(*)
        FROM visits v
        WHERE v.user_id = target_user_id
    )
    WHERE id = target_user_id;
    RETURN COALESCE(NEW, OLD);
END;
$$;

-- ------------------------------------------------------------
-- 17. TRIGGERI
-- ------------------------------------------------------------
CREATE TRIGGER trg_regions_updated_at
BEFORE UPDATE ON regions FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_cities_updated_at
BEFORE UPDATE ON cities FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_countries_updated_at
BEFORE UPDATE ON countries FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_roles_updated_at
BEFORE UPDATE ON roles FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_user_auth_accounts_updated_at
BEFORE UPDATE ON user_auth_accounts FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_email_verifications_updated_at
BEFORE UPDATE ON email_verifications FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_user_preferences_updated_at
BEFORE UPDATE ON user_preferences FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_destinations_updated_at
BEFORE UPDATE ON destinations FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_places_updated_at
BEFORE UPDATE ON places FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_place_types_updated_at
BEFORE UPDATE ON place_types FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_place_amenities_updated_at
BEFORE UPDATE ON place_amenities FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_place_working_days_updated_at
BEFORE UPDATE ON place_working_days FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_event_types_updated_at
BEFORE UPDATE ON event_types FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_events_updated_at
BEFORE UPDATE ON events FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_activity_categories_updated_at
BEFORE UPDATE ON activity_categories FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_seasons_updated_at
BEFORE UPDATE ON seasons FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_activities_updated_at
BEFORE UPDATE ON activities FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_interest_tags_updated_at
BEFORE UPDATE ON interest_tags FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_users_location
BEFORE INSERT OR UPDATE OF current_latitude, current_longitude ON users
FOR EACH ROW EXECUTE FUNCTION sync_user_location();

CREATE TRIGGER trg_destinations_location
BEFORE INSERT OR UPDATE OF latitude, longitude ON destinations
FOR EACH ROW EXECUTE FUNCTION sync_point_from_lat_lon();

CREATE TRIGGER trg_places_location
BEFORE INSERT OR UPDATE OF latitude, longitude ON places
FOR EACH ROW EXECUTE FUNCTION sync_point_from_lat_lon();

CREATE TRIGGER trg_events_location
BEFORE INSERT OR UPDATE OF latitude, longitude ON events
FOR EACH ROW EXECUTE FUNCTION sync_point_from_lat_lon();

CREATE TRIGGER trg_activities_location
BEFORE INSERT OR UPDATE OF latitude, longitude ON activities
FOR EACH ROW EXECUTE FUNCTION sync_point_from_lat_lon();

CREATE TRIGGER trg_cities_location
BEFORE INSERT OR UPDATE OF latitude, longitude ON cities
FOR EACH ROW EXECUTE FUNCTION sync_point_from_lat_lon();

CREATE TRIGGER trg_destinations_search_vector
BEFORE INSERT OR UPDATE OF name, description ON destinations
FOR EACH ROW EXECUTE FUNCTION sync_search_vector();

CREATE TRIGGER trg_places_search_vector
BEFORE INSERT OR UPDATE OF name, description ON places
FOR EACH ROW EXECUTE FUNCTION sync_search_vector();

CREATE TRIGGER trg_events_search_vector
BEFORE INSERT OR UPDATE OF name, description ON events
FOR EACH ROW EXECUTE FUNCTION sync_search_vector();

CREATE TRIGGER trg_activities_search_vector
BEFORE INSERT OR UPDATE OF name, description ON activities
FOR EACH ROW EXECUTE FUNCTION sync_search_vector();

CREATE TRIGGER trg_destination_rating_upsert
AFTER INSERT OR UPDATE ON reviews
FOR EACH ROW WHEN (NEW.entity_type = 'destination')
EXECUTE FUNCTION update_destination_rating_upsert();

CREATE TRIGGER trg_destination_rating_delete
AFTER DELETE ON reviews
FOR EACH ROW WHEN (OLD.entity_type = 'destination')
EXECUTE FUNCTION update_destination_rating_delete();

CREATE TRIGGER trg_place_rating_upsert
AFTER INSERT OR UPDATE ON reviews
FOR EACH ROW WHEN (NEW.entity_type = 'place')
EXECUTE FUNCTION update_place_rating_upsert();

CREATE TRIGGER trg_place_rating_delete
AFTER DELETE ON reviews
FOR EACH ROW WHEN (OLD.entity_type = 'place')
EXECUTE FUNCTION update_place_rating_delete();

CREATE TRIGGER trg_activity_rating_upsert
AFTER INSERT OR UPDATE ON reviews
FOR EACH ROW WHEN (NEW.entity_type = 'activity')
EXECUTE FUNCTION update_activity_rating_upsert();

CREATE TRIGGER trg_activity_rating_delete
AFTER DELETE ON reviews
FOR EACH ROW WHEN (OLD.entity_type = 'activity')
EXECUTE FUNCTION update_activity_rating_delete();

CREATE TRIGGER trg_sync_user_total_visits
AFTER INSERT OR DELETE ON visits
FOR EACH ROW EXECUTE FUNCTION sync_user_total_visits();

-- ------------------------------------------------------------
-- 18. SEED DATA
-- ------------------------------------------------------------
INSERT INTO roles (name, description) VALUES
    ('admin', 'Sistemski administrator sa punim pristupom'),
    ('partner', 'Partner koji upravlja svojim sadržajem'),
    ('user', 'Standardni krajnji korisnik');

INSERT INTO countries (name, code) VALUES
    ('Srbija', 'SRB'),
    ('Hrvatska', 'HRV'),
    ('Bosna i Hercegovina', 'BIH'),
    ('Crna Gora', 'MNE'),
    ('Slovenija', 'SVN'),
    ('Makedonija', 'MKD');

INSERT INTO regions (name) VALUES
    ('Šumadija'), ('Zapadna Srbija'), ('Južna Srbija'), ('Istočna Srbija'), ('Vojvodina');

INSERT INTO event_types (name) VALUES
    ('Muzički'), ('Sportski'), ('Kulturni'), ('Gastronomski'),
    ('Zabavni'), ('Edukativni'), ('Sajam'), ('Festival');

INSERT INTO activity_categories (name) VALUES
    ('Planinarenje'), ('Rafting'), ('Degustacija vina'), ('Biciklizam'),
    ('Paraglajding'), ('Kajaking'), ('Tura gradom'), ('Fotografija prirode'),
    ('Jahanje'), ('Zipline');

INSERT INTO seasons (name) VALUES
    ('Proleće'), ('Leto'), ('Jesen'), ('Zima'), ('Cele godine');

INSERT INTO place_types (name) VALUES
    ('Hotel'), ('Restoran'), ('Muzej'), ('Kafić'), ('Spa centar'),
    ('Vidikovac'), ('Sportski centar'), ('Atrakcija'), ('Apartman'), ('Etno selo');

INSERT INTO place_amenities (name) VALUES
    ('WiFi'), ('Parking'), ('Bazen'), ('Spa'), ('Pet friendly'),
    ('Doručak uključen'), ('Pristup osobama sa invaliditetom');

INSERT INTO interest_tags (name) VALUES
    ('Priroda'), ('Avantura'), ('Wellness'), ('Hrana'), ('Kultura'),
    ('Noćni život'), ('Porodični odmor'), ('Sport'), ('Fotografija'), ('Istorija');
