import Foundation
import AVFoundation
import UIKit

public class BarcodeScanner: NSObject, AVCaptureMetadataOutputObjectsDelegate {
    private var session: AVCaptureSession?
    private var previewController: UIViewController?
    private var completion: ((Result<String, Error>) -> Void)?

    public func scan(presenter: UIViewController?, completion: @escaping (Result<String, Error>) -> Void) {
        guard let presenter = presenter else {
            completion(.failure(NSError(domain: "BarcodeScanner", code: 1, userInfo: [NSLocalizedDescriptionKey: "No view controller"])))
            return
        }
        guard let device = AVCaptureDevice.default(for: .video),
              let input = try? AVCaptureDeviceInput(device: device) else {
            completion(.failure(NSError(domain: "BarcodeScanner", code: 2, userInfo: [NSLocalizedDescriptionKey: "No camera available"])))
            return
        }

        let session = AVCaptureSession()
        guard session.canAddInput(input) else {
            completion(.failure(NSError(domain: "BarcodeScanner", code: 3, userInfo: [NSLocalizedDescriptionKey: "Camera unavailable"])))
            return
        }
        session.addInput(input)

        let output = AVCaptureMetadataOutput()
        guard session.canAddOutput(output) else {
            completion(.failure(NSError(domain: "BarcodeScanner", code: 4, userInfo: [NSLocalizedDescriptionKey: "Cannot read barcodes"])))
            return
        }
        session.addOutput(output)
        output.setMetadataObjectsDelegate(self, queue: .main)
        output.metadataObjectTypes = [.ean13, .ean8, .upce, .code128, .code39, .itf14, .qr]

        self.session = session
        self.completion = completion

        let vc = UIViewController()
        vc.view.backgroundColor = .black
        let preview = AVCaptureVideoPreviewLayer(session: session)
        preview.frame = UIScreen.main.bounds
        preview.videoGravity = .resizeAspectFill
        vc.view.layer.addSublayer(preview)
        vc.modalPresentationStyle = .fullScreen

        let close = UIButton(type: .system)
        close.setTitle("Close", for: .normal)
        close.addTarget(self, action: #selector(cancelTapped), for: .touchUpInside)
        close.frame = CGRect(x: 20, y: 60, width: 80, height: 44)
        vc.view.addSubview(close)

        self.previewController = vc
        presenter.present(vc, animated: true) { session.startRunning() }
    }

    @objc private func cancelTapped() {
        finish(.failure(NSError(domain: "BarcodeScanner", code: 5, userInfo: [NSLocalizedDescriptionKey: "Scan cancelled"])))
    }

    public func metadataOutput(
        _ output: AVCaptureMetadataOutput,
        didOutput metadataObjects: [AVMetadataObject],
        from connection: AVCaptureConnection
    ) {
        guard let object = metadataObjects.first as? AVMetadataMachineReadableCodeObject,
              let value = object.stringValue else { return }
        finish(.success(value))
    }

    private func finish(_ result: Result<String, Error>) {
        session?.stopRunning()
        previewController?.dismiss(animated: true)
        completion?(result)
        completion = nil
        session = nil
        previewController = nil
    }
}
