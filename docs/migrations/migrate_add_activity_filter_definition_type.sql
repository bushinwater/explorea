ALTER TABLE filter_definitions DROP CONSTRAINT IF EXISTS filter_definitions_entity_type_check;
ALTER TABLE filter_definitions ADD CONSTRAINT filter_definitions_entity_type_check
  CHECK (entity_type IN ('event', 'place', 'destination', 'activity'));
