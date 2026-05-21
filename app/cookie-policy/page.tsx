export default function CookiePolicyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-bold text-gray-900">Cookie Policy</h1>
      <p className="mt-4 text-sm text-gray-700">
        We use cookies for essential functionality (such as security and session management). With your consent, we also
        use analytics cookies to understand how the site is used and improve the experience.
      </p>
      <h2 className="mt-8 text-lg font-semibold text-gray-900">Manage your consent</h2>
      <p className="mt-2 text-sm text-gray-700">
        You can change your cookie preference anytime by clearing the <code className="rounded bg-gray-100 px-1">cp_cookie_consent</code>{" "}
        cookie / localStorage value in your browser, or by using a “cookie preferences” link if present on the site.
      </p>
    </main>
  );
}

