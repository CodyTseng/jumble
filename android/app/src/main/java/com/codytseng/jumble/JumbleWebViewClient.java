package com.codytseng.jumble;

import android.content.Intent;
import android.net.Uri;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.widget.Toast;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebViewClient;

/** Explicit feedback for wallet/signing links when their app is not installed. */
final class JumbleWebViewClient extends BridgeWebViewClient {
    private final Bridge bridge;
    JumbleWebViewClient(Bridge bridge) { super(bridge); this.bridge = bridge; }

    @Override
    public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
        Uri uri = request.getUrl();
        String scheme = uri.getScheme();
        if (scheme != null && !scheme.matches("https?|data|blob|about")) {
            if (!request.isForMainFrame()) return true;
            if (!scheme.matches("mailto|tel|lightning|bitcoin|nostr|nostrconnect|nostrsigner")) return true;
            try {
                bridge.getActivity().startActivity(new Intent(Intent.ACTION_VIEW, uri).addCategory(Intent.CATEGORY_BROWSABLE));
            } catch (RuntimeException error) {
                Toast.makeText(bridge.getContext(), R.string.no_external_app, Toast.LENGTH_LONG).show();
            }
            return true;
        }
        return super.shouldOverrideUrlLoading(view, request);
    }
}
