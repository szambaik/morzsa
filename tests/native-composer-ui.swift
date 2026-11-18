import XCTest

@MainActor
final class NativeComposerTests: XCTestCase {
    func testNativeTypingRedrawSubmissionAndNavigation() {
        let app = XCUIApplication(bundleIdentifier: "io.github.szambaik.morzsa.composerqa")
        app.launch()
        XCTAssertTrue(app.staticTexts["Composer QA ready"].waitForExistence(timeout: 20))
        let historyButton = app.buttons["Beszélgetéstörténet"]
        XCTAssertLessThan(historyButton.frame.minY, 120, "Header must reserve the status bar inset only once")
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
        XCTAssertLessThanOrEqual(editor.frame.maxY, app.buttons["Küldés"].frame.maxY, "Native text must fit inside the existing glass composer")
        let beforeSend = XCTAttachment(screenshot: app.screenshot())
        beforeSend.name = "Native UITextView and keyboard"
        beforeSend.lifetime = .keepAlways
        add(beforeSend)
        app.buttons["Küldés"].coordinate(withNormalizedOffset: CGVector(dx: 1, dy: 0.5)).withOffset(CGVector(dx: -22, dy: 0)).tap()
        let receipt = app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@", "Sent:")).firstMatch
        XCTAssertTrue(receipt.waitForExistence(timeout: 5))
        XCTAssertEqual(receipt.label, "Sent: Native draft\nSecond line + retained")
        XCTAssertFalse((editor.value as? String ?? "").contains("Native draft"))
        editor.tap()
        editor.typeText("Next draft")
        XCTAssertFalse(app.toolbars.buttons["Kész"].exists, "The editor must not add an accessory Done row")
        app.buttons["Beszélgetéstörténet"].tap()
        app.buttons["Bezárás"].firstMatch.tap()
        XCTAssertLessThanOrEqual(editor.frame.maxY, app.buttons["Küldés"].frame.maxY, "Keyboard dismissal must keep text inside the glass card")
        app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@", "Miben segít")).firstMatch.tap()
        XCTAssertTrue(app.buttons["morzsa-tab-pantry"].waitForExistence(timeout: 5), "A background tap dismisses the keyboard and restores navigation")
        app.buttons["morzsa-tab-pantry"].tap()
        app.buttons["morzsa-tab-chat"].tap()
        XCTAssertTrue(editor.waitForExistence(timeout: 5))
        XCTAssertEqual(editor.value as? String, "Next draft")
        app.buttons["Beszélgetéstörténet"].tap()
        XCTAssertFalse(editor.isHittable, "An open dialog must hide the native editor")
        app.buttons["Bezárás"].firstMatch.tap()
        XCTAssertTrue(editor.waitForExistence(timeout: 5))
        XCTAssertEqual(editor.value as? String, "Next draft")
        app.buttons["Új Morzsa-beszélgetés"].tap()
        XCTAssertTrue(editor.waitForExistence(timeout: 5))
        XCTAssertEqual(editor.value as? String, "Next draft", "Opening an already empty chat preserves its draft")
        XCTAssertTrue(app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@", "New chat invoked")).firstMatch.waitForExistence(timeout: 5))
        XCTAssertTrue(app.keyboards.firstMatch.exists, "Web focus requests must open the native keyboard")
        app.buttons["Cooking QA"].tap()
        let back = app.buttons["Vissza Morzsához"]
        XCTAssertTrue(back.waitForExistence(timeout: 5))
        XCTAssertLessThan(back.frame.minY, 120)
        XCTAssertEqual(back.frame.width, 44, accuracy: 1)
        let cooking = XCTAttachment(screenshot: app.screenshot())
        cooking.name = "Native cooking back arrow"
        cooking.lifetime = .keepAlways
        add(cooking)
        back.tap()
        XCTAssertTrue(editor.waitForExistence(timeout: 5))
    }
}
