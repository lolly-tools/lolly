// SPDX-License-Identifier: MPL-2.0
//! Anonymous, bounded public website reads for the design-system importer.
//! Each connection uses a fresh client pinned to public DNS answers. Page
//! redirects keep the same party; linked resources may use other public hosts.
//! Public-network refusals fail the import; unavailable resources are skipped.

use std::time::{Duration, Instant};

use crate::public_network::{public_http_url, public_read, PublicReadError, PublicResponse};
use reqwest::Url;
use serde::Serialize;

/// Ceiling on the page HTML. Real pages are ≤ 1 MB; this is the hostile bound.
const MAX_HTML_BYTES: usize = 8 * 1024 * 1024;
/// Total stylesheet budget across every sheet (plan 97 section 9's 4 MB cap).
const MAX_CSS_TOTAL_BYTES: usize = 4 * 1024 * 1024;
/// Per-sheet ceiling, so one enormous sheet cannot eat the whole budget.
const MAX_CSS_BYTES: usize = 2 * 1024 * 1024;
const MAX_SHEETS: usize = 20;
const MAX_ASSETS: usize = 10;
const MAX_ASSET_BYTES: usize = 2 * 1024 * 1024;
/// Same-party hops followed before giving up.
const MAX_REDIRECTS: usize = 5;
const DEFAULT_TIMEOUT_MS: u64 = 15_000;
const MIN_TIMEOUT_MS: u64 = 1_000;
const MAX_TIMEOUT_MS: u64 = 60_000;
/// Tags examined by the subresource scan before it stops. A hostile page
/// degrades to a partial subresource list, never to a spin.
const MAX_SCAN_TAGS: usize = 20_000;
/// Attribute-blob length read from one tag before the tag is abandoned.
const MAX_TAG_LEN: usize = 8 * 1024;
const MAX_URL_LEN: usize = 2_048;

/// One prefetched byte payload (an icon, an og:image). `data` is base64 so the
/// IPC payload stays a JSON string, exactly as capture.rs returns its PNG.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SiteAsset {
    /// Absolute address these bytes came from - the key the client matches
    /// against the logo candidates extract-site.ts derives from the same HTML.
    pub url: String,
    /// Content-Type as the server sent it, minus parameters; "" when absent.
    pub mime: String,
    /// Base64 (RFC 4648) of the bytes.
    pub data: String,
}

/// Exactly what the client needs to run extract-site.ts, and nothing more.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SiteFetchResult {
    /// Raw page source, decoded lossily as UTF-8 (see `decode_text`).
    pub html: String,
    /// Text of every stylesheet that fetched inside the caps, in document order.
    pub css_texts: Vec<String>,
    pub assets: Vec<SiteAsset>,
    /// The address the HTML actually came from after redirects - what the client
    /// passes to extract-site.ts as `baseUrl`, so relative URLs resolve right.
    pub final_url: String,
}

/// Read one first-party page plus its stylesheets and icon/og bytes.
///
/// `timeout_ms` bounds each individual request; the whole call is additionally
/// bounded by a deadline of twice that, after which subresources stop being
/// fetched and whatever has been read so far is returned. A partial result is
/// the right answer here: the census degrades gracefully, and a missing
/// stylesheet costs colours, not correctness.
pub async fn read_site(url: String, timeout_ms: Option<u64>) -> Result<SiteFetchResult, String> {
    let start = parse_entry_url(&url)?;

    let per_request = Duration::from_millis(
        timeout_ms
            .unwrap_or(DEFAULT_TIMEOUT_MS)
            .clamp(MIN_TIMEOUT_MS, MAX_TIMEOUT_MS),
    );
    let deadline = Instant::now() + per_request * 2;

    let (final_url, html_bytes) = get_page(start, MAX_HTML_BYTES, per_request, deadline).await?;
    let html = decode_text(&html_bytes);
    let scan = scan_subresources(&html, &final_url);

    let mut css_texts: Vec<String> = Vec::new();
    let mut css_total = 0usize;
    for sheet in scan.sheets.iter().take(MAX_SHEETS) {
        if Instant::now() >= deadline || css_total >= MAX_CSS_TOTAL_BYTES {
            break;
        }
        let room = (MAX_CSS_TOTAL_BYTES - css_total).min(MAX_CSS_BYTES);
        // A sheet that 404s, times out or overruns its budget is skipped, not
        // fatal: the page's own colours still make a census.
        match get_capped(sheet, room, per_request, deadline).await {
            Ok((_, bytes)) => {
                css_total += bytes.len();
                css_texts.push(decode_text(&bytes));
            }
            Err(error) if error.policy => return Err(error.message),
            Err(_) => {}
        }
    }

    let mut assets: Vec<SiteAsset> = Vec::new();
    for asset in scan.assets.iter().take(MAX_ASSETS) {
        if Instant::now() >= deadline {
            break;
        }
        match get_capped(asset, MAX_ASSET_BYTES, per_request, deadline).await {
            Ok((mime, bytes)) => assets.push(SiteAsset {
                url: asset.to_string(),
                mime,
                data: base64(&bytes),
            }),
            Err(error) if error.policy => return Err(error.message),
            Err(_) => {}
        }
    }

    Ok(SiteFetchResult {
        html,
        css_texts,
        assets,
        final_url: final_url.to_string(),
    })
}

