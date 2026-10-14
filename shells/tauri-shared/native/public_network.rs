// SPDX-License-Identifier: MPL-2.0
use reqwest::{redirect::Policy, Client, Url};
use std::net::{IpAddr, Ipv4Addr, Ipv6Addr, SocketAddr, ToSocketAddrs};
use std::sync::{Arc, LazyLock};
use std::time::Duration;

static DNS_SLOTS: LazyLock<Arc<tokio::sync::Semaphore>> =
    LazyLock::new(|| Arc::new(tokio::sync::Semaphore::new(2)));

pub(crate) struct PublicResponse {
    pub status: u16,
    pub headers: Vec<(String, String)>,
    pub body: Vec<u8>,
}

pub(crate) fn public_http_url(raw: &str) -> Result<Url, String> {
    if raw.len() > 8192 {
        return Err("The page address is too long.".into());
    }
    let url = Url::parse(raw).map_err(|_| "The page address is invalid.".to_string())?;
    if !matches!(url.scheme(), "http" | "https")
        || url.host().is_none()
        || !url.username().is_empty()
        || url.password().is_some()
    {
        return Err("Page reads require an http(s) address without credentials.".into());
    }
    let literal = match url.host() {
        Some(url::Host::Ipv4(v)) => Some(IpAddr::V4(v)),
        Some(url::Host::Ipv6(v)) => Some(IpAddr::V6(v)),
        _ => None,
    };
    if literal.is_some_and(|v| !is_public_ip(v)) {
        return Err("The page address is outside public network space.".into());
    }
    Ok(url)
}

#[derive(Debug)]
pub(crate) struct PublicReadError {
    pub policy: bool,
    pub message: String,
}
impl PublicReadError {
    pub(crate) fn policy(message: impl Into<String>) -> Self {
        Self {
            policy: true,
            message: message.into(),
        }
    }
    pub(crate) fn unavailable(message: impl Into<String>) -> Self {
        Self {
            policy: false,
            message: message.into(),
        }
    }
}

pub(crate) async fn capture_read(raw: &str, method: &str) -> Result<PublicResponse, String> {
    public_read(raw, method, Duration::from_secs(10), 8 * 1024 * 1024)
        .await
        .map_err(|e| e.message)
}

pub(crate) async fn public_read(
    raw: &str,
    method: &str,
    timeout: Duration,
    cap: usize,
) -> Result<PublicResponse, PublicReadError> {
    let url = public_http_url(raw).map_err(PublicReadError::policy)?;
    if !matches!(method, "GET" | "HEAD") {
        return Err(PublicReadError::policy(
            "Page reads support GET and HEAD only.",
        ));
    }
    tokio::time::timeout(timeout, async {
        let (client, addresses) = checked_client(&url, timeout).await?;
        let mut response = client
            .request(reqwest::Method::from_bytes(method.as_bytes()).unwrap(), url)
            .header("accept-encoding", "identity")
            .send()
            .await
            .map_err(|_| PublicReadError::unavailable("The public page could not be reached."))?;
        if !response
            .remote_addr()
            .is_some_and(|address| addresses.contains(&address) && is_public_ip(address.ip()))
        {
            return Err(PublicReadError::policy(
                "The public page connection was refused.",
            ));
        }
        if response
            .headers()
            .get("content-encoding")
            .is_some_and(|v| v != "identity")
        {
            return Err(PublicReadError::unavailable(
                "The public page returned unsupported content encoding.",
            ));
        }
        if response.content_length().is_some_and(|v| v > cap as u64) {
            return Err(PublicReadError::unavailable(
                "The public page response is too large.",
            ));
        }
        let status = response.status().as_u16();
        let headers = response
            .headers()
            .iter()
            .filter_map(|(name, value)| {
                if matches!(
                    name.as_str(),
                    "set-cookie"
                        | "connection"
                        | "transfer-encoding"
                        | "content-length"
                        | "upgrade"
                        | "alt-svc"
                        | "www-authenticate"
                        | "proxy-authenticate"
                ) {
                    return None;
                }
                value
                    .to_str()
                    .ok()
                    .map(|v| (name.to_string(), v.to_string()))
            })
            .collect();
        let mut body = Vec::new();
        while let Some(chunk) = response.chunk().await.map_err(|_| {
            PublicReadError::unavailable("The public page response ended unexpectedly.")
        })? {
            if body.len().saturating_add(chunk.len()) > cap {
                return Err(PublicReadError::unavailable(
                    "The public page response is too large.",
                ));
            }
            body.extend_from_slice(&chunk);
        }
        Ok(PublicResponse {
            status,
            headers,
            body,
        })
    })
    .await
    .map_err(|_| PublicReadError::unavailable("Reading the public page timed out."))?
}

pub(crate) async fn pinned_client(url: &Url, timeout: Duration) -> Result<Client, String> {
    checked_client(url, timeout)
        .await
        .map(|(client, _)| client)
        .map_err(|e| e.message)
}

