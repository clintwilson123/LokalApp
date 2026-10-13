-- =============================================
-- SKILLS CATALOG
--
-- Before this, the system's skill vocabulary was whatever admins had typed
-- into `jobs.requirements` as free text. That list was then handed to every
-- applicant as their skill dropdown (see Profile.jsx), so each typo or
-- synonym became a permanent selectable option for everyone, forever — and
-- computeSkillMatch (substring, both directions) then scored "Good
-- communication" against "Communication Skills" as 0%.
--
-- One table, one name per skill, aliases for the synonyms that actually
-- occur. Matching normalizes through it.
--
-- Order matters: BACKFILL FIRST, then seed. Every requirement string already
-- in production becomes a catalog entry, so the applicant dropdown cannot
-- shrink on release day — even the typos, which stay selectable until an
-- admin cleans them up by hand.
-- =============================================

CREATE TABLE IF NOT EXISTS skills (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL DEFAULT 'General',
  aliases TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE skills IS
  'Controlled vocabulary for job requirements and applicant skills.';

-- 1) Backfill: every requirement string currently in production.
INSERT INTO skills (name)
SELECT DISTINCT TRIM(req)
FROM jobs, LATERAL unnest(jobs.requirements) AS req
WHERE TRIM(req) <> ''
ON CONFLICT (name) DO NOTHING;

