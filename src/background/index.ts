chrome.sidePanel
	.setPanelBehavior({ openPanelOnActionClick: true })
	.catch((err: unknown) => console.error("sidePanel setup failed:", err));
