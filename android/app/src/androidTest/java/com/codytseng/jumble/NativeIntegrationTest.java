package com.codytseng.jumble;

import static org.junit.Assert.*;
import static androidx.test.espresso.Espresso.*;
import static androidx.test.espresso.action.ViewActions.click;
import static androidx.test.espresso.matcher.ViewMatchers.isAssignableFrom;
import static androidx.test.espresso.intent.Intents.intending;
import static androidx.test.espresso.intent.matcher.IntentMatchers.hasAction;
import android.Manifest;
import android.app.Activity;
import android.app.Instrumentation;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.SystemClock;
import android.view.View;
import android.webkit.WebView;
import androidx.core.content.FileProvider;
import androidx.test.core.app.ActivityScenario;
import androidx.test.espresso.intent.Intents;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.filters.SdkSuppress;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.rule.GrantPermissionRule;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import org.junit.Rule;
import org.junit.Test;
import org.junit.runner.RunWith;

@RunWith(AndroidJUnit4.class)
@SdkSuppress(minSdkVersion=29)
public class NativeIntegrationTest {
    @Rule public GrantPermissionRule camera = GrantPermissionRule.grant(Manifest.permission.CAMERA);
    private String evaluate(ActivityScenario<MainActivity> scenario, String script) throws Exception {
        CountDownLatch done = new CountDownLatch(1); String[] result = new String[1];
        scenario.onActivity(activity -> activity.getBridge().getWebView().evaluateJavascript(script, value -> { result[0] = value; done.countDown(); }));
        assertTrue("JS evaluation timed out", done.await(5,TimeUnit.SECONDS));
        return result[0];
    }
    private void ready(ActivityScenario<MainActivity> scenario) throws Exception {
        for (int i=0;i<160;i++) {
            if ("true".equals(evaluate(scenario,"!!window.Capacitor?.nativePromise && document.readyState === 'complete'"))) return;
            SystemClock.sleep(100);
        }
        fail("WebView did not load");
    }
    private void awaitFlag(ActivityScenario<MainActivity> scenario, String name) throws Exception {
        for (int i=0;i<100;i++) {
            if ("true".equals(evaluate(scenario,"window."+name+" === true"))) return;
            SystemClock.sleep(100);
        }
        fail(name+" was not set; "+evaluate(scenario,"window.__nativeError"));
    }
    @Test public void clipboardUsesNativeClipboardAndHidesSensitivePreviews() throws Exception {
        try (ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)) {
            ready(scenario);
            evaluate(scenario,"Capacitor.nativePromise('JumbleSystem','writeClipboard',{text:'jumble-test-copy'}).then(()=>window.__copyOk=true)");
            awaitFlag(scenario,"__copyOk");
            scenario.onActivity(activity -> {
                ClipboardManager clipboard=(ClipboardManager)activity.getSystemService(Context.CLIPBOARD_SERVICE);
                assertEquals("jumble-test-copy",clipboard.getPrimaryClip().getItemAt(0).getText().toString());
                assertTrue(clipboard.getPrimaryClip().getDescription().getExtras().getBoolean("android.content.extra.IS_SENSITIVE"));
            });
        }
    }
    @Test public void exportWritesOnlyToTheSystemSelectedDocumentAndCancelStaysCancelled() throws Exception {
        Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();
        File file=File.createTempFile("jumble-export-test-",".txt",context.getCacheDir());
        Uri destination=FileProvider.getUriForFile(context,context.getPackageName()+".fileprovider",file);
        Intents.init();
        try (ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)) {
            ready(scenario);
            intending(hasAction(Intent.ACTION_CREATE_DOCUMENT)).respondWith(new Instrumentation.ActivityResult(Activity.RESULT_OK,new Intent().setData(destination)));
            evaluate(scenario,"Capacitor.nativePromise('JumbleFiles','saveText',{filename:'test.txt',text:'test export only'}).then(v=>window.__exportOk=v.saved).catch(e=>window.__nativeError=e.message)");
            awaitFlag(scenario,"__exportOk");
            try(FileInputStream input=new FileInputStream(file)) {
                byte[] bytes=new byte[(int)file.length()]; assertEquals(bytes.length,input.read(bytes));
                assertEquals("test export only",new String(bytes,StandardCharsets.UTF_8));
            }
            intending(hasAction(Intent.ACTION_CREATE_DOCUMENT)).respondWith(new Instrumentation.ActivityResult(Activity.RESULT_CANCELED,null));
            evaluate(scenario,"Capacitor.nativePromise('JumbleFiles','saveText',{filename:'test.txt',text:'must not overwrite'}).then(v=>window.__cancelOk=!v.saved)");
            awaitFlag(scenario,"__cancelOk");
        } finally { Intents.release(); file.delete(); }
    }
    @Test public void filePickerPreservesSelectedImageAndCameraStreams() throws Exception {
        Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();
        File file=File.createTempFile("jumble-upload-test-",".png",context.getCacheDir());
        Bitmap image=Bitmap.createBitmap(2,2,Bitmap.Config.ARGB_8888);
        try(FileOutputStream output=new FileOutputStream(file)) { image.compress(Bitmap.CompressFormat.PNG,100,output); }
        image.recycle();
        Uri uri=FileProvider.getUriForFile(context,context.getPackageName()+".fileprovider",file);
        Intents.init();
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)) {
            ready(scenario);
            intending(hasAction(Intent.ACTION_GET_CONTENT)).respondWith(new Instrumentation.ActivityResult(Activity.RESULT_OK,new Intent().setData(uri)));
            evaluate(scenario,"(()=>{const i=document.createElement('input');i.type='file';i.accept='image/*';i.style='position:fixed;inset:0;width:100%;height:100%;z-index:2147483647';i.onchange=()=>window.__fileOk=i.files[0]?.size>0&&i.files[0]?.type==='image/png';document.body.append(i)})()");
            onView(isAssignableFrom(WebView.class)).perform(click());
            awaitFlag(scenario,"__fileOk");
            evaluate(scenario,"navigator.mediaDevices.getUserMedia({video:true}).then(s=>{window.__cameraOk=s.getVideoTracks()[0].readyState==='live';s.getTracks().forEach(t=>t.stop())}).catch(e=>window.__nativeError=e.message)");
            awaitFlag(scenario,"__cameraOk");
        } finally { Intents.release(); file.delete(); }
    }
    @Test public void fullscreenEntersNativeContainerAndBackOnlyExitsFullscreen() throws Exception {
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)) {
            ready(scenario);
            evaluate(scenario,"(()=>{const b=document.createElement('button');b.style='position:fixed;inset:0;width:100%;height:100%;z-index:2147483647';b.onclick=()=>document.documentElement.requestFullscreen().catch(e=>window.__nativeError=e.message);document.body.append(b)})()");
            onView(isAssignableFrom(WebView.class)).perform(click());
            boolean[] fullscreen={false};
            for(int i=0;i<60&&!fullscreen[0];i++) { scenario.onActivity(activity->fullscreen[0]=activity.getWindow().getDecorView().findViewWithTag("jumble-fullscreen")!=null);SystemClock.sleep(100); }
            assertTrue("Fullscreen container missing",fullscreen[0]);
            // Android may show its first-use immersive-mode confirmation over the
            // Activity. Send real system Back events without requiring Espresso's
            // application root to own focus; dismiss that prompt before exiting.
            for (int attempt=0;attempt<3&&fullscreen[0];attempt++) {
                InstrumentationRegistry.getInstrumentation().getUiAutomation().performGlobalAction(android.accessibilityservice.AccessibilityService.GLOBAL_ACTION_BACK);
                for(int wait=0;wait<15&&fullscreen[0];wait++) {
                    SystemClock.sleep(100);
                    scenario.onActivity(activity->fullscreen[0]=activity.getWindow().getDecorView().findViewWithTag("jumble-fullscreen")!=null);
                }
            }
            scenario.onActivity(activity->{
                assertNull(activity.getWindow().getDecorView().findViewWithTag("jumble-fullscreen"));
                assertEquals(View.VISIBLE,activity.getBridge().getWebView().getVisibility());
            });
        }
    }
}
