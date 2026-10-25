// A short sitemap with the three real pages. Search engines need full addresses, so this
// is empty until SITE_URL is set (see the README). Movie views are not separate pages.
import { site as siteConfig } from '../config/site';

export function GET({ site }: { site?: URL }) {
  const urls = site ? siteConfig.nav.map((link) => new URL(link.href, site).href) : [];
  const body =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.map((url) => `  <url><loc>${url}</loc></url>`).join('\n') +
    '\n</urlset>\n';
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
