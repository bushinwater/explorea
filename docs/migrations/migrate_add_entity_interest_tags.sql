-- Migration: add interest_tags junction tables for destinations, places, events, activities
-- Date: 2026-04-09

CREATE TABLE IF NOT EXISTS destination_interest_tags (
    destination_id    UUID NOT NULL REFERENCES destinations(id) ON DELETE CASCADE,
    interest_tag_id   INT  NOT NULL REFERENCES interest_tags(id) ON DELETE CASCADE,
    PRIMARY KEY (destination_id, interest_tag_id)
);

CREATE TABLE IF NOT EXISTS place_interest_tags (
    place_id          UUID NOT NULL REFERENCES places(id) ON DELETE CASCADE,
    interest_tag_id   INT  NOT NULL REFERENCES interest_tags(id) ON DELETE CASCADE,
    PRIMARY KEY (place_id, interest_tag_id)
);

CREATE TABLE IF NOT EXISTS event_interest_tags (
    event_id          UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    interest_tag_id   INT  NOT NULL REFERENCES interest_tags(id) ON DELETE CASCADE,
    PRIMARY KEY (event_id, interest_tag_id)
);

CREATE TABLE IF NOT EXISTS activity_interest_tags (
    activity_id       UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
    interest_tag_id   INT  NOT NULL REFERENCES interest_tags(id) ON DELETE CASCADE,
    PRIMARY KEY (activity_id, interest_tag_id)
);
