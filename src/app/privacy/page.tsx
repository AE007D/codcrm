export const metadata = { title: "Privacy Policy – COD CRM" };

export default function PrivacyPage() {
  return (
    <main style={{ maxWidth: 720, margin: "60px auto", padding: "0 24px", fontFamily: "sans-serif", lineHeight: 1.7, color: "#111" }}>
      <h1>Privacy Policy</h1>
      <p><strong>Last updated:</strong> May 2026</p>

      <h2>1. Overview</h2>
      <p>
        COD CRM (&quot;the App&quot;) is a private internal tool used exclusively by our own business to manage
        e-commerce orders and read ad performance data from our own Meta ad accounts. The App is not
        available to the general public.
      </p>

      <h2>2. Data We Access</h2>
      <p>
        The App connects to the Meta Marketing API solely to read ad performance metrics (spend,
        impressions, clicks, reach) for ad accounts owned and operated by our business. We do not
        collect, store, or share any personal data from Meta users.
      </p>

      <h2>3. Data Storage</h2>
      <p>
        Access tokens and ad account identifiers are stored securely in our database (Supabase) and
        are never shared with third parties.
      </p>

      <h2>4. Data Sharing</h2>
      <p>
        We do not sell, trade, or transfer any data to outside parties. All data accessed via the
        Meta Marketing API is used exclusively for internal business reporting.
      </p>

      <h2>5. Contact</h2>
      <p>
        For any questions regarding this privacy policy, contact us at:{" "}
        <a href="mailto:ayoubelkihel7@gmail.com">ayoubelkihel7@gmail.com</a>
      </p>
    </main>
  );
}
