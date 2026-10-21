import UIKit
import Capacitor
import WebKit

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = ChessBridgeViewController()
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}

// One UIApplication scene owns one WebView. No second local page or storage writer.
class ChessBridgeViewController: CAPBridgeViewController, WKScriptMessageHandler {
    private var probeToken = ""
    private var probePhase = ""

    override func webView(with frame: CGRect, configuration: WKWebViewConfiguration) -> WKWebView {
        #if DEBUG && targetEnvironment(simulator)
        let env = ProcessInfo.processInfo.environment
        if env["CHESSBEST_CI_PROBE"] == "1",
           let token = env["CHESSBEST_CI_TOKEN"],
           token.range(of: "^[a-zA-Z0-9-]{1,80}$", options: .regularExpression) != nil,
           let phase = env["CHESSBEST_CI_PHASE"], ["first", "relaunch"].contains(phase) {
            probeToken = token
            probePhase = phase
            configuration.userContentController.add(self, name: "chessbestDiagnostics")
            let script = """
            window.__CHESSBEST_SMOKE__=true;
            window.__CHESSBEST_SMOKE_TOKEN__='\(token)';
            window.__CHESSBEST_SMOKE_PHASE__='\(phase)';
            window.__CHESSBEST_ERRORS__=[];
            window.addEventListener('error',e=>{if(window.__CHESSBEST_ERRORS__.length<12)window.__CHESSBEST_ERRORS__.push(e.target!==window?'RESOURCE_LOAD_ERROR':'JS_ERROR');},true);
            window.addEventListener('unhandledrejection',()=>{if(window.__CHESSBEST_ERRORS__.length<12)window.__CHESSBEST_ERRORS__.push('UNHANDLED_REJECTION');});
            if ('\(phase)'==='first') localStorage.setItem('ChessBest:APP:v1:settings',JSON.stringify({analysisSource:'sf',sfAnalysisDepth:3}));
            """
            configuration.userContentController.addUserScript(WKUserScript(source: script, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        }
        #endif
        return super.webView(with: frame, configuration: configuration)
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        #if DEBUG && targetEnvironment(simulator)
        guard !probeToken.isEmpty, message.frameInfo.isMainFrame,
              message.frameInfo.securityOrigin.protocol == "capacitor",
              message.frameInfo.securityOrigin.host == "localhost",
              let input = message.body as? [String: Any],
              input["token"] as? String == probeToken,
              input["phase"] as? String == probePhase,
              let ok = input["ok"] as? Bool,
              let checks = input["checks"] as? [String: Bool] else { return }
        let allowed = Set(["visibleBoard", "localPieces", "storageReady", "studySurvivesTermination", "gameSurvivesTermination", "libraryControl", "legalMoveControl", "sevenBundledTopPicks", "studyCommitted", "realStockfishDepth3", "noStartupErrors"])
        let safeChecks = checks.filter { allowed.contains($0.key) }
        func safeCode(_ value: Any?) -> String {
            guard let s = value as? String, s.count <= 80,
                  s.range(of: "^[a-zA-Z0-9_-]*$", options: .regularExpression) != nil else { return "REDACTED" }
            return s
        }
        let receipt: [String: Any] = ["schema": "chessbest-native-smoke/1", "token": probeToken,
            "phase": probePhase, "ok": ok, "checks": safeChecks,
            "stage": safeCode(input["stage"]), "code": safeCode(input["code"]),
            "readyMs": min(120000, max(0, input["readyMs"] as? Int ?? 0)),
            "startupErrors": (input["startupErrors"] as? [String] ?? []).prefix(12).map { safeCode($0) }]
        do {
            let folder = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
            let path = folder.appendingPathComponent("chessbest-\(probePhase).json")
            let bytes = try JSONSerialization.data(withJSONObject: receipt, options: [.sortedKeys])
            try bytes.write(to: path, options: .atomic)
        } catch { /* The runner reports missing receipt, never success. */ }
        #endif
    }
}
