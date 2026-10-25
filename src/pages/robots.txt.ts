// Tells search engines they are welcome, and where the sitemap is (once SITE_URL is set).
export function GET({ site }: { site?: URL }) {
  const lines = ['User-agent: *', 'Allow: /'];
  if (site) lines.push('', `Sitemap: ${new URL('/sitemap.xml', site).href}`);
  return new Response(lines.join('\n') + '\n', { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
