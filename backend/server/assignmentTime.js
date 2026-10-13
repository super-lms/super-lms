let migration;
function ensureAssignmentTimeZones(pool) {
  if(!migration) migration=pool.query(`DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'assignments' AND column_name = 'available_from' AND data_type IN ('date', 'timestamp without time zone')) THEN
        ALTER TABLE assignments ALTER COLUMN available_from TYPE TIMESTAMPTZ USING available_from::timestamp AT TIME ZONE 'UTC';
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'assignments' AND column_name = 'due_date' AND data_type IN ('date', 'timestamp without time zone')) THEN
        ALTER TABLE assignments ALTER COLUMN due_date TYPE TIMESTAMPTZ USING due_date::timestamp AT TIME ZONE 'UTC';
      END IF;
    END $$`).catch(error=>{migration=undefined;throw error;});
  return migration;
}
module.exports={ensureAssignmentTimeZones};
