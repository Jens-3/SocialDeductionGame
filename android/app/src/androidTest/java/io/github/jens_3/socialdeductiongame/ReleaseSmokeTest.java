package io.github.jens_3.socialdeductiongame;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;

import android.app.Activity;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.content.pm.ApplicationInfo;
import android.graphics.drawable.AdaptiveIconDrawable;
import android.net.Uri;
import android.os.Build;
import android.os.ParcelFileDescriptor;
import android.provider.MediaStore;
import android.util.TypedValue;
import android.view.ContextThemeWrapper;
import android.webkit.WebView;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.rules.ActivityScenarioRule;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.BufferedReader;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import java.util.stream.Collectors;
import org.json.JSONObject;
import org.json.JSONTokener;
import org.junit.Rule;
import org.junit.Test;
import org.junit.runner.RunWith;

@RunWith(AndroidJUnit4.class)
public class ReleaseSmokeTest {
    private static final long JAVASCRIPT_TIMEOUT_SECONDS = 90;
    private static final long WEBVIEW_CALLBACK_TIMEOUT_SECONDS = 30;

    @Rule
    public final ActivityScenarioRule<MainActivity> activityRule =
        new ActivityScenarioRule<>(MainActivity.class);

    @Test
    public void releaseBuildSupportsCriticalNativeAndUserFlows() throws Exception {
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        Uri exportTarget = createExportTarget(context);
		Intent pluginIntent = NativeDataFilePlugin.createDocumentIntent("release-smoke");
		assertEquals(Intent.ACTION_CREATE_DOCUMENT, pluginIntent.getAction());
		assertEquals("application/json", pluginIntent.getType());
		assertEquals("release-smoke.json", pluginIntent.getStringExtra(Intent.EXTRA_TITLE));
		NativeDataFilePlugin.writeBytes(
			context.getContentResolver(),
			exportTarget,
			"{\"releaseSmoke\":true}".getBytes(StandardCharsets.UTF_8)
		);
		assertTrue("NativeDataFile byte export failed", readText(context, exportTarget).contains("releaseSmoke"));
		try {
			assertPackagedIconAndSplashResources(context);
			runPhase(activityRule.getScenario(), "beforeRestart");
			runPhase(activityRule.getScenario(), "orientation");
			returnToMainActivity();
			waitForResumedActivity("io.github.jens_3.socialdeductiongame/.MainActivity");
			startDialogPhase(activityRule.getScenario(), "exportDialog");
			waitForResumedActivity("com.google.android.documentsui", "DocumentsActivity");
			returnToMainActivity();
			waitForResumedActivity("io.github.jens_3.socialdeductiongame/.MainActivity");
			startDialogPhase(activityRule.getScenario(), "shareDialog");
			waitForResumedActivity("ChooserActivity", "ResolverActivity");
			returnToMainActivity();
			waitForResumedActivity("io.github.jens_3.socialdeductiongame/.MainActivity");
            activityRule.getScenario().close();
            try (ActivityScenario<MainActivity> restarted = ActivityScenario.launch(MainActivity.class)) {
                runPhase(restarted, "afterRestart");
            }
        } finally {
            context.getContentResolver().delete(exportTarget, null, null);
        }
	}

	private static void runPhase(ActivityScenario<MainActivity> scenario, String phase) throws Exception {
		WebView webView = getReadyWebView(scenario);
		evaluate(webView, phaseScript(phase), "starting phase " + phase);

		long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(JAVASCRIPT_TIMEOUT_SECONDS);
		JSONObject result = null;
		while (System.nanoTime() < deadline) {
			String rawResult = evaluate(
				webView,
				"window.__releaseSmokeResult || null",
				"polling phase " + phase
			);
			Object decoded = new JSONTokener(rawResult).nextValue();
			if (decoded instanceof String && !((String) decoded).isEmpty()) {
				result = new JSONObject((String) decoded);
				break;
			}
			Thread.sleep(250);
		}
		if (result == null) {
			String progress = evaluate(
				webView,
				"window.__releaseSmokeProgress || 'unknown'",
				"reading timeout progress for phase " + phase
			);
			throw new AssertionError("Release smoke phase timed out: " + phase + " at " + progress);
		}
		assertTrue(result.optString("message", "Release smoke phase failed"), result.optBoolean("ok"));
	}

	private static void startDialogPhase(ActivityScenario<MainActivity> scenario, String phase) throws Exception {
		WebView webView = getReadyWebView(scenario);
		executeWithoutResult(webView, phaseScript(phase));
	}

