import UIKit

/// Real system text editing above the web composer's reserved text area.
/// The toolbar remains in WKWebView to retain trusted photo/microphone taps.
final class MorzsaTextInput: UITextView, UITextViewDelegate {
    private let placeholderLabel = UILabel()
    private(set) var session = ""
    private(set) var sequence = 0
    private var latestRevision = -1
    private var maxLength = 2000
    private var cssScale: CGFloat = 1
    private var lastReportedHeight: CGFloat = 0
    var onChange: (([String: Any]) -> Void)?

    init() {
        super.init(frame: .zero, textContainer: nil)
        delegate = self
        backgroundColor = .clear
        textColor = UIColor(red: 0.204, green: 0.275, blue: 0.220, alpha: 1)
        tintColor = UIColor(red: 0.75, green: 0.306, blue: 0.173, alpha: 1)
        font = UIFontMetrics(forTextStyle: .body).scaledFont(for: .systemFont(ofSize: 16))
        adjustsFontForContentSizeCategory = true
        textContainerInset = UIEdgeInsets(top: 9, left: 10, bottom: 7, right: 10)
        textContainer.lineFragmentPadding = 0
        keyboardAppearance = .light
        autocorrectionType = .yes
        autocapitalizationType = .sentences
        returnKeyType = .default
        isScrollEnabled = true
        contentInsetAdjustmentBehavior = .never
        showsVerticalScrollIndicator = false
        accessibilityIdentifier = "morzsa-native-chat-input"
        placeholderLabel.textColor = UIColor(red: 0.369, green: 0.412, blue: 0.353, alpha: 1)
        placeholderLabel.font = font
        placeholderLabel.adjustsFontForContentSizeCategory = true
        placeholderLabel.isAccessibilityElement = false
        placeholderLabel.isUserInteractionEnabled = false
        addSubview(placeholderLabel)
        // Keep the editor next to the keyboard without an extra accessory row.
        inputAccessoryView = nil
        isHidden = true
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    func update(_ state: [String: Any], revision: Int, scale: CGFloat) {
        guard revision >= latestRevision else { return }
        latestRevision = revision
        guard state["visible"] as? Bool == true else {
            resignFirstResponder()
            isHidden = true
            return
        }
        let nextSession = state["session"] as? String ?? ""
        let changedSession = nextSession != session
        if changedSession {
            resignFirstResponder()
            session = nextSession
            sequence = 0
            undoManager?.removeAllActions()
        }
        cssScale = scale
        let value = state["text"] as? String ?? ""
        let ack = state["editAck"] as? Int ?? 0
        // A delayed web redraw must never overwrite newer native typing or IME text.
        if changedSession || (ack >= sequence && markedTextRange == nil && text != value) {
            let selection = selectedRange
            text = value
            let length = (text as NSString).length
            selectedRange = changedSession ? NSRange(location: length, length: 0)
                : NSRange(location: min(selection.location, length), length: min(selection.length, max(0, length - selection.location)))
        }
        maxLength = max(1, min(2000, state["maxLength"] as? Int ?? 2000))
        placeholderLabel.text = state["placeholder"] as? String
        placeholderLabel.isHidden = !text.isEmpty
        accessibilityLabel = state["label"] as? String
        isEditable = state["editable"] as? Bool != false
        isHidden = false
        setNeedsLayout()
        if state["focus"] as? Bool == true && isEditable && !isFirstResponder { becomeFirstResponder() }
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        placeholderLabel.frame = CGRect(x: textContainerInset.left, y: textContainerInset.top,
            width: max(0, bounds.width - textContainerInset.left - textContainerInset.right), height: font?.lineHeight ?? 20)
        reportHeightIfNeeded()
    }

    private var desiredHeight: CGFloat {
        guard bounds.width > 0 else { return 44 }
        return min(110, max(44, sizeThatFits(CGSize(width: bounds.width, height: .greatestFiniteMagnitude)).height / cssScale))
    }

    private func reportHeightIfNeeded() {
        let height = desiredHeight
        guard !isHidden, abs(height - lastReportedHeight) > 0.5 else { return }
        lastReportedHeight = height
        notify()
    }

    private func notify() {
        onChange?(["session": session, "sequence": sequence, "text": text ?? "", "height": desiredHeight])
    }

    func textViewDidChange(_ textView: UITextView) {
        // Match HTML maxlength's UTF-16 budget without cutting a composed character.
        if markedTextRange == nil && text.utf16.count > maxLength {
            var result = "", length = 0
            for character in text {
                let part = String(character), size = part.utf16.count
                if length + size > maxLength { break }
                result += part; length += size
            }
            text = result
        }
        sequence += 1
        placeholderLabel.isHidden = !text.isEmpty
        notify()
    }

    func textView(_ textView: UITextView, shouldChangeTextIn range: NSRange, replacementText replacement: String) -> Bool {
        guard range.location + range.length <= (text as NSString).length else { return false }
        let candidate = (text as NSString).replacingCharacters(in: range, with: replacement)
        return markedTextRange != nil || candidate.utf16.count <= maxLength
    }

    func dismiss(for key: String) {
        guard key == session else { return }
        resignFirstResponder()
    }

    func takeSubmission(for key: String) -> [String: Any]? {
        guard key == session, !isHidden, isEditable else { return nil }
        unmarkText()
        let submitted = text ?? ""
        text = ""
        sequence += 1
        placeholderLabel.isHidden = false
        setNeedsLayout()
        // Do not emit an empty draft before JS receives this submission snapshot.
        lastReportedHeight = desiredHeight
        return ["session": session, "sequence": sequence, "text": submitted]
    }
}
