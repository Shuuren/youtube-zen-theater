type YtztFilterKey =
  | 'hideHomeFeed'
  | 'hideEndScreen'
  | 'hideInfoCards'
  | 'hideShorts'
  | 'hideComments'
  | 'hideMixes'
  | 'hideNotifications'
  | 'hideSearchShelves'
  | 'hideTrending'
  | 'hideMoreYouTube'
  | 'hideOffers'
  | 'disableAutoplay';

type YtztSettings = {
  detailsLocation: 'page' | 'card' | null;
  detailsSide: 'left' | 'right' | null;
  detailsTrigger: 'scroll' | 'button' | 'hover' | 'scroll-hover' | null;
  playlistLocation: 'page' | 'card' | 'hidden' | null;
  playlistSide: 'left' | 'right' | null;
  playlistTrigger: 'button' | 'hover' | null;
  scrollBehavior: 'page' | 'card';
  startupMode: 'zen' | 'theater';
  zenShortcut: 't' | 'shift-t';
  autoZen: boolean;
  hideLiveChat: boolean;
  hideHeader: boolean;
  hideRecommendations: boolean;
  revealHeaderOnHover: boolean;
  revealMetaOnHover: boolean;
  revealPlaylistOnHover: boolean;
  sideRevealMode: 'drawer' | 'hover';
  drawerImplementation: 'custom' | 'native';
  revealSideLayout: 'same' | 'separate';
  sideHoverPosition: 'left' | 'right';
  sameSideSplit: 'playlist-top' | 'details-top';
  hoverRevealDelay: number;
  drawerGlassEffect: boolean;
  shortcutEnabled: boolean;
  hideHomeFeed: boolean;
  hideEndScreen: boolean;
  hideInfoCards: boolean;
  hideShorts: boolean;
  hideComments: boolean;
  hideMixes: boolean;
  hideNotifications: boolean;
  hideSearchShelves: boolean;
  hideTrending: boolean;
  hideMoreYouTube: boolean;
  hideOffers: boolean;
  disableAutoplay: boolean;
};

interface DistractionFilter {
  key: YtztFilterKey;
  label: string;
  detail: string;
  rootClass: string;
  defaultValue: boolean;
}

interface UnhookFeature {
  id: string;
  label: string;
  decision: 'adopted' | 'merged' | 'cut';
  setting: string;
  reason: string;
}

interface YtztSettingsApi {
  defaultSettings: YtztSettings;
  distractionFilters: DistractionFilter[];
  unhookFeatures: UnhookFeature[];
  normalizeSettings: (values: Partial<YtztSettings>) => YtztSettings;
  normalizePopupSettings: (values: Partial<YtztSettings>) => YtztSettings;
}

interface Window {
  YTZTSettings: YtztSettingsApi;
}

declare var YTZTSettings: YtztSettingsApi;
