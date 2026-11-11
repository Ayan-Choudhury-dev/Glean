package io.github.ayanchoudhurydev.glean.barcode

import android.Manifest
import android.app.Activity
import androidx.activity.result.ActivityResult
import com.getcapacitor.JSObject
import com.getcapacitor.PermissionState
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback
import com.journeyapps.barcodescanner.ScanContract
import com.journeyapps.barcodescanner.ScanOptions

@CapacitorPlugin(
    name = "BarcodeScanner",
    permissions = [Permission(alias = "camera", strings = [Manifest.permission.CAMERA])],
)
class BarcodeScannerPlugin : Plugin() {

    @PluginMethod
    fun scan(call: PluginCall) {
        if (getPermissionState("camera") != PermissionState.GRANTED) {
            requestPermissionForAlias("camera", call, "cameraPermissionCallback")
            return
        }
        launchScanner(call)
    }

    @PermissionCallback
    private fun cameraPermissionCallback(call: PluginCall) {
        if (getPermissionState("camera") == PermissionState.GRANTED) {
            launchScanner(call)
        } else {
            call.reject("Camera permission denied", "PERMISSION_DENIED")
        }
    }

    @PluginMethod
    override fun checkPermissions(call: PluginCall) {
        call.resolve(permissionResult())
    }

    @PluginMethod
    override fun requestPermissions(call: PluginCall) {
        requestPermissionForAlias("camera", call, "requestPermissionCallback")
    }

    @PermissionCallback
    private fun requestPermissionCallback(call: PluginCall) {
        call.resolve(permissionResult())
    }

    private fun permissionResult(): JSObject {
        val value = when (getPermissionState("camera")) {
            PermissionState.GRANTED -> "granted"
            PermissionState.DENIED -> "denied"
            else -> "prompt"
        }
        return JSObject().put("camera", value)
    }

    private fun launchScanner(call: PluginCall) {
        val options = ScanOptions().apply {
            setDesiredBarcodeFormats(ScanOptions.ALL_CODE_TYPES)
            setPrompt("")
            setBeepEnabled(false)
            setOrientationLocked(false)
        }
        val intent = ScanContract().createIntent(context, options)
        startActivityForResult(call, intent, "scanResult")
    }

    @ActivityCallback
    private fun scanResult(call: PluginCall, result: ActivityResult) {
        if (result.resultCode != Activity.RESULT_OK) {
            call.reject("Scan cancelled", "OPERATION_FAILED")
            return
        }
        val contents = result.data?.getStringExtra("SCAN_RESULT")
        val format = result.data?.getStringExtra("SCAN_RESULT_FORMAT") ?: "unknown"
        if (contents.isNullOrEmpty()) {
            call.reject("No barcode found", "OPERATION_FAILED")
            return
        }
        call.resolve(JSObject().put("barcode", contents).put("format", format.lowercase()))
    }
}
