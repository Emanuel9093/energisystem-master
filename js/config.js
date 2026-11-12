// Fyll i uppgifterna från ditt Supabase-projekt (Project Settings → API).
// Nyckeln "anon public" är gjord för att ligga i webbläsaren; skyddet sköts av
// Row Level Security i supabase/schema.sql.
//
// Lämnar du fälten tomma körs sidan i demoläge: allt sparas bara i din egen
// webbläsare och klasskompisarna är påhittade exempel.

export const SUPABASE_URL = "";
export const SUPABASE_ANON_KEY = "";

// Bara e-postadresser som slutar på någon av dessa domäner kan logga in.
// Samma lista finns i supabase/schema.sql och måste hållas i synk.
export const ALLOWED_EMAIL_DOMAINS = ["student.uu.se", "stud.slu.se"];
