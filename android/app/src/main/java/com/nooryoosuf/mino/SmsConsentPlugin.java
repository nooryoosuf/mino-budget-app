package com.nooryoosuf.mino;

import android.app.Activity;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Bundle;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.auth.api.phone.SmsRetriever;
import com.google.android.gms.auth.api.phone.SmsRetrieverClient;

/**
 * SmsConsent — full-auto BML (sender 455) import without SMS permissions.
 *
 * Uses Google Play Services' SMS User Consent API: Android shows a one-tap
 * consent dialog for each matching message, so no READ_SMS permission is
 * needed and the Play Store SMS policy is not triggered. The sender filter
 * (default 455) means only BML alerts surface — personal texts never do.
 *
 * JS events: "smsReceived" {message}, "smsTimeout" {}, "smsError" {error}.
 * The 5-minute watch window is re-armed automatically while watching.
 */
@CapacitorPlugin(name = "SmsConsent")
public class SmsConsentPlugin extends Plugin {
    private BroadcastReceiver receiver;
    private boolean watching = false;
    private String sender = "455";
    private String pendingCallId;

    @PluginMethod
    public void startWatch(PluginCall call) {
        String s = call.getString("sender", "455");
        sender = (s == null || s.isEmpty()) ? "455" : s;
        watching = true;
        pendingCallId = call.getCallbackId();
        bridge.saveCall(call);
        armRetriever();
        // NOTE: call stays saved (not resolved) until stopWatch — results
        // arrive as events, so the promise is only bookkeeping.
    }

    @PluginMethod
    public void stopWatch(PluginCall call) {
        watching = false;
        unregister();
        if (pendingCallId != null) {
            bridge.releaseCall(pendingCallId);
            pendingCallId = null;
        }
        call.resolve();
    }

    @PluginMethod
    public void isWatching(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("watching", watching);
        call.resolve(ret);
    }

    private void armRetriever() {
        Activity activity = getActivity();
        if (activity == null || !watching) return;
        SmsRetrieverClient client = SmsRetriever.getClient(activity);
        client.startSmsUserConsent(sender)
            .addOnSuccessListener(aVoid -> register())
            .addOnFailureListener(e -> {
                JSObject ret = new JSObject();
                ret.put("error", e.getMessage());
                notifyListeners("smsError", ret);
            });
    }

    private void rearm() {
        if (watching) armRetriever();
    }

    private void register() {
        unregister();
        Context ctx = getContext();
        if (ctx == null) return;
        receiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                if (!SmsRetriever.SMS_RETRIEVED_ACTION.equals(intent.getAction())) return;
                Bundle extras = intent.getExtras();
                if (extras == null) {
                    rearm();
                    return;
                }
                int status = extras.getInt(SmsRetriever.EXTRA_STATUS, -1);
                if (status == com.google.android.gms.common.api.CommonStatusCodes.SUCCESS) {
                    Intent consent = extras.getParcelable(SmsRetriever.EXTRA_CONSENT_INTENT);
                    PluginCall saved = pendingCallId != null ? bridge.getSavedCall(pendingCallId) : null;
                    if (consent != null && saved != null) {
                        try {
                            startActivityForResult(saved, consent, "onConsentResult");
                        } catch (Exception e) {
                            rearm();
                        }
                    } else {
                        rearm();
                    }
                } else {
                    // timeout (or no match) — 5-minute window elapsed
                    notifyListeners("smsTimeout", new JSObject());
                    rearm();
                }
            }
        };
        ctx.registerReceiver(receiver, new IntentFilter(SmsRetriever.SMS_RETRIEVED_ACTION));
    }

    private void unregister() {
        if (receiver != null) {
            try {
                getContext().unregisterReceiver(receiver);
            } catch (Exception ignored) {
            }
            receiver = null;
        }
    }

    @ActivityCallback
    public void onConsentResult(PluginCall call, ActivityResult result) {
        if (result.getResultCode() == Activity.RESULT_OK && result.getData() != null) {
            String message = result.getData().getStringExtra(SmsRetriever.EXTRA_SMS_MESSAGE);
            if (message != null && !message.isEmpty()) {
                JSObject ret = new JSObject();
                ret.put("message", message);
                notifyListeners("smsReceived", ret);
            }
        } else {
            notifyListeners("smsDenied", new JSObject());
        }
        rearm();
    }
}
