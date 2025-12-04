/**
 * Spotify Tools via Composio
 *
 * Provides Spotify playback control and music discovery tools using Composio's Spotify toolkit.
 * These tools allow the AI agent to control playback, search music, manage playlists, etc.
 *
 * NOTE: Most playback controls require Spotify Premium.
 *
 * @see https://docs.composio.dev/toolkits/spotify
 */

import { Composio } from '@composio/core'
import { AnthropicProvider } from '@composio/anthropic'
import { env } from '@/lib/config/env'

// ============================================================================
// Types
// ============================================================================

/**
 * Output type for Composio tool execution results.
 */
export interface ComposioToolOutput {
  successful: boolean
  data?: unknown
  error?: string | null
  logId?: string
  sessionInfo?: unknown
}

export interface SpotifyToolContext {
  userId: string
  connectedAccountId?: string
}

// Playback types
export interface PlaybackParams {
  device_id?: string
}

export interface StartPlaybackParams extends PlaybackParams {
  context_uri?: string // Album, artist, or playlist URI
  uris?: string[] // Track URIs to play
  offset?: { position?: number; uri?: string }
  position_ms?: number
}

export interface SeekParams extends PlaybackParams {
  position_ms: number
}

export interface VolumeParams extends PlaybackParams {
  volume_percent: number
}

export interface RepeatParams extends PlaybackParams {
  state: 'track' | 'context' | 'off'
}

export interface ShuffleParams extends PlaybackParams {
  state: boolean
}

export interface TransferPlaybackParams {
  device_ids: string[]
  play?: boolean
}

// Search types
export interface SpotifySearchParams {
  q: string
  type: ('album' | 'artist' | 'playlist' | 'track' | 'show' | 'episode' | 'audiobook')[]
  market?: string
  limit?: number
  offset?: number
}

// Playlist types
export interface CreatePlaylistParams {
  user_id: string
  name: string
  description?: string
  public?: boolean
}

export interface AddTracksToPlaylistParams {
  playlist_id: string
  uris: string[]
  position?: number
}

export interface RemoveTracksFromPlaylistParams {
  playlist_id: string
  uris: string[]
}

export interface UpdatePlaylistParams {
  playlist_id: string
  name?: string
  description?: string
  public?: boolean
}

export interface UpdatePlaylistItemsParams {
  playlist_id: string
  range_start?: number
  insert_before?: number
  range_length?: number
  snapshot_id?: string
  uris?: string[]
}

// Library types
export interface SaveTracksParams {
  ids: string[]
}

export interface SaveAlbumsParams {
  ids: string[]
}

export interface FollowParams {
  type: 'artist' | 'user'
  ids: string[]
}

// Queue types
export interface AddToQueueParams {
  uri: string
  device_id?: string
}

// ============================================================================
// Composio Client with Anthropic Provider
// ============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let composioWithAnthropic: Composio<any> | null = null

/**
 * Get Composio client configured with Anthropic provider for Spotify tools.
 * Returns null if COMPOSIO_API_KEY is not configured.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getComposioAnthropicClient(): Composio<any> | null {
  if (!env.COMPOSIO_API_KEY) {
    return null
  }

  if (!composioWithAnthropic) {
    composioWithAnthropic = new Composio({
      apiKey: env.COMPOSIO_API_KEY,
      provider: new AnthropicProvider(),
    })
  }

  return composioWithAnthropic
}

/**
 * Check if Spotify tools are available (Composio API key is configured)
 */
export function isSpotifyToolsAvailable(): boolean {
  return Boolean(env.COMPOSIO_API_KEY)
}

// ============================================================================
// Tool Execution Helpers
// ============================================================================

/**
 * Default user ID for Composio operations.
 * In a real app, this would be the authenticated user's ID.
 */
const DEFAULT_USER_ID = 'default'

// Store the current tool context (set per request)
let currentToolContext: SpotifyToolContext = { userId: DEFAULT_USER_ID }

/**
 * Set the context for Spotify tool execution (user ID and connected account).
 * Call this before executing Spotify tools.
 */
export function setSpotifyToolContext(context: SpotifyToolContext): void {
  currentToolContext = context
}

/**
 * Get the current tool context.
 */
export function getSpotifyToolContext(): SpotifyToolContext {
  return currentToolContext
}

/**
 * Find the user's Spotify connected account ID.
 */
