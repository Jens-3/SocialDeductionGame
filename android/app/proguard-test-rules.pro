# Test-only annotations reference this JDK compiler API type, which is not used
# by the instrumented smoke test at runtime on Android.
-dontwarn javax.lang.model.element.Modifier

# The AndroidX runner discovers tests and optional helpers reflectively. Keep
# the test harness intact; only the target release APK is meant to be shrunk.
-keepattributes RuntimeVisibleAnnotations,RuntimeInvisibleAnnotations,AnnotationDefault
-keep class androidx.test.** { *; }
-keep interface androidx.test.** { *; }
-keep class androidx.tracing.** { *; }
-keep class org.junit.** { *; }
-keep class org.hamcrest.** { *; }
-keep class io.github.jens_3.socialdeductiongame.ReleaseSmokeTest { *; }
