/**
 * Shared settings contract for the content script and the popup.
 * The popup renders `distractionFilters` and can replace its markup
 * without inventing a second list of stored keys.
 * Wrapped so these helpers stay lexical and do not replace popup or content functions.
 */
(() => {
/** @type {YtztSettings} */
const storedDefaults = {
  detailsLocation: null,
  detailsSide: null,
  detailsTrigger: null,
  playlistLocation: null,
  playlistSide: null,
  playlistTrigger: null,
  scrollBehavior: 'page',
  startupMode: 'zen',
  zenShortcut: 't',
  autoZen: true,
  hideLiveChat: true,
  hideHeader: true,
  hideRecommendations: true,
  revealHeaderOnHover: true,
  revealMetaOnHover: true,
  revealPlaylistOnHover: true,
  sideRevealMode: 'drawer',
  drawerImplementation: 'custom',
  revealSideLayout: 'separate',
  sideHoverPosition: 'right',
  sameSideSplit: 'playlist-top',
  hoverRevealDelay: 140,
  drawerGlassEffect: true,
  shortcutEnabled: true,
  hideHomeFeed: true,
  hideEndScreen: true,
  hideInfoCards: true,
  hideShorts: false,
  hideComments: false,
  hideMixes: false,
  hideNotifications: true,
  hideSearchShelves: true,
  hideTrending: false,
  hideMoreYouTube: true,
  hideOffers: true,
  disableAutoplay: true
};

/** @type {DistractionFilter[]} */
const DISTRACTION_FILTERS = [
  {
    key: 'hideHomeFeed',
    label: 'Hide home feed',
    detail: 'Clear the recommendation wall on Home',
    rootClass: 'ytzt-hide-home-feed',
    defaultValue: true,
    group: 'browse'
  },
  {
    key: 'hideShorts',
    label: 'Hide Shorts',
    detail: 'Remove Shorts shelves. A Shorts link you open still plays',
    rootClass: 'ytzt-hide-shorts',
    defaultValue: false,
    group: 'browse'
  },
  {
    key: 'hideEndScreen',
    label: 'Hide end screen',
    detail: 'Remove the video grid when playback ends',
    rootClass: 'ytzt-hide-endscreen',
    defaultValue: true,
    group: 'watch'
  },
  {
    key: 'hideInfoCards',
    label: 'Hide info cards',
    detail: 'Remove cards that pop over the video',
    rootClass: 'ytzt-hide-info-cards',
    defaultValue: true,
    group: 'watch'
  },
  {
    key: 'disableAutoplay',
    label: 'Disable autoplay',
    detail: 'Turn off the next video. Next and previous stay available',
    rootClass: 'ytzt-disable-autoplay',
    defaultValue: true,
    group: 'playback'
  },
  {
    key: 'hideComments',
    label: 'Hide comments',
    detail: 'Keep comments out of the page and the details card',
    rootClass: 'ytzt-hide-comments',
    defaultValue: false,
    group: 'comments'
  },
  {
    key: 'hideMixes',
    label: 'Hide mixes',
    detail: 'Remove mix and radio shelves',
    rootClass: 'ytzt-hide-mixes',
    defaultValue: false,
    group: 'watch'
  },
  {
    key: 'hideSearchShelves',
    label: 'Hide search shelves',
    detail: 'Leave the video results, remove the extra shelves',
    rootClass: 'ytzt-hide-search-shelves',
    defaultValue: true,
    group: 'browse'
  },
  {
    key: 'hideTrending',
    label: 'Hide Trending and Explore',
    detail: 'Hide those entries and pages',
    rootClass: 'ytzt-hide-trending',
    defaultValue: false,
    group: 'browse'
  },
  {
    key: 'hideMoreYouTube',
    label: 'Hide More from YouTube',
    detail: 'Remove Premium, Music, and Movies from the guide',
    rootClass: 'ytzt-hide-more-youtube',
    defaultValue: true,
    group: 'browse'
  },
  {
    key: 'hideNotifications',
    label: 'Hide notifications',
    detail: 'Hide the bell and the unread count in the tab title',
    rootClass: 'ytzt-hide-notifications',
    defaultValue: true,
    group: 'chrome'
  },
  {
    key: 'hideOffers',
    label: 'Hide offers and promos',
    detail: 'Merch, tickets, fundraisers, and survey prompts',
    rootClass: 'ytzt-hide-offers',
    defaultValue: true,
    group: 'watch'
  }
];

/** @type {UnhookFeature[]} */
const UNHOOK_FEATURES = [
  {
    id: 'hide_feed',
    label: 'Hide Home Feed',
    decision: 'adopted',
    setting: 'hideHomeFeed',
    reason: 'The home recommendation wall is the main pull away from choosing a video. It is hidden with CSS on the home browse only.'
  },
  {
    id: 'hide_redirect_home',
    label: 'Redirect to Subscriptions',
    decision: 'cut',
    setting: '',
    reason: 'Sending Home to Subscriptions needs a navigation hijack and changes the logo. Clearing the feed is the job; Home stays Home.'
  },
  {
    id: 'hide_sidebar',
    label: 'Hide Video Sidebar',
    decision: 'cut',
    setting: '',
    reason: 'Hiding the whole secondary column would remove the playlist and the sidebar space Zen keeps on purpose. Recommended, chat, playlist, and fundraisers already have their own controls.'
  },
  {
    id: 'hide_recommended',
    label: 'Hide Recommended',
    decision: 'merged',
    setting: 'hideRecommendations',
    reason: 'Zen already hides recommendation content in theater and leaves the sidebar box. The same setting now also hides that content and the pause-overlay suggestions when Zen is off.'
  },
  {
    id: 'hide_chat',
    label: 'Hide Live Chat',
    decision: 'merged',
    setting: 'hideLiveChat',
    reason: 'Zen still closes chat with the native control while theater is on. Outside theater the same setting hides the chat frame with CSS, so the capped chat search does not run on every page.'
  },
  {
    id: 'hide_playlists',
    label: 'Hide Playlist',
    decision: 'merged',
    setting: 'playlistLocation',
    reason: 'Playlist placement already has a Hidden choice. That choice now hides the playlist panel outside theater as well.'
  },
  {
    id: 'hide_donate',
    label: 'Hide Fundraiser',
    decision: 'merged',
    setting: 'hideOffers',
    reason: 'Fundraisers are the same commercial interruption as merch and tickets, so they share one switch.'
  },
  {
    id: 'hide_endscreen',
    label: 'Hide End Screen Feed',
    decision: 'adopted',
    setting: 'hideEndScreen',
    reason: 'The end-screen grid is what pulls you into the next video. It is a CSS hide, including while fullscreen.'
  },
  {
    id: 'hide_cards',
    label: 'Hide End Screen Cards',
    decision: 'adopted',
    setting: 'hideInfoCards',
    reason: 'Info cards paint over the video. They are hidden with CSS and are separate from the end-screen grid.'
  },
  {
    id: 'hide_shorts',
    label: 'Hide Shorts',
    decision: 'adopted',
    setting: 'hideShorts',
    reason: 'Shorts shelves and guide entries are the feed. Default off, matching Unhook, and a Shorts URL you open still plays instead of going blank.'
  },
  {
    id: 'hide_comments',
    label: 'Hide Comments',
    decision: 'adopted',
    setting: 'hideComments',
    reason: 'Comments stay visible by default because Zen scrolls to them. The switch hides them everywhere, including inside the details card, for anyone who does not want them.'
  },
  {
    id: 'hide_prof',
    label: 'Hide Profile Photos',
    decision: 'cut',
    setting: '',
    reason: 'Comment avatars are not what pulls you into the next video. A second comments switch for photos is not worth keeping.'
  },
  {
    id: 'hide_mix',
    label: 'Hide Mixes',
    decision: 'adopted',
    setting: 'hideMixes',
    reason: 'Mixes are infinite radio shelves. Default off. CSS removes the mix renderers and mix links without scanning the page.'
  },
  {
    id: 'hide_merch',
    label: 'Hide Merch, Tickets, Offers',
    decision: 'merged',
    setting: 'hideOffers',
    reason: 'Merch, tickets, and offers sit under the video as ads. They share the offers switch. The generic player drawer is left alone so playback menus still open.'
  },
  {
    id: 'hide_meta',
    label: 'Hide Video Info',
    decision: 'cut',
    setting: '',
    reason: 'Title, channel, actions, and description are the details surface Zen exists to reveal. A second set of hide switches would fight that surface.'
  },
  {
    id: 'hide_bar',
    label: 'Hide Buttons Bar',
    decision: 'cut',
    setting: '',
    reason: 'Like, share, and save are part of the details surface, not a distraction feed.'
  },
  {
    id: 'hide_channel',
    label: 'Hide Channel',
    decision: 'cut',
    setting: '',
    reason: 'The channel row is part of the details surface Zen keeps one scroll away.'
  },
  {
    id: 'hide_desc',
    label: 'Hide Description',
    decision: 'cut',
    setting: '',
    reason: 'The description is part of the details surface. Placement already decides whether it sits on the page or in a card.'
  },
  {
    id: 'hide_header',
    label: 'Hide Top Header',
    decision: 'merged',
    setting: 'hideHeader',
    reason: 'Zen already hides the masthead on watch pages and brings it back from the top edge. Hiding it on Home and Search would remove search and the account controls.'
  },
  {
    id: 'hide_notifs',
    label: 'Hide Notifications',
    decision: 'adopted',
    setting: 'hideNotifications',
    reason: 'The bell and the unread count in the tab title pull you out of the video. The bell is CSS. The count is stripped by an observer on the title element only.'
  },
  {
    id: 'hide_search',
    label: 'Hide Inapt Search Results',
    decision: 'adopted',
    setting: 'hideSearchShelves',
    reason: 'Search shelves are recommendation rows inside results. The video results stay. CSS only.'
  },
  {
    id: 'hide_trending',
    label: 'Hide Explore, Trending',
    decision: 'adopted',
    setting: 'hideTrending',
    reason: 'Trending and Explore entries and pages can be hidden. Default off. No address-bar redirect, so the extension does not need webRequest.'
  },
  {
    id: 'hide_moreyt',
    label: 'Hide More from YouTube',
    decision: 'adopted',
    setting: 'hideMoreYouTube',
    reason: 'Premium, Music, and storefront links in the guide are another door out of the video. The section is matched by those links, not by counting guide sections.'
  },
  {
    id: 'hide_subs',
    label: 'Hide Subscriptions',
    decision: 'cut',
    setting: '',
    reason: 'Subscriptions are how someone picks a video on purpose. Removing that page fights the reason they opened YouTube.'
  },
  {
    id: 'hide_autoplay',
    label: 'Disable Autoplay',
    decision: 'adopted',
    setting: 'disableAutoplay',
    reason: 'Autoplay is what starts the next video. Zen clicks the player autoplay toggle at most once per video and never opens the settings menu. Next and previous stay visible.'
  },
  {
    id: 'hide_annotations',
    label: 'Disable Annotations',
    decision: 'cut',
    setting: '',
    reason: 'YouTube removed annotations. Unhook opens the player menu and clicks the last checkbox, which can hit the wrong option and is the menu churn the lag work removed.'
  },
  {
    id: 'yt_on',
    label: 'Extension on or off',
    decision: 'cut',
    setting: '',
    reason: 'Each control already turns its own behavior off. A second master switch hides which behavior is active.'
  },
  {
    id: 'dark_mode',
    label: 'Popup dark mode',
    decision: 'cut',
    setting: '',
    reason: 'Popup theme is presentation, not a YouTube behavior. The popup redesign owns that surface.'
  },
  {
    id: 'sidebar_tree',
    label: 'Sidebar option group',
    decision: 'cut',
    setting: '',
    reason: 'This only expands a group in the Unhook popup. It does not change YouTube.'
  },
  {
    id: 'comment_tree',
    label: 'Comments option group',
    decision: 'cut',
    setting: '',
    reason: 'This only expands a group in the Unhook popup. It does not change YouTube.'
  },
  {
    id: 'meta_tree',
    label: 'Video info option group',
    decision: 'cut',
    setting: '',
    reason: 'This only expands a group in the Unhook popup. It does not change YouTube.'
  },
  {
    id: 'header_tree',
    label: 'Header option group',
    decision: 'cut',
    setting: '',
    reason: 'This only expands a group in the Unhook popup. It does not change YouTube.'
  },
  {
    id: 'surveys_promos',
    label: 'Surveys and promo bars',
    decision: 'merged',
    setting: 'hideOffers',
    reason: 'Unhook always hides mealbar, primetime, and survey dialogs. They share the offers switch so the hide stays reversible.'
  }
];

/**
 * @param {number} value
 * @returns {number}
 */
function normalizeHoverDelay(value) {
  const delay = Number(value);

  if (!Number.isFinite(delay)) {
    return storedDefaults.hoverRevealDelay;
  }

  return Math.min(1000, Math.max(0, delay));
}

/**
 * @param {YtztSettings} next
 * @returns {YtztSettings}
 */
function applyBooleanSettings(next) {
  next.autoZen = next.autoZen === true;
  next.hideLiveChat = next.hideLiveChat === true;
  next.hideHeader = next.hideHeader === true;
  next.hideRecommendations = next.hideRecommendations === true;
  next.revealHeaderOnHover = next.revealHeaderOnHover === true;
  next.revealMetaOnHover = next.revealMetaOnHover === true;
  next.revealPlaylistOnHover = next.revealPlaylistOnHover === true;
  next.drawerGlassEffect = next.drawerGlassEffect === true;
  next.shortcutEnabled = next.shortcutEnabled === true;
  next.hideHomeFeed = next.hideHomeFeed === true;
  next.hideEndScreen = next.hideEndScreen === true;
  next.hideInfoCards = next.hideInfoCards === true;
  next.hideShorts = next.hideShorts === true;
  next.hideComments = next.hideComments === true;
  next.hideMixes = next.hideMixes === true;
  next.hideNotifications = next.hideNotifications === true;
  next.hideSearchShelves = next.hideSearchShelves === true;
  next.hideTrending = next.hideTrending === true;
  next.hideMoreYouTube = next.hideMoreYouTube === true;
  next.hideOffers = next.hideOffers === true;
  next.disableAutoplay = next.disableAutoplay === true;

  return next;
}

/**
 * @param {Partial<YtztSettings>} values
 * @returns {YtztSettings}
 */
function normalizeSettings(values) {
  const next = { ...storedDefaults, ...values };
  next.detailsLocation = ['page', 'card'].includes(next.detailsLocation) ? next.detailsLocation : null;
  next.detailsSide = ['left', 'right'].includes(next.detailsSide) ? next.detailsSide : null;
  next.detailsTrigger = ['scroll', 'button', 'hover', 'scroll-hover'].includes(next.detailsTrigger) ? next.detailsTrigger : null;
  next.playlistLocation = ['page', 'card', 'hidden'].includes(next.playlistLocation) ? next.playlistLocation : null;
  next.playlistSide = ['left', 'right'].includes(next.playlistSide) ? next.playlistSide : null;
  next.playlistTrigger = ['button', 'hover'].includes(next.playlistTrigger) ? next.playlistTrigger : null;
  next.scrollBehavior = next.scrollBehavior === 'card' ? 'card' : 'page';
  next.startupMode = next.startupMode === 'theater' ? 'theater' : 'zen';
  next.zenShortcut = next.zenShortcut === 'shift-t' ? 'shift-t' : 't';
  next.sideRevealMode = next.sideRevealMode === 'hover' ? 'hover' : 'drawer';
  next.drawerImplementation = next.drawerImplementation === 'native' ? 'native' : 'custom';
  next.revealSideLayout = next.revealSideLayout === 'same' ? 'same' : 'separate';
  next.sideHoverPosition = next.sideHoverPosition === 'left' ? 'left' : 'right';
  next.sameSideSplit = next.sameSideSplit === 'details-top' ? 'details-top' : 'playlist-top';
  next.hoverRevealDelay = normalizeHoverDelay(next.hoverRevealDelay);

  return applyBooleanSettings(next);
}

/**
 * Popup controls show the effective placement when a legacy key has not been saved yet.
 * @param {Partial<YtztSettings>} values
 * @returns {YtztSettings}
 */
function normalizePopupSettings(values) {
  const next = normalizeSettings(values);
  next.detailsLocation ||= next.scrollBehavior === 'card' && next.revealMetaOnHover ? 'card' : 'page';
  next.detailsSide ||= next.sideHoverPosition;
  next.detailsTrigger ||= next.sideRevealMode === 'hover' ? 'scroll-hover' : 'scroll';
  next.playlistLocation ||= !next.revealPlaylistOnHover ? 'hidden' : next.drawerImplementation === 'native' ? 'page' : 'card';
  next.playlistSide ||= next.revealSideLayout === 'same' ? next.sideHoverPosition : next.sideHoverPosition === 'left' ? 'right' : 'left';
  next.playlistTrigger ||= next.sideRevealMode === 'hover' ? 'hover' : 'button';

  return next;
}

/** @type {YtztSettingsApi} */
const settingsApi = {
  defaultSettings: storedDefaults,
  distractionFilters: DISTRACTION_FILTERS,
  unhookFeatures: UNHOOK_FEATURES,
  normalizeSettings,
  normalizePopupSettings
};

globalThis.YTZTSettings = settingsApi;
})();
