# AndroidX Test expects this transitive helper in its target APK. The real
# release variant may continue to remove it because the app itself does not use it.
-keep class androidx.tracing.** { *; }
-keep class kotlin.** { *; }
-keep interface kotlin.** { *; }
-keep class kotlinx.coroutines.** { *; }

# Entry points called across the target-APK/test-APK boundary.
-keepclassmembers class com.getcapacitor.BridgeActivity {
    public com.getcapacitor.Bridge getBridge();
}
-keepclassmembers class com.getcapacitor.Bridge {
    public android.webkit.WebView getWebView();
}