// ── addresses ───────────────────────────────────────────────────────────────

fn is_http(url: &Url) -> bool {
    matches!(url.scheme(), "http" | "https") && url.host_str().is_some()
}

/// The user's address, validated. A bare "example.com" is not guessed at here -
/// the field in the studio owns that, so what is fetched is what was shown.
///
/// CREDENTIALS ARE REFUSED, NOT STRIPPED, and that check belongs here and not
/// only in the studio's field. `Url::parse` accepts `https://user:pw@host`
/// happily, `is_http` passes it, and reqwest turns the userinfo into an
/// `Authorization: Basic` header - so without this the app would send somebody's
/// secret to a third party from their own machine, and the host would then sit
/// in a provenance chip as if nothing had happened. Stripping instead would
/// fetch a different (probably 401) page than the one described; refusing says
/// so. Every other cap in this command is duplicated on both sides of the IPC
/// on purpose, because this command is a registered `#[tauri::command]`
/// reachable from any frontend code, not only from the validated studio path.
fn parse_entry_url(raw: &str) -> Result<Url, String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Err("No address to read.".into());
    }
    if trimmed.len() > MAX_URL_LEN {
        return Err("That address is too long to read.".into());
    }
    let url =
        Url::parse(trimmed).map_err(|_| "That is not an address this can read.".to_string())?;
    if !is_http(&url) {
        return Err("Only http and https addresses can be read.".into());
    }
    if !url.username().is_empty() || url.password().is_some() {
        return Err(
            "That address carries a username and password. Take them out and try again.".into(),
        );
    }
    public_http_url(url.as_str())
}

/// A host compared for redirect purposes: lowercased, with one leading `www.`
/// folded away.
///
/// The `www.` fold is a deliberate, narrow relaxation of strict same-host. Apex
/// to `www` (and back) is the single most common redirect on the web -
/// `https://suse.com` answers 301 to `https://www.suse.com` - and refusing it
/// would fail the feature on a large share of real sites while protecting
/// nothing: it is the same party, and the user typed one of the two. Every other
/// host change is refused. Delete the strip_prefix to make this strict.
fn host_key(url: &Url) -> String {
    let host = url.host_str().unwrap_or("").to_ascii_lowercase();
    host.strip_prefix("www.").unwrap_or(&host).to_string()
}

