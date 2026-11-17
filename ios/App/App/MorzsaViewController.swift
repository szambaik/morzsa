import UIKit
import Capacitor

/// The same web application and data stores, with a system-owned navigation bar.
final class MorzsaViewController: CAPBridgeViewController, UITabBarDelegate {
    private let navigationBar = UITabBar()
    private let destinations = ["overview", "shopping", "chat", "pantry", "recipes"]
    private let symbols = ["square.grid.2x2", "cart", "sparkles", "house", "fork.knife"]
    private let selectionFeedback = UISelectionFeedbackGenerator()
    private var currentLanguage = ""
    private var requestedHidden = true
    private var lastHeight: CGFloat = -1

    private struct Control {
        let button: UIButton
        let frame: CGRect
        let fixed: Bool
    }
    private var controls: [String: Control] = [:]
    private var controlsRevision = 0
    private var viewportWidth: CGFloat = 1
    private var offsetObservation: NSKeyValueObservation?

    func updateControls(_ specifications: [[String: Any]], revision: Int, width: CGFloat) {
        guard let webView, width > 0 else { return }
        if offsetObservation == nil {
            offsetObservation = webView.scrollView.observe(\.contentOffset, options: [.new]) { [weak self] _, _ in self?.positionFixedControls() }
        }
        controlsRevision = revision
        viewportWidth = width
        let scale = webView.bounds.width / width
        let ids = Set(specifications.compactMap { $0["id"] as? String })
        for (id, control) in controls where !ids.contains(id) { control.button.removeFromSuperview(); controls.removeValue(forKey: id) }
        for spec in specifications {
            guard let id = spec["id"] as? String,
                  let label = spec["label"] as? String,
                  let x = spec["x"] as? Double, let y = spec["y"] as? Double,
                  let w = spec["width"] as? Double, let h = spec["height"] as? Double,
                  [x,y,w,h].allSatisfy({ $0.isFinite }), w >= 32, h >= 32 else { continue }
            let button: UIButton
            if let existing = controls[id]?.button { button = existing }
            else {
                button = UIButton(type: .system)
                button.accessibilityIdentifier = "morzsa-control-" + id
                button.addAction(UIAction { [weak self, weak button] _ in
                    guard let self, let button, let web = self.webView else { return }
                    let rect = button.convert(button.bounds, to: web)
                    let ratio = self.viewportWidth / web.bounds.width
                    self.emit("morzsa-native-action", data: ["id": id, "revision": self.controlsRevision, "x": rect.minX * ratio, "y": rect.minY * ratio])
                }, for: .touchUpInside)
                webView.scrollView.addSubview(button)
            }
            let prominent = spec["prominent"] as? Bool == true || spec["selected"] as? Bool == true
            var configuration: UIButton.Configuration
            if #available(iOS 26.0, *) { configuration = prominent ? .prominentGlass() : .glass() }
            else { configuration = prominent ? .filled() : .tinted() }
            configuration.cornerStyle = .capsule
            configuration.title = spec["title"] as? String
            configuration.titleLineBreakMode = .byTruncatingTail
            if let symbol = spec["symbol"] as? String, !symbol.isEmpty { configuration.image = UIImage(systemName: symbol) }
            configuration.imagePadding = 5
            configuration.contentInsets = NSDirectionalEdgeInsets(top: 5, leading: 8, bottom: 5, trailing: 8)
            configuration.baseBackgroundColor = prominent ? UIColor(red: 0.75, green: 0.306, blue: 0.173, alpha: 1) : UIColor(red: 0.973, green: 0.953, blue: 0.914, alpha: 0.8)
            configuration.baseForegroundColor = prominent ? .white : UIColor(red: 0.204, green: 0.275, blue: 0.220, alpha: 1)
            if spec["destructive"] as? Bool == true { configuration.baseForegroundColor = .systemRed }
            let fontSize = CGFloat(spec["fontSize"] as? Double ?? 14)
            configuration.titleTextAttributesTransformer = UIConfigurationTextAttributesTransformer { incoming in
                var attributes = incoming
                attributes.font = UIFontMetrics(forTextStyle: .subheadline).scaledFont(for: UIFont.systemFont(ofSize: max(12, min(22, fontSize))))
                return attributes
            }
            button.configuration = configuration
            button.titleLabel?.adjustsFontForContentSizeCategory = true
            button.titleLabel?.numberOfLines = 1
            button.titleLabel?.lineBreakMode = .byTruncatingTail
            button.isEnabled = spec["disabled"] as? Bool != true
            button.accessibilityLabel = label
            button.accessibilityTraits = spec["selected"] as? Bool == true ? [.button, .selected] : .button
            let rect = CGRect(x: x * scale, y: y * scale, width: w * scale, height: h * scale)
            // UIScrollView owns panning, including gestures beginning on a button.
            let contentFrame = webView.convert(rect, to: webView.scrollView)
            let fixed = spec["fixed"] as? Bool == true
            button.frame = contentFrame
            controls[id] = Control(button: button, frame: rect, fixed: fixed)
            webView.scrollView.bringSubviewToFront(button)
        }
    }

