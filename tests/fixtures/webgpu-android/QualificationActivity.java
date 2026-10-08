// SPDX-License-Identifier: MPL-2.0
package tools.lolly.webgpuqualification;

import android.app.Activity;
import android.content.pm.PackageInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import org.json.JSONObject;

/** Owns one local test page; no GPU flags, provider changes or JavaScript bridge. */
public final class QualificationActivity extends Activity {
    private WebView webView;

    private boolean accepts(Uri address, int port) {
        return "http".equals(address.getScheme()) && "127.0.0.1".equals(address.getHost())
            && address.getPort() == port && address.getUserInfo() == null;
    }

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        String input = getIntent().getStringExtra("qualification_url");
        if (input == null) throw new IllegalArgumentException("Missing owned qualification URL");
        Uri address = Uri.parse(input);
        String actor = address.getQueryParameter("qualification");
        if (!accepts(address, address.getPort()) || address.getPort() < 1024
            || !"/".equals(address.getPath()) || address.getFragment() != null
            || address.getQueryParameterNames().size() != 1
            || actor == null || !actor.matches("[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}")) {
            throw new IllegalArgumentException("Only an owned loopback qualification page is allowed");
        }
        final int port = address.getPort();
        webView = new WebView(this);
        webView.getSettings().setJavaScriptEnabled(true);
        // Other WebView feature settings retain the provider defaults.
        webView.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return !accepts(request.getUrl(), port);
            }
        });
        setContentView(webView);
        webView.post(() -> recordEnvironment());
        webView.loadUrl(input);
    }

    private void recordEnvironment() {
        try {
            PackageInfo provider = WebView.getCurrentWebViewPackage();
            JSONObject info = new JSONObject();
            info.put("actor", Uri.parse(getIntent().getStringExtra("qualification_url")).getQueryParameter("qualification"));
            info.put("package", provider == null ? JSONObject.NULL : provider.packageName);
            info.put("version", provider == null ? JSONObject.NULL : provider.versionName);
            info.put("versionCode", provider == null ? JSONObject.NULL : provider.getLongVersionCode());
            info.put("sdk", Build.VERSION.SDK_INT);
            info.put("release", Build.VERSION.RELEASE);
            info.put("securityPatch", Build.VERSION.SECURITY_PATCH);
            info.put("fingerprint", Build.FINGERPRINT);
            info.put("hardware", Build.HARDWARE);
            info.put("javascriptEnabled", webView.getSettings().getJavaScriptEnabled());
            info.put("domStorageEnabled", webView.getSettings().getDomStorageEnabled());
            info.put("mixedContentMode", webView.getSettings().getMixedContentMode());
            info.put("hardwareAccelerated", webView.isHardwareAccelerated());
            Log.i("LollyWebGpuQualification", info.toString());
        } catch (Exception error) {
            Log.e("LollyWebGpuQualification", "Could not record native settings", error);
        }
    }

    @Override public void onDestroy() {
        if (webView != null) {
            webView.stopLoading(); webView.loadUrl("about:blank"); webView.destroy();
        }
        super.onDestroy();
    }
}
