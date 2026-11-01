import XCTest
@testable import tart

final class DockerConfigTests: XCTestCase {
  func testHelpers() throws {
    let config = DockerConfig(credHelpers: [
      "(.*).dkr.ecr.(.*).amazonaws.com": "ecr-login",
      "gcr.io": "gcloud"
    ])

    XCTAssertEqual(try config.findCredHelper(host: "gcr.io"), "gcloud")
    XCTAssertEqual(try config.findCredHelper(host: "123.dkr.ecr.eu-west-1.amazonaws.com"), "ecr-login")
    XCTAssertEqual(try config.findCredHelper(host: "456.dkr.ecr.us-east-1.amazonaws.com"), "ecr-login")
    XCTAssertNil(try config.findCredHelper(host: "ghcr.io"))
  }

  func testAuthPasswordWithColons() throws {
    let auth = Data("user:token:with:colons".utf8).base64EncodedString()
    let credentials = try XCTUnwrap(DockerAuthConfig(auth: auth).decodeCredentials())

    XCTAssertEqual(credentials.0, "user")
    XCTAssertEqual(credentials.1, "token:with:colons")
  }
}