    private func positionFixedControls() {
        guard let webView else { return }
        for control in controls.values where control.fixed {
            control.button.frame = webView.convert(control.frame, to: webView.scrollView)
        }
    }

    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(MorzsaUIPlugin())
        webView?.isOpaque = false
        webView?.backgroundColor = UIColor(red: 0.973, green: 0.953, blue: 0.914, alpha: 1)
        webView?.scrollView.backgroundColor = webView?.backgroundColor
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        // The existing application palette is light; a partial dark theme would reduce contrast.
        overrideUserInterfaceStyle = .light
        navigationBar.delegate = self
        navigationBar.accessibilityIdentifier = "morzsa-native-tabs"
        navigationBar.tintColor = UIColor(red: 0.204, green: 0.275, blue: 0.220, alpha: 1)
        navigationBar.unselectedItemTintColor = .secondaryLabel
        let appearance = UITabBarAppearance()
        appearance.configureWithDefaultBackground()
        navigationBar.standardAppearance = appearance
        navigationBar.scrollEdgeAppearance = appearance
        navigationBar.isHidden = true
        view.addSubview(navigationBar)
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        // UIKit includes its bottom safe area in the fitted tab-bar height.
        let height = navigationBar.sizeThatFits(view.bounds.size).height
        navigationBar.frame = CGRect(x: 0, y: view.bounds.height - height, width: view.bounds.width, height: height)
        view.bringSubviewToFront(navigationBar)
        publishHeight()
    }

    override func viewSafeAreaInsetsDidChange() {
        super.viewSafeAreaInsetsDidChange()
        view.setNeedsLayout()
    }

    func updateNavigation(page: String, language: String, count: Int, hidden: Bool) -> CGFloat {
        if currentLanguage != language {
            currentLanguage = language
            let labels = language == "en"
                ? ["Overview", "List", "Morzsa", "Pantry", "Recipes"]
                : ["Áttekintés", "Lista", "Morzsa", "Készlet", "Receptek"]
            navigationBar.items = destinations.indices.map { index in
                let item = UITabBarItem(title: labels[index], image: UIImage(systemName: symbols[index]), tag: index)
                item.accessibilityIdentifier = "morzsa-tab-" + destinations[index]
                return item
            }
        }
        if let index = destinations.firstIndex(of: page) {
            navigationBar.selectedItem = navigationBar.items?[index]
        }
        navigationBar.items?[1].badgeValue = count > 0 ? (count > 99 ? "99+" : String(count)) : nil
        requestedHidden = hidden
        navigationBar.isHidden = hidden
        view.setNeedsLayout()
        view.layoutIfNeeded()
        return hidden ? 0 : navigationBar.frame.height
    }

    func tabBar(_ tabBar: UITabBar, didSelect item: UITabBarItem) {
        guard destinations.indices.contains(item.tag) else { return }
        selectionFeedback.selectionChanged()
        selectionFeedback.prepare()
        emit("morzsa-native-tab", data: ["page": destinations[item.tag]])
    }

    private func publishHeight() {
        let height = requestedHidden ? 0 : navigationBar.frame.height
        guard abs(height - lastHeight) > 0.5 else { return }
        lastHeight = height
        emit("morzsa-native-insets", data: ["height": height])
    }

    private func emit(_ name: String, data: [String: Any]) {
        guard let bytes = try? JSONSerialization.data(withJSONObject: data),
              let json = String(data: bytes, encoding: .utf8) else { return }
        bridge?.triggerJSEvent(eventName: name, target: "window", data: json)
    }
}

