import ExpoModulesCore
import AVFoundation

/**
 * Exposes the rear camera's real field of view to JavaScript.
 *
 * `AVCaptureDevice.activeFormat.videoFieldOfView` is the horizontal field of
 * view (in degrees) measured across the LONG edge of the sensor image
 * (horizontal when the device is in landscape). The JS side converts this to
 * the on-screen field for the current orientation/aspect so the rendered star
 * overlay tracks the live camera 1:1 — the same value Stellarium reports when
 * its camera overlay is enabled (~32.9° across the screen width on recent
 * iPhones after the full-screen crop).
 */
public class CameraFovModule: Module {
  public func definition() -> ModuleDefinition {
    Name("CameraFov")

    // Returns the rear wide camera's horizontal (long-edge) FOV in degrees,
    // or nil if it can't be determined (no camera / permission not yet granted).
    Function("getCameraFov") { () -> Double? in
      let device =
        AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back)
        ?? AVCaptureDevice.default(for: .video)
      guard let d = device else { return nil }
      let fov = d.activeFormat.videoFieldOfView
      return fov > 0 ? Double(fov) : nil
    }
  }
}
