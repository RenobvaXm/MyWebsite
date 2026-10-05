
// Keeps the Supabase login session active across the public website and client portal.
(async function () {
  const cfg = window.RENOBVA_SUPABASE || {};
  if (!window.supabase || !cfg.url || !cfg.anonKey || cfg.url.includes("YOUR_")) return;

  // Explicit persistence makes the intended behavior clear.
  const client = window.supabase.createClient(cfg.url, cfg.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });

  window.renobvaSiteAuth = client;

  const { data: { session } } = await client.auth.getSession();
  const portalLinks = document.querySelectorAll('[data-client-portal]');

  if (session?.user) {
    let displayName = session.user.user_metadata?.display_name ||
                      session.user.email?.split("@")[0] ||
                      "Account";

    // Try to use the current profile name if available.
    const { data: profile } = await client
      .from("profiles")
      .select("display_name")
      .eq("id", session.user.id)
      .maybeSingle();

    if (profile?.display_name) displayName = profile.display_name;

    portalLinks.forEach(link => {
      link.href = link.dataset.dashboardHref;
      link.textContent = displayName;
      link.classList.add("logged-in");
      link.title = "Open client dashboard";
    });
  }
})();
