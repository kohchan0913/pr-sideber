const params = new URLSearchParams(window.location.search);
const type = params.get("type");
const issueNum = Number(params.get("issue"));
const icon = document.getElementById("icon");
const message = document.getElementById("message");
if (icon && message && !Number.isNaN(issueNum)) {
	if (type === "pr") {
		icon.textContent = "\uD83D\uDD00";
		message.textContent = `PR \u306F\u307E\u3060\u4F5C\u6210\u3055\u308C\u3066\u3044\u307E\u305B\u3093 \u2014 Issue #${issueNum}`;
	} else if (type === "session") {
		icon.textContent = "\uD83E\uDD16";
		message.textContent = `Claude Code Web \u30BB\u30C3\u30B7\u30E7\u30F3\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093 \u2014 Issue #${issueNum}`;
	}
}
