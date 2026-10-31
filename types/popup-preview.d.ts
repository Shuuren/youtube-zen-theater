interface Window {
  updateZenPreview?: (settings: import('../popup/popup.js').PopupSettings) => void;
  renderPreviewScene: (settings: import('../popup/popup.js').PopupSettings, open: 'details' | 'playlist' | null, pinned?: boolean) => void;
  renderPreviewSummary: (settings: import('../popup/popup.js').PopupSettings) => void;
}
