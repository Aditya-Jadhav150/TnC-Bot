package com.tncbot.app;

import android.content.Intent;
import android.net.Uri;
import android.provider.Settings;
import android.widget.Toast;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "OverlayPlugin")
public class OverlayPlugin extends Plugin {

    private void showToast(final String text) {
        getActivity().runOnUiThread(new Runnable() {
            @Override
            public void run() {
                Toast.makeText(getContext(), "OverlayPlugin: " + text, Toast.LENGTH_SHORT).show();
            }
        });
    }

    @PluginMethod
    public void toggleOverlay(PluginCall call) {
        Boolean enable = call.getBoolean("enable", false);
        showToast("toggleOverlay called with enable = " + enable);
        
        // On Android M (6.0) and above, check for overlay permission
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
            if (!Settings.canDrawOverlays(getContext())) {
                showToast("Permission denied! Opening overlay settings...");
                
                Intent intent = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                        Uri.parse("package:" + getContext().getPackageName()));
                getActivity().startActivity(intent);
                
                JSObject ret = new JSObject();
                ret.put("status", "permission_required");
                call.resolve(ret);
                return;
            }
        }

        try {
            Intent serviceIntent = new Intent(getContext(), OverlayService.class);
            if (enable) {
                showToast("Starting service...");
                // Start as a foreground service for compatibility with background rules in Android 8.0+
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                    getContext().startForegroundService(serviceIntent);
                    showToast("Called startForegroundService()");
                } else {
                    getContext().startService(serviceIntent);
                    showToast("Called startService()");
                }
            } else {
                showToast("Stopping service...");
                getContext().stopService(serviceIntent);
                showToast("Called stopService()");
            }
            JSObject ret = new JSObject();
            ret.put("status", "success");
            call.resolve(ret);
        } catch (Exception e) {
            final String errorMsg = e.getMessage();
            showToast("Error: " + errorMsg);
            call.reject("Failed to toggle service: " + errorMsg, e);
        }
    }
}
