package com.tncbot.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.graphics.PixelFormat;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;
import androidx.core.app.NotificationCompat;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.List;
import org.json.JSONArray;
import org.json.JSONObject;

public class OverlayService extends Service {
    private static final int NOTIFICATION_ID = 1001;
    private static final String CHANNEL_ID = "OverlayServiceChannel";
    
    private WindowManager windowManager;
    private FrameLayout rootView;
    private WindowManager.LayoutParams params;
    private boolean isBubbleAdded = false;

    // Active Agreement Analysis JSON
    private JSONObject activeDoc = null;
    
    // Conversation State for Grounded Chat
    private final List<JSONObject> chatMessages = new ArrayList<>();
    private boolean isLoadingChat = false;
    private LinearLayout chatLogLayout;
    private ScrollView chatScrollView;

    private int dpToPx(int dp) {
        return (int) (dp * getResources().getDisplayMetrics().density);
    }

    private void showToast(final String text) {
        new Handler(Looper.getMainLooper()).post(new Runnable() {
            @Override
            public void run() {
                Toast.makeText(getApplicationContext(), text, Toast.LENGTH_SHORT).show();
            }
        });
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
        rootView = new FrameLayout(this);
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
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentIntent(pendingIntent)
            .build();

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
            } else {
                startForeground(NOTIFICATION_ID, notification);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }

        if (!isBubbleAdded) {
            try {
                params = new WindowManager.LayoutParams(
                    dpToPx(60),
                    dpToPx(60),
                    Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                        ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                        : WindowManager.LayoutParams.TYPE_PHONE,
                    WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
                    PixelFormat.TRANSLUCENT
                );

                params.gravity = Gravity.TOP | Gravity.START;
                params.x = 200;
                params.y = 200;

                windowManager.addView(rootView, params);
                isBubbleAdded = true;
                showBubble();
            } catch (Exception e) {
                e.printStackTrace();
            }
        }