/// May a redirect from `from` to `to` be followed?
///
/// Same party (see `host_key`), never a downgrade out of https, and no jump to a
/// different explicit port. An http→https upgrade of the same host is the one
/// scheme change allowed - it is the hop that makes a typed `http://` address
/// safe rather than less so.
///
/// The upgrade is the reason the port test has two branches. `port_or_known_default`
/// answers 80 for `http://host` and 443 for `https://host`, so on an upgrade it
/// ALWAYS differs and comparing it would refuse the one hop this exists to
/// allow. Waiving the test entirely (what this did before) is too broad the
/// other way: it let `http://host:8080` → `https://host:9999` through, a hop
/// that changes both the scheme and the service. So an upgrade compares what
/// was WRITTEN - neither side may name an explicit port the other does not -
/// and everything else compares the effective port as before.
fn same_party(from: &Url, to: &Url) -> bool {
    let scheme_ok = matches!(
        (from.scheme(), to.scheme()),
        ("https", "https") | ("http", "https") | ("http", "http")
    );
    if !scheme_ok {
        return false;
    }
    if host_key(from) != host_key(to) {
        return false;
    }
    let upgrading = from.scheme() == "http" && to.scheme() == "https";
    if upgrading {
        from.port() == to.port()
    } else {
        from.port_or_known_default() == to.port_or_known_default()
    }
}

/// Subresources may be cross-origin (CDN-hosted CSS is the norm), but never a
/// mixed-content downgrade out of an https page, and never a non-http scheme.
/// `data:` icons are skipped here on purpose: they carry their own bytes, so the
/// client already has them from the HTML.
fn subresource_allowed(page: &Url, sub: &Url) -> bool {
    if !is_http(sub) {
        return false;
    }
    !(page.scheme() == "https" && sub.scheme() == "http")
}

// ── fetching ────────────────────────────────────────────────────────────────

fn header<'a>(response: &'a PublicResponse, name: &str) -> Option<&'a str> {
    response
        .headers
        .iter()
        .find(|(key, _)| key == name)
        .map(|(_, value)| value.as_str())
}

fn redirect_target(
    current: &Url,
    response: &PublicResponse,
    same_host: bool,
) -> Result<Url, PublicReadError> {
    let location = header(response, "location").ok_or_else(|| {
        PublicReadError::unavailable("The site redirected without a destination.")
    })?;
    let next = current
        .join(location)
        .map_err(|_| PublicReadError::policy("The site redirected to an invalid address."))?;
    let next = public_http_url(next.as_str()).map_err(PublicReadError::policy)?;
    if (same_host && !same_party(current, &next)) || !subresource_allowed(current, &next) {
        return Err(PublicReadError::policy(
            "The site redirected outside the permitted address scope.",
        ));
    }
    Ok(next)
}

async fn read_hop(
    url: &Url,
    cap: usize,
    per_request: Duration,
    deadline: Instant,
) -> Result<PublicResponse, PublicReadError> {
    let remaining = deadline.saturating_duration_since(Instant::now());
    if remaining.is_zero() {
        return Err(PublicReadError::unavailable("Reading the site timed out."));
    }
    public_read(url.as_str(), "GET", per_request.min(remaining), cap).await
}

async fn get_page(
    start: Url,
    cap: usize,
    per_request: Duration,
    deadline: Instant,
) -> Result<(Url, Vec<u8>), String> {
    let mut current = start;
    for _ in 0..=MAX_REDIRECTS {
        let response = read_hop(&current, cap, per_request, deadline)
            .await
            .map_err(|e| e.message)?;
        if (300..400).contains(&response.status) {
            current = redirect_target(&current, &response, true).map_err(|e| e.message)?;
            continue;
        }
        if !(200..300).contains(&response.status) {
            return Err(format!(
                "{} answered HTTP {}.",
                host_of(&current),
                response.status
            ));
        }
        return Ok((current, response.body));
    }
    Err("The site redirected too many times.".into())
}

async fn get_capped(
    url: &Url,
    cap: usize,
    per_request: Duration,
    deadline: Instant,
) -> Result<(String, Vec<u8>), PublicReadError> {
    let mut current = public_http_url(url.as_str()).map_err(PublicReadError::policy)?;
    for _ in 0..=3 {
        let response = read_hop(&current, cap, per_request, deadline).await?;
        if (300..400).contains(&response.status) {
            current = redirect_target(&current, &response, false)?;
            continue;
        }
        if !(200..300).contains(&response.status) {
            return Err(PublicReadError::unavailable(format!(
                "HTTP {}",
                response.status
            )));
        }
        let mime = header(&response, "content-type")
            .unwrap_or("")
            .split(';')
            .next()
            .unwrap_or("")
            .trim()
            .to_ascii_lowercase();
        return Ok((mime, response.body));
    }
    Err(PublicReadError::unavailable(
        "The resource redirected too many times.",
    ))
}

