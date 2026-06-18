Pod::Spec.new do |s|
  s.name           = 'CameraFov'
  s.version        = '1.0.0'
  s.summary        = 'Reads the rear camera field of view (AVCaptureDevice).'
  s.description    = 'Exposes the active rear-camera videoFieldOfView to JS so the AR star overlay can match the live preview.'
  s.author         = 'Pie Matrix'
  s.homepage       = 'https://thepiematrix.com'
  s.license        = { :type => 'MIT' }
  s.platforms      = { :ios => '15.1' }
  s.source         = { :git => '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
