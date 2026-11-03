package com.codytseng.jumble;

import static org.junit.Assert.*;
import static androidx.test.espresso.intent.Intents.intending;
import static androidx.test.espresso.intent.matcher.IntentMatchers.hasAction;
import android.app.Activity;
import android.app.Instrumentation;
import android.content.Intent;
import android.os.SystemClock;
import androidx.test.core.app.ActivityScenario;
import androidx.test.espresso.intent.Intents;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import okhttp3.*;
import org.junit.Test;
import org.junit.runner.RunWith;

@RunWith(AndroidJUnit4.class)
public class BrowserAuthTest {
    private static final String ID = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    private final OkHttpClient http = new OkHttpClient();

    private String evaluate(ActivityScenario<MainActivity> scenario, String script) throws Exception {
        CountDownLatch done = new CountDownLatch(1); String[] value = new String[1];
        scenario.onActivity(activity -> activity.getBridge().getWebView().evaluateJavascript(script, result -> { value[0] = result; done.countDown(); }));
        assertTrue(done.await(5, TimeUnit.SECONDS)); return value[0];
    }
    private void ready(ActivityScenario<MainActivity> scenario) throws Exception {
        for (int i=0;i<160;i++) {
            if ("true".equals(evaluate(scenario,"!!window.Capacitor?.nativePromise && document.readyState==='complete'"))) return;
            SystemClock.sleep(100);
        }
        fail("WebView not ready");
    }
    private void start(ActivityScenario<MainActivity> scenario) throws Exception {
        evaluate(scenario,"Capacitor.nativePromise('JumbleBrowserAuth','authenticate',{requestId:'"+ID+"',page:'<!doctype html><title>Test authorization relay</title>',csp:\"default-src 'none'\"}).then(r=>window.__authValue=r.value).catch(e=>window.__authError=e.code||e.message)");
    }
    private String awaitValue(ActivityScenario<MainActivity> scenario, String name) throws Exception {
        for(int i=0;i<60;i++) { String value=evaluate(scenario,"window."+name);if(!"null".equals(value))return value;SystemClock.sleep(100); }
        fail("No result for "+name);return null;
    }
    private int post(String url, String origin, String value) throws Exception {
        Request request=new Request.Builder().url(url).header("Origin",origin)
            .post(RequestBody.create("{\"value\":\""+value+"\"}",MediaType.get("application/json"))).build();
        try(Response response=http.newCall(request).execute()) { return response.code(); }
    }

    @Test public void browserRelayRejectsForeignOriginsAndAutomaticallyReturnsToTheSameActivity() throws Exception {
        Intents.init();
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)) {
            ready(scenario);
            evaluate(scenario,"window.__activityMarker='same-webview'");
            start(scenario);
            Intent launched=null;
            for(int i=0;i<60&&launched==null;i++) {
                for(Intent intent:Intents.getIntents()) if(intent.getDataString()!=null&&intent.getDataString().contains("/pomegranate-auth/"+ID)) launched=intent;
                SystemClock.sleep(100);
            }
            assertNotNull("System browser was not launched",launched);
            assertTrue("Must request a Custom Tab",launched.hasExtra("android.support.customtabs.extra.SESSION"));
            assertTrue("Must request a partial-height tab",launched.getIntExtra("androidx.browser.customtabs.extra.INITIAL_ACTIVITY_HEIGHT_PX",0)>0);
            String url=launched.getDataString();String origin=url.substring(0,url.indexOf("/pomegranate-auth/"));
            try(Response response=http.newCall(new Request.Builder().url(url).build()).execute()) {
                assertEquals(200,response.code());assertTrue(response.body().string().contains("Test authorization relay"));
                assertEquals("no-store",response.header("Cache-Control"));
            }
            try(Response response=http.newCall(new Request.Builder().url(url).header("Host","attacker.example").build()).execute()) { assertEquals(421,response.code()); }
            assertEquals(403,post(url+"/complete","https://attacker.example","forged"));
            assertEquals(403,post(url+"/complete","null","forged"));
            assertEquals(400,post(url+"/complete",origin,""));
            assertEquals(200,post(url+"/complete",origin,"test-result"));
            assertEquals("\"test-result\"",awaitValue(scenario,"__authValue"));
            for(int i=0;i<60&&scenario.getState()!=androidx.lifecycle.Lifecycle.State.RESUMED;i++)SystemClock.sleep(100);
            assertEquals(androidx.lifecycle.Lifecycle.State.RESUMED,scenario.getState());
            assertEquals("\"same-webview\"",evaluate(scenario,"window.__activityMarker"));
            Intent returned=null;
            for(Intent intent:Intents.getIntents()) if(intent.getComponent()!=null&&intent.getComponent().getClassName().equals(MainActivity.class.getName())&&(intent.getFlags()&Intent.FLAG_ACTIVITY_CLEAR_TOP)!=0)returned=intent;
            assertNotNull("Must close the Custom Tab and return without a browser link",returned);
            assertNull(returned.getData());
            assertNull(returned.getExtras());
        } finally { Intents.release(); }
    }

    @Test public void closingTheBrowserCancelsAndAllowsAnotherAttempt() throws Exception {
        Intents.init();
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)) {
            ready(scenario);
            intending(hasAction(Intent.ACTION_VIEW)).respondWith(new Instrumentation.ActivityResult(Activity.RESULT_CANCELED,null));
            start(scenario);assertEquals("\"CANCELLED\"",awaitValue(scenario,"__authError"));
            evaluate(scenario,"delete window.__authError");
            start(scenario);assertEquals("\"CANCELLED\"",awaitValue(scenario,"__authError"));
        } finally { Intents.release(); }
    }
}