	private static WebView getReadyWebView(ActivityScenario<MainActivity> scenario) throws Exception {
		AtomicReference<WebView> webViewReference = new AtomicReference<>();
		scenario.onActivity(activity -> {
            assertNotNull("Capacitor bridge is unavailable", activity.getBridge());
            webViewReference.set(activity.getBridge().getWebView());
        });
		WebView webView = webViewReference.get();
		assertNotNull("Capacitor WebView is unavailable", webView);
		waitForApplicationReady(webView);
		return webView;
	}

	private static String phaseScript(String phase) throws Exception {
		return "window.__releaseSmokePhase=" + JSONObject.quote(phase) + ";\n" + loadSmokeScript();
	}

	private static void waitForResumedActivity(String... expectedMarkers) throws Exception {
		long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(20);
		String lastState = "";
		while (System.nanoTime() < deadline) {
			lastState = shellText("dumpsys activity activities");
			for (String line : lastState.split("\\R")) {
				if (!line.contains("topResumedActivity") && !line.contains("mResumedActivity")) continue;
				for (String marker : expectedMarkers) {
					if (line.contains(marker)) return;
				}
			}
			Thread.sleep(100);
		}
		throw new AssertionError(
			"Expected Android activity was not resumed. Last activity state: " + lastState
		);
	}

	private static void returnToMainActivity() throws Exception {
		shellText(
			"am start -W -a android.intent.action.MAIN -c android.intent.category.LAUNCHER "
				+ "-f 0x04000000 -n io.github.jens_3.socialdeductiongame/.MainActivity"
		);
	}

	private static String shellText(String shellCommand) throws Exception {
		ParcelFileDescriptor command = InstrumentationRegistry.getInstrumentation()
			.getUiAutomation()
			.executeShellCommand(shellCommand);
		ByteArrayOutputStream result = new ByteArrayOutputStream();
		try (InputStream output = new ParcelFileDescriptor.AutoCloseInputStream(command)) {
			byte[] buffer = new byte[4096];
			int read;
			while ((read = output.read(buffer)) >= 0) result.write(buffer, 0, read);
		}
		return result.toString(StandardCharsets.UTF_8.name());
	}

    private static Uri createExportTarget(Context context) {
        ContentValues values = new ContentValues();
        values.put(MediaStore.MediaColumns.DISPLAY_NAME, "release-smoke-export.json");
        values.put(MediaStore.MediaColumns.MIME_TYPE, "application/json");
        Uri uri = context.getContentResolver().insert(
            MediaStore.Downloads.EXTERNAL_CONTENT_URI,
            values
        );
        assertNotNull("Could not create test export document", uri);
        return uri;
    }

    private static String readText(Context context, Uri uri) throws Exception {
        try (InputStream input = context.getContentResolver().openInputStream(uri)) {
            assertNotNull("Exported document cannot be opened", input);
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            byte[] buffer = new byte[4096];
            int read;
            while ((read = input.read(buffer)) >= 0) output.write(buffer, 0, read);
            return output.toString(StandardCharsets.UTF_8.name());
        }
    }

    private static void assertPackagedIconAndSplashResources(Context context) throws Exception {
        ApplicationInfo applicationInfo = context.getPackageManager().getApplicationInfo(
            context.getPackageName(),
            0
        );
        assertTrue("launcher icon is missing", applicationInfo.icon != 0);
        assertNotNull("launcher icon cannot be loaded", context.getPackageManager().getApplicationIcon(applicationInfo));
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            assertTrue(
                "launcher icon is not packaged as an adaptive icon",
                context.getPackageManager().getApplicationIcon(applicationInfo) instanceof AdaptiveIconDrawable
            );
        }
        int roundIcon = context.getResources().getIdentifier(
            "ic_launcher_round",
            "mipmap",
            context.getPackageName()
        );
        assertTrue("round launcher icon is missing", roundIcon != 0);
        int splashForeground = requireResource(
            context,
            "ic_launcher_foreground",
            "mipmap",
            "splash foreground"
        );
        assertNotNull("splash foreground cannot be loaded", context.getDrawable(splashForeground));
        int splashBackground = requireResource(
            context,
            "ic_launcher_background",
            "color",
            "splash background"
        );
        context.getColor(splashBackground);
        ActivityInfo activityInfo = context.getPackageManager().getActivityInfo(
            new android.content.ComponentName(context, MainActivity.class),
            0
        );
        int launchTheme = context.getResources().getIdentifier(
            "AppTheme.NoActionBarLaunch",
            "style",
            context.getPackageName()
        );
        assertTrue("launch theme is missing", launchTheme != 0);
        assertEquals("MainActivity does not use the splash launch theme", launchTheme, activityInfo.theme);