-- 2) Seed. DO UPDATE so rows promoted out of the backfill above gain their
--    real category and aliases instead of keeping the 'General' default.
INSERT INTO skills (name, category, aliases) VALUES
  -- Technical & IT
  ('Computer Literacy',          'Technical & IT', '{}'),
  ('Microsoft Word',             'Technical & IT', '{"Word"}'),
  ('Microsoft Excel',            'Technical & IT', '{"Excel"}'),
  ('Microsoft PowerPoint',       'Technical & IT', '{"PowerPoint","PPT"}'),
  ('Google Workspace',           'Technical & IT', '{"Google Docs","Google Sheets","GSuite"}'),
  ('Data Entry',                 'Technical & IT', '{"Data Input"}'),
  ('Technical Support',          'Technical & IT', '{"Tech Support","IT Support"}'),
  ('Computer Hardware Repair',   'Technical & IT', '{"Hardware Repair","PC Repair"}'),
  ('Laptop Repair',              'Technical & IT', '{"Notebook Repair"}'),
  ('Cellphone Repair',           'Technical & IT', '{"Mobile Phone Repair","Phone Repair"}'),
  ('Printer Servicing',          'Technical & IT', '{}'),
  ('Networking',                 'Technical & IT', '{"Network Administration"}'),
  ('Troubleshooting',            'Technical & IT', '{"Fault Finding"}'),
  ('Web Development',            'Technical & IT', '{"Web Design","Frontend Development"}'),
  ('JavaScript',                 'Technical & IT', '{"JS","ECMAScript"}'),
  ('React',                      'Technical & IT', '{"ReactJS","React.js"}'),
  ('Node.js',                    'Technical & IT', '{"NodeJS","Node"}'),
  ('Python',                     'Technical & IT', '{"Python3"}'),
  ('HTML and CSS',               'Technical & IT', '{"HTML","CSS","HTML5","CSS3"}'),
  ('SQL',                        'Technical & IT', '{"MySQL","PostgreSQL"}'),
  ('Git',                        'Technical & IT', '{"GitHub","Version Control"}'),
  ('Graphic Design',             'Technical & IT', '{"Visual Design"}'),
  ('Canva',                      'Technical & IT', '{}'),
  ('Adobe Photoshop',            'Technical & IT', '{"Photoshop"}'),
  ('Video Editing',              'Technical & IT', '{"Video Production"}'),

  -- Office & Admin
  ('Filing and Records Management', 'Office & Admin', '{"Records Management","Filing"}'),
  ('Bookkeeping',                'Office & Admin', '{"Accounting","Book Keeping"}'),
  ('QuickBooks',                 'Office & Admin', '{}'),
  ('Payroll',                    'Office & Admin', '{"Payroll Processing"}'),
  ('Inventory Management',       'Office & Admin', '{"Stock Control","Inventory Control"}'),
  ('Scheduling',                 'Office & Admin', '{"Appointment Setting"}'),
  ('Report Writing',             'Office & Admin', '{"Report Preparation"}'),
  ('Document Preparation',       'Office & Admin', '{"Documentations"}'),
  ('Time Management',            'Office & Admin', '{}'),
  ('Attention to Detail',        'Office & Admin', '{"Keen Attention to Detail"}'),
  ('Multitasking',               'Office & Admin', '{}'),
  ('Organization',               'Office & Admin', '{"Organisational Skills"}'),

  -- Sales & Customer Service
  ('Customer Service',           'Sales & Customer Service', '{"CS","Customer Support","Client Support"}'),
  ('Cash Handling',              'Sales & Customer Service', '{"Cashiering","Cashier Experience"}'),
  ('Point of Sale',              'Sales & Customer Service', '{"POS","POS System"}'),
  ('Sales',                      'Sales & Customer Service', '{"Selling","Sales Experience"}'),
  ('Client Relations',           'Sales & Customer Service', '{"Customer Relations","Client Relationship Management"}'),
  ('Telemarketing',              'Sales & Customer Service', '{"Cold Calling","Outbound Calls"}'),
  ('Product Knowledge',          'Sales & Customer Service', '{}'),
  ('Merchandising',              'Sales & Customer Service', '{"Product Display"}'),
  ('Upselling',                  'Sales & Customer Service', '{"Upselling and Cross-selling"}'),
  ('Order Processing',           'Sales & Customer Service', '{"Order Fulfilment"}'),
  ('Complaint Handling',         'Sales & Customer Service', '{"Complaint Resolution","Escalation Handling"}'),

  -- Trades & Field Work
  ('Electrical Wiring',          'Trades & Field Work', '{"Electrical Installation","Electrician"}'),
  ('Welding',                    'Trades & Field Work', '{"Welder"}'),
  ('Aircon Servicing',           'Trades & Field Work', '{"Air Conditioning Repair","HVAC"}'),
  ('Delivery Driving',           'Trades & Field Work', '{"Driving","Driver","Delivery"}'),
  ('Motorcycle Riding',          'Trades & Field Work', '{"Motorcycle Delivery","Habal-habal"}'),
  ('Warehouse Operations',       'Trades & Field Work', '{"Warehouse","Warehouse Handling"}'),
  ('Packing and Loading',        'Trades & Field Work', '{"Packing","Loading"}'),
  ('Forklift Operation',         'Trades & Field Work', '{"Forklift"}'),
  ('Plumbing',                   'Trades & Field Work', '{"Plumber"}'),
  ('Carpentry',                  'Trades & Field Work', '{"Carpenter"}'),
  ('Equipment Maintenance',      'Trades & Field Work', '{"Equipment Repair","Maintenance"}'),
  ('Quality Control',            'Trades & Field Work', '{"QC","Quality Assurance"}'),

  -- Soft Skills
  ('Communication',              'Soft Skills', '{"Good Communication","Communication Skills","Communications"}'),
  ('Teamwork',                   'Soft Skills', '{"Collaboration","Team Player"}'),
  ('Problem Solving',            'Soft Skills', '{"Analytical Skills","Problem-solving"}'),
  ('Leadership',                 'Soft Skills', '{"Team Leadership"}'),
  ('Adaptability',               'Soft Skills', '{"Flexible","Adaptable"}'),
  ('Critical Thinking',          'Soft Skills', '{}'),
  ('Positive Attitude',          'Soft Skills', '{"Pleasant Personality"}'),
  ('Customer Focus',             'Soft Skills', '{"Customer-oriented"}'),
  ('Work Ethic',                 'Soft Skills', '{"Hardworking","Dedicated"}'),
  ('Initiative',                 'Soft Skills', '{"Self-motivated","Proactive"}')
ON CONFLICT (name) DO UPDATE SET
  category = EXCLUDED.category,
  aliases  = EXCLUDED.aliases;

-- =============================================
-- RLS — same shape as the jobs policies in 20260626130000_setup.sql:
-- anyone may read the vocabulary (applicants need it to pick skills),
-- only admins may change it.
-- =============================================

ALTER TABLE skills ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read skills" ON skills;
DROP POLICY IF EXISTS "Admins can manage skills" ON skills;

CREATE POLICY "Anyone can read skills" ON skills
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage skills" ON skills
  FOR ALL USING (is_admin());

-- Explicit grants: 20260925000000_grants_for_data_api.sql sets default
-- privileges for future tables, but an explicit grant makes this
-- migration self-contained and safe to re-run.
GRANT SELECT ON skills TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON skills TO authenticated, service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
