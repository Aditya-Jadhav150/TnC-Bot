package com.tncbot.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.graphics.PixelFormat;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.IBinder;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.ImageView;
import androidx.core.app.NotificationCompat;

public class OverlayService extends Service {
    private static final int NOTIFICATION_ID = 1001;
    private static final String CHANNEL_ID = "OverlayServiceChannel";
    private WindowManager windowManager;
    private ImageView floatingBubble;

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        createNotificationChannel();
        
        Intent notificationIntent = new Intent(this, MainActivity.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            this, 0, notificationIntent,
            PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
        );

        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("TnC Bot Overlay")
            .setContentText("Show Bot bubble is active over other apps.")
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentIntent(pendingIntent)
            .build();

        // Android 14+ compatibility check: Data Sync type dynamic value is 1 (0x00000001)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) { // SDK 34 (Android 14+)
            startForeground(NOTIFICATION_ID, notification, 1); // ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }

        return START_STICKY;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);

        // Simple floating bubble representing the bot icon
        floatingBubble = new ImageView(this);
        
        // Draw a solid circle drawable programmatically for reliability (independent of system resources)
        GradientDrawable shape = new GradientDrawable();
        shape.setShape(GradientDrawable.OVAL);
        shape.setColor(0xFF4F46E5); // Indigo-600 brand color
        shape.setStroke(6, 0xFFFFFFFF); // White border
        floatingBubble.setImageDrawable(shape);
        floatingBubble.setPadding(12, 12, 12, 12);

        int size = (int) (60 * getResources().getDisplayMetrics().density); // 60dp standard size

        // Setting layout parameters for overlay
        final WindowManager.LayoutParams params = new WindowManager.LayoutParams(
            size,
            size,
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                : WindowManager.LayoutParams.TYPE_PHONE,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
            PixelFormat.TRANSLUCENT
        );

        params.gravity = Gravity.TOP | Gravity.START;
        params.x = 200;
        params.y = 200;

        windowManager.addView(floatingBubble, params);

        // Implement drag and drop & click actions
        floatingBubble.setOnTouchListener(new View.OnTouchListener() {
            private int lastAction;
            private int initialX;
            private int initialY;
            private float initialTouchX;
            private float initialTouchY;

            @Override
            public boolean onTouch(View v, MotionEvent event) {
                switch (event.getAction()) {
                    case MotionEvent.ACTION_DOWN:
                        initialX = params.x;
                        initialY = params.y;
                        initialTouchX = event.getRawX();
                        initialTouchY = event.getRawY();
                        lastAction = event.getAction();
                        return true;

                    case MotionEvent.ACTION_MOVE:
                        params.x = initialX + (int) (event.getRawX() - initialTouchX);
                        params.y = initialY + (int) (event.getRawY() - initialTouchY);
                        windowManager.updateViewLayout(floatingBubble, params);
                        lastAction = event.getAction();
                        return true;

                    case MotionEvent.ACTION_UP:
                        if (lastAction == MotionEvent.ACTION_DOWN) {
                            onBubbleClick();
                        }
                        lastAction = event.getAction();
                        return true;
                }
                return false;
            }
        });
    }

    private void onBubbleClick() {
        Intent intent = new Intent(this, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
        startActivity(intent);
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel serviceChannel = new NotificationChannel(
                CHANNEL_ID,
                "TnC Bot Overlay Channel",
                NotificationManager.IMPORTANCE_DEFAULT
            );
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(serviceChannel);
            }
        }
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (floatingBubble != null) {
            windowManager.removeView(floatingBubble);
        }
    }
}