        ContextThemeWrapper launchContext = new ContextThemeWrapper(context, launchTheme);
        assertThemeResource(
            launchContext,
            requireResource(
                context,
                "windowSplashScreenAnimatedIcon",
                "attr",
                "splash foreground attribute"
            ),
            splashForeground,
            "splash foreground"
        );
        assertThemeResource(
            launchContext,
            requireResource(
                context,
                "windowSplashScreenBackground",
                "attr",
                "splash background attribute"
            ),
            splashBackground,
            "splash background"
        );
        assertThemeResource(
            launchContext,
            requireResource(
                context,
                "windowSplashScreenIconBackgroundColor",
                "attr",
                "splash icon background attribute"
            ),
            splashBackground,
            "splash icon background"
        );
        assertThemeResource(
            launchContext,
            requireResource(
                context,
                "postSplashScreenTheme",
                "attr",
                "post-splash theme attribute"
            ),
            requireResource(
                context,
                "AppTheme.NoActionBar",
                "style",
                "post-splash theme"
            ),
            "post-splash theme"
        );
    }

    private static int requireResource(
        Context context,
        String name,
        String type,
        String description
    ) {
        int resource = context.getResources().getIdentifier(
            name,
            type,
            context.getPackageName()
        );
        assertTrue(description + " is missing", resource != 0);
        return resource;
    }

    private static void assertThemeResource(
        ContextThemeWrapper context,
        int attribute,
        int expectedResource,
        String description
    ) {
        TypedValue value = new TypedValue();
        assertTrue(
            description + " is missing from the launch theme",
            context.getTheme().resolveAttribute(attribute, value, false)
        );
        int actualResource = value.resourceId;
        if (actualResource == 0 && value.type == TypedValue.TYPE_REFERENCE) {
            actualResource = value.data;
        }
        assertEquals(description + " uses the wrong resource", expectedResource, actualResource);
    }

    private static void waitForApplicationReady(WebView webView) throws Exception {
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(45);
        int consecutiveReadyChecks = 0;
        while (System.nanoTime() < deadline) {
            String ready = evaluate(
                webView,
                "document.readyState === 'complete'"
                    + " && Boolean(window.Capacitor?.isNativePlatform?.())"
                    + " && Boolean(document.querySelector('[data-testid=\"home-continue\"]'))",
                "waiting for the application home screen"
            );
            if ("true".equals(ready)) {
                consecutiveReadyChecks++;
                if (consecutiveReadyChecks >= 3) return;
            } else {
                consecutiveReadyChecks = 0;
            }
            Thread.sleep(200);
        }
        throw new AssertionError("Capacitor application did not reach a stable home screen");
    }

	private static String evaluate(WebView webView, String script, String operation) throws Exception {
        CountDownLatch latch = new CountDownLatch(1);
        AtomicReference<String> result = new AtomicReference<>();
        boolean scheduled = webView.post(() -> webView.evaluateJavascript(script, value -> {
            result.set(value);
            latch.countDown();
        }));
		if (!scheduled) {
			throw new AssertionError("WebView rejected JavaScript while " + operation);
		}
        if (!latch.await(WEBVIEW_CALLBACK_TIMEOUT_SECONDS, TimeUnit.SECONDS)) {
			throw new AssertionError(
				"JavaScript evaluation timed out after "
					+ WEBVIEW_CALLBACK_TIMEOUT_SECONDS
					+ " seconds while "
					+ operation
			);
		}
		return result.get();
	}

	private static void executeWithoutResult(WebView webView, String script) throws Exception {
		CountDownLatch latch = new CountDownLatch(1);
		webView.post(() -> {
			webView.evaluateJavascript(script, null);
			latch.countDown();
		});
		if (!latch.await(WEBVIEW_CALLBACK_TIMEOUT_SECONDS, TimeUnit.SECONDS)) {
			throw new AssertionError("JavaScript dialog phase could not be scheduled");
		}
	}

    private static String loadSmokeScript() throws Exception {
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(
            InstrumentationRegistry.getInstrumentation().getContext().getAssets().open("release_smoke.js"),
            StandardCharsets.UTF_8
        ))) {
            return reader.lines().collect(Collectors.joining("\n"));
        }
    }
}