fn host_of(url: &Url) -> &str {
    url.host_str().unwrap_or("that address")
}

/// Bytes to text, lossily. Declared charsets other than UTF-8 are not honoured:
/// a legacy-encoded page loses its non-ASCII characters (the site NAME may come
/// back mangled) but every hex colour, family name and href - everything the
/// census is built from - is ASCII and survives intact.
fn decode_text(bytes: &[u8]) -> String {
    String::from_utf8_lossy(bytes).into_owned()
}

// ── the subresource scan (not a parser) ─────────────────────────────────────

#[derive(Default)]
struct Subresources {
    sheets: Vec<Url>,
    assets: Vec<Url>,
}

/// Find the `<link rel=stylesheet>` hrefs and the icon / og:image addresses.
///
/// This is a scan, not a parse: it answers "what else should be fetched?" and
/// nothing else. Ranking mirrors extract-site.ts's logo ranks so the ten assets
/// prefetched are the ten that module will actually rank highest - apple-touch
/// icons and og:images first, then the icon links. The meta-key precedence
/// (name, then property, then itemprop) is extract-site.ts order verbatim, so the
/// two can never read the same odd tag differently.
fn scan_subresources(html: &str, base: &Url) -> Subresources {
    let mut out = Subresources::default();
    let mut top: Vec<Url> = Vec::new();
    let mut rest: Vec<Url> = Vec::new();

    for tag in tags(html) {
        match tag.name.as_str() {
            "link" => {
                let Some(href) = tag.attr("href") else {
                    continue;
                };
                let rel = tag.attr("rel").unwrap_or_default().to_ascii_lowercase();
                let rels: Vec<&str> = rel.split_whitespace().collect();
                if rels.contains(&"stylesheet") {
                    if let Some(u) = resolve(base, &href) {
                        push_unique(&mut out.sheets, u);
                    }
                } else if rels.contains(&"apple-touch-icon")
                    || rels.contains(&"apple-touch-icon-precomposed")
                {
                    if let Some(u) = resolve(base, &href) {
                        push_unique(&mut top, u);
                    }
                } else if rels.contains(&"icon")
                    || rels.contains(&"mask-icon")
                    || rels.contains(&"fluid-icon")
                {
                    if let Some(u) = resolve(base, &href) {
                        push_unique(&mut rest, u);
                    }
                }
            }
            "meta" => {
                let key = tag
                    .attr("name")
                    .or_else(|| tag.attr("property"))
                    .or_else(|| tag.attr("itemprop"))
                    .unwrap_or_default()
                    .trim()
                    .to_ascii_lowercase();
                if key == "og:image" || key == "og:image:url" {
                    if let Some(content) = tag.attr("content") {
                        if let Some(u) = resolve(base, &content) {
                            push_unique(&mut top, u);
                        }
                    }
                }
            }
            _ => {}
        }
    }

    out.assets = top;
    for u in rest {
        push_unique(&mut out.assets, u);
    }
    out.sheets.retain(|u| subresource_allowed(base, u));
    out.assets.retain(|u| subresource_allowed(base, u));
    out
}

fn push_unique(list: &mut Vec<Url>, url: Url) {
    if !list.iter().any(|u| *u == url) {
        list.push(url);
    }
}

fn resolve(base: &Url, raw: &str) -> Option<Url> {
    let v = raw.trim();
    if v.is_empty() || v.len() > MAX_URL_LEN || v.starts_with('#') {
        return None;
    }
    base.join(v).ok()
}

/// One open tag: its lowercased name and its raw attribute blob.
struct Tag {
    name: String,
    attrs: String,
}

