import XCTest

@MainActor
final class NativeComposerTests: XCTestCase {
    func testNativeTypingRedrawSubmissionAndNavigation() {
        let app = XCUIApplication(bundleIdentifier: "io.github.szambaik.morzsa.composerqa")
        app.launch()
        let editor = app.textViews["morzsa-native-chat-input"]
        XCTAssertTrue(editor.waitForExistence(timeout: 20), "A real UITextView must replace the HTML editor")
        editor.tap()
        editor.typeText("Native draft\nSecond line")
        XCTAssertEqual(editor.value as? String, "Native draft\nSecond line")
        XCTAssertTrue(app.keyboards.firstMatch.exists)
        XCTAssertTrue(app.staticTexts["Redraw complete"].waitForExistence(timeout: 5))
        // Continue typing without tapping: the same native cursor must survive.
        editor.typeText(" + retained")
        XCTAssertEqual(editor.value as? String, "Native draft\nSecond line + retained")
        XCTAssertTrue(app.keyboards.firstMatch.exists, "Chat redraw must keep native editing active")
        XCTAssertLessThanOrEqual(editor.frame.maxY, app.buttons["Küldés"].frame.minY, "Native text must fit above the existing toolbar")
        let beforeSend = XCTAttachment(screenshot: app.screenshot())
        beforeSend.name = "Native UITextView and keyboard"
        beforeSend.lifetime = .keepAlways
        add(beforeSend)
        app.buttons["Küldés"].tap()
        let receipt = app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@", "Sent:")).firstMatch
        XCTAssertTrue(receipt.waitForExistence(timeout: 5))
        XCTAssertEqual(receipt.label, "Sent: Native draft\nSecond line + retained")
        XCTAssertFalse((editor.value as? String ?? "").contains("Native draft"))
        editor.tap()
        editor.typeText("Next draft")
        app.toolbars.buttons["Kész"].tap()
        XCTAssertLessThanOrEqual(editor.frame.maxY, app.buttons["Küldés"].frame.minY, "Keyboard dismissal must keep text inside the glass card")
        app.buttons["morzsa-tab-pantry"].tap()
        app.buttons["morzsa-tab-chat"].tap()
        XCTAssertTrue(editor.waitForExistence(timeout: 5))
        XCTAssertEqual(editor.value as? String, "Next draft")
        app.buttons["Beszélgetéstörténet"].tap()
        XCTAssertFalse(editor.isHittable, "An open dialog must hide the native editor")
        app.buttons["Bezárás"].firstMatch.tap()
        XCTAssertTrue(editor.waitForExistence(timeout: 5))
        XCTAssertEqual(editor.value as? String, "Next draft")
        app.buttons["Új beszélgetés"].tap()
        XCTAssertTrue(editor.waitForExistence(timeout: 5))
        XCTAssertEqual(editor.value as? String, "")
        XCTAssertTrue(app.keyboards.firstMatch.exists, "Web focus requests must open the native keyboard")
    }
}