export async function findSpotifyConnectionId(userId: string): Promise<string | undefined> {
  const composio = getComposioAnthropicClient()
  if (!composio) return undefined

  try {
    const connections = await composio.connectedAccounts.list({
      userIds: [userId],
      statuses: ['ACTIVE'],
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const spotifyConnection = connections.items?.find((conn: any) => {
      const connToolkitSlug = conn.toolkit?.slug || conn.appName?.toLowerCase() || ''
      return connToolkitSlug === 'spotify'
    })

    return spotifyConnection?.id
  } catch (error) {
    console.error('[Composio] Failed to find Spotify connection:', error)
    return undefined
  }
}

/**
 * Execute a Composio Spotify tool and return the result.
 * Uses dangerouslySkipVersionCheck to bypass version requirements.
 */
async function executeSpotifyTool(
  toolSlug: string,
  args: Record<string, unknown>
): Promise<ComposioToolOutput> {
  const composio = getComposioAnthropicClient()
  if (!composio) {
    return {
      successful: false,
      error: 'Composio is not configured. Please set COMPOSIO_API_KEY.',
    }
  }

  const context = getSpotifyToolContext()

  // Check if user has Spotify connected
  if (!context.connectedAccountId) {
    console.log(`[Spotify Tool] No Spotify connection found for user ${context.userId}`)
    return {
      successful: false,
      error: 'Spotify is not connected. Please connect your Spotify account in settings.',
    }
  }

  console.log(`[Spotify Tool] Executing ${toolSlug} for user ${context.userId}`)
  console.log(`[Spotify Tool] Using connection: ${context.connectedAccountId}`)
  console.log(`[Spotify Tool] Args:`, JSON.stringify(args, null, 2))

  try {
    const result = await composio.tools.execute(toolSlug, {
      userId: context.userId,
      arguments: args,
      connectedAccountId: context.connectedAccountId,
      dangerouslySkipVersionCheck: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    console.log(`[Spotify Tool] ${toolSlug} result: successful=${result.successful}`)
    
    if (!result.successful && result.error) {
      // Parse common Spotify errors and provide user-friendly messages
      const errorMsg = result.error.toLowerCase()
      if (errorMsg.includes('premium') || errorMsg.includes('403')) {
        return {
          ...result,
          error: 'This feature requires Spotify Premium. Please upgrade your account.',
        }
      }
      if (errorMsg.includes('no active device') || errorMsg.includes('no device')) {
        return {
          ...result,
          error: 'No active Spotify device found. Please open Spotify on a device first.',
        }
      }
      if (errorMsg.includes('not found') || errorMsg.includes('404')) {
        return {
          ...result,
          error: 'The requested item was not found on Spotify.',
        }
      }
      if (errorMsg.includes('expired') || errorMsg.includes('unauthorized') || errorMsg.includes('401')) {
        return {
          ...result,
          error: 'Spotify session expired. Please reconnect your Spotify account in settings.',
        }
      }
    }
    
    return result
  } catch (error) {
    console.error(`[Spotify Tool] ${toolSlug} error:`, error)
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    
    // Parse common error types
    if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('network')) {
      return {
        successful: false,
        error: 'Network error. Please check your internet connection.',
      }
    }
    
    return {
      successful: false,
      error: `Spotify API error: ${errorMessage}`,
    }
  }
}

// ============================================================================
// Playback Control Tools (Requires Spotify Premium)
// ============================================================================

/**
 * Get information about the user's current playback state.
 *
 * @example
 * const playback = await getPlaybackState()
 */
export async function getPlaybackState(): Promise<ComposioToolOutput> {
  return executeSpotifyTool('SPOTIFY_GET_PLAYBACK_STATE', {})
}

/**
 * Get the currently playing track.
 *
 * @example
 * const track = await getCurrentlyPlayingTrack()
 */
export async function getCurrentlyPlayingTrack(): Promise<ComposioToolOutput> {
  return executeSpotifyTool('SPOTIFY_GET_CURRENTLY_PLAYING_TRACK', {})
}

/**
 * Start or resume playback on the user's active device.
 * Requires Spotify Premium.
 *
 * @example
 * // Resume playback
 * await startPlayback({})
 *
 * // Play a specific album
 * await startPlayback({ context_uri: 'spotify:album:5ht7ItJgpBH7W6vJ5BqpPr' })
 *
 * // Play specific tracks
 * await startPlayback({ uris: ['spotify:track:4iV5W9uYEdYUVa79Axb7Rh'] })
 */
export async function startPlayback(params: StartPlaybackParams = {}): Promise<ComposioToolOutput> {
  return executeSpotifyTool('SPOTIFY_START_RESUME_PLAYBACK', {
    ...(params.device_id && { device_id: params.device_id }),
    ...(params.context_uri && { context_uri: params.context_uri }),
    ...(params.uris && { uris: params.uris }),
    ...(params.offset && { offset: params.offset }),
    ...(params.position_ms !== undefined && { position_ms: params.position_ms }),
  })
}

/**
 * Pause playback on the user's active device.
 * Requires Spotify Premium.
 *
 * @example
 * await pausePlayback()
 */
export async function pausePlayback(params: PlaybackParams = {}): Promise<ComposioToolOutput> {
  return executeSpotifyTool('SPOTIFY_PAUSE_PLAYBACK', {
    ...(params.device_id && { device_id: params.device_id }),
  })
}

/**
 * Skip to the next track.
 * Requires Spotify Premium.
 *
 * @example
 * await skipToNext()
 */
export async function skipToNext(params: PlaybackParams = {}): Promise<ComposioToolOutput> {
  return executeSpotifyTool('SPOTIFY_SKIP_TO_NEXT', {
    ...(params.device_id && { device_id: params.device_id }),
  })
}

/**
 * Skip to the previous track.
 * Requires Spotify Premium.
 *
 * @example
 * await skipToPrevious()
 */
export async function skipToPrevious(params: PlaybackParams = {}): Promise<ComposioToolOutput> {
  return executeSpotifyTool('SPOTIFY_SKIP_TO_PREVIOUS', {
    ...(params.device_id && { device_id: params.device_id }),
  })
}

/**
 * Seek to a position in the currently playing track.
 * Requires Spotify Premium.
 *
 * @example
 * // Seek to 30 seconds
 * await seekToPosition({ position_ms: 30000 })
 */
export async function seekToPosition(params: SeekParams): Promise<ComposioToolOutput> {
  return executeSpotifyTool('SPOTIFY_SEEK_TO_POSITION', {
    position_ms: params.position_ms,
    ...(params.device_id && { device_id: params.device_id }),
  })
}

/**
 * Set the volume for the user's current playback device.
 * Requires Spotify Premium.
 *
 * @example
 * await setVolume({ volume_percent: 50 })
 */
export async function setVolume(params: VolumeParams): Promise<ComposioToolOutput> {
  return executeSpotifyTool('SPOTIFY_SET_PLAYBACK_VOLUME', {
    volume_percent: params.volume_percent,
    ...(params.device_id && { device_id: params.device_id }),
  })
}

/**
 * Set the repeat mode for playback.
 * Requires Spotify Premium.
 *
 * @example
 * await setRepeatMode({ state: 'track' }) // Repeat current track
 * await setRepeatMode({ state: 'context' }) // Repeat playlist/album
 * await setRepeatMode({ state: 'off' }) // Turn off repeat
 */
export async function setRepeatMode(params: RepeatParams): Promise<ComposioToolOutput> {
  return executeSpotifyTool('SPOTIFY_SET_REPEAT_MODE', {
    state: params.state,
    ...(params.device_id && { device_id: params.device_id }),
  })
}

/**
 * Toggle shuffle on or off.
 * Requires Spotify Premium.
 *
 * @example
 * await toggleShuffle({ state: true })
 */
export async function toggleShuffle(params: ShuffleParams): Promise<ComposioToolOutput> {
  return executeSpotifyTool('SPOTIFY_TOGGLE_PLAYBACK_SHUFFLE', {
    state: params.state,
    ...(params.device_id && { device_id: params.device_id }),
  })
}

/**
 * Transfer playback to a different device.
 * Requires Spotify Premium.
 *
 * @example
 * await transferPlayback({ device_ids: ['device_id_here'], play: true })
 */
export async function transferPlayback(params: TransferPlaybackParams): Promise<ComposioToolOutput> {
  return executeSpotifyTool('SPOTIFY_TRANSFER_PLAYBACK', {
    device_ids: params.device_ids,
    ...(params.play !== undefined && { play: params.play }),
  })
}

/**
 * Get available playback devices.
 *
 * @example
 * const devices = await getAvailableDevices()
 */
export async function getAvailableDevices(): Promise<ComposioToolOutput> {
  return executeSpotifyTool('SPOTIFY_GET_AVAILABLE_DEVICES', {})
}

// ============================================================================
// Queue Tools
// ============================================================================

/**
 * Get the user's playback queue.
 *
 * @example
 * const queue = await getQueue()
 */
export async function getQueue(): Promise<ComposioToolOutput> {
  return executeSpotifyTool('SPOTIFY_GET_THE_USER_S_QUEUE', {})
}

/**
 * Add an item to the user's playback queue.
 * Requires Spotify Premium.
 *
 * @example
 * await addToQueue({ uri: 'spotify:track:4iV5W9uYEdYUVa79Axb7Rh' })
 */
export async function addToQueue(params: AddToQueueParams): Promise<ComposioToolOutput> {
  return executeSpotifyTool('SPOTIFY_ADD_ITEM_TO_PLAYBACK_QUEUE', {
    uri: params.uri,
    ...(params.device_id && { device_id: params.device_id }),
  })
}

// ============================================================================
// Search Tools
// ============================================================================

/**
 * Search for tracks, albums, artists, playlists, shows, or episodes.
 *
 * @example
 * const results = await search({ q: 'Taylor Swift', type: ['track', 'artist'] })
 */
export async function search(params: SpotifySearchParams): Promise<ComposioToolOutput> {
  return executeSpotifyTool('SPOTIFY_SEARCH_FOR_ITEM', {
    q: params.q,
    type: params.type, // API expects array, not comma-separated string
    ...(params.market && { market: params.market }),
    ...(params.limit && { limit: params.limit }),
    ...(params.offset && { offset: params.offset }),
  })
}

// ============================================================================
// Track Tools
// ============================================================================

/**
 * Get details of a track.
 *
 * @example
 * const track = await getTrack('4iV5W9uYEdYUVa79Axb7Rh')
 */
export async function getTrack(trackId: string): Promise<ComposioToolOutput> {
  return executeSpotifyTool('SPOTIFY_GET_TRACK', {
    id: trackId,
  })
}

/**
 * Get audio features for a track (tempo, key, danceability, etc.).
 *
 * @example
 * const features = await getTrackAudioFeatures('4iV5W9uYEdYUVa79Axb7Rh')
 */
export async function getTrackAudioFeatures(trackId: string): Promise<ComposioToolOutput> {
  return executeSpotifyTool('SPOTIFY_GET_TRACK_S_AUDIO_FEATURES', {
    id: trackId,
  })
}

/**
 * Get multiple tracks.
 *
 * @example
 * const tracks = await getSeveralTracks(['4iV5W9uYEdYUVa79Axb7Rh', '1301WleyT98MSxVHPZCA6M'])
 */
export async function getSeveralTracks(trackIds: string[]): Promise<ComposioToolOutput> {
  return executeSpotifyTool('SPOTIFY_GET_SEVERAL_TRACKS', {
    ids: trackIds.join(','),
  })
}

// ============================================================================
// Album Tools
// ============================================================================

/**
 * Get details of an album.
 *
 * @example
 * const album = await getAlbum('5ht7ItJgpBH7W6vJ5BqpPr')
 */
export async function getAlbum(albumId: string): Promise<ComposioToolOutput> {
  return executeSpotifyTool('SPOTIFY_GET_ALBUM', {
    id: albumId,
  })
}

/**
 * Get tracks from an album.
 *
 * @example
 * const tracks = await getAlbumTracks('5ht7ItJgpBH7W6vJ5BqpPr')
 */
export async function getAlbumTracks(
  albumId: string,
  options?: { limit?: number; offset?: number }
): Promise<ComposioToolOutput> {
  return executeSpotifyTool('SPOTIFY_GET_ALBUM_TRACKS', {
    id: albumId,
    ...(options?.limit && { limit: options.limit }),
    ...(options?.offset && { offset: options.offset }),
  })
}

/**
 * Get multiple albums.
 *
 * @example
 * const albums = await getSeveralAlbums(['5ht7ItJgpBH7W6vJ5BqpPr', '2noRn2Aes5aoNVsU6iWThc'])
 */
export async function getSeveralAlbums(albumIds: string[]): Promise<ComposioToolOutput> {
  return executeSpotifyTool('SPOTIFY_GET_SEVERAL_ALBUMS', {
    ids: albumIds.join(','),
  })
}

/**
 * Get new album releases.
 *
 * @example
 * const releases = await getNewReleases({ limit: 20 })
 */
export async function getNewReleases(options?: {
  country?: string
  limit?: number
  offset?: number
}): Promise<ComposioToolOutput> {
  return executeSpotifyTool('SPOTIFY_GET_NEW_RELEASES', {
    ...(options?.country && { country: options.country }),
    ...(options?.limit && { limit: options.limit }),
    ...(options?.offset && { offset: options.offset }),
  })
}

// ============================================================================
// Artist Tools
// ============================================================================

/**
 * Get details of an artist.
 *
 * @example
 * const artist = await getArtist('0OdUWJ0sBjDrqHygGUXeCF')
 */
export async function getArtist(artistId: string): Promise<ComposioToolOutput> {
  return executeSpotifyTool('SPOTIFY_GET_ARTIST', {
    id: artistId,
  })
}

/**
 * Get an artist's top tracks.
 *
 * @example
 * const topTracks = await getArtistTopTracks('0OdUWJ0sBjDrqHygGUXeCF', 'US')
 */
export async function getArtistTopTracks(
  artistId: string,
  market: string
): Promise<ComposioToolOutput> {
  return executeSpotifyTool('SPOTIFY_GET_ARTIST_S_TOP_TRACKS', {
    id: artistId,
    market,
  })
}

/**
 * Get an artist's albums.
 *
 * @example
 * const albums = await getArtistAlbums('0OdUWJ0sBjDrqHygGUXeCF')
 */
export async function getArtistAlbums(
  artistId: string,
  options?: { include_groups?: string; limit?: number; offset?: number }
): Promise<ComposioToolOutput> {
  return executeSpotifyTool('SPOTIFY_GET_ARTIST_S_ALBUMS', {
    id: artistId,
    ...(options?.include_groups && { include_groups: options.include_groups }),
    ...(options?.limit && { limit: options.limit }),
    ...(options?.offset && { offset: options.offset }),
  })
}

/**
 * Get artists related to an artist.
 *
 * @example
 * const related = await getRelatedArtists('0OdUWJ0sBjDrqHygGUXeCF')
 */
export async function getRelatedArtists(artistId: string): Promise<ComposioToolOutput> {
  return executeSpotifyTool('SPOTIFY_GET_ARTIST_S_RELATED_ARTISTS', {
    id: artistId,
  })
}

/**
 * Get multiple artists.
 *
 * @example
 * const artists = await getSeveralArtists(['0OdUWJ0sBjDrqHygGUXeCF', '6M2wZ9GZgrQXHCFfjv46we'])
 */
export async function getSeveralArtists(artistIds: string[]): Promise<ComposioToolOutput> {
  return executeSpotifyTool('SPOTIFY_GET_SEVERAL_ARTISTS', {
    ids: artistIds.join(','),
  })
}

// ============================================================================
// Playlist Tools
// ============================================================================

/**
 * Get details of a playlist.
 *
 * @example
 * const playlist = await getPlaylist('3cEYpjA9oz9GiPac4AsH4n')
 */
export async function getPlaylist(playlistId: string): Promise<ComposioToolOutput> {
  return executeSpotifyTool('SPOTIFY_GET_PLAYLIST', {
    playlist_id: playlistId,
  })
}

/**
 * Get tracks from a playlist.
 *
 * @example
 * const tracks = await getPlaylistTracks('3cEYpjA9oz9GiPac4AsH4n')
 */
export async function getPlaylistTracks(
  playlistId: string,
  options?: { limit?: number; offset?: number }
): Promise<ComposioToolOutput> {
  return executeSpotifyTool('SPOTIFY_GET_PLAYLIST_ITEMS', {
    playlist_id: playlistId,
    ...(options?.limit && { limit: options.limit }),
    ...(options?.offset && { offset: options.offset }),
  })
}

/**
 * Create a playlist for a user.
 *
 * @example
 * const playlist = await createPlaylist({
 *   user_id: 'user123',
 *   name: 'My New Playlist',
 *   description: 'A collection of great songs',
 *   public: false
 * })
 */
export async function createPlaylist(params: CreatePlaylistParams): Promise<ComposioToolOutput> {
  return executeSpotifyTool('SPOTIFY_CREATE_PLAYLIST', {
    user_id: params.user_id,
    name: params.name,
    ...(params.description && { description: params.description }),
    ...(params.public !== undefined && { public: params.public }),
  })
}

/**
 * Add tracks to a playlist.
 *
 * @example
 * await addTracksToPlaylist({
 *   playlist_id: '3cEYpjA9oz9GiPac4AsH4n',
 *   uris: ['spotify:track:4iV5W9uYEdYUVa79Axb7Rh']
 * })
 */
export async function addTracksToPlaylist(
  params: AddTracksToPlaylistParams
): Promise<ComposioToolOutput> {
  return executeSpotifyTool('SPOTIFY_ADD_ITEMS_TO_PLAYLIST', {
    playlist_id: params.playlist_id,
    uris: params.uris,
    ...(params.position !== undefined && { position: params.position }),
  })
}

/**
 * Remove tracks from a playlist.
 *
 * @example
 * await removeTracksFromPlaylist({
 *   playlist_id: '3cEYpjA9oz9GiPac4AsH4n',
 *   uris: ['spotify:track:4iV5W9uYEdYUVa79Axb7Rh']
 * })
 */
export async function removeTracksFromPlaylist(
  params: RemoveTracksFromPlaylistParams
): Promise<ComposioToolOutput> {
  return executeSpotifyTool('SPOTIFY_REMOVE_PLAYLIST_ITEMS', {
    playlist_id: params.playlist_id,
    tracks: params.uris.map((uri) => ({ uri })),
  })
}

/**
 * Update playlist details (name, description, public status).
 *
 * @example
 * await updatePlaylistDetails({
 *   playlist_id: '3cEYpjA9oz9GiPac4AsH4n',
 *   name: 'Updated Playlist Name'
 * })
 */
export async function updatePlaylistDetails(
  params: UpdatePlaylistParams
): Promise<ComposioToolOutput> {
  return executeSpotifyTool('SPOTIFY_CHANGE_PLAYLIST_DETAILS', {
    playlist_id: params.playlist_id,
    ...(params.name && { name: params.name }),
    ...(params.description && { description: params.description }),
    ...(params.public !== undefined && { public: params.public }),
  })
}

/**
 * Reorder or replace playlist items.
 *
 * @example
 * // Reorder items
 * await updatePlaylistItems({
 *   playlist_id: '3cEYpjA9oz9GiPac4AsH4n',
 *   range_start: 0,
 *   insert_before: 5,
 *   range_length: 2
 * })
 *
 * // Replace all items
 * await updatePlaylistItems({
 *   playlist_id: '3cEYpjA9oz9GiPac4AsH4n',
 *   uris: ['spotify:track:4iV5W9uYEdYUVa79Axb7Rh']
 * })
 */
export async function updatePlaylistItems(
  params: UpdatePlaylistItemsParams
): Promise<ComposioToolOutput> {
  return executeSpotifyTool('SPOTIFY_UPDATE_PLAYLIST_ITEMS', {
    playlist_id: params.playlist_id,
    ...(params.range_start !== undefined && { range_start: params.range_start }),
    ...(params.insert_before !== undefined && { insert_before: params.insert_before }),
    ...(params.range_length !== undefined && { range_length: params.range_length }),
    ...(params.snapshot_id && { snapshot_id: params.snapshot_id }),
    ...(params.uris && { uris: params.uris }),
  })
}

/**
 * Get the current user's playlists.
 *
 * @example
 * const playlists = await getCurrentUserPlaylists()
 */
export async function getCurrentUserPlaylists(options?: {
  limit?: number
  offset?: number
}): Promise<ComposioToolOutput> {
  return executeSpotifyTool('SPOTIFY_GET_CURRENT_USER_S_PLAYLISTS', {
    ...(options?.limit && { limit: options.limit }),
    ...(options?.offset && { offset: options.offset }),
  })
}

/**
 * Get a user's playlists.
 *
 * @example
 * const playlists = await getUserPlaylists('user123')
 */
export async function getUserPlaylists(
  userId: string,
  options?: { limit?: number; offset?: number }
): Promise<ComposioToolOutput> {
  return executeSpotifyTool('SPOTIFY_GET_USER_S_PLAYLISTS', {
    user_id: userId,
    ...(options?.limit && { limit: options.limit }),
    ...(options?.offset && { offset: options.offset }),
  })
}

/**
 * Get featured playlists.
 *
 * @example
 * const featured = await getFeaturedPlaylists()
 */
export async function getFeaturedPlaylists(options?: {
  country?: string
  locale?: string
  timestamp?: string
  limit?: number
  offset?: number
}): Promise<ComposioToolOutput> {
  return executeSpotifyTool('SPOTIFY_GET_FEATURED_PLAYLISTS', {
    ...(options?.country && { country: options.country }),
    ...(options?.locale && { locale: options.locale }),
    ...(options?.timestamp && { timestamp: options.timestamp }),
    ...(options?.limit && { limit: options.limit }),
    ...(options?.offset && { offset: options.offset }),
  })
}

/**
 * Get playlists for a category.
 *
 * @example
 * const playlists = await getCategoryPlaylists('party')
 */
export async function getCategoryPlaylists(
  categoryId: string,
  options?: { country?: string; limit?: number; offset?: number }
): Promise<ComposioToolOutput> {
  return executeSpotifyTool('SPOTIFY_GET_CATEGORY_S_PLAYLISTS', {
    category_id: categoryId,
    ...(options?.country && { country: options.country }),
    ...(options?.limit && { limit: options.limit }),
    ...(options?.offset && { offset: options.offset }),
  })
}

/**
 * Follow a playlist.
 *
 * @example
 * await followPlaylist('3cEYpjA9oz9GiPac4AsH4n')
 */
export async function followPlaylist(
  playlistId: string,
  publicFollow?: boolean
): Promise<ComposioToolOutput> {
  return executeSpotifyTool('SPOTIFY_FOLLOW_PLAYLIST', {
    playlist_id: playlistId,
    ...(publicFollow !== undefined && { public: publicFollow }),
  })
}

/**
 * Unfollow a playlist.
 *
 * @example
 * await unfollowPlaylist('3cEYpjA9oz9GiPac4AsH4n')
 */
export async function unfollowPlaylist(playlistId: string): Promise<ComposioToolOutput> {
  return executeSpotifyTool('SPOTIFY_UNFOLLOW_PLAYLIST', {
    playlist_id: playlistId,
  })
}

// ============================================================================
// User Profile & Library Tools
// ============================================================================

/**
 * Get the current user's profile.
 *
 * @example
 * const profile = await getCurrentUserProfile()
 */
export async function getCurrentUserProfile(): Promise<ComposioToolOutput> {
  return executeSpotifyTool('SPOTIFY_GET_CURRENT_USER_S_PROFILE', {})
}

/**
 * Get a user's profile.
 *
 * @example
 * const profile = await getUserProfile('user123')
 */
export async function getUserProfile(userId: string): Promise<ComposioToolOutput> {
  return executeSpotifyTool('SPOTIFY_GET_USER_S_PROFILE', {
    user_id: userId,
  })
}

/**
 * Get the current user's saved tracks.
 *
 * @example
 * const tracks = await getSavedTracks()
 */
export async function getSavedTracks(options?: {
  limit?: number
  offset?: number
}): Promise<ComposioToolOutput> {
  return executeSpotifyTool('SPOTIFY_GET_USER_S_SAVED_TRACKS', {
    ...(options?.limit && { limit: options.limit }),
    ...(options?.offset && { offset: options.offset }),
  })
}

/**
 * Save tracks to the current user's library.
 *
 * @example
 * await saveTracks({ ids: ['4iV5W9uYEdYUVa79Axb7Rh'] })
 */
export async function saveTracks(params: SaveTracksParams): Promise<ComposioToolOutput> {
  return executeSpotifyTool('SPOTIFY_SAVE_TRACKS_FOR_CURRENT_USER', {
    ids: params.ids,
  })
}

/**
 * Remove tracks from the current user's library.
 *
 * @example
 * await removeSavedTracks({ ids: ['4iV5W9uYEdYUVa79Axb7Rh'] })
 */
export async function removeSavedTracks(params: SaveTracksParams): Promise<ComposioToolOutput> {
  return executeSpotifyTool('SPOTIFY_REMOVE_USER_S_SAVED_TRACKS', {
    ids: params.ids,
  })
}

/**
 * Check if tracks are in the user's library.
 *
 * @example
 * const checks = await checkSavedTracks(['4iV5W9uYEdYUVa79Axb7Rh'])
 */
export async function checkSavedTracks(trackIds: string[]): Promise<ComposioToolOutput> {
  return executeSpotifyTool('SPOTIFY_CHECK_USER_S_SAVED_TRACKS', {
    ids: trackIds.join(','),
  })
}

/**
 * Get the current user's saved albums.
 *
 * @example
 * const albums = await getSavedAlbums()
 */
export async function getSavedAlbums(options?: {
  limit?: number
  offset?: number
}): Promise<ComposioToolOutput> {
  return executeSpotifyTool('SPOTIFY_GET_USER_S_SAVED_ALBUMS', {
    ...(options?.limit && { limit: options.limit }),
    ...(options?.offset && { offset: options.offset }),
  })
}

/**
 * Save albums to the current user's library.
 *
 * @example
 * await saveAlbums({ ids: ['5ht7ItJgpBH7W6vJ5BqpPr'] })
 */
export async function saveAlbums(params: SaveAlbumsParams): Promise<ComposioToolOutput> {
  return executeSpotifyTool('SPOTIFY_SAVE_ALBUMS_FOR_CURRENT_USER', {
    ids: params.ids,
  })
}

/**
 * Remove albums from the current user's library.
 *
 * @example
 * await removeSavedAlbums({ ids: ['5ht7ItJgpBH7W6vJ5BqpPr'] })
 */
export async function removeSavedAlbums(params: SaveAlbumsParams): Promise<ComposioToolOutput> {
  return executeSpotifyTool('SPOTIFY_REMOVE_USERS_SAVED_ALBUMS', {
    ids: params.ids,
  })
}

/**
 * Get the current user's top artists.
 *
 * @example
 * const artists = await getTopArtists({ time_range: 'medium_term', limit: 20 })
 */
export async function getTopArtists(options?: {
  time_range?: 'short_term' | 'medium_term' | 'long_term'
  limit?: number
  offset?: number
}): Promise<ComposioToolOutput> {
  return executeSpotifyTool('SPOTIFY_GET_USER_S_TOP_ARTISTS', {
    ...(options?.time_range && { time_range: options.time_range }),
    ...(options?.limit && { limit: options.limit }),
    ...(options?.offset && { offset: options.offset }),
  })
}

/**
 * Get the current user's top tracks.
 *
 * @example
 * const tracks = await getTopTracks({ time_range: 'short_term', limit: 50 })
 */
export async function getTopTracks(options?: {
  time_range?: 'short_term' | 'medium_term' | 'long_term'
  limit?: number
  offset?: number
}): Promise<ComposioToolOutput> {
  return executeSpotifyTool('SPOTIFY_GET_USER_S_TOP_TRACKS', {
    ...(options?.time_range && { time_range: options.time_range }),
    ...(options?.limit && { limit: options.limit }),
    ...(options?.offset && { offset: options.offset }),
  })
}

/**
 * Get the current user's followed artists.
 *
 * @example
 * const artists = await getFollowedArtists()
 */
export async function getFollowedArtists(options?: {
  limit?: number
  after?: string
}): Promise<ComposioToolOutput> {
  return executeSpotifyTool('SPOTIFY_GET_FOLLOWED_ARTISTS', {
    type: 'artist',
    ...(options?.limit && { limit: options.limit }),
    ...(options?.after && { after: options.after }),
  })
}

/**
 * Follow artists or users.
 *
 * @example
 * await followArtistsOrUsers({ type: 'artist', ids: ['0OdUWJ0sBjDrqHygGUXeCF'] })
 */
export async function followArtistsOrUsers(params: FollowParams): Promise<ComposioToolOutput> {
  return executeSpotifyTool('SPOTIFY_FOLLOW_ARTISTS_OR_USERS', {
    type: params.type,
    ids: params.ids,
  })
}

/**
 * Unfollow artists or users.
 *
 * @example
 * await unfollowArtistsOrUsers({ type: 'artist', ids: ['0OdUWJ0sBjDrqHygGUXeCF'] })
 */
export async function unfollowArtistsOrUsers(params: FollowParams): Promise<ComposioToolOutput> {
  return executeSpotifyTool('SPOTIFY_UNFOLLOW_ARTISTS_OR_USERS', {
    type: params.type,
    ids: params.ids,
  })
}

/**
 * Check if the current user follows artists or users.
 *
 * @example
 * const follows = await checkFollowing({ type: 'artist', ids: ['0OdUWJ0sBjDrqHygGUXeCF'] })
 */
export async function checkFollowing(params: FollowParams): Promise<ComposioToolOutput> {
  return executeSpotifyTool('SPOTIFY_CHECK_IF_USER_FOLLOWS_ARTISTS_OR_USERS', {
    type: params.type,
    ids: params.ids.join(','),
  })
}

/**
 * Get the current user's recently played tracks.
 *
 * @example
 * const history = await getRecentlyPlayed({ limit: 20 })
 */
export async function getRecentlyPlayed(options?: {
  limit?: number
  after?: number
  before?: number
}): Promise<ComposioToolOutput> {
  return executeSpotifyTool('SPOTIFY_GET_RECENTLY_PLAYED_TRACKS', {
    ...(options?.limit && { limit: options.limit }),
    ...(options?.after && { after: options.after }),
    ...(options?.before && { before: options.before }),
  })
}

// ============================================================================
// Browse/Discovery Tools
// ============================================================================

/**
 * Get a list of available genre seeds for recommendations.
 *
 * @example
 * const genres = await getAvailableGenres()
 */
export async function getAvailableGenres(): Promise<ComposioToolOutput> {
  return executeSpotifyTool('SPOTIFY_GET_AVAILABLE_GENRE_SEEDS', {})
}

/**
 * Get a list of browse categories.
 *
 * @example
 * const categories = await getBrowseCategories()
 */
export async function getBrowseCategories(options?: {
  country?: string
  locale?: string
  limit?: number
  offset?: number
}): Promise<ComposioToolOutput> {
  return executeSpotifyTool('SPOTIFY_GET_SEVERAL_BROWSE_CATEGORIES', {
    ...(options?.country && { country: options.country }),
    ...(options?.locale && { locale: options.locale }),
    ...(options?.limit && { limit: options.limit }),
    ...(options?.offset && { offset: options.offset }),
  })
}

/**
 * Get a single browse category.
 *
 * @example
 * const category = await getBrowseCategory('party')
 */
export async function getBrowseCategory(
  categoryId: string,
  options?: { country?: string; locale?: string }
): Promise<ComposioToolOutput> {
  return executeSpotifyTool('SPOTIFY_GET_SINGLE_BROWSE_CATEGORY', {
    category_id: categoryId,
    ...(options?.country && { country: options.country }),
    ...(options?.locale && { locale: options.locale }),
  })
}

/**
 * Get track recommendations based on seeds.
 *
 * @example
 * const recs = await getRecommendations({
 *   seed_artists: ['0OdUWJ0sBjDrqHygGUXeCF'],
 *   seed_genres: ['pop'],
 *   seed_tracks: ['4iV5W9uYEdYUVa79Axb7Rh'],
 *   limit: 20
 * })
 */
export async function getRecommendations(params: {
  seed_artists?: string[]
  seed_genres?: string[]
  seed_tracks?: string[]
  limit?: number
  market?: string
  // Tunable attributes
  min_acousticness?: number
  max_acousticness?: number
  target_acousticness?: number
  min_danceability?: number
  max_danceability?: number
  target_danceability?: number
  min_energy?: number
  max_energy?: number
  target_energy?: number
  min_instrumentalness?: number
  max_instrumentalness?: number
  target_instrumentalness?: number
  min_popularity?: number
  max_popularity?: number
  target_popularity?: number
  min_tempo?: number
  max_tempo?: number
  target_tempo?: number
  min_valence?: number
  max_valence?: number
  target_valence?: number
}): Promise<ComposioToolOutput> {
  return executeSpotifyTool('SPOTIFY_GET_RECOMMENDATIONS', {
    ...(params.seed_artists && { seed_artists: params.seed_artists.join(',') }),
    ...(params.seed_genres && { seed_genres: params.seed_genres.join(',') }),
    ...(params.seed_tracks && { seed_tracks: params.seed_tracks.join(',') }),
    ...(params.limit && { limit: params.limit }),
    ...(params.market && { market: params.market }),
    // Tunable attributes
    ...(params.min_acousticness !== undefined && { min_acousticness: params.min_acousticness }),
    ...(params.max_acousticness !== undefined && { max_acousticness: params.max_acousticness }),
    ...(params.target_acousticness !== undefined && {
      target_acousticness: params.target_acousticness,
    }),
    ...(params.min_danceability !== undefined && { min_danceability: params.min_danceability }),
    ...(params.max_danceability !== undefined && { max_danceability: params.max_danceability }),
    ...(params.target_danceability !== undefined && {
      target_danceability: params.target_danceability,
    }),
    ...(params.min_energy !== undefined && { min_energy: params.min_energy }),
    ...(params.max_energy !== undefined && { max_energy: params.max_energy }),
    ...(params.target_energy !== undefined && { target_energy: params.target_energy }),
    ...(params.min_instrumentalness !== undefined && {
      min_instrumentalness: params.min_instrumentalness,
    }),
    ...(params.max_instrumentalness !== undefined && {
      max_instrumentalness: params.max_instrumentalness,
    }),
    ...(params.target_instrumentalness !== undefined && {
      target_instrumentalness: params.target_instrumentalness,
    }),
    ...(params.min_popularity !== undefined && { min_popularity: params.min_popularity }),
    ...(params.max_popularity !== undefined && { max_popularity: params.max_popularity }),
    ...(params.target_popularity !== undefined && { target_popularity: params.target_popularity }),
    ...(params.min_tempo !== undefined && { min_tempo: params.min_tempo }),
    ...(params.max_tempo !== undefined && { max_tempo: params.max_tempo }),
    ...(params.target_tempo !== undefined && { target_tempo: params.target_tempo }),
    ...(params.min_valence !== undefined && { min_valence: params.min_valence }),
    ...(params.max_valence !== undefined && { max_valence: params.max_valence }),
    ...(params.target_valence !== undefined && { target_valence: params.target_valence }),
  })
}

// ============================================================================
// Spotify Tools for Anthropic
// ============================================================================

/**
 * Get pre-configured Spotify tools formatted for Anthropic's API.
 * These can be passed directly to Anthropic's messages.create() tools parameter.
 *
 * @example
 * const tools = await getSpotifyToolsForAnthropic()
 * const response = await anthropic.messages.create({
 *   model: 'claude-sonnet-4-20250514',
 *   tools: [...otherTools, ...tools],
 *   messages: [...]
 * })
 */
export async function getSpotifyToolsForAnthropic(options?: {
  tools?: string[]
  search?: string
  limit?: number
}): Promise<unknown[]> {
  const composio = getComposioAnthropicClient()
  if (!composio) {
    return []
  }

  try {
    // If specific tools are requested, use tools parameter; otherwise use toolkits
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let tools: any[]
    if (options?.tools && options.tools.length > 0) {
      tools = await composio.tools.get(DEFAULT_USER_ID, {
        tools: options.tools,
      })
    } else {
      tools = await composio.tools.get(DEFAULT_USER_ID, {
        toolkits: ['spotify'],
      })
    }

    return tools
  } catch (error) {
    console.error('Failed to get Spotify tools from Composio:', error)
    return []
  }
}

/**
 * Handle tool calls from Anthropic response using Composio.
 * This executes the tool calls and returns results.
 *
 * @example
 * const result = await handleSpotifyToolCalls(response)
 */
export async function handleSpotifyToolCalls(response: unknown): Promise<unknown> {
  const composio = getComposioAnthropicClient()
  if (!composio) {
    throw new Error('Composio is not configured')
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return composio.provider.handleToolCalls(DEFAULT_USER_ID, response as any)
}

// ============================================================================
// Formatting Helpers
// ============================================================================

/**
 * Format Spotify track info for LLM consumption.
 */
export function formatTrackForLLM(data: Record<string, unknown>): string {
  const artists = (data.artists as { name: string }[])?.map((a) => a.name).join(', ') || 'Unknown'
  const album = data.album as Record<string, unknown>
  const durationMs = data.duration_ms as number
  const minutes = Math.floor(durationMs / 60000)
  const seconds = Math.floor((durationMs % 60000) / 1000)

  const lines = [
    `# ${data.name}`,
    '',
    `**Artist(s):** ${artists}`,
    `**Album:** ${album?.name ?? 'N/A'}`,
    `**Duration:** ${minutes}:${seconds.toString().padStart(2, '0')}`,
    `**Popularity:** ${data.popularity ?? 'N/A'}/100`,
    `**Explicit:** ${data.explicit ? 'Yes' : 'No'}`,
    '',
    `**Spotify URL:** ${data.external_urls ? (data.external_urls as Record<string, string>).spotify : 'N/A'}`,
    `**URI:** ${data.uri ?? 'N/A'}`,
  ]

  return lines.join('\n')
}

/**
 * Format Spotify album info for LLM consumption.
 */
export function formatAlbumForLLM(data: Record<string, unknown>): string {
  const artists = (data.artists as { name: string }[])?.map((a) => a.name).join(', ') || 'Unknown'

  const lines = [
    `# ${data.name}`,
    '',
    `**Artist(s):** ${artists}`,
    `**Album Type:** ${data.album_type ?? 'N/A'}`,
    `**Total Tracks:** ${data.total_tracks ?? 'N/A'}`,
    `**Release Date:** ${data.release_date ?? 'N/A'}`,
    `**Label:** ${data.label ?? 'N/A'}`,
    '',
    `**Spotify URL:** ${data.external_urls ? (data.external_urls as Record<string, string>).spotify : 'N/A'}`,
    `**URI:** ${data.uri ?? 'N/A'}`,
  ]

  return lines.join('\n')
}

/**
 * Format Spotify artist info for LLM consumption.
 */
export function formatArtistForLLM(data: Record<string, unknown>): string {
  const genres = (data.genres as string[])?.join(', ') || 'N/A'
  const followers = data.followers as Record<string, unknown>

  const lines = [
    `# ${data.name}`,
    '',
    `**Followers:** ${followers?.total?.toLocaleString() ?? 'N/A'}`,
    `**Popularity:** ${data.popularity ?? 'N/A'}/100`,
    `**Genres:** ${genres}`,
    '',
    `**Spotify URL:** ${data.external_urls ? (data.external_urls as Record<string, string>).spotify : 'N/A'}`,
    `**URI:** ${data.uri ?? 'N/A'}`,
  ]

  return lines.join('\n')
}

/**
 * Format Spotify playlist info for LLM consumption.
 */
export function formatPlaylistForLLM(data: Record<string, unknown>): string {
  const owner = data.owner as Record<string, unknown>
  const followers = data.followers as Record<string, unknown>
  const tracks = data.tracks as Record<string, unknown>

  const lines = [
    `# ${data.name}`,
    '',
    data.description ? `${data.description}` : '',
    '',
    `**Owner:** ${owner?.display_name ?? 'Unknown'}`,
    `**Followers:** ${followers?.total?.toLocaleString() ?? 'N/A'}`,
    `**Tracks:** ${tracks?.total ?? 'N/A'}`,
    `**Public:** ${data.public ? 'Yes' : 'No'}`,
    `**Collaborative:** ${data.collaborative ? 'Yes' : 'No'}`,
    '',
    `**Spotify URL:** ${data.external_urls ? (data.external_urls as Record<string, string>).spotify : 'N/A'}`,
    `**URI:** ${data.uri ?? 'N/A'}`,
  ]

  return lines.filter(Boolean).join('\n')
}

/**
 * Format current playback state for LLM consumption.
 */
export function formatPlaybackForLLM(data: Record<string, unknown>): string {
  if (!data || !data.item) {
    return 'No track currently playing.'
  }

  const item = data.item as Record<string, unknown>
  const artists = (item.artists as { name: string }[])?.map((a) => a.name).join(', ') || 'Unknown'
  const device = data.device as Record<string, unknown>

  const progressMs = data.progress_ms as number
  const durationMs = item.duration_ms as number
  const progressMin = Math.floor(progressMs / 60000)
  const progressSec = Math.floor((progressMs % 60000) / 1000)
  const durationMin = Math.floor(durationMs / 60000)
  const durationSec = Math.floor((durationMs % 60000) / 1000)

  const lines = [
    `# Now Playing`,
    '',
    `**Track:** ${item.name}`,
    `**Artist(s):** ${artists}`,
    `**Progress:** ${progressMin}:${progressSec.toString().padStart(2, '0')} / ${durationMin}:${durationSec.toString().padStart(2, '0')}`,
    '',
    `**Status:** ${data.is_playing ? '▶️ Playing' : '⏸️ Paused'}`,
    `**Shuffle:** ${data.shuffle_state ? 'On' : 'Off'}`,
    `**Repeat:** ${data.repeat_state}`,
    `**Volume:** ${device?.volume_percent ?? 'N/A'}%`,
    '',
    `**Device:** ${device?.name ?? 'Unknown'} (${device?.type ?? 'unknown'})`,
  ]

  return lines.join('\n')
}

/**
 * Format search results for LLM consumption.
 */
export function formatSearchResultsForLLM(data: Record<string, unknown>): string {
  const sections: string[] = ['# Search Results', '']

  // Tracks
  const tracks = data.tracks as { items: Record<string, unknown>[] }
  if (tracks?.items?.length > 0) {
    sections.push('## Tracks')
    tracks.items.forEach((track, i) => {
      const artists =
        (track.artists as { name: string }[])?.map((a) => a.name).join(', ') || 'Unknown'
      sections.push(`${i + 1}. **${track.name}** by ${artists}`)
    })
    sections.push('')
  }

  // Artists
  const artists = data.artists as { items: Record<string, unknown>[] }
  if (artists?.items?.length > 0) {
    sections.push('## Artists')
    artists.items.forEach((artist, i) => {
      const followers = artist.followers as Record<string, unknown>
      sections.push(
        `${i + 1}. **${artist.name}** (${followers?.total?.toLocaleString() ?? 0} followers)`
      )
    })
    sections.push('')
  }

  // Albums
  const albums = data.albums as { items: Record<string, unknown>[] }
  if (albums?.items?.length > 0) {
    sections.push('## Albums')
    albums.items.forEach((album, i) => {
      const albumArtists =
        (album.artists as { name: string }[])?.map((a) => a.name).join(', ') || 'Unknown'
      sections.push(`${i + 1}. **${album.name}** by ${albumArtists} (${album.release_date})`)
    })
    sections.push('')
  }

  // Playlists
  const playlists = data.playlists as { items: Record<string, unknown>[] }
  if (playlists?.items?.length > 0) {
    sections.push('## Playlists')
    playlists.items.forEach((playlist, i) => {
      const owner = playlist.owner as Record<string, unknown>
      const playlistTracks = playlist.tracks as Record<string, unknown>
      sections.push(
        `${i + 1}. **${playlist.name}** by ${owner?.display_name ?? 'Unknown'} (${playlistTracks?.total ?? 0} tracks)`
      )
    })
    sections.push('')
  }

  return sections.join('\n')
}

