import XCTest
@testable import Runner

final class CameraEffectRegistryTests: XCTestCase {
  override func setUp() {
    super.setUp()
    CameraEffectRegistry.resetForTests()
    CameraEffectRegistry.bootstrap()
  }

  func testKnownStrategiesAreRegisteredWithoutSwitching() {
    XCTAssertNotNil(CameraEffectRegistry.make("dollyZoom"))
    XCTAssertNotNil(CameraEffectRegistry.make("rockFocus"))
    XCTAssertNotNil(CameraEffectRegistry.make("rackFocus"))
    XCTAssertNotNil(CameraEffectRegistry.make("dutchAngle"))
    XCTAssertNil(CameraEffectRegistry.make("lensFlare"))
  }

  func testFactoryReturnsAFreshInstance() {
    let a = CameraEffectRegistry.make("dollyZoom")?()
    let b = CameraEffectRegistry.make("dollyZoom")?()
    XCTAssertFalse(a === b)
    XCTAssertTrue(a is DollyZoomEffect)
  }

  func testPayloadParserReadsEffectTypeAndParams() throws {
    let parsed = try CameraEffectParams.parse([
      "effectType": "dutchAngle",
      "params": ["angle": 22, "animated": true],
    ])
    XCTAssertEqual(parsed.effectType, "dutchAngle")
    XCTAssertEqual(parsed.params.double("angle", default: 0), 22)
    XCTAssertTrue(parsed.params.bool("animated", default: false))
  }
}
