# LokalApp — Complete Backend & Deployment Guide

## 1. Supabase Setup (Database + Auth + AI Backend)

### 1.1 Create a Supabase project
1. Go to [supabase.com](https://supabase.com) and sign up
2. Click **New project**, name it `lokalapp`, set a strong DB password
3. Wait ~2 minutes for provisioning

### 1.2 Get your API keys
- Go to **Project Settings → API**
- Copy **Project URL** and **anon public key**

### 1.3 Add them to your project
Create a `.env` file in the project root:
```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 1.4 Run the database migrations
Go to **SQL Editor** in Supabase and run:

```sql
-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles table (extends auth.users)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users PRIMARY KEY,
  full_name TEXT,
  role TEXT CHECK (role IN ('admin', 'applicant')) DEFAULT 'applicant',
  status TEXT DEFAULT 'pending',
  phone TEXT,
  location TEXT,
  skills TEXT,
  resume_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Jobs table
CREATE TABLE jobs (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  company TEXT DEFAULT 'CJTECH Computer Trading',
  location TEXT DEFAULT 'Sangi, Toledo City',
  salary TEXT,
  description TEXT,
  requirements TEXT[],
  icon TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Applications table
CREATE TABLE applications (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  job_id INT REFERENCES jobs(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending',
  score INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications table
CREATE TABLE notifications (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  message TEXT,
  type TEXT DEFAULT 'info',
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Interviews table
CREATE TABLE interviews (
  id SERIAL PRIMARY KEY,
  application_id INT REFERENCES applications(id) ON DELETE CASCADE,
  date DATE,
  time TIME,
  location TEXT,
  instructions TEXT,
  status TEXT DEFAULT 'scheduled'
);

-- Activities table (security reports)
CREATE TABLE activities (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  action TEXT,
  ip TEXT,
  device TEXT,
  location TEXT,
  type TEXT DEFAULT 'info',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed sample data
INSERT INTO jobs (title, company, location, salary, description, requirements, icon) VALUES
  ('Sales Assistant', 'CJTECH Computer Trading', 'Sangi, Toledo City', '₱15,000 — ₱18,000 / month', 'Assist customers, handle transactions, and maintain store cleanliness.', ARRAY['High school graduate', 'Assist customers', 'Good communication', 'Handle transactions'], '🛍️'),
  ('Computer Service', 'CJTECH Computer Trading', 'Sangi, Toledo City', '₱20,000 — ₱25,000 / month', 'Provide technical support, repair hardware, and install software updates.', ARRAY['IT Background', 'Hardware Repair', 'Software Troubleshooting', 'Patience'], '💻'),
  ('Repair Technician', 'CJTECH Computer Trading', 'Sangi, Toledo City', '₱18,000 — ₱22,000 / month', 'Diagnose and fix various electronic appliances and gadgets.', ARRAY['Technical Vocational Course', 'Tool Proficiency', 'Diagnostics', 'Manual Dexterity'], '🔧'),
  ('Store Manager', 'CJTECH Computer Trading', 'Sangi, Toledo City', '₱30,000 — ₱35,000 / month', 'Oversee daily operations, manage staff, and ensure sales targets are met.', ARRAY['Management Experience', 'Leadership', 'Inventory Control', 'Reporting'], '🏪');
```

### 1.5 Set up Storage for Resumes
1. In Supabase, go to **Storage → Create bucket**
2. Name: `resumes`, make it **public**
3. Add a policy to allow authenticated users to upload:
   ```sql
   -- Allow authenticated users to upload their own resumes
   CREATE POLICY "Users can upload their own resumes"
   ON storage.objects FOR INSERT
   WITH CHECK (
     auth.role() = 'authenticated'
     AND bucket_id = 'resumes'
   );

   -- Allow public read access to resumes
   CREATE POLICY "Resumes are publicly readable"
   ON storage.objects FOR SELECT
   USING (bucket_id = 'resumes');
   ```

---

## 2. Deploy the AI Matching Backend

### 2.1 Install the Supabase CLI
```bash
npm install -g supabase
```

### 2.2 Login and link your project
```bash
supabase login
supabase link --project-ref your-project-ref-id
```

### 2.3 Deploy the Edge Function
```bash
supabase functions deploy match-talent --no-verify-jwt
```

### 2.4 Set environment variables
In **Supabase Dashboard → Edge Functions → match-talent → Environment Variables**, add:
- `SUPABASE_URL` — same as your project URL
- `SUPABASE_SERVICE_ROLE_KEY` — found in **Project Settings → API → service_role key**

---

## 3. Connect Authentication

Replace the mock Login/Signup with real Supabase Auth:

```js
import { supabase } from "../lib/supabaseClient";

// Sign up
const { data, error } = await supabase.auth.signUp({
  email: "user@email.com",
  password: "password",
  options: { data: { full_name: "Name", role: "applicant" } }
});

// Sign in
const { data, error } = await supabase.auth.signInWithPassword({
  email: "user@email.com",
  password: "password"
});

// Sign out
await supabase.auth.signOut();

// Get current user
const { data: { user } } = await supabase.auth.getUser();

// Listen to auth state changes
supabase.auth.onAuthStateChange((event, session) => {
  // Redirect based on user role
});
```

---

## 4. API Data Flow

### Fetch Jobs (instead of hardcoded data)
```js
const { data: jobs } = await supabase
  .from("jobs")
  .select("*");
```

### Submit Job Application
```js
await supabase
  .from("applications")
  .insert({ user_id: user.id, job_id: jobId });
```

### Fetch Notifications (real-time)
```js
const { data: notifications } = await supabase
  .from("notifications")
  .select("*")
  .eq("user_id", user.id)
  .order("created_at", { ascending: false });
```

### Upload Resume
```js
const { data } = await supabase.storage
  .from("resumes")
  .upload(`resumes/${user.id}/resume.pdf`, file);

const { data: { publicUrl } } = supabase.storage
  .from("resumes")
  .getPublicUrl(`resumes/${user.id}/resume.pdf`);
```

---

## 5. Deployment

### Option A: Vercel (Recommended — easiest)
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel

# Follow prompts — it auto-detects Vite
```

### Option B: Netlify
```bash
# Install Netlify CLI
npm install -g netlify-cli

# Build
npm run build

# Deploy
netlify deploy --prod --dir=dist
```

### Option C: GitHub Pages
1. Add to `vite.config.js`:
   ```js
   export default defineConfig({
     base: "/LokalApp/",
     // ...
   })
   ```
2. `npm run build`
3. Push the `dist/` folder to `gh-pages` branch

### Environment Variables on Deploy
On Vercel/Netlify, go to **Project Settings → Environment Variables** and add:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

---

## 6. How the AI Matching Works

```
User clicks "AI Match Scan"
         │
         ▼
Frontend calls → POST /functions/v1/match-talent
         │
         ▼
Edge Function receives { jobTitle: "Sales Assistant" }
         │
         ▼
1. Fetches job requirements from DB
   → ["High school graduate", "Good communication", ...]
         │
         ▼
2. Fetches all applicant profiles
   → [{ skills: "Communication, Sales, Customer Service" }, ...]
         │
         ▼
3. Scoring algorithm:
   - Normalize skills to lowercase
   - For each applicant skill, check if any job requirement
     contains or is contained by that skill (fuzzy match)
   - Base score = matched_skills / total_requirements × 100
   - Breadth bonus = min(10, skill_count × 2)
   - Final score = min(100, base + bonus)
         │
         ▼
4. Sorted by score descending, returned as JSON
   → { candidates: [{ name, score, skills }, ...] }
```

To **improve accuracy**, you can later:
- Add NLP libraries for synonym matching
- Use embeddings (via OpenAI API or Supabase AI)
- Add weights to specific skills
- Include work experience duration in scoring
