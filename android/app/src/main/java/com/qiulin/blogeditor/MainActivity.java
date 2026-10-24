package com.qiulin.blogeditor;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.view.KeyEvent;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.webkit.WebSettingsCompat;
import androidx.webkit.WebViewFeature;

/**
 * 编辑器整体是一个纯静态网页（随 APK 内置在 assets/editor/），本地加载、离线可用；
 * 保存/传图时由页面直接请求 api.github.com，因此开启 file:// 的跨域访问。
 */
public class MainActivity extends Activity {

	private static final int FILE_CHOOSER_CODE = 1;

	private WebView web;
	private ValueCallback<Uri[]> fileCallback;

	@SuppressLint("SetJavaScriptEnabled")
	@Override
	protected void onCreate(Bundle savedInstanceState) {
		super.onCreate(savedInstanceState);
		web = new WebView(this);

		WebSettings st = web.getSettings();
		st.setJavaScriptEnabled(true);
		st.setDomStorageEnabled(true);
		st.setAllowFileAccess(true);
		st.setAllowUniversalAccessFromFileURLs(true);
		if (WebViewFeature.isFeatureSupported(WebViewFeature.ALGORITHMIC_DARKENING)) {
			WebSettingsCompat.setAlgorithmicDarkeningAllowed(st, true);
		}

		web.setWebViewClient(new WebViewClient());
		web.setWebChromeClient(new WebChromeClient() {
			@Override
			public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback,
					FileChooserParams params) {
				if (fileCallback != null) {
					fileCallback.onReceiveValue(null);
				}
				fileCallback = callback;
				Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
				intent.addCategory(Intent.CATEGORY_OPENABLE);
				intent.setType("image/*");
				startActivityForResult(Intent.createChooser(intent, "选择图片"), FILE_CHOOSER_CODE);
				return true;
			}
		});

		web.loadUrl("file:///android_asset/editor/index.html");
		setContentView(web);
	}

	@Override
	protected void onActivityResult(int requestCode, int resultCode, Intent data) {
		if (requestCode == FILE_CHOOSER_CODE && fileCallback != null) {
			Uri[] results = null;
			if (resultCode == RESULT_OK && data != null) {
				if (data.getClipData() != null) {
					int n = data.getClipData().getItemCount();
					results = new Uri[n];
					for (int i = 0; i < n; i++) {
						results[i] = data.getClipData().getItemAt(i).getUri();
					}
				} else if (data.getData() != null) {
					results = new Uri[]{ data.getData() };
				}
			}
			fileCallback.onReceiveValue(results);
			fileCallback = null;
			return;
		}
		super.onActivityResult(requestCode, resultCode, data);
	}

	@Override
	public boolean onKeyDown(int keyCode, KeyEvent event) {
		if (keyCode == KeyEvent.KEYCODE_BACK && web != null && web.canGoBack()) {
			web.goBack();
			return true;
		}
		return super.onKeyDown(keyCode, event);
	}
}
