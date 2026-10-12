package com.nooryoosuf.mino;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(SmsConsentPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