@objc(MorzsaUIPlugin)
final class MorzsaUIPlugin: CAPPlugin, CAPBridgedPlugin {
    let identifier = "MorzsaUIPlugin"
    let jsName = "MorzsaUI"
    let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setNavigation", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "selectionFeedback", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "showActions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setControls", returnType: CAPPluginReturnPromise)
    ]

    @objc func setControls(_ call: CAPPluginCall) {
        guard let buttons = call.getArray("buttons", JSObject.self), buttons.count <= 80,
              let revision = call.getInt("revision"), let width = call.getDouble("viewportWidth"), width > 0 else {
            call.reject("Invalid controls")
            return
        }
        DispatchQueue.main.async { [weak self] in
            guard let controller = self?.bridge?.viewController as? MorzsaViewController else {
                call.reject("Native controls unavailable")
                return
            }
            controller.updateControls(buttons, revision: revision, width: CGFloat(width))
            call.resolve(["revision": revision])
        }
    }

    @objc func setNavigation(_ call: CAPPluginCall) {
        let page = call.getString("page") ?? "chat"
        let language = call.getString("language") == "en" ? "en" : "hu"
        let count = max(0, min(9999, call.getInt("count") ?? 0))
        let hidden = call.getBool("hidden") ?? false
        DispatchQueue.main.async { [weak self] in
            guard let controller = self?.bridge?.viewController as? MorzsaViewController else {
                call.reject("Native navigation unavailable")
                return
            }
            let height = controller.updateNavigation(page: page, language: language, count: count, hidden: hidden)
            call.resolve(["height": height])
        }
    }

    @objc func selectionFeedback(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            UISelectionFeedbackGenerator().selectionChanged()
            call.resolve()
        }
    }

    @objc func showActions(_ call: CAPPluginCall) {
        guard let actions = call.getArray("actions", String.self), !actions.isEmpty,
              actions.count <= 8, actions.allSatisfy({ !$0.isEmpty && $0.count <= 160 }) else {
            call.reject("Invalid actions")
            return
        }
        DispatchQueue.main.async { [weak self] in
            guard let presenter = self?.bridge?.viewController, presenter.presentedViewController == nil else {
                call.reject("Another screen is already open")
                return
            }
            let sheet = UIAlertController(title: call.getString("title"), message: nil, preferredStyle: .actionSheet)
            for (index, title) in actions.enumerated() {
                sheet.addAction(UIAlertAction(title: title, style: .default) { _ in call.resolve(["index": index]) })
            }
            sheet.addAction(UIAlertAction(title: call.getString("cancel") ?? "Mégse", style: .cancel) { _ in
                call.resolve(["index": -1])
            })
            // Action sheets require a popover anchor on iPad and in wide windows.
            if let popover = sheet.popoverPresentationController {
                popover.sourceView = presenter.view
                popover.sourceRect = CGRect(x: presenter.view.bounds.midX, y: presenter.view.bounds.maxY - 80, width: 1, height: 1)
                popover.permittedArrowDirections = []
            }
            presenter.present(sheet, animated: true)
        }
    }
}
