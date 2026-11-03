package com.codytseng.jumble;

import static org.junit.Assert.*;
import android.Manifest;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.os.SystemClock;
import android.webkit.WebView;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.filters.SdkSuppress;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.rule.GrantPermissionRule;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Rule;
import org.junit.Test;
import org.junit.runner.RunWith;

/** Loopback transport injects public protocol fixtures locally; nothing is published to a relay. */
@RunWith(AndroidJUnit4.class)
@SdkSuppress(minSdkVersion=33)
public class SharedBackgroundRuntimeTest {
    @Rule public GrantPermissionRule permission = GrantPermissionRule.grant(Manifest.permission.POST_NOTIFICATIONS);
    private String evaluate(WebView view, String code) throws Exception {
        CountDownLatch latch = new CountDownLatch(1); String[] value = new String[1];
        InstrumentationRegistry.getInstrumentation().runOnMainSync(() -> view.evaluateJavascript(code, result -> { value[0]=result; latch.countDown(); }));
        assertTrue(latch.await(5,TimeUnit.SECONDS)); return value[0];
    }
    private void waitFor(WebView view, String expression) throws Exception {
        for(int i=0;i<150;i++) { if("true".equals(evaluate(view,expression))) return;SystemClock.sleep(100); }
        fail("Background condition timed out: "+expression);
    }
    @Test public void sharedJsKeepsValidatingFilteringAndNotifyingAfterActivityDestruction() throws Exception {
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        JSONObject fixture;
        try(InputStream input=InstrumentationRegistry.getInstrumentation().getContext().getAssets().open("notification-event.json");ByteArrayOutputStream data=new ByteArrayOutputStream()) {
            byte[] bytes=new byte[4096];int count;while((count=input.read(bytes))!=-1)data.write(bytes,0,count);
            fixture=new JSONObject(data.toString("UTF-8"));
        }
        EncryptedStore storage=new EncryptedStore(context);
        String previous=storage.load("notifications"), previousCursor=storage.load("notification-cursor");
        boolean wasEnabled=context.getSharedPreferences("listener",0).getBoolean("enabled",false);
        ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class);
        String eventId=fixture.getJSONObject("event").getString("id");
        try {
            WebView[] ui=new WebView[1];scenario.onActivity(activity->ui[0]=activity.getBridge().getWebView());
            waitFor(ui[0],"!!window.Capacitor?.nativePromise && document.readyState==='complete'");
            // Wait for the anonymous foreground provider's initial stop request to finish.
            waitFor(ui[0],"document.getElementById('root')?.children.length>0");SystemClock.sleep(300);
            JSONObject config=new JSONObject().put("pubkey",fixture.getString("recipient")).put("relays",new JSONArray().put("wss://relay.example"))
                .put("enabledAt",1699999999).put("filters",new JSONArray().put("mentions")).put("descriptions",new JSONObject().put("mentions","Shared JS test"))
                .put("muted",new JSONArray()).put("trusted",new JSONArray()).put("minTrustScore",0).put("hideMutedMentions",false).put("zapIssuer","");
            evaluate(ui[0],"Capacitor.nativePromise('JumbleRelayNotifications','configure',{config:"+config+",userInitiated:true}).then(()=>window.__backgroundStarted=true).catch(e=>window.__backgroundError=e.message)");
            waitFor(ui[0],"window.__backgroundStarted===true");
            RelayNotificationsService service=RelayNotificationsService.instance;
            assertNotNull(service);
            java.lang.reflect.Field runtimeField=RelayNotificationsService.class.getDeclaredField("runtime");runtimeField.setAccessible(true);
            WebView worker=(WebView)runtimeField.get(service);
            String loopback="(()=>{const host=window.JumbleBackgroundHost;window.__notifyCount=0;window.JumbleBackgroundHost={isForeground:()=>host.isForeground(),isOnline:()=>true,postMessage(raw){const m=JSON.parse(raw);if(m.op==='socketOpen'){queueMicrotask(()=>JumbleBackground.socket(m.socketId,{type:'open'}));return}if(m.op==='socketSend'){const r=JSON.parse(m.data);if(r[0]==='REQ'){window.__subscription={socketId:m.socketId,id:r[1]};queueMicrotask(()=>JumbleBackground.socket(m.socketId,{type:'message',data:JSON.stringify(['EOSE',r[1]])}))}return}if(m.op==='socketClose'){queueMicrotask(()=>JumbleBackground.socket(m.socketId,{type:'close',code:1000}));return}if(m.op==='notify')window.__notifyCount++;host.postMessage(raw)}};Date.now=()=>1700000010000;JumbleBackground.configure("+config+",null)})()";
            evaluate(worker,loopback);
            waitFor(worker,"!!window.__subscription");
            scenario.close();SystemClock.sleep(200);
            assertSame(service,RelayNotificationsService.instance);
            assertTrue(service.started);
            JSONObject forged=new JSONObject(fixture.getJSONObject("event").toString()).put("id",new String(new char[64]).replace('\0','0'));
            String deliver="(event)=>JumbleBackground.socket(__subscription.socketId,{type:'message',data:JSON.stringify(['EVENT',__subscription.id,event])})";
            evaluate(worker,"("+deliver+")("+forged+")");
            SystemClock.sleep(150);assertEquals("0",evaluate(worker,"window.__notifyCount"));
            evaluate(worker,"("+deliver+")("+fixture.getJSONObject("event")+");("+deliver+")("+fixture.getJSONObject("event")+")");
            waitFor(worker,"window.__notifyCount===1");
            boolean alerted=false;
            for(int i=0;i<50&&!alerted;i++) {
                for(android.service.notification.StatusBarNotification notification:context.getSystemService(NotificationManager.class).getActiveNotifications())
                    if(("relay:"+eventId).equals(notification.getTag()))alerted=true;
                if(!alerted)SystemClock.sleep(100);
            }
            assertTrue("Native notification was not displayed",alerted);
            assertTrue(new JSONObject(storage.load("notification-cursor")).getJSONArray("ids").toString().contains(eventId));
        } finally {
            scenario.close();context.stopService(new Intent(context,RelayNotificationsService.class));
            for(int i=0;i<50&&RelayNotificationsService.instance!=null;i++)SystemClock.sleep(50);
            context.getSystemService(NotificationManager.class).cancel("relay:"+eventId,eventId.hashCode()&0x7fffffff);
            if(previous!=null)storage.save("notifications",previous);
            else new java.io.File(context.getNoBackupFilesDir(),"jumble/notifications.enc").delete();
            if(previousCursor!=null)storage.save("notification-cursor",previousCursor);
            else new java.io.File(context.getNoBackupFilesDir(),"jumble/notification-cursor.enc").delete();
            context.getSharedPreferences("listener",0).edit().putBoolean("enabled",wasEnabled).apply();
        }
    }
    @Test public void stoppingNotificationsWithPooledTlsConnectionsKeepsTheActivityAlive() throws Exception {
        Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();
        EncryptedStore storage=new EncryptedStore(context);
        String previous=storage.load("notifications"), previousCursor=storage.load("notification-cursor");
        android.content.SharedPreferences preferences=context.getSharedPreferences("listener",0);
        boolean enabled=preferences.getBoolean("enabled",false), paused=preferences.getBoolean("pausedByUser",false);
        ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class);
        android.os.StrictMode.ThreadPolicy[] originalPolicy=new android.os.StrictMode.ThreadPolicy[1];
        okhttp3.mockwebserver.MockWebServer server=new okhttp3.mockwebserver.MockWebServer();
        okhttp3.OkHttpClient client=null;
        try {
            WebView[] ui=new WebView[1];scenario.onActivity(activity->ui[0]=activity.getBridge().getWebView());
            waitFor(ui[0],"!!window.Capacitor?.nativePromise && document.getElementById('root')?.children.length>0");
            SystemClock.sleep(300);
            JSONObject config=new JSONObject().put("pubkey",new String(new char[64]).replace('\0','a'))
                .put("relays",new JSONArray()).put("enabledAt",System.currentTimeMillis()/1000)
                .put("filters",new JSONArray()).put("descriptions",new JSONObject())
                .put("muted",new JSONArray()).put("trusted",new JSONArray()).put("minTrustScore",0)
                .put("hideMutedMentions",false).put("zapIssuer","");
            evaluate(ui[0],"Capacitor.nativePromise('JumbleRelayNotifications','configure',{config:"+config+",userInitiated:true}).then(()=>window.__tlsStarted=true)");
            waitFor(ui[0],"window.__tlsStarted===true");
            RelayNotificationsService service=RelayNotificationsService.instance;
            assertNotNull(service);
            java.lang.reflect.Field field=RelayNotificationsService.class.getDeclaredField("socketsClient");field.setAccessible(true);
            okhttp3.ConnectionPool pool=((okhttp3.OkHttpClient)field.get(service)).connectionPool();
            okhttp3.tls.HeldCertificate certificate=new okhttp3.tls.HeldCertificate.Builder().addSubjectAlternativeName("localhost").build();
            okhttp3.tls.HandshakeCertificates serverTls=new okhttp3.tls.HandshakeCertificates.Builder().heldCertificate(certificate).build();
            okhttp3.tls.HandshakeCertificates clientTls=new okhttp3.tls.HandshakeCertificates.Builder().addTrustedCertificate(certificate.certificate()).build();
            server.useHttps(serverTls.sslSocketFactory(),false);
            server.enqueue(new okhttp3.mockwebserver.MockResponse().setBody("idle TLS connection"));server.start();
            client=new okhttp3.OkHttpClient.Builder().connectionPool(pool).sslSocketFactory(clientTls.sslSocketFactory(),clientTls.trustManager()).build();
            try(okhttp3.Response response=client.newCall(new okhttp3.Request.Builder().url(server.url("/idle")).build()).execute()) {
                assertEquals("idle TLS connection",response.body().string());
            }
            assertTrue("Test must leave a real idle TLS connection in the service pool",pool.idleConnectionCount()>0);
            scenario.onActivity(activity->{
                originalPolicy[0]=android.os.StrictMode.getThreadPolicy();
                android.os.StrictMode.setThreadPolicy(new android.os.StrictMode.ThreadPolicy.Builder(originalPolicy[0]).detectNetwork().penaltyDeathOnNetwork().build());
            });
            evaluate(ui[0],"Capacitor.nativePromise('JumbleRelayNotifications','stop',{}).then(()=>window.__tlsStopped=true)");
            waitFor(ui[0],"window.__tlsStopped===true");
            for(int count=0;count<100&&(RelayNotificationsService.instance!=null||pool.connectionCount()!=0);count++)SystemClock.sleep(50);
            assertNull("Listener must stop",RelayNotificationsService.instance);
            java.lang.reflect.Field cleanupField=RelayNotificationsService.class.getDeclaredField("transportCleanup");cleanupField.setAccessible(true);
            assertTrue("Network cleanup must finish",((java.util.concurrent.ExecutorService)cleanupField.get(service)).awaitTermination(5,TimeUnit.SECONDS));
            assertEquals("TLS pool must drain asynchronously",0,pool.connectionCount());
            assertEquals("Foreground WebView must remain responsive","2",evaluate(ui[0],"1+1"));
        } finally {
            if(originalPolicy[0]!=null)InstrumentationRegistry.getInstrumentation().runOnMainSync(()->android.os.StrictMode.setThreadPolicy(originalPolicy[0]));
            context.stopService(new Intent(context,RelayNotificationsService.class));
            for(int count=0;count<100&&RelayNotificationsService.instance!=null;count++)SystemClock.sleep(50);
            scenario.close();server.shutdown();
            if(client!=null)client.dispatcher().executorService().shutdown();
            if(previous!=null)storage.save("notifications",previous);
            else new java.io.File(context.getNoBackupFilesDir(),"jumble/notifications.enc").delete();
            if(previousCursor!=null)storage.save("notification-cursor",previousCursor);
            else new java.io.File(context.getNoBackupFilesDir(),"jumble/notification-cursor.enc").delete();
            preferences.edit().putBoolean("enabled",enabled).putBoolean("pausedByUser",paused).apply();
        }
    }

}