        return START_STICKY;
    }

    private void setFocusable(boolean focusable) {
        if (focusable) {
            params.flags &= ~WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE;
        } else {
            params.flags |= WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE;
        }
        if (isBubbleAdded && rootView != null) {
            windowManager.updateViewLayout(rootView, params);
        }
    }

    // --- State Swapping Methods ---

    private void showBubble() {
        new Handler(Looper.getMainLooper()).post(new Runnable() {
            @Override
            public void run() {
                rootView.removeAllViews();
                rootView.addView(createBubbleView());
                
                params.width = dpToPx(60);
                params.height = dpToPx(60);
                setFocusable(false);
            }
        });
    }

    private void showMenu() {
        rootView.removeAllViews();
        rootView.addView(createMenuView());
        
        params.width = dpToPx(130);
        params.height = dpToPx(100);
        setFocusable(true);
    }

    private void showLoading() {
        rootView.removeAllViews();
        rootView.addView(createLoadingView());
        
        params.width = dpToPx(280);
        params.height = dpToPx(140);
        setFocusable(true);
    }

    private void showCard(final String activeTab) {
        new Handler(Looper.getMainLooper()).post(new Runnable() {
            @Override
            public void run() {
                rootView.removeAllViews();
                rootView.addView(createCardView(activeTab));
                
                params.width = dpToPx(300);
                params.height = dpToPx(380);
                setFocusable(true);
            }
        });
    }

    // --- View Factory Helpers ---

    private View createBubbleView() {
        ImageView bubble = new ImageView(this);
        
        GradientDrawable shape = new GradientDrawable();
        shape.setShape(GradientDrawable.OVAL);
        shape.setColor(0xFF4F46E5); // Indigo-600
        shape.setStroke(dpToPx(3), 0xFFFFFFFF); // White border
        bubble.setBackground(shape);
        
        bubble.setImageResource(R.mipmap.ic_launcher);
        bubble.setPadding(dpToPx(14), dpToPx(14), dpToPx(14), dpToPx(14));
        
        bubble.setOnTouchListener(new View.OnTouchListener() {
            private int lastAction;
            private int initialX;
            private int initialY;
            private float initialTouchX;
            private float initialTouchY;
            private boolean isDragging = false;

            @Override
            public boolean onTouch(View v, MotionEvent event) {
                switch (event.getAction()) {
                    case MotionEvent.ACTION_DOWN:
                        initialX = params.x;
                        initialY = params.y;
                        initialTouchX = event.getRawX();
                        initialTouchY = event.getRawY();
                        lastAction = event.getAction();
                        isDragging = false;
                        return true;

                    case MotionEvent.ACTION_MOVE:
                        int deltaX = (int) (event.getRawX() - initialTouchX);
                        int deltaY = (int) (event.getRawY() - initialTouchY);
                        if (Math.abs(deltaX) > 8 || Math.abs(deltaY) > 8) {
                            isDragging = true;
                        }
                        params.x = initialX + deltaX;
                        params.y = initialY + deltaY;
                        windowManager.updateViewLayout(rootView, params);
                        lastAction = event.getAction();
                        return true;

                    case MotionEvent.ACTION_UP:
                        if (!isDragging) {
                            showMenu();
                        } else {
                            // Snap to nearest screen edge (left or right)
                            int halfWidth = getResources().getDisplayMetrics().widthPixels / 2;
                            if (params.x + dpToPx(30) > halfWidth) {
                                params.x = getResources().getDisplayMetrics().widthPixels - dpToPx(65);
                            } else {
                                params.x = dpToPx(5);
                            }
                            windowManager.updateViewLayout(rootView, params);
                        }
                        return true;
                }
                return false;
            }
        });
        
        return bubble;
    }

    private View createMenuView() {
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setBackground(createCardBackground());
        layout.setPadding(dpToPx(6), dpToPx(6), dpToPx(6), dpToPx(6));
        
        // Scan Page Action Button
        Button scanBtn = new Button(this);
        scanBtn.setText("🔍 Scan Page");
        scanBtn.setTextColor(0xFFFFFFFF);
        scanBtn.setTextSize(11);
        scanBtn.setBackground(createButtonBackground(0xFF4F46E5, 6)); // Indigo
        scanBtn.setPadding(dpToPx(8), dpToPx(4), dpToPx(8), dpToPx(4));
        LinearLayout.LayoutParams scanParams = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT
        );
        scanParams.setMargins(0, 0, 0, dpToPx(4));
        scanBtn.setLayoutParams(scanParams);
        scanBtn.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                startScan();
            }
        });
        
        // Exit Bot Action Button
        Button exitBtn = new Button(this);
        exitBtn.setText("🚪 Exit Bot");
        exitBtn.setTextColor(0xFFFFFFFF);
        exitBtn.setTextSize(11);
        exitBtn.setBackground(createButtonBackground(0xFFF43F5E, 6)); // Rose Red
        exitBtn.setPadding(dpToPx(8), dpToPx(4), dpToPx(8), dpToPx(4));
        LinearLayout.LayoutParams exitParams = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT
        );
        exitBtn.setLayoutParams(exitParams);
        exitBtn.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                stopSelf();
            }
        });
        
        layout.addView(scanBtn);
        layout.addView(exitBtn);
        return layout;
    }

    private View createLoadingView() {
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setGravity(Gravity.CENTER);
        layout.setBackground(createCardBackground());
        layout.setPadding(dpToPx(12), dpToPx(12), dpToPx(12), dpToPx(12));
        
        ProgressBar spinner = new ProgressBar(this);
        LinearLayout.LayoutParams spinnerParams = new LinearLayout.LayoutParams(
            dpToPx(36), dpToPx(36)
        );
        spinnerParams.setMargins(0, 0, 0, dpToPx(10));
        spinner.setLayoutParams(spinnerParams);
        
        TextView loadingText = new TextView(this);
        loadingText.setText("Analyzing Page Context...");
        loadingText.setTextColor(0xFFCBD5E1);
        loadingText.setTextSize(12);
        loadingText.setGravity(Gravity.CENTER);
        
        layout.addView(spinner);
        layout.addView(loadingText);
        return layout;
    }

    private View createCardView(final String activeTab) {
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setBackground(createCardBackground());
        layout.setPadding(dpToPx(10), dpToPx(10), dpToPx(10), dpToPx(10));
        
        // Header
        LinearLayout header = new LinearLayout(this);
        header.setOrientation(LinearLayout.HORIZONTAL);
        header.setGravity(Gravity.CENTER_VERTICAL);
        LinearLayout.LayoutParams headerParams = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT
        );
        headerParams.setMargins(0, 0, 0, dpToPx(8));
        header.setLayoutParams(headerParams);
        
        LinearLayout headerInfo = new LinearLayout(this);
        headerInfo.setOrientation(LinearLayout.VERTICAL);
        LinearLayout.LayoutParams infoParams = new LinearLayout.LayoutParams(
            0, LinearLayout.LayoutParams.WRAP_CONTENT, 1.0f
        );
        headerInfo.setLayoutParams(infoParams);
        
        TextView subtitle = new TextView(this);
        subtitle.setText("TnC Quick Scan");
        subtitle.setTextColor(0xFF94A3B8); // Slate 400
        subtitle.setTextSize(8);
        subtitle.setAllCaps(true);
        
        TextView title = new TextView(this);
        try {
            title.setText(activeDoc != null ? activeDoc.getString("name") : "Summary Results");
        } catch (Exception e) {
            title.setText("Summary Results");
        }
        title.setTextColor(0xFFFFFFFF);
        title.setTextSize(12);
        title.setSingleLine(true);
        title.setEllipsize(android.text.TextUtils.TruncateAt.END);
        
        headerInfo.addView(subtitle);
        headerInfo.addView(title);
        
        // Launch workspace button
        Button openBtn = new Button(this);
        openBtn.setText("↗");
        openBtn.setTextSize(14);
        openBtn.setTextColor(0xFFFFFFFF);
        openBtn.setPadding(0, 0, 0, 0);
        openBtn.setBackgroundColor(0); // Transparent
        LinearLayout.LayoutParams btnParams1 = new LinearLayout.LayoutParams(
            dpToPx(28), dpToPx(28)
        );
        openBtn.setLayoutParams(btnParams1);
        openBtn.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                Intent launchIntent = new Intent(OverlayService.this, MainActivity.class);
                launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
                startActivity(launchIntent);
            }
        });
        
        // Shrink button
        Button closeBtn = new Button(this);
        closeBtn.setText("✕");
        closeBtn.setTextSize(12);
        closeBtn.setTextColor(0xFF94A3B8);
        closeBtn.setPadding(0, 0, 0, 0);
        closeBtn.setBackgroundColor(0); // Transparent
        LinearLayout.LayoutParams btnParams2 = new LinearLayout.LayoutParams(
            dpToPx(28), dpToPx(28)
        );
        btnParams2.setMargins(dpToPx(2), 0, 0, 0);
        closeBtn.setLayoutParams(btnParams2);
        closeBtn.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                showBubble();
            }
        });
        
        header.addView(headerInfo);
        header.addView(openBtn);
        header.addView(closeBtn);
        layout.addView(header);
        
        // Tabs
        LinearLayout tabsRow = new LinearLayout(this);
        tabsRow.setOrientation(LinearLayout.HORIZONTAL);
        tabsRow.setBackground(createButtonBackground(0xFF020617, 6)); // Slate 950
        tabsRow.setPadding(dpToPx(2), dpToPx(2), dpToPx(2), dpToPx(2));
        LinearLayout.LayoutParams rowParams = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT
        );
        rowParams.setMargins(0, 0, 0, dpToPx(8));
        tabsRow.setLayoutParams(rowParams);
        
        Button tabSum = createTabButton("Summary", activeTab.equals("summary"));
        tabSum.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                showCard("summary");
            }
        });
        
        Button tabAi = createTabButton("AI & Rights", activeTab.equals("ai"));
        tabAi.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                showCard("ai");
            }
        });
        
        Button tabChat = createTabButton("Ask Bot", activeTab.equals("chat"));
        tabChat.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                showCard("chat");
            }
        });
        
        tabsRow.addView(tabSum);
        tabsRow.addView(tabAi);
        tabsRow.addView(tabChat);
        layout.addView(tabsRow);
        
        // Scroll Content Area
        FrameLayout body = new FrameLayout(this);
        LinearLayout.LayoutParams bodyParams = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, 0, 1.0f
        );
        body.setLayoutParams(bodyParams);
        
        if (activeTab.equals("summary")) {
            body.addView(createSummaryTabContent());
        } else if (activeTab.equals("ai")) {
            body.addView(createAiTabContent());
        } else {
            body.addView(createChatTabContent());
        }
        
        layout.addView(body);
        return layout;
    }

    private Button createTabButton(String label, boolean isActive) {
        Button btn = new Button(this);
        btn.setText(label);
        btn.setTextSize(9);
        btn.setAllCaps(false);
        btn.setTextColor(isActive ? 0xFFFFFFFF : 0xFF94A3B8);
        btn.setPadding(0, dpToPx(4), 0, dpToPx(4));
        btn.setBackground(isActive ? createButtonBackground(0xFF1E293B, 4) : null); // Slate 800
        
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
            0, LinearLayout.LayoutParams.WRAP_CONTENT, 1.0f
        );
        btn.setLayoutParams(lp);
        return btn;
    }

    private View createSummaryTabContent() {
        ScrollView scroll = new ScrollView(this);
        LinearLayout content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        
        try {
            JSONObject summaryObj = activeDoc.getJSONObject("summary");
            
            // Executive Summary
            LinearLayout sumCard = new LinearLayout(this);
            sumCard.setOrientation(LinearLayout.VERTICAL);
            sumCard.setBackground(createButtonBackground(0x1F1E293B, 6));
            sumCard.setPadding(dpToPx(8), dpToPx(8), dpToPx(8), dpToPx(8));
            LinearLayout.LayoutParams cardLp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT
            );
            cardLp.setMargins(0, 0, 0, dpToPx(10));
            sumCard.setLayoutParams(cardLp);
            
            TextView cardTitle = new TextView(this);
            cardTitle.setText("Executive Summary");
            cardTitle.setTextColor(0xFF6366F1); // Indigo
            cardTitle.setTextSize(9);
            cardTitle.setAllCaps(true);
            cardTitle.setTypeface(null, android.graphics.Typeface.BOLD);
            cardTitle.setPadding(0, 0, 0, dpToPx(4));
            
            TextView cardText = new TextView(this);
            cardText.setText(summaryObj.getString("summary"));
            cardText.setTextColor(0xFFCBD5E1);
            cardText.setTextSize(10);
            cardText.setLineSpacing(0, 1.25f);
            
            sumCard.addView(cardTitle);
            sumCard.addView(cardText);
            content.addView(sumCard);
            
            // Clauses List Header
            TextView clausesHeader = new TextView(this);
            clausesHeader.setText("Key Clauses Scanned");
            clausesHeader.setTextColor(0xFF94A3B8);
            clausesHeader.setTextSize(9);
            clausesHeader.setAllCaps(true);
            clausesHeader.setTypeface(null, android.graphics.Typeface.BOLD);
            clausesHeader.setPadding(0, 0, 0, dpToPx(4));
            content.addView(clausesHeader);
            
            // Clauses Row Rendering
            JSONArray clauses = summaryObj.getJSONArray("key_clauses");
            for (int i = 0; i < clauses.length(); i++) {
                JSONObject clause = clauses.getJSONObject(i);
                String title = clause.getString("clause_title");
                String status = clause.getString("status");
                String explanation = clause.getString("plain_english");
                
                LinearLayout item = new LinearLayout(this);
                item.setOrientation(LinearLayout.VERTICAL);
                int strokeColor = status.equalsIgnoreCase("clear") ? 0x4410B981 : 0x44F59E0B;
                item.setBackground(createClauseBackground(strokeColor));
                item.setPadding(dpToPx(8), dpToPx(6), dpToPx(8), dpToPx(6));
                
                LinearLayout.LayoutParams itemLp = new LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT
                );
                itemLp.setMargins(0, 0, 0, dpToPx(6));
                item.setLayoutParams(itemLp);
                
                LinearLayout itemHeader = new LinearLayout(this);
                itemHeader.setOrientation(LinearLayout.HORIZONTAL);
                itemHeader.setGravity(Gravity.CENTER_VERTICAL);
                
                TextView clauseTitle = new TextView(this);
                clauseTitle.setText(title);
                clauseTitle.setTextColor(0xFFE2E8F0);
                clauseTitle.setTextSize(9);
                clauseTitle.setTypeface(null, android.graphics.Typeface.BOLD);
                LinearLayout.LayoutParams titleLp = new LinearLayout.LayoutParams(
                    0, LinearLayout.LayoutParams.WRAP_CONTENT, 1.0f
                );
                clauseTitle.setLayoutParams(titleLp);
                
                TextView badge = new TextView(this);
                badge.setText(status.toUpperCase());
                badge.setTextSize(6);
                badge.setPadding(dpToPx(3), dpToPx(1), dpToPx(3), dpToPx(1));
                badge.setTextColor(status.equalsIgnoreCase("clear") ? 0xFF34D399 : 0xFFFBBF24);
                badge.setBackground(createButtonBackground(status.equalsIgnoreCase("clear") ? 0x33064E3B : 0x3378350F, 4));
                
                itemHeader.addView(clauseTitle);
                itemHeader.addView(badge);
                
                TextView clauseText = new TextView(this);
                clauseText.setText(explanation);
                clauseText.setTextColor(0xFF94A3B8);
                clauseText.setTextSize(9);
                clauseText.setPadding(0, dpToPx(3), 0, 0);
                clauseText.setLineSpacing(0, 1.2f);
                
                item.addView(itemHeader);
                item.addView(clauseText);
                content.addView(item);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
        
        scroll.addView(content);
        return scroll;
    }

    private View createAiTabContent() {
        ScrollView scroll = new ScrollView(this);
        LinearLayout content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        
        try {
            JSONObject summaryObj = activeDoc.getJSONObject("summary");
            
            content.addView(createDetailCard("AI Model Training", summaryObj.getString("ai_training"), 0xFF818CF8));
            content.addView(createDetailCard("Content Ownership", summaryObj.getString("ownership"), 0xFF34D399));
            content.addView(createDetailCard("Cancellation & Termination", summaryObj.getString("termination"), 0xFFFBBF24));
            content.addView(createDetailCard("Data Retention", summaryObj.getString("retention"), 0xFFF87171));
            
        } catch (Exception e) {
            e.printStackTrace();
        }
        
        scroll.addView(content);
        return scroll;
    }

    private View createDetailCard(String title, String body, int titleColor) {
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setBackground(createButtonBackground(0x1F1E293B, 6));
        card.setPadding(dpToPx(8), dpToPx(8), dpToPx(8), dpToPx(8));
        
        LinearLayout.LayoutParams cardLp = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT
        );
        cardLp.setMargins(0, 0, 0, dpToPx(6));
        card.setLayoutParams(cardLp);
        
        TextView cardTitle = new TextView(this);
        cardTitle.setText(title);
        cardTitle.setTextColor(titleColor);
        cardTitle.setTextSize(8);
        cardTitle.setAllCaps(true);
        cardTitle.setTypeface(null, android.graphics.Typeface.BOLD);
        cardTitle.setPadding(0, 0, 0, dpToPx(3));
        
        TextView cardText = new TextView(this);
        cardText.setText(body);
        cardText.setTextColor(0xFFCBD5E1);
        cardText.setTextSize(9);
        cardText.setLineSpacing(0, 1.25f);
        
        card.addView(cardTitle);
        card.addView(cardText);
        return card;
    }

    private View createChatTabContent() {
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        
        // Chat Logs Scrollable List
        chatScrollView = new ScrollView(this);
        LinearLayout.LayoutParams scrollLp = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, 0, 1.0f
        );
        scrollLp.setMargins(0, 0, 0, dpToPx(6));
        chatScrollView.setLayoutParams(scrollLp);
        
        chatLogLayout = new LinearLayout(this);
        chatLogLayout.setOrientation(LinearLayout.VERTICAL);
        chatLogLayout.setPadding(0, 0, 0, dpToPx(4));
        chatScrollView.addView(chatLogLayout);
        layout.addView(chatScrollView);
        
        renderChatLogs();
        
        // Chat Send Action Box
        LinearLayout inputForm = new LinearLayout(this);
        inputForm.setOrientation(LinearLayout.HORIZONTAL);
        inputForm.setGravity(Gravity.CENTER_VERTICAL);
        
        final EditText input = new EditText(this);
        input.setHint("Ask assistant...");
        input.setHintTextColor(0xFF64748B);
        input.setTextColor(0xFFF8FAFC);
        input.setTextSize(10);
        input.setBackground(createButtonBackground(0xFF020617, 6)); // Slate 950
        input.setPadding(dpToPx(8), dpToPx(6), dpToPx(8), dpToPx(6));
        LinearLayout.LayoutParams inputLp = new LinearLayout.LayoutParams(
            0, LinearLayout.LayoutParams.WRAP_CONTENT, 1.0f
        );
        inputLp.setMargins(0, 0, dpToPx(4), 0);
        input.setLayoutParams(inputLp);
        
        final Button sendBtn = new Button(this);
        sendBtn.setText("Send");
        sendBtn.setTextSize(9);
        sendBtn.setTextColor(0xFFFFFFFF);
        sendBtn.setBackground(createButtonBackground(0xFF4F46E5, 6));
        sendBtn.setPadding(dpToPx(8), dpToPx(6), dpToPx(8), dpToPx(6));
        LinearLayout.LayoutParams sendLp = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT
        );
        sendBtn.setLayoutParams(sendLp);
        
        sendBtn.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                String query = input.getText().toString().trim();
                if (query.isEmpty() || isLoadingChat) return;
                
                try {
                    JSONObject userMsg = new JSONObject();
                    userMsg.put("role", "user");
                    userMsg.put("content", query);
                    chatMessages.add(userMsg);
                    
                    JSONObject botLoadingMsg = new JSONObject();
                    botLoadingMsg.put("role", "assistant");
                    botLoadingMsg.put("content", "Thinking...");
                    chatMessages.add(botLoadingMsg);
                    
                    input.setText("");
                    renderChatLogs();
                    
                    isLoadingChat = true;
                    performChatRequest(query);
                    
                } catch (Exception e) {
                    e.printStackTrace();
                }
            }
        });
        
        inputForm.addView(input);
        inputForm.addView(sendBtn);
        layout.addView(inputForm);
        
        return layout;
    }

    private void renderChatLogs() {
        if (chatLogLayout == null) return;
        chatLogLayout.removeAllViews();
        isLoadingChat = false;
        
        if (chatMessages.isEmpty()) {
            TextView intro = new TextView(this);
            intro.setText("Grounded Quick Q&A\nAsk anything about AI training parameters, liabilities, or closure terms.");
            intro.setTextColor(0xFF64748B);
            intro.setTextSize(9);
            intro.setGravity(Gravity.CENTER);
            intro.setPadding(dpToPx(8), dpToPx(24), dpToPx(8), dpToPx(8));
            chatLogLayout.addView(intro);
            return;
        }
        
        try {
            for (JSONObject msg : chatMessages) {
                String role = msg.getString("role");
                String content = msg.getString("content");
                
                LinearLayout bubbleContainer = new LinearLayout(this);
                bubbleContainer.setOrientation(LinearLayout.VERTICAL);
                
                TextView sender = new TextView(this);
                sender.setText(role.equals("user") ? "YOU" : "TNC BOT");
                sender.setTextColor(0xFF64748B);
                sender.setTextSize(7);
                sender.setTypeface(null, android.graphics.Typeface.BOLD);
                sender.setPadding(0, 0, 0, dpToPx(1));
                
                TextView bubble = new TextView(this);
                bubble.setText(content);
                bubble.setTextSize(9);
                bubble.setPadding(dpToPx(8), dpToPx(6), dpToPx(8), dpToPx(6));
                
                LinearLayout.LayoutParams bubbleLp = new LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT
                );
                
                if (role.equals("user")) {
                    bubbleContainer.setGravity(Gravity.END);
                    sender.setGravity(Gravity.END);
                    bubble.setTextColor(0xFFFFFFFF);
                    bubble.setBackground(createButtonBackground(0xFF4F46E5, 8)); // Indigo
                    bubbleLp.gravity = Gravity.END;
                } else {
                    bubbleContainer.setGravity(Gravity.START);
                    sender.setGravity(Gravity.START);
                    bubble.setTextColor(0xFFCBD5E1);
                    GradientDrawable bg = new GradientDrawable();
                    bg.setShape(GradientDrawable.RECTANGLE);
                    bg.setColor(0xFF020617);
                    bg.setCornerRadius(dpToPx(8));
                    bg.setStroke(dpToPx(1), 0xFF1E293B);
                    bubble.setBackground(bg);
                    bubbleLp.gravity = Gravity.START;
                }
                
                bubble.setLayoutParams(bubbleLp);
                bubbleContainer.addView(sender);
                bubbleContainer.addView(bubble);
                
                LinearLayout.LayoutParams containerLp = new LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT
                );
                containerLp.setMargins(0, 0, 0, dpToPx(8));
                bubbleContainer.setLayoutParams(containerLp);
                
                chatLogLayout.addView(bubbleContainer);
            }
            
            chatScrollView.post(new Runnable() {
                @Override
                public void run() {
                    if (chatScrollView != null) {
                        chatScrollView.fullScroll(ScrollView.FOCUS_DOWN);
                    }
                }
            });
            
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    // --- Actions Trigger Logic ---

    private void startScan() {
        ClipboardManager clipboard = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
        String textToScan = "";
        if (clipboard != null && clipboard.hasPrimaryClip()) {
            ClipData clip = clipboard.getPrimaryClip();
            if (clip != null && clip.getItemCount() > 0) {
                CharSequence text = clip.getItemAt(0).getText();
                if (text != null) {
                    textToScan = text.toString().trim();
                }
            }
        }
        
        if (textToScan.isEmpty()) {
            Toast.makeText(this, "Clipboard is empty. Copy the contract text you want to scan first!", Toast.LENGTH_LONG).show();
            showBubble();
            return;
        }
        
        showLoading();
        performScanRequest(textToScan);
    }

    // --- Asynchronous Network HTTP Requests ---

    private void performScanRequest(final String clipboardText) {
        new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    URL url = new URL("https://tnc-bot.vercel.app/api/analyze/text");
                    HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                    conn.setRequestMethod("POST");
                    conn.setRequestProperty("Content-Type", "application/json; utf-8");
                    conn.setRequestProperty("Accept", "application/json");
                    conn.setDoOutput(true);

                    JSONObject requestPayload = new JSONObject();
                    requestPayload.put("name", "Scanned Page");
                    requestPayload.put("text", clipboardText);
                    requestPayload.put("category", "Terms of Service");

                    try (OutputStream os = conn.getOutputStream()) {
                        byte[] input = requestPayload.toString().getBytes("utf-8");
                        os.write(input, 0, input.length);
                    }

                    int code = conn.getResponseCode();
                    if (code == HttpURLConnection.HTTP_OK || code == HttpURLConnection.HTTP_CREATED) {
                        try (BufferedReader br = new BufferedReader(new InputStreamReader(conn.getInputStream(), "utf-8"))) {
                            StringBuilder response = new StringBuilder();
                            String responseLine;
                            while ((responseLine = br.readLine()) != null) {
                                response.append(responseLine.trim());
                            }
                            final JSONObject responseJson = new JSONObject(response.toString());
                            new Handler(Looper.getMainLooper()).post(new Runnable() {
                                @Override
                                public void run() {
                                    activeDoc = responseJson;
                                    chatMessages.clear();
                                    showCard("summary");
                                }
                            });
                        }
                    } else {
                        showToast("Scan failed. Server returned error code: " + code);
                        new Handler(Looper.getMainLooper()).post(new Runnable() {
                            @Override
                            public void run() {
                                showBubble();
                            }
                        });
                    }
                } catch (final Exception e) {
                    showToast("Connection error: " + e.getMessage());
                    new Handler(Looper.getMainLooper()).post(new Runnable() {
                        @Override
                        public void run() {
                            showBubble();
                        }
                    });
                }
            }
        }).start();
    }

    private void performChatRequest(final String query) {
        new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    URL url = new URL("https://tnc-bot.vercel.app/api/chat");
                    HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                    conn.setRequestMethod("POST");
                    conn.setRequestProperty("Content-Type", "application/json; utf-8");
                    conn.setRequestProperty("Accept", "application/json");
                    conn.setDoOutput(true);

                    JSONObject requestPayload = new JSONObject();
                    requestPayload.put("document_id", activeDoc.getString("id"));
                    requestPayload.put("query", query);
                    
                    JSONArray historyArray = new JSONArray();
                    for (JSONObject msg : chatMessages) {
                        if (msg.getString("content").equals("Thinking...")) continue;
                        historyArray.put(msg);
                    }
                    requestPayload.put("history", historyArray);

                    try (OutputStream os = conn.getOutputStream()) {
                        byte[] input = requestPayload.toString().getBytes("utf-8");
                        os.write(input, 0, input.length);
                    }

                    int code = conn.getResponseCode();
                    if (code == HttpURLConnection.HTTP_OK) {
                        try (BufferedReader br = new BufferedReader(new InputStreamReader(conn.getInputStream(), "utf-8"))) {
                            StringBuilder response = new StringBuilder();
                            String responseLine;
                            boolean isFirstLine = true;
                            while ((responseLine = br.readLine()) != null) {
                                if (isFirstLine) {
                                    isFirstLine = false;
                                    if (responseLine.trim().startsWith("{")) {
                                        continue;
                                    }
                                }
                                response.append(responseLine).append("\n");
                            }
                            final String finalResponse = response.toString().trim();
                            new Handler(Looper.getMainLooper()).post(new Runnable() {
                                @Override
                                public void run() {
                                    updateBotMessageInChat(finalResponse);
                                }
                            });
                        }
                    } else {
                        new Handler(Looper.getMainLooper()).post(new Runnable() {
                            @Override
                            public void run() {
                                updateBotMessageInChat("Error: Server returned code " + code);
                            }
                        });
                    }
                } catch (final Exception e) {
                    new Handler(Looper.getMainLooper()).post(new Runnable() {
                        @Override
                        public void run() {
                            updateBotMessageInChat("Connection failed: " + e.getMessage());
                        }
                    });
                }
            }
        }).start();
    }

    private void updateBotMessageInChat(String content) {
        try {
            for (int i = chatMessages.size() - 1; i >= 0; i--) {
                JSONObject msg = chatMessages.get(i);
                if (msg.getString("role").equals("assistant")) {
                    msg.put("content", content);
                    break;
                }
            }
            renderChatLogs();
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    // --- Styling Factory Drawables ---

    private GradientDrawable createCardBackground() {
        GradientDrawable gd = new GradientDrawable();
        gd.setShape(GradientDrawable.RECTANGLE);
        gd.setColor(0xFF0F172A); // Slate-900
        gd.setCornerRadius(dpToPx(12));
        gd.setStroke(dpToPx(1), 0xFF1E293B); // Slate-800
        return gd;
    }

    private GradientDrawable createButtonBackground(int color, int radiusDp) {
        GradientDrawable gd = new GradientDrawable();
        gd.setShape(GradientDrawable.RECTANGLE);
        gd.setColor(color);
        gd.setCornerRadius(dpToPx(radiusDp));
        return gd;
    }

    private GradientDrawable createClauseBackground(int strokeColor) {
        GradientDrawable gd = new GradientDrawable();
        gd.setShape(GradientDrawable.RECTANGLE);
        gd.setColor(0x1F020617);
        gd.setCornerRadius(dpToPx(6));
        gd.setStroke(dpToPx(1), strokeColor);
        return gd;
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
        if (isBubbleAdded && rootView != null) {
            try {
                windowManager.removeView(rootView);
                isBubbleAdded = false;
            } catch (Exception e) {
                e.printStackTrace();
            }
        }
    }
}