async fn checked_client(
    url: &Url,
    timeout: Duration,
) -> Result<(Client, Vec<SocketAddr>), PublicReadError> {
    let host = url
        .host_str()
        .ok_or_else(|| PublicReadError::policy("The remote address has no host."))?
        .to_string();
    let port = url.port_or_known_default().unwrap_or(443);
    let literal = match url.host() {
        Some(url::Host::Ipv4(ip)) => Some(IpAddr::V4(ip)),
        Some(url::Host::Ipv6(ip)) => Some(IpAddr::V6(ip)),
        _ => None,
    };
    let addresses = if let Some(ip) = literal {
        vec![SocketAddr::new(ip, port)]
    } else {
        let lookup_host = host.clone();
        let slot = Arc::clone(&DNS_SLOTS).try_acquire_owned().map_err(|_| {
            PublicReadError::unavailable("Native name resolution is busy. Try again shortly.")
        })?;
        tokio::task::spawn_blocking(move || {
            let _slot = slot;
            (lookup_host.as_str(), port)
                .to_socket_addrs()
                .map(|answers| answers.collect::<Vec<_>>())
        })
        .await
        .map_err(|_| PublicReadError::unavailable("The remote name could not be resolved."))?
        .map_err(|_| PublicReadError::unavailable("The remote name could not be resolved."))?
    };
    public_addresses(&addresses).map_err(PublicReadError::policy)?;
    let client =
        client_for_addresses(&host, &addresses, timeout).map_err(PublicReadError::unavailable)?;
    Ok((client, addresses))
}

fn public_addresses(addresses: &[SocketAddr]) -> Result<(), String> {
    if addresses.is_empty() || addresses.iter().any(|answer| !is_public_ip(answer.ip())) {
        return Err("The remote address does not resolve to public network space.".into());
    }
    Ok(())
}

fn client_for_addresses(
    host: &str,
    addresses: &[SocketAddr],
    timeout: Duration,
) -> Result<Client, String> {
    Client::builder()
        .user_agent("Lolly/1.0 (+https://lolly.tools)")
        .timeout(timeout)
        .redirect(Policy::none())
        .no_proxy()
        .resolve_to_addrs(host, addresses)
        .build()
        .map_err(|_| "The native HTTP client could not be created.".to_string())
}

pub(crate) fn is_public_ip(address: IpAddr) -> bool {
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
        || (a == 192 && b == 88 && c == 99)
        || (a == 192 && b == 168)
        || (a == 192 && b == 0 && c == 0)
        || (a == 192 && b == 0 && c == 2)
        || (a == 198 && (b == 18 || b == 19))
        || (a == 198 && b == 51 && c == 100)
        || (a == 203 && b == 0 && c == 113))
}

fn is_public_v6(address: Ipv6Addr) -> bool {
    let s = address.segments();
    (s[0] & 0xe000) == 0x2000
        && !(s[0] == 0x2001 && s[1] < 0x0200)
        && !(s[0] == 0x2001 && s[1] == 0x0db8)
        && s[0] != 0x2002
        && !(s[0] == 0x3fff && (s[1] & 0xf000) == 0)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::{Read, Write};

    #[test]
    fn public_policy_refuses_empty_mixed_and_reserved_answers() {
        assert!(public_addresses(&[]).is_err());
        assert!(public_addresses(&[
            "1.1.1.1:443".parse().unwrap(),
            "192.0.2.1:443".parse().unwrap()
        ])
        .is_err());
        for raw in [
            "192.88.99.1",
            "2001::1",
            "2002::1",
            "3fff::1",
            "5f00::1",
            "64:ff9b::1",
        ] {
            assert!(!is_public_ip(raw.parse().unwrap()), "{raw}");
        }
        assert!(public_addresses(&["1.1.1.1:443".parse().unwrap()]).is_ok());
    }

    #[test]
    fn capture_address_refuses_non_http_and_non_public_targets() {
        for raw in [
            "file:///unavailable-fixture",
            "https://192.0.2.1/fixture",
            "https://[2001:db8::1]/fixture",
            "https://user:fixture@capture.example.test/",
        ] {
            assert!(public_http_url(raw).is_err());
        }
        assert!(public_http_url("http://capture.example.test/page").is_ok());
    }

    #[test]
    fn native_client_connects_to_its_pinned_table_with_the_original_host() {
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let address = listener.local_addr().unwrap();
        let server = std::thread::spawn(move || {
            let (mut socket, _) = listener.accept().unwrap();
            let mut bytes = [0; 4096];
            let n = socket.read(&mut bytes).unwrap();
            let request = String::from_utf8_lossy(&bytes[..n]).to_lowercase();
            assert!(request.contains(&format!("host: pinned.example.test:{}", address.port())));
            assert!(!request.contains("authorization:") && !request.contains("cookie:"));
            socket
                .write_all(
                    b"HTTP/1.1 200 OK\r\nContent-Length: 7\r\nConnection: close\r\n\r\nfixture",
                )
                .unwrap();
        });
        let runtime = tokio::runtime::Runtime::new().unwrap();
        runtime.block_on(async {
            let client =
                client_for_addresses("pinned.example.test", &[address], Duration::from_secs(2))
                    .unwrap();
            let response = client
                .get(format!(
                    "http://pinned.example.test:{}/fixture",
                    address.port()
                ))
                .send()
                .await
                .unwrap();
            assert_eq!(response.remote_addr(), Some(address));
            assert_eq!(response.bytes().await.unwrap().as_ref(), b"fixture");
        });
        server.join().unwrap();
    }
}
