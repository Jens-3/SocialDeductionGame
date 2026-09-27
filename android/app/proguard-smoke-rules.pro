# AndroidX Test expects this transitive helper in its target APK. The real
# release variant may continue to remove it because the app itself does not use it.
-keep class androidx.tracing.Trace { *; }

# AndroidJUnitRunner's FileTestStorage uses a Kotlin lambda and lazy delegate.
# These calls originate in the separate test APK and are invisible to app R8.
-keep class kotlin.jvm.internal.Lambda { *; }
-keep class kotlin.jvm.internal.Intrinsics { *; }
-keep interface kotlin.jvm.functions.Function0 { *; }
-keep interface kotlin.Lazy { *; }
-keep class kotlin.LazyKt { *; }
-keep class kotlin.LazyKt__LazyJVMKt { *; }
-keep class kotlin.LazyKt__LazyKt { *; }

# Entry points called across the target-APK/test-APK boundary.
-keepclassmembers class com.getcapacitor.BridgeActivity {
    public com.getcapacitor.Bridge getBridge();
}
-keepclassmembers class com.getcapacitor.Bridge {
    public android.webkit.WebView getWebView();
}
