//! Narrow native HTTP transport for reviewed shell code.
//!
//! This replaces the webview-visible `plugin:http|*` command family. Requests
//! are HTTPS-only, have bounded metadata and bodies, resolve to public IP space,
//! pin the resolved addresses into a fresh no-proxy client, and re-apply those
//! checks on every redirect. The command remains intentionally general enough
//! for user-selected remote Lolly instances and personal export providers.

use std::net::{IpAddr, Ipv4Addr, Ipv6Addr, SocketAddr, ToSocketAddrs};
use std::time::Duration;

use reqwest::{
    header::{HeaderMap, HeaderName, HeaderValue, AUTHORIZATION, CONTENT_TYPE, COOKIE, LOCATION},
    redirect::Policy,
    Client, Method, Url,
};
use serde::{Deserialize, Serialize};

const MAX_URL_BYTES: usize = 8 * 1024;
const MAX_HEADERS: usize = 64;
const MAX_HEADER_NAME_BYTES: usize = 128;
const MAX_HEADER_VALUE_BYTES: usize = 16 * 1024;
const MAX_HEADER_BYTES: usize = 64 * 1024;
const MAX_REQUEST_BYTES: usize = 256 * 1024 * 1024;
const MAX_RESPONSE_BYTES: usize = 256 * 1024 * 1024;
const MAX_REDIRECTS: usize = 5;
const DEFAULT_TIMEOUT_MS: u64 = 60_000;
const MIN_TIMEOUT_MS: u64 = 1_000;
const MAX_TIMEOUT_MS: u64 = 5 * 60_000;
const USER_AGENT: &str = "Lolly/1.0 (+https://lolly.tools)";

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteFetchRequest {
    method: String,
    url: String,
    #[serde(default)]
    headers: Vec<(String, String)>,
    body: Option<Vec<u8>>,
    timeout_ms: Option<u64>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteFetchResponse {
    status: u16,
    status_text: String,
    url: String,
    headers: Vec<(String, String)>,
    body: Vec<u8>,
}

#[tauri::command]
pub async fn remote_fetch(request: RemoteFetchRequest) -> Result<RemoteFetchResponse, String> {
    let mut url = validate_url(&request.url)?;
    let mut method = validate_method(&request.method)?;
    let mut headers = validate_headers(request.headers)?;
    let mut body = request.body.unwrap_or_default();
    if body.len() > MAX_REQUEST_BYTES {
        return Err("The request body is larger than Lolly will send.".into());
    }
    let timeout = Duration::from_millis(
        request
            .timeout_ms
            .unwrap_or(DEFAULT_TIMEOUT_MS)
            .clamp(MIN_TIMEOUT_MS, MAX_TIMEOUT_MS),
    );

    for hop in 0..=MAX_REDIRECTS {
        let client = pinned_client(&url, timeout).await?;
        let mut builder = client
            .request(method.clone(), url.clone())
            .headers(headers.clone());
        if !body.is_empty() {
            builder = builder.body(body.clone());
        }
        let mut response = builder
            .send()
            .await
            .map_err(|_| "The remote service could not be reached.".to_string())?;
        let status = response.status();

        if status.is_redirection() {
            if hop == MAX_REDIRECTS {
                return Err("The remote service redirected too many times.".into());
            }
            let location = response
                .headers()
                .get(LOCATION)
                .and_then(|value| value.to_str().ok())
                .ok_or_else(|| {
                    "The remote service redirected without a valid destination.".to_string()
                })?;
            let next = url.join(location).map_err(|_| {
                "The remote service redirected to an invalid destination.".to_string()
            })?;
            let next = validate_url(next.as_str())?;
            if origin(&url) != origin(&next) {
                headers.remove(AUTHORIZATION);
                headers.remove(COOKIE);
            }
            if status.as_u16() == 303
                || ((status.as_u16() == 301 || status.as_u16() == 302) && method == Method::POST)
            {
                method = Method::GET;
                body.clear();
                headers.remove(CONTENT_TYPE);
            }
            url = next;
            continue;
        }

        let final_url = response.url().to_string();
        let response_headers = response
            .headers()
            .iter()
            .filter_map(|(name, value)| {
                value
                    .to_str()
                    .ok()
                    .map(|value| (name.to_string(), value.to_string()))
            })
            .collect();
        let bytes = read_capped(&mut response, MAX_RESPONSE_BYTES).await?;
        return Ok(RemoteFetchResponse {
            status: status.as_u16(),
            status_text: status.canonical_reason().unwrap_or("").to_string(),
            url: final_url,
            headers: response_headers,
            body: bytes,
        });
    }
    Err("The remote request could not be completed.".into())
}

fn validate_url(raw: &str) -> Result<Url, String> {
    if raw.len() > MAX_URL_BYTES {
        return Err("The remote address is too long.".into());
    }
    let url = Url::parse(raw).map_err(|_| "The remote address is invalid.".to_string())?;
    if url.scheme() != "https" || url.host_str().is_none() {
        return Err("Native remote requests require https.".into());
    }
    if !url.username().is_empty() || url.password().is_some() {
        return Err("The remote address must not contain credentials.".into());
    }
    if let Some(host) = url.host_str() {
        if let Ok(address) = host.parse::<IpAddr>() {
            if !is_public_ip(address) {
                return Err("The remote address does not resolve to public network space.".into());
            }
        }
    }
    Ok(url)
}

fn validate_method(raw: &str) -> Result<Method, String> {
    let method = Method::from_bytes(raw.as_bytes())
        .map_err(|_| "The request method is invalid.".to_string())?;
    if matches!(
        method,
        Method::GET
            | Method::HEAD
            | Method::POST
            | Method::PUT
            | Method::PATCH
            | Method::DELETE
            | Method::OPTIONS
    ) {
        Ok(method)
    } else {
        Err("The request method is not allowed.".into())
    }
}

fn validate_headers(entries: Vec<(String, String)>) -> Result<HeaderMap, String> {
    if entries.len() > MAX_HEADERS {
        return Err("The request has too many headers.".into());
    }
    let mut total = 0usize;
    let mut out = HeaderMap::new();
    for (name, value) in entries {
        total = total.saturating_add(name.len()).saturating_add(value.len());
        if name.len() > MAX_HEADER_NAME_BYTES
            || value.len() > MAX_HEADER_VALUE_BYTES
            || total > MAX_HEADER_BYTES
        {
            return Err("The request headers are too large.".into());
        }
        let lower = name.to_ascii_lowercase();
        if matches!(
            lower.as_str(),
            "host"
                | "connection"
                | "content-length"
                | "transfer-encoding"
                | "upgrade"
                | "proxy-authorization"
                | "proxy-connection"
        ) || lower.starts_with("sec-")
        {
            return Err("The request contains a transport-controlled header.".into());
        }
        let name = HeaderName::from_bytes(name.as_bytes())
            .map_err(|_| "A request header name is invalid.".to_string())?;
        let value = HeaderValue::from_str(&value)
            .map_err(|_| "A request header value is invalid.".to_string())?;
        out.append(name, value);
    }
    Ok(out)
}

async fn pinned_client(url: &Url, timeout: Duration) -> Result<Client, String> {
    let host = url
        .host_str()
        .ok_or_else(|| "The remote address has no host.".to_string())?
        .to_string();
    let port = url.port_or_known_default().unwrap_or(443);
    let addresses = if let Ok(ip) = host.parse::<IpAddr>() {
        vec![SocketAddr::new(ip, port)]
    } else {
        let lookup_host = host.clone();
        tauri::async_runtime::spawn_blocking(move || {
            (lookup_host.as_str(), port)
                .to_socket_addrs()
                .map(|answers| answers.collect::<Vec<_>>())
        })
        .await
        .map_err(|_| "The remote name could not be resolved.".to_string())?
        .map_err(|_| "The remote name could not be resolved.".to_string())?
    };
    if addresses.is_empty() || addresses.iter().any(|answer| !is_public_ip(answer.ip())) {
        return Err("The remote address does not resolve to public network space.".into());
    }
    Client::builder()
        .user_agent(USER_AGENT)
        .timeout(timeout)
        .redirect(Policy::none())
        .no_proxy()
        .resolve_to_addrs(&host, &addresses)
        .build()
        .map_err(|_| "The native HTTP client could not be created.".to_string())
}

async fn read_capped(response: &mut reqwest::Response, cap: usize) -> Result<Vec<u8>, String> {
    if response
        .content_length()
        .is_some_and(|length| length > cap as u64)
    {
        return Err("The remote response is larger than Lolly will read.".into());
    }
    let mut out = Vec::new();
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|_| "The remote response ended unexpectedly.".to_string())?
    {
        if out.len().saturating_add(chunk.len()) > cap {
            return Err("The remote response is larger than Lolly will read.".into());
        }
        out.extend_from_slice(&chunk);
    }
    Ok(out)
}

