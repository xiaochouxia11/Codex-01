import XCTest
@testable import tart

final class WWWAuthenticateTests: XCTestCase {
  func testExample() throws {
    // Test example from Token Authentication Specification[1]
    //
    // [1]: https://docs.docker.com/registry/spec/auth/token/
    let wwwAuthenticate = try WWWAuthenticate(rawHeaderValue: "Bearer realm=\"https://auth.docker.io/token\",service=\"registry.docker.io\",scope=\"repository:samalba/my-app:pull,push\"")

    XCTAssertEqual("Bearer", wwwAuthenticate.scheme)
    XCTAssertEqual([
      "realm": "https://auth.docker.io/token",
      "service": "registry.docker.io",
      "scope": "repository:samalba/my-app:pull,push",
    ], wwwAuthenticate.kvs)
  }

  func testBasic() throws {
    let wwwAuthenticate = try WWWAuthenticate(rawHeaderValue: "Bearer a=b,c=\"d\"")

    XCTAssertEqual("Bearer", wwwAuthenticate.scheme)
    XCTAssertEqual(["a": "b", "c": "d"], wwwAuthenticate.kvs)
  }

  func testWhitespaceAroundDirectives() throws {
    // RFC 7235 allows optional whitespace around the commas separating directives[1]
    //
    // [1]: https://www.rfc-editor.org/rfc/rfc7235#section-4.1
    let wwwAuthenticate = try WWWAuthenticate(rawHeaderValue: "Bearer realm=\"https://auth.example.com/token\", service=\"registry.example.com\" , scope=\"repository:org/repo:pull,push\"")

    XCTAssertEqual("Bearer", wwwAuthenticate.scheme)
    XCTAssertEqual([
      "realm": "https://auth.example.com/token",
      "service": "registry.example.com",
      "scope": "repository:org/repo:pull,push",
    ], wwwAuthenticate.kvs)
  }

  func testIncompleteHeader() throws {
    XCTAssertThrowsError(try WWWAuthenticate(rawHeaderValue: "Whatever")) {
      XCTAssertTrue($0 is RegistryError)
    }

    XCTAssertThrowsError(try WWWAuthenticate(rawHeaderValue: "Bearer ")) {
      XCTAssertTrue($0 is RegistryError)
    }
  }

  func testIncompleteDirective() throws {
    XCTAssertThrowsError(try WWWAuthenticate(rawHeaderValue: "Bearer whatever")) {
      XCTAssertTrue($0 is RegistryError)
    }
  }
}
