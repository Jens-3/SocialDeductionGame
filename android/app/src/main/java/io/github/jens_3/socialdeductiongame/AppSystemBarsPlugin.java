package io.github.jens_3.socialdeductiongame;

import android.content.res.Configuration;
import android.graphics.Color;
import android.os.Build;
import android.view.Window;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "AppSystemBars")
public class AppSystemBarsPlugin extends Plugin {
    private Integer background;
    private boolean light;

    @PluginMethod
    public void setAppearance(PluginCall call) {
        final int parsed;
        try {
            parsed = Color.parseColor(call.getString("background", ""));
        } catch (IllegalArgumentException exception) {
            call.reject("Invalid system bar background", exception);
            return;
        }
        final boolean lightTheme = call.getBoolean("light", false);
        getActivity().runOnUiThread(() -> {
            background = parsed;
            light = lightTheme;
            applyAppearance();
            call.resolve();
        });
    }

    @Override
    protected void handleOnConfigurationChanged(Configuration configuration) {
        super.handleOnConfigurationChanged(configuration);
        // Reapply after Capacitor has updated its system-theme bar appearance.
        getActivity().getWindow().getDecorView().post(this::applyAppearance);
    }

    @Override
    protected void handleOnResume() {
        super.handleOnResume();
        getActivity().getWindow().getDecorView().post(this::applyAppearance);
    }

    @SuppressWarnings("deprecation")
    private void applyAppearance() {
        if (background == null) return;
        Window window = getActivity().getWindow();
        // Capacitor retains ownership of padding and WindowInsets listeners.
        window.getDecorView().setBackgroundColor(background);
        window.setStatusBarColor(background);
        window.setNavigationBarColor(background);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            window.setStatusBarContrastEnforced(false);
            window.setNavigationBarContrastEnforced(false);
        }
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(window, window.getDecorView());
        controller.setAppearanceLightStatusBars(light);
        controller.setAppearanceLightNavigationBars(light);
    }
}
