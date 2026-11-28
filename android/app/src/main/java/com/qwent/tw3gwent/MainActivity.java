package com.qwent.tw3gwent;

import android.app.UiModeManager;
import android.content.Context;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.InputDevice;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final float STICK_DEAD_ZONE = 0.45f;
    private static final long MOTION_REPEAT_INTERVAL_MS = 180L;

    private final Handler motionHandler = new Handler(Looper.getMainLooper());
    private String activeMotionDirectionKey = null;
    private boolean nativeBridgeInstalled = false;

    private final Runnable motionRepeatRunnable = new Runnable() {
        @Override
        public void run() {
            if (activeMotionDirectionKey == null) {
                return;
            }
            WebView webView = getBridgeWebView();
            if (webView != null) {
                dispatchJsKey(webView, "keydown", activeMotionDirectionKey, true);
                motionHandler.postDelayed(this, MOTION_REPEAT_INTERVAL_MS);
            } else {
                stopMotionRepeat();
            }
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        WebView webView = getBridgeWebView();
        if (webView != null) {
            installNativeBridge(webView);
            webView.setFocusable(true);
            webView.setFocusableInTouchMode(true);
            webView.requestFocus();
        }
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                WebView webView = getBridgeWebView();
                if (webView == null) {
                    setEnabled(false);
                    getOnBackPressedDispatcher().onBackPressed();
                    return;
                }
                webView.evaluateJavascript(
                    "window.dispatchEvent(new CustomEvent('qwent-native-back'));",
                    null
                );
            }
        });
        applyImmersiveMode();
    }

    @Override
    protected void load() {
        WebView preloadedWebView = findViewById(com.getcapacitor.android.R.id.webview);
        if (preloadedWebView != null) {
            installNativeBridge(preloadedWebView);
            preloadedWebView.setFocusable(true);
            preloadedWebView.setFocusableInTouchMode(true);
        }

        super.load();

        WebView webView = getBridgeWebView();
        if (webView != null) {
            installNativeBridge(webView);
            webView.setFocusable(true);
            webView.setFocusableInTouchMode(true);
            webView.requestFocus();
        }
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        int action = event.getAction();
        if (action != KeyEvent.ACTION_DOWN && action != KeyEvent.ACTION_UP) {
            return super.dispatchKeyEvent(event);
        }

        String key = javascriptKeyFor(event.getKeyCode());
        if (key == null) {
            return super.dispatchKeyEvent(event);
        }

        WebView webView = getBridgeWebView();
        if (webView == null) {
            return super.dispatchKeyEvent(event);
        }

        String type = action == KeyEvent.ACTION_UP ? "keyup" : "keydown";
        dispatchJsKey(webView, type, key, action == KeyEvent.ACTION_DOWN && event.getRepeatCount() > 0);
        return true;
    }

    @Override
    public boolean dispatchGenericMotionEvent(MotionEvent event) {
        boolean isControllerSource =
            event.isFromSource(InputDevice.SOURCE_JOYSTICK)
                || event.isFromSource(InputDevice.SOURCE_GAMEPAD)
                || event.isFromSource(InputDevice.SOURCE_DPAD);
        if (isControllerSource && event.getAction() == MotionEvent.ACTION_MOVE) {
            updateMotionDirection(resolveMotionDirectionKey(event));
            return true;
        }
        return super.dispatchGenericMotionEvent(event);
    }

    @Override
    public void onPause() {
        stopMotionRepeat();
        super.onPause();
    }

    @Override
    public void onDestroy() {
        motionHandler.removeCallbacks(motionRepeatRunnable);
        activeMotionDirectionKey = null;
        super.onDestroy();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            applyImmersiveMode();
            WebView webView = getBridgeWebView();
            if (webView != null) {
                webView.requestFocus();
            }
        } else {
            stopMotionRepeat();
        }
    }

    private void applyImmersiveMode() {
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            WindowManager.LayoutParams params = getWindow().getAttributes();
            params.layoutInDisplayCutoutMode =
                WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            getWindow().setAttributes(params);
        }

        WindowInsetsControllerCompat controller =
            WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        if (controller != null) {
            controller.hide(WindowInsetsCompat.Type.systemBars());
            controller.setSystemBarsBehavior(
                WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            );
        }
    }

    private WebView getBridgeWebView() {
        return getBridge() != null ? getBridge().getWebView() : null;
    }

    private void dispatchJsKey(WebView webView, String type, String key, boolean isRepeat) {
        String script =
            "document.dispatchEvent(new KeyboardEvent('" + type + "', {"
                + "key: '" + key + "', bubbles: true, cancelable: true, repeat: "
                + (isRepeat ? "true" : "false")
                + "}));";
        webView.post(() -> webView.evaluateJavascript(script, null));
    }

    private void updateMotionDirection(String nextDirectionKey) {
        if (nextDirectionKey == null) {
            stopMotionRepeat();
            return;
        }
        if (nextDirectionKey.equals(activeMotionDirectionKey)) {
            return;
        }
        stopMotionRepeat();
        activeMotionDirectionKey = nextDirectionKey;
        WebView webView = getBridgeWebView();
        if (webView != null) {
            dispatchJsKey(webView, "keydown", nextDirectionKey, false);
            motionHandler.postDelayed(motionRepeatRunnable, MOTION_REPEAT_INTERVAL_MS);
        }
    }

    private void stopMotionRepeat() {
        motionHandler.removeCallbacks(motionRepeatRunnable);
        if (activeMotionDirectionKey != null) {
            WebView webView = getBridgeWebView();
            if (webView != null) {
                dispatchJsKey(webView, "keyup", activeMotionDirectionKey, false);
            }
            activeMotionDirectionKey = null;
        }
    }

    private String resolveMotionDirectionKey(MotionEvent event) {
        float hatX = event.getAxisValue(MotionEvent.AXIS_HAT_X);
        float hatY = event.getAxisValue(MotionEvent.AXIS_HAT_Y);
        boolean hatHoriz = Math.abs(hatX) >= STICK_DEAD_ZONE;
        boolean hatVert = Math.abs(hatY) >= STICK_DEAD_ZONE;
        if (hatHoriz || hatVert) {
            if (Math.abs(hatX) >= Math.abs(hatY)) {
                return hatX < 0f ? "ArrowLeft" : "ArrowRight";
            }
            return hatY < 0f ? "ArrowUp" : "ArrowDown";
        }

        float stickX = getCenteredAxis(event, MotionEvent.AXIS_X);
        float stickY = getCenteredAxis(event, MotionEvent.AXIS_Y);
        if (stickX == 0f && stickY == 0f) {
            return null;
        }
        if (Math.abs(stickX) >= Math.abs(stickY)) {
            return stickX < 0f ? "ArrowLeft" : "ArrowRight";
        }
        return stickY < 0f ? "ArrowUp" : "ArrowDown";
    }

    private float getCenteredAxis(MotionEvent event, int axis) {
        float value = event.getAxisValue(axis);
        InputDevice device = event.getDevice();
        if (device != null) {
            InputDevice.MotionRange range = device.getMotionRange(axis, event.getSource());
            if (range != null && Math.abs(value) <= range.getFlat()) {
                return 0f;
            }
        }
        return Math.abs(value) >= STICK_DEAD_ZONE ? value : 0f;
    }

    private String javascriptKeyFor(int keyCode) {
        switch (keyCode) {
            case KeyEvent.KEYCODE_DPAD_UP:
                return "ArrowUp";
            case KeyEvent.KEYCODE_DPAD_DOWN:
                return "ArrowDown";
            case KeyEvent.KEYCODE_DPAD_LEFT:
                return "ArrowLeft";
            case KeyEvent.KEYCODE_DPAD_RIGHT:
                return "ArrowRight";
            case KeyEvent.KEYCODE_DPAD_CENTER:
                return "Select";
            case KeyEvent.KEYCODE_ENTER:
            case KeyEvent.KEYCODE_NUMPAD_ENTER:
            case KeyEvent.KEYCODE_BUTTON_A:
            case KeyEvent.KEYCODE_BUTTON_1:
                return "Enter";
            case KeyEvent.KEYCODE_BUTTON_B:
            case KeyEvent.KEYCODE_BUTTON_2:
            case KeyEvent.KEYCODE_ESCAPE:
                return "Escape";
            case KeyEvent.KEYCODE_BUTTON_X:
            case KeyEvent.KEYCODE_BUTTON_3:
                return "x";
            case KeyEvent.KEYCODE_BUTTON_Y:
            case KeyEvent.KEYCODE_BUTTON_4:
                return "y";
            case KeyEvent.KEYCODE_BUTTON_L1:
                return "q";
            case KeyEvent.KEYCODE_BUTTON_R1:
                return "e";
            case KeyEvent.KEYCODE_BUTTON_START:
            case KeyEvent.KEYCODE_MENU:
                return "m";
            default:
                return null;
        }
    }

    private void installNativeBridge(WebView webView) {
        if (nativeBridgeInstalled) {
            return;
        }
        webView.addJavascriptInterface(new QwentNativeInterface(), "QwentNative");
        nativeBridgeInstalled = true;
    }

    public final class QwentNativeInterface {
        @JavascriptInterface
        public void exitApp() {
            runOnUiThread(MainActivity.this::finish);
        }

        @JavascriptInterface
        public boolean isTelevision() {
            UiModeManager uiModeManager =
                (UiModeManager) getSystemService(Context.UI_MODE_SERVICE);
            boolean isTvMode =
                uiModeManager != null
                    && uiModeManager.getCurrentModeType() == Configuration.UI_MODE_TYPE_TELEVISION;
            boolean hasTouchscreen =
                getPackageManager().hasSystemFeature(PackageManager.FEATURE_TOUCHSCREEN);
            return isTvMode || !hasTouchscreen;
        }
    }
}
