import Foundation
import Capacitor
import AVFoundation

@objc(BarcodeScannerPlugin)
public class BarcodeScannerPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "BarcodeScannerPlugin"
    public let jsName = "BarcodeScanner"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "scan", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "checkPermissions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestPermissions", returnType: CAPPluginReturnPromise),
    ]

    private let implementation = BarcodeScanner()

    @objc func scan(_ call: CAPPluginCall) {
        implementation.scan(presenter: self.bridge?.viewController) { result in
            switch result {
            case .success(let value):
                call.resolve(["barcode": value, "format": "unknown"])
            case .failure(let error):
                call.reject(error.localizedDescription, "OPERATION_FAILED")
            }
        }
    }

    @objc func checkPermissions(_ call: CAPPluginCall) {
        call.resolve(["camera": cameraState()])
    }

    @objc func requestPermissions(_ call: CAPPluginCall) {
        AVCaptureDevice.requestAccess(for: .video) { _ in
            DispatchQueue.main.async { call.resolve(["camera": self.cameraState()]) }
        }
    }

    private func cameraState() -> String {
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized: return "granted"
        case .denied, .restricted: return "denied"
        default: return "prompt"
        }
    }
}
