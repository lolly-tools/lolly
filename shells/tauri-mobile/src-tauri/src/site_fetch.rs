// SPDX-License-Identifier: MPL-2.0
#[path = "../../../tauri-shared/native/site_fetch.rs"]
mod reader;

#[tauri::command]
pub async fn site_fetch(url: String, timeout_ms: Option<u64>) -> Result<reader::SiteFetchResult, String> {
    reader::read_site(url, timeout_ms).await
}
