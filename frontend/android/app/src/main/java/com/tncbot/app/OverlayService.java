package com.tncbot.app;

import android.app.Service;
import android.content.Intent;
import android.graphics.PixelFormat;
import android.os.IBinder;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.ImageView;

public class OverlayService extends Service {
    private WindowManager windowManager;
    private ImageView floatingBubble;

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);

        // Simple floating bubble representing the bot icon
        floatingBubble = new ImageView(this);
        // Use android system drawable for convenience, styled as our bot icon
        floatingBubble.setImageResource(android.R.drawable.ic_dialog_info); 
        floatingBubble.setBackgroundColor(0xFF4F46E5); // Indigo brand color
        floatingBubble.setPadding(24, 24, 24, 24);

        // Setting layout parameters for overlay
        final WindowManager.LayoutParams params = new WindowManager.LayoutParams(
            150, // width in pixels
            150, // height in pixels
            android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O
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
        // Bring app to foreground
        Intent intent = new Intent(this, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
        startActivity(intent);
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (floatingBubble != null) {
            windowManager.removeView(floatingBubble);
        }
    }
}
