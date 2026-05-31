package com.tncbot.app;

import android.content.Intent;
import android.net.Uri;
import android.provider.Settings;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "OverlayPlugin")
public class OverlayPlugin extends Plugin {

    @PluginMethod
    public void toggleOverlay(PluginCall call) {
        Boolean enable = call.getBoolean("enable", false);
        
        // On Android M (6.0) and above, check for overlay permission
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
            if (!Settings.canDrawOverlays(getContext())) {
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
                // Start as a foreground service for compatibility with background rules in Android 8.0+
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                    getContext().startForegroundService(serviceIntent);
                } else {
                    getContext().startService(serviceIntent);
                }
            } else {
                getContext().stopService(serviceIntent);
            }
            JSObject ret = new JSObject();
            ret.put("status", "success");
            call.resolve(ret);
        } catch (Exception e) {
            final String errorMsg = e.getMessage();
            call.reject("Failed to toggle service: " + errorMsg, e);
        }
    }
}