fn origin(url: &Url) -> (String, String, u16) {
    (
        url.scheme().to_string(),
        url.host_str().unwrap_or("").to_ascii_lowercase(),
        url.port_or_known_default().unwrap_or(443),
    )
}

fn is_public_ip(address: IpAddr) -> bool {
    match address {
        IpAddr::V4(v4) => is_public_v4(v4),
        IpAddr::V6(v6) => v6
            .to_ipv4_mapped()
            .map(is_public_v4)
            .unwrap_or_else(|| is_public_v6(v6)),
    }
}

fn is_public_v4(address: Ipv4Addr) -> bool {
    let [a, b, c, _] = address.octets();
    !(a == 0
        || a == 10
        || a == 127
        || a >= 224
        || (a == 100 && (64..=127).contains(&b))
        || (a == 169 && b == 254)
        || (a == 172 && (16..=31).contains(&b))
        || (a == 192 && b == 168)
        || (a == 192 && b == 0 && c == 0)
        || (a == 192 && b == 0 && c == 2)
        || (a == 198 && (b == 18 || b == 19))
        || (a == 198 && b == 51 && c == 100)
        || (a == 203 && b == 0 && c == 113))
}

fn is_public_v6(address: Ipv6Addr) -> bool {
    let segments = address.segments();
    !(address.is_unspecified()
        || address.is_loopback()
        || (segments[0] & 0xff00) == 0xff00
        || (segments[0] & 0xfe00) == 0xfc00
        || (segments[0] & 0xffc0) == 0xfe80
        || (segments[0] & 0xffc0) == 0xfec0
        || (segments[0] == 0x0100 && segments[1] == 0 && segments[2] == 0 && segments[3] == 0)
        || (segments[0] == 0x2001 && segments[1] == 0x0db8))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn address_policy_rejects_local_private_metadata_and_documentation_space() {
        for raw in [
            "127.0.0.1",
            "10.0.0.1",
            "100.64.0.1",
            "169.254.169.254",
            "172.16.0.1",
            "192.168.0.1",
            "192.0.2.1",
            "198.51.100.1",
            "203.0.113.1",
            "::1",
            "fe80::1",
            "fc00::1",
            "2001:db8::1",
            "::ffff:127.0.0.1",
        ] {
            assert!(!is_public_ip(raw.parse().unwrap()), "{raw}");
        }
        assert!(is_public_ip("1.1.1.1".parse().unwrap()));
        assert!(is_public_ip("2606:4700:4700::1111".parse().unwrap()));
    }

    #[test]
    fn request_boundary_requires_safe_https_and_transport_owned_headers() {
        assert!(validate_url("http://example.com/").is_err());
        assert!(validate_url("https://user:pass@example.com/").is_err());
        assert!(validate_url("https://127.0.0.1/").is_err());
        assert!(validate_url("https://example.com/path").is_ok());
        assert!(validate_headers(vec![("Host".into(), "elsewhere.test".into())]).is_err());
        assert!(validate_headers(vec![("authorization".into(), "Bearer test".into())]).is_ok());
    }
}