impl Tag {
    /// First value for `name` (lowercased attribute names), HTML-unescaped only
    /// for the five entities that appear in real hrefs. Nothing here needs a
    /// full entity table: extract-site.ts owns text decoding.
    fn attr(&self, name: &str) -> Option<String> {
        let mut i = 0usize;
        let b = self.attrs.as_bytes();
        while i < b.len() {
            while i < b.len() && (b[i] as char).is_ascii_whitespace() {
                i += 1;
            }
            let start = i;
            while i < b.len()
                && !matches!(b[i], b'=' | b'/' | b'>')
                && !(b[i] as char).is_ascii_whitespace()
            {
                i += 1;
            }
            if i == start {
                i += 1; // a stray '=' or '/' - step over it so this always advances
                continue;
            }
            let key = self.attrs[start..i].to_ascii_lowercase();
            while i < b.len() && (b[i] as char).is_ascii_whitespace() {
                i += 1;
            }
            let mut value = String::new();
            if i < b.len() && b[i] == b'=' {
                i += 1;
                while i < b.len() && (b[i] as char).is_ascii_whitespace() {
                    i += 1;
                }
                if i < b.len() && (b[i] == b'"' || b[i] == b'\'') {
                    let quote = b[i];
                    i += 1;
                    let vs = i;
                    while i < b.len() && b[i] != quote {
                        i += 1;
                    }
                    value = self.attrs[vs..i].to_string();
                    if i < b.len() {
                        i += 1; // past the closing quote
                    }
                } else {
                    let vs = i;
                    while i < b.len() && !(b[i] as char).is_ascii_whitespace() {
                        i += 1;
                    }
                    value = self.attrs[vs..i].to_string();
                }
            }
            if key == name {
                return Some(unescape_min(&value));
            }
        }
        None
    }
}

fn unescape_min(s: &str) -> String {
    if !s.contains('&') {
        return s.to_string();
    }
    s.replace("&amp;", "&")
        .replace("&#38;", "&")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replace("&apos;", "'")
}

/// Every `<link>` / `<meta>` open tag, in document order.
///
/// Quoted attribute values may hold `>`, so the walk tracks quoting rather than
/// scanning to the next `>`. An unterminated quote ends the scan (the tolerant
/// outcome: read what was readable, drop the rest), and the tag budget bounds a
/// hostile document.
fn tags(html: &str) -> Vec<Tag> {
    let b = html.as_bytes();
    let mut out: Vec<Tag> = Vec::new();
    let mut i = 0usize;
    let mut seen = 0usize;

    while i < b.len() && seen < MAX_SCAN_TAGS {
        // Next '<' that starts an element name.
        while i < b.len() && b[i] != b'<' {
            i += 1;
        }
        if i >= b.len() {
            break;
        }
        i += 1;
        let name_start = i;
        while i < b.len() && (b[i].is_ascii_alphanumeric() || b[i] == b'-' || b[i] == b':') {
            i += 1;
        }
        if i == name_start {
            continue; // "</", "<!", "<?" - not an open tag
        }
        seen += 1;
        let name = html[name_start..i].to_ascii_lowercase();
        let wanted = name == "link" || name == "meta";

        // Walk the attribute blob to the tag's unquoted '>'.
        let attr_start = i;
        let mut quote: u8 = 0;
        while i < b.len() {
            let c = b[i];
            if quote != 0 {
                if c == quote {
                    quote = 0;
                }
            } else if c == b'"' || c == b'\'' {
                quote = c;
            } else if c == b'>' {
                break;
            }
            i += 1;
            if i - attr_start > MAX_TAG_LEN {
                break;
            }
        }
        if wanted {
            // `get` rather than an index: the MAX_TAG_LEN break above can stop
            // mid-character in a multi-byte value, and slicing off a char
            // boundary panics. An unreadable blob yields no attributes, which is
            // the same tolerant outcome as a dropped tag.
            let end = i.min(b.len());
            out.push(Tag {
                name,
                attrs: html.get(attr_start..end).unwrap_or_default().to_string(),
            });
        }
        if i < b.len() {
            i += 1; // past '>'
        }
    }
    out
}

// ── base64 ──────────────────────────────────────────────────────────────────

