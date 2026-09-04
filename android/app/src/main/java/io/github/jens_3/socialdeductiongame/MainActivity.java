package io.github.jens_3.socialdeductiongame;

import android.content.res.Configuration;
import android.os.Bundle;
import androidx.core.splashscreen.SplashScreen;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final String SYSTEM_THEME_CHANGE_SCRIPT_LIGHT =
        "window.dispatchEvent(new CustomEvent('socialDeductionGameSystemThemeChange',{detail:'light'}));";
    private static final String SYSTEM_THEME_CHANGE_SCRIPT_DARK =
        "window.dispatchEvent(new CustomEvent('socialDeductionGameSystemThemeChange',{detail:'dark'}));";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(NativeDataFilePlugin.class);
        SplashScreen.installSplashScreen(this);
        super.onCreate(savedInstanceState);
    }

    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);

        if (getBridge() == null || getBridge().getWebView() == null) {
            return;
        }

        int nightMode = newConfig.uiMode & Configuration.UI_MODE_NIGHT_MASK;
        String script = nightMode == Configuration.UI_MODE_NIGHT_YES
            ? SYSTEM_THEME_CHANGE_SCRIPT_DARK
            : SYSTEM_THEME_CHANGE_SCRIPT_LIGHT;
        getBridge().getWebView().post(
            () -> getBridge().getWebView().evaluateJavascript(script, null)
        );
    }
}
