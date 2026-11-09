import Foundation

/// Maps `effectType` strings to strategy factories.
///
/// Adding an effect:
/// 1. Create `ios/Runner/Camera/Effects/YourEffect.swift`
/// 2. Conform to `CameraEffectStrategy` (`static var effectType`, `init()`)
/// 3. Append `YourEffect.self` to `bootstrap()`
///
/// AppDelegate never switches on type names.
enum CameraEffectRegistry {
  typealias Factory = () -> CameraEffectStrategy

  private static var factories: [String: Factory] = [:]

  static func bootstrap() {
    register(DollyZoomEffect.self)
    register(RockFocusEffect.self, aliases: ["rackFocus"])
    register(DutchAngleEffect.self)
    register(SteadicamEffect.self, aliases: ["stedicam"])
    register(ShallowZoomEffect.self)
    register(FocusZoomEffect.self)
  }

  static func register<T: CameraEffectStrategy>(_ type: T.Type, aliases: [String] = []) {
    let factory: Factory = { type.init() }
    factories[type.effectType] = factory
    for alias in aliases {
      factories[alias] = factory
    }
  }

  /// Dynamically instantiate the strategy for `effectType`.
  static func make(_ effectType: String) -> Factory? {
    factories[effectType]
  }

  static var knownTypes: [String] {
    Array(Set(factories.keys)).sorted()
  }

  #if DEBUG
  static func resetForTests() {
    factories.removeAll()
  }
  #endif
}