/// RFC 4648 base64, hand-written rather than pulled in as a crate: it is fifteen
/// lines, it is the only encoding this file needs, and neither shell declares a
/// base64 dependency today. (the desktop shell capture.rs never needed one either - CDP hands back
/// base64 already encoded.)
fn base64(bytes: &[u8]) -> String {
    const T: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity(bytes.len().div_ceil(3) * 4);
    for c in bytes.chunks(3) {
        let n = (u32::from(c[0]) << 16)
            | (u32::from(*c.get(1).unwrap_or(&0)) << 8)
            | u32::from(*c.get(2).unwrap_or(&0));
        out.push(T[(n >> 18 & 63) as usize] as char);
        out.push(T[(n >> 12 & 63) as usize] as char);
        out.push(if c.len() > 1 {
            T[(n >> 6 & 63) as usize] as char
        } else {
            '='
        });
        out.push(if c.len() > 2 {
            T[(n & 63) as usize] as char
        } else {
            '='
        });
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn u(s: &str) -> Url {
        Url::parse(s).unwrap()
    }

    #[test]
    fn base64_matches_rfc4648_vectors() {
        assert_eq!(base64(b""), "");
        assert_eq!(base64(b"f"), "Zg==");
        assert_eq!(base64(b"fo"), "Zm8=");
        assert_eq!(base64(b"foo"), "Zm9v");
        assert_eq!(base64(b"foob"), "Zm9vYg==");
        assert_eq!(base64(b"fooba"), "Zm9vYmE=");
        assert_eq!(base64(b"foobar"), "Zm9vYmFy");
        assert_eq!(base64(&[0xff, 0xff, 0xff]), "////");
    }

    #[test]
    fn redirects_stay_with_the_same_party() {
        assert!(same_party(
            &u("https://suse.com/"),
            &u("https://suse.com/en")
        ));
        assert!(same_party(
            &u("https://suse.com/"),
            &u("https://www.suse.com/")
        ));
        assert!(same_party(
            &u("https://www.suse.com/"),
            &u("https://suse.com/")
        ));
        // http → https on the same host is the one allowed scheme change.
        assert!(same_party(&u("http://suse.com/"), &u("https://suse.com/")));
        // and never the other way.
        assert!(!same_party(&u("https://suse.com/"), &u("http://suse.com/")));
        assert!(!same_party(
            &u("https://suse.com/"),
            &u("https://evil.example/")
        ));
        assert!(!same_party(
            &u("https://suse.com/"),
            &u("https://suse.com.evil.example/")
        ));
        assert!(!same_party(
            &u("https://suse.com/"),
            &u("https://suse.com:8443/")
        ));
        // An upgrade may not also move to a different service on that host.
        assert!(!same_party(
            &u("http://dev.local:8080/"),
            &u("https://dev.local:9999/")
        ));
        assert!(!same_party(
            &u("http://dev.local:8080/"),
            &u("https://dev.local/")
        ));
        // …but the same explicit port, upgraded, is still the same party.
        assert!(same_party(
            &u("http://dev.local:8080/"),
            &u("https://dev.local:8080/")
        ));
    }

    #[test]
    fn entry_urls_must_be_http() {
        assert!(parse_entry_url("https://suse.com").is_ok());
        assert!(parse_entry_url("  https://suse.com  ").is_ok());
        assert!(parse_entry_url("file:///etc/passwd").is_err());
        assert!(parse_entry_url("javascript:alert(1)").is_err());
        assert!(parse_entry_url("suse.com").is_err());
        assert!(parse_entry_url("").is_err());
        // Credentials are refused here too, not only in the studio's field:
        // reqwest would turn the userinfo into an Authorization: Basic header.
        assert!(parse_entry_url("https://user:pw@suse.com/").is_err());
        assert!(parse_entry_url("https://user@suse.com/").is_err());
    }

    #[test]
    fn subresources_may_be_cross_origin_but_never_downgrade() {
        let page = u("https://suse.com/");
        assert!(subresource_allowed(
            &page,
            &u("https://cdn.example/app.css")
        ));
        assert!(!subresource_allowed(
            &page,
            &u("http://cdn.example/app.css")
        ));
        let http_page = u("http://localhost:5173/");
        assert!(subresource_allowed(
            &http_page,
            &u("http://localhost:5173/app.css")
        ));
    }

    #[test]
    fn scan_finds_sheets_and_ranks_icons() {
        let html = r#"
            <html><head>
            <link rel="stylesheet" href="/a.css">
            <link rel=stylesheet href=/b.css>
            <link rel="icon" href="/favicon.ico">
            <link rel="apple-touch-icon" href="/touch.png">
            <meta property="og:image" content="https://suse.com/og.png">
            <link rel="preload" href="/not-a-sheet.css">
            <img src="/logo.svg" alt="logo">
            </head></html>"#;
        let base = u("https://suse.com/");
        let s = scan_subresources(html, &base);
        assert_eq!(
            s.sheets.iter().map(Url::as_str).collect::<Vec<_>>(),
            vec!["https://suse.com/a.css", "https://suse.com/b.css"]
        );
        // apple-touch-icon and og:image outrank the plain icon link.
        assert_eq!(
            s.assets.iter().map(Url::as_str).collect::<Vec<_>>(),
            vec![
                "https://suse.com/touch.png",
                "https://suse.com/og.png",
                "https://suse.com/favicon.ico"
            ]
        );
    }

    #[test]
    fn scan_survives_hostile_markup() {
        // A '>' inside a quoted value must not end the tag early, and an
        // unterminated quote must not spin.
        let html = r#"<link rel="stylesheet" title="a > b" href="/a.css"><link rel="stylesheet" href="/b.css><link rel="stylesheet" href="/c.css">"#;
        let s = scan_subresources(html, &u("https://suse.com/"));
        assert!(s.sheets.iter().any(|u| u.path() == "/a.css"));
        assert!(!s.sheets.is_empty());
    }

    #[test]
    fn scan_ignores_data_and_non_http_subresources() {
        let html = r#"<link rel="icon" href="data:image/png;base64,AAAA"><link rel="stylesheet" href="ftp://x/y.css">"#;
        let s = scan_subresources(html, &u("https://suse.com/"));
        assert!(s.assets.is_empty());
        assert!(s.sheets.is_empty());
    }
}

#[cfg(test)]
mod public_read_tests {
    use super::*;
    #[test]
    fn redirect_scope_rechecks_public_addresses_and_credentials() {
        let current = Url::parse("https://page.example.test/start").unwrap();
        for location in [
            "https://192.0.2.1/fixture",
            "https://[2001:db8::1]/fixture",
            "https://name:fixture@cdn.example.test/item",
            "http://cdn.example.test/item",
        ] {
            let response = PublicResponse {
                status: 302,
                headers: vec![("location".into(), location.into())],
                body: vec![],
            };
            assert!(
                redirect_target(&current, &response, false)
                    .unwrap_err()
                    .policy
            );
        }
        let response = PublicResponse {
            status: 302,
            headers: vec![("location".into(), "https://cdn.example.test/item".into())],
            body: vec![],
        };
        assert!(redirect_target(&current, &response, false).is_ok());
        assert!(
            redirect_target(&current, &response, true)
                .unwrap_err()
                .policy
        );
    }
    #[test]
    fn public_site_reads_refuse_local_connections_and_expired_deadlines() {
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        listener.set_nonblocking(true).unwrap();
        let url = Url::parse(&format!(
            "http://127.0.0.1:{}/fixture",
            listener.local_addr().unwrap().port()
        ))
        .unwrap();
        let runtime = tokio::runtime::Runtime::new().unwrap();
        runtime.block_on(async {
            assert!(
                get_capped(
                    &url,
                    1024,
                    Duration::from_secs(1),
                    Instant::now() + Duration::from_secs(1)
                )
                .await
                .unwrap_err()
                .policy
            );
            assert!(read_site(url.to_string(), Some(1000)).await.is_err());
            let public = Url::parse("https://unused.example.test/fixture").unwrap();
            assert!(
                !read_hop(&public, 1024, Duration::from_secs(1), Instant::now())
                    .await
                    .err()
                    .unwrap()
                    .policy
            );
        });
        assert_eq!(
            listener.accept().unwrap_err().kind(),
            std::io::ErrorKind::WouldBlock
        );
    }
}
