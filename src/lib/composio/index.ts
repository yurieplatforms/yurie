// Core client
export {
  getComposioClient,
  getComposioAnthropicClient,
  isComposioAvailable,
  COMPOSIO_DEFAULT_USER_ID,
} from './client'

// GitHub tools
export {
  // Availability check
  isGitHubToolsAvailable,

  // Context management
  setGitHubToolContext,
  getGitHubToolContext,
  findGitHubConnectionId,

  // Repository operations
  getRepository,
  getReadme,
  getFileContent,
  listBranches,
  listReleases,
  getLatestRelease,
  listContributors,
  getLanguages,
  getRepoTree,

  // Issues
  listIssues,
  getIssue,
  createIssue,
  updateIssue,
  createIssueComment,
  listIssueComments,
  addLabels,

  // Pull requests
  listPullRequests,
  getPullRequest,
  createPullRequest,
  mergePullRequest,
  createPRReview,
  listPullRequestFiles,
  listPullRequestCommits,
  getPullRequestDiff,

  // Commits
  listCommits,
  getCommit,

  // Search
  searchRepositories,
  searchIssues,
  searchCode,

  // Users
  getUser,
  listUserRepos,
  getAuthenticatedUser,

  // Repository Actions
  starRepository,
  unstarRepository,
  forkRepository,
  watchRepository,

  // Workflows / CI
  listWorkflows,
  listWorkflowRuns,
  triggerWorkflow,

  // Anthropic integration
  getGitHubToolsForAnthropic,
  handleGitHubToolCalls,

  // Formatters
  formatRepoForLLM,
  formatIssuesForLLM,
  formatPRsForLLM,
  formatCommitsForLLM,
} from './github'

// GitHub Types
export type {
  GitHubRepoInfo,
  GitHubIssueParams,
  GitHubPRParams,
  GitHubCommitParams,
  GitHubSearchParams,
  GitHubFileParams,
  GitHubToolContext,
  CreateIssueParams,
  CreateIssueCommentParams,
  CreatePullRequestParams,
  UpdateIssueParams,
  MergePullRequestParams,
  AddLabelsParams,
  CreatePRReviewParams,
} from './github'

// Spotify tools
export {
  // Availability check
  isSpotifyToolsAvailable,

  // Context management
  setSpotifyToolContext,
  getSpotifyToolContext,
  findSpotifyConnectionId,

  // Playback controls (Requires Premium)
  getPlaybackState,
  getCurrentlyPlayingTrack,
  startPlayback,
  pausePlayback,
  skipToNext,
  skipToPrevious,
  seekToPosition,
  setVolume,
  setRepeatMode,
  toggleShuffle,
  transferPlayback,
  getAvailableDevices,

  // Queue
  getQueue,
  addToQueue,

  // Search
  search,

  // Tracks
  getTrack,
  getTrackAudioFeatures,
  getSeveralTracks,

  // Albums
  getAlbum,
  getAlbumTracks,
  getSeveralAlbums,
  getNewReleases,

  // Artists
  getArtist,
  getArtistTopTracks,
  getArtistAlbums,
  getRelatedArtists,
  getSeveralArtists,

  // Playlists
  getPlaylist,
  getPlaylistTracks,
  createPlaylist,
  addTracksToPlaylist,
  removeTracksFromPlaylist,
  updatePlaylistDetails,
  updatePlaylistItems,
  getCurrentUserPlaylists,
  getUserPlaylists,
  getFeaturedPlaylists,
  getCategoryPlaylists,
  followPlaylist,
  unfollowPlaylist,

  // User profile & library
  getCurrentUserProfile,
  getUserProfile,
  getSavedTracks,
  saveTracks,
  removeSavedTracks,
  checkSavedTracks,
  getSavedAlbums,
  saveAlbums,
  removeSavedAlbums,
  getTopArtists,
  getTopTracks,
  getFollowedArtists,
  followArtistsOrUsers,
  unfollowArtistsOrUsers,
  checkFollowing,
  getRecentlyPlayed,

  // Browse/Discovery
  getAvailableGenres,
  getBrowseCategories,
  getBrowseCategory,
  getRecommendations,

  // Anthropic integration
  getSpotifyToolsForAnthropic,
  handleSpotifyToolCalls,

  // Formatters
  formatTrackForLLM,
  formatAlbumForLLM,
  formatArtistForLLM,
  formatPlaylistForLLM,
  formatPlaybackForLLM,
  formatSearchResultsForLLM,
} from './spotify'

// Spotify Types
export type {
  SpotifyToolContext,
  PlaybackParams,
  StartPlaybackParams,
  SeekParams,
  VolumeParams,
  RepeatParams,
  ShuffleParams,
  TransferPlaybackParams,
  SpotifySearchParams,
  CreatePlaylistParams,
  AddTracksToPlaylistParams,
  RemoveTracksFromPlaylistParams,
  UpdatePlaylistParams,
  UpdatePlaylistItemsParams,
  SaveTracksParams,
  SaveAlbumsParams,
  FollowParams,
  AddToQueueParams,
} from './spotify'
