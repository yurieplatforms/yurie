import type { SSEHandler } from '@/agent/sse-handler'
import {
  isSpotifyToolsAvailable,
  setSpotifyToolContext,
  findSpotifyConnectionId,
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
  getQueue,
  addToQueue,
  search as spotifySearch,
  getTrack,
  getTrackAudioFeatures,
  getAlbum,
  getAlbumTracks,
  getNewReleases,
  getArtist,
  getArtistTopTracks,
  getArtistAlbums,
  getRelatedArtists,
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
  getCurrentUserProfile,
  getSavedTracks,
  saveTracks,
  removeSavedTracks,
  checkSavedTracks,
  getSavedAlbums,
  saveAlbums,
  removeSavedAlbums,
  getTopArtists,
  getTopTracks,
  getRecentlyPlayed,
  getRecommendations,
  getAvailableGenres,
  getBrowseCategories,
  followPlaylist,
  unfollowPlaylist,
  formatTrackForLLM,
  formatAlbumForLLM,
  formatArtistForLLM,
  formatPlaylistForLLM,
  formatPlaybackForLLM,
  formatSearchResultsForLLM,
} from '@/services/composio'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getSpotifyTools(sseHandler: SSEHandler, userId?: string): Promise<any[]> {
  // Set up Spotify context if user is authenticated and Composio is available
  if (userId && isSpotifyToolsAvailable()) {
    const connectedAccountId = await findSpotifyConnectionId(userId)
    setSpotifyToolContext({
      userId,
      connectedAccountId,
    })
    if (connectedAccountId) {
      console.log(`[Spotify Tools] Context set for user ${userId} with connection ${connectedAccountId}`)
    }
  }

  if (!isSpotifyToolsAvailable()) {
    return []
  }

  return [
    // Playback State
    {
      name: 'spotify_get_playback_state',
      description: 'Get information about the user\'s current playback state, including track, artist, album, and device.',
      input_schema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      run: async (input: Record<string, unknown>) => {
        try {
          const result = await getPlaybackState()
          if (!result.successful) throw new Error(result.error || 'Unknown error')
          const formatted = formatPlaybackForLLM(result.data as Record<string, unknown>)
          await sseHandler.sendToolEvent('spotify_get_playback_state', 'end', input, formatted)
          return formatted
        } catch (error) {
          const errorMsg = `Spotify error: ${error instanceof Error ? error.message : 'Unknown error'}`
          await sseHandler.sendToolEvent('spotify_get_playback_state', 'end', input, errorMsg)
          return errorMsg
        }
      },
    },
    
    // Start/Resume Playback
    {
      name: 'spotify_start_playback',
      description: 'Start or resume playback. Can play a specific track, album, or playlist by URI.',
      input_schema: {
        type: 'object',
        properties: {
          context_uri: { type: 'string', description: 'Spotify URI of the context to play (album, artist, playlist).' },
          uris: { type: 'array', items: { type: 'string' }, description: 'Array of track URIs to play.' },
          device_id: { type: 'string', description: 'The device to play on.' },
        },
        additionalProperties: false,
      },
      run: async (input: Record<string, unknown>) => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const result = await startPlayback(input as any)
          if (!result.successful) throw new Error(result.error || 'Unknown error')
          const msg = 'Playback started/resumed.'
          await sseHandler.sendToolEvent('spotify_start_playback', 'end', input, msg)
          return msg
        } catch (error) {
          const errorMsg = `Spotify error: ${error instanceof Error ? error.message : 'Unknown error'}`
          await sseHandler.sendToolEvent('spotify_start_playback', 'end', input, errorMsg)
          return errorMsg
        }
      },
    },

    // Pause Playback
    {
      name: 'spotify_pause_playback',
      description: 'Pause playback on the user\'s active device.',
      input_schema: {
        type: 'object',
        properties: {
          device_id: { type: 'string', description: 'The device to pause.' },
        },
        additionalProperties: false,
      },
      run: async (input: Record<string, unknown>) => {
        try {
          const result = await pausePlayback(input)
          if (!result.successful) throw new Error(result.error || 'Unknown error')
          const msg = 'Playback paused.'
          await sseHandler.sendToolEvent('spotify_pause_playback', 'end', input, msg)
          return msg
        } catch (error) {
          const errorMsg = `Spotify error: ${error instanceof Error ? error.message : 'Unknown error'}`
          await sseHandler.sendToolEvent('spotify_pause_playback', 'end', input, errorMsg)
          return errorMsg
        }
      },
    },

    // Skip to Next
    {
      name: 'spotify_skip_next',
      description: 'Skip to the next track in the user\'s queue.',
      input_schema: {
        type: 'object',
        properties: {
          device_id: { type: 'string', description: 'The device to use.' },
        },
        additionalProperties: false,
      },
      run: async (input: Record<string, unknown>) => {
        try {
          const result = await skipToNext(input)
          if (!result.successful) throw new Error(result.error || 'Unknown error')
          const msg = 'Skipped to next track.'
          await sseHandler.sendToolEvent('spotify_skip_next', 'end', input, msg)
          return msg
        } catch (error) {
          const errorMsg = `Spotify error: ${error instanceof Error ? error.message : 'Unknown error'}`
          await sseHandler.sendToolEvent('spotify_skip_next', 'end', input, errorMsg)
          return errorMsg
        }
      },
    },

    // Skip to Previous
    {
      name: 'spotify_skip_previous',
      description: 'Skip to the previous track in the user\'s queue.',
      input_schema: {
        type: 'object',
        properties: {
          device_id: { type: 'string', description: 'The device to use.' },
        },
        additionalProperties: false,
      },
      run: async (input: Record<string, unknown>) => {
        try {
          const result = await skipToPrevious(input)
          if (!result.successful) throw new Error(result.error || 'Unknown error')
          const msg = 'Skipped to previous track.'
          await sseHandler.sendToolEvent('spotify_skip_previous', 'end', input, msg)
          return msg
        } catch (error) {
          const errorMsg = `Spotify error: ${error instanceof Error ? error.message : 'Unknown error'}`
          await sseHandler.sendToolEvent('spotify_skip_previous', 'end', input, errorMsg)
          return errorMsg
        }
      },
    },

    // Search
    {
      name: 'spotify_search',
      description: 'Search for tracks, artists, albums, playlists, etc.',
      input_schema: {
        type: 'object',
        properties: {
          q: { type: 'string', description: 'Search query.' },
          type: { 
            type: 'array', 
            items: { type: 'string', enum: ['album', 'artist', 'playlist', 'track', 'show', 'episode', 'audiobook'] },
            description: 'Types of items to search for.',
          },
          limit: { type: 'number', description: 'Max number of results (default: 20).' },
        },
        required: ['q', 'type'],
        additionalProperties: false,
      },
      run: async (input: Record<string, unknown>) => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const result = await spotifySearch(input as any)
          if (!result.successful) throw new Error(result.error || 'Unknown error')
          const formatted = formatSearchResultsForLLM(result.data as Record<string, unknown>)
          await sseHandler.sendToolEvent('spotify_search', 'end', input, formatted)
          return formatted
        } catch (error) {
          const errorMsg = `Spotify error: ${error instanceof Error ? error.message : 'Unknown error'}`
          await sseHandler.sendToolEvent('spotify_search', 'end', input, errorMsg)
          return errorMsg
        }
      },
    },

    // Get Queue
    {
      name: 'spotify_get_queue',
      description: 'Get the user\'s current playback queue.',
      input_schema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      run: async (input: Record<string, unknown>) => {
        try {
          const result = await getQueue()
          if (!result.successful) throw new Error(result.error || 'Unknown error')
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const data = result.data as any
          const current = data.currently_playing ? `Currently Playing: ${data.currently_playing.name} - ${data.currently_playing.artists[0].name}` : 'Nothing playing'
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const next = data.queue ? data.queue.slice(0, 10).map((t: any, i: number) => `${i+1}. ${t.name} - ${t.artists[0].name}`).join('\n') : 'Empty queue'
          const formatted = `${current}\n\nNext Up:\n${next}`
          
          await sseHandler.sendToolEvent('spotify_get_queue', 'end', input, formatted)
          return formatted
        } catch (error) {
          const errorMsg = `Spotify error: ${error instanceof Error ? error.message : 'Unknown error'}`
          await sseHandler.sendToolEvent('spotify_get_queue', 'end', input, errorMsg)
          return errorMsg
        }
      },
    },

    // Get User Playlists
    {
      name: 'spotify_get_my_playlists',
      description: 'Get the current user\'s playlists.',
      input_schema: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Max number of playlists.' },
          offset: { type: 'number', description: 'Offset for pagination.' },
        },
        additionalProperties: false,
      },
      run: async (input: Record<string, unknown>) => {
        try {
          const result = await getCurrentUserPlaylists(input)
          if (!result.successful) throw new Error(result.error || 'Unknown error')
          
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const data = result.data as any
          const items = data.items || []
          
          if (items.length === 0) {
            const msg = 'No playlists found on your Spotify account.'
            await sseHandler.sendToolEvent('spotify_get_my_playlists', 'end', input, msg)
            return msg
          }

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const formatted = items.map((p: any) => `- ${p.name} (ID: ${p.id}, Tracks: ${p.tracks.total})`).join('\n')
          await sseHandler.sendToolEvent('spotify_get_my_playlists', 'end', input, formatted)
          return formatted
        } catch (error) {
          const errorMsg = `Spotify error: ${error instanceof Error ? error.message : 'Unknown error'}`
          await sseHandler.sendToolEvent('spotify_get_my_playlists', 'end', input, errorMsg)
          return errorMsg
        }
      },
    },

    // Get Saved Tracks (Liked Songs)
    {
      name: 'spotify_get_saved_tracks',
      description: 'Get the current user\'s saved tracks (Liked Songs).',
      input_schema: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Max number of tracks (default 20).' },
          offset: { type: 'number', description: 'Offset for pagination.' },
        },
        additionalProperties: false,
      },
      run: async (input: Record<string, unknown>) => {
        try {
          const result = await getSavedTracks(input)
          if (!result.successful) throw new Error(result.error || 'Unknown error')
          
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const data = result.data as any
          const items = data.items || []
          
          if (items.length === 0) {
            const msg = 'No saved tracks found.'
            await sseHandler.sendToolEvent('spotify_get_saved_tracks', 'end', input, msg)
            return msg
          }

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const formatted = items.map((item: any) => {
            const t = item.track
            return `- ${t.name} by ${t.artists[0].name} (Added: ${item.added_at})`
          }).join('\n')
          
          await sseHandler.sendToolEvent('spotify_get_saved_tracks', 'end', input, formatted)
          return formatted
        } catch (error) {
          const errorMsg = `Spotify error: ${error instanceof Error ? error.message : 'Unknown error'}`
          await sseHandler.sendToolEvent('spotify_get_saved_tracks', 'end', input, errorMsg)
          return errorMsg
        }
      },
    },

    // Get Available Devices
    {
      name: 'spotify_get_devices',
      description: 'Get information about active available devices.',
      input_schema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      run: async (input: Record<string, unknown>) => {
        try {
          const result = await getAvailableDevices()
          if (!result.successful) throw new Error(result.error || 'Unknown error')
          
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const data = result.data as any
          const devices = data.devices || []
          
          if (devices.length === 0) {
            const msg = 'No active devices found. Please open Spotify on a device.'
            await sseHandler.sendToolEvent('spotify_get_devices', 'end', input, msg)
            return msg
          }

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const formatted = devices.map((d: any) => 
            `- ${d.name} (${d.type}): ${d.is_active ? 'Active 🟢' : 'Inactive'} (Vol: ${d.volume_percent}%)`
          ).join('\n')
          
          await sseHandler.sendToolEvent('spotify_get_devices', 'end', input, formatted)
          return formatted
        } catch (error) {
          const errorMsg = `Spotify error: ${error instanceof Error ? error.message : 'Unknown error'}`
          await sseHandler.sendToolEvent('spotify_get_devices', 'end', input, errorMsg)
          return errorMsg
        }
      },
    },
    
    // Get Recommendations
    {
      name: 'spotify_get_recommendations',
      description: 'Get recommendations based on seeds (artists, genres, tracks).',
      input_schema: {
        type: 'object',
        properties: {
          seed_artists: { type: 'array', items: { type: 'string' } },
          seed_genres: { type: 'array', items: { type: 'string' } },
          seed_tracks: { type: 'array', items: { type: 'string' } },
          limit: { type: 'number' },
        },
        additionalProperties: false,
      },
      run: async (input: Record<string, unknown>) => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const result = await getRecommendations(input as any)
          if (!result.successful) throw new Error(result.error || 'Unknown error')
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const tracks = (result.data as any).tracks || []
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const formatted = tracks.map((t: any) => `- ${t.name} by ${t.artists[0].name} (URI: ${t.uri})`).join('\n')
          await sseHandler.sendToolEvent('spotify_get_recommendations', 'end', input, formatted)
          return formatted
        } catch (error) {
          const errorMsg = `Spotify error: ${error instanceof Error ? error.message : 'Unknown error'}`
          await sseHandler.sendToolEvent('spotify_get_recommendations', 'end', input, errorMsg)
          return errorMsg
        }
      },
    },

    // Set Volume
    {
      name: 'spotify_set_volume',
      description: 'Set the volume for the user\'s current playback device (0-100). Requires Spotify Premium.',
      input_schema: {
        type: 'object',
        properties: {
          volume_percent: { type: 'number', description: 'Volume percentage (0-100).' },
          device_id: { type: 'string', description: 'The device to control.' },
        },
        required: ['volume_percent'],
        additionalProperties: false,
      },
      run: async (input: Record<string, unknown>) => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const result = await setVolume(input as any)
          if (!result.successful) throw new Error(result.error || 'Unknown error')
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const msg = `Volume set to ${(input as any).volume_percent}%.`
          await sseHandler.sendToolEvent('spotify_set_volume', 'end', input, msg)
          return msg
        } catch (error) {
          const errorMsg = `Spotify error: ${error instanceof Error ? error.message : 'Unknown error'}`
          await sseHandler.sendToolEvent('spotify_set_volume', 'end', input, errorMsg)
          return errorMsg
        }
      },
    },

    // Seek to Position
    {
      name: 'spotify_seek',
      description: 'Seek to a position in the currently playing track. Requires Spotify Premium.',
      input_schema: {
        type: 'object',
        properties: {
          position_ms: { type: 'number', description: 'Position in milliseconds to seek to.' },
          device_id: { type: 'string', description: 'The device to control.' },
        },
        required: ['position_ms'],
        additionalProperties: false,
      },
      run: async (input: Record<string, unknown>) => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const result = await seekToPosition(input as any)
          if (!result.successful) throw new Error(result.error || 'Unknown error')
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const posMs = (input as any).position_ms
          const mins = Math.floor(posMs / 60000)
          const secs = Math.floor((posMs % 60000) / 1000)
          const msg = `Seeked to ${mins}:${secs.toString().padStart(2, '0')}.`
          await sseHandler.sendToolEvent('spotify_seek', 'end', input, msg)
          return msg
        } catch (error) {
          const errorMsg = `Spotify error: ${error instanceof Error ? error.message : 'Unknown error'}`
          await sseHandler.sendToolEvent('spotify_seek', 'end', input, errorMsg)
          return errorMsg
        }
      },
    },

    // Set Repeat Mode
    {
      name: 'spotify_set_repeat',
      description: 'Set the repeat mode for playback. Requires Spotify Premium.',
      input_schema: {
        type: 'object',
        properties: {
          state: { 
            type: 'string', 
            enum: ['track', 'context', 'off'],
            description: 'Repeat mode: "track" (repeat one), "context" (repeat all), or "off".' 
          },
          device_id: { type: 'string', description: 'The device to control.' },
        },
        required: ['state'],
        additionalProperties: false,
      },
      run: async (input: Record<string, unknown>) => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const result = await setRepeatMode(input as any)
          if (!result.successful) throw new Error(result.error || 'Unknown error')
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const state = (input as any).state
          const modeText = state === 'track' ? 'Repeat One' : state === 'context' ? 'Repeat All' : 'Off'
          const msg = `Repeat mode set to: ${modeText}.`
          await sseHandler.sendToolEvent('spotify_set_repeat', 'end', input, msg)
          return msg
        } catch (error) {
          const errorMsg = `Spotify error: ${error instanceof Error ? error.message : 'Unknown error'}`
          await sseHandler.sendToolEvent('spotify_set_repeat', 'end', input, errorMsg)
          return errorMsg
        }
      },
    },

    // Toggle Shuffle
    {
      name: 'spotify_toggle_shuffle',
      description: 'Toggle shuffle on or off for playback. Requires Spotify Premium.',
      input_schema: {
        type: 'object',
        properties: {
          state: { type: 'boolean', description: 'True to enable shuffle, false to disable.' },
          device_id: { type: 'string', description: 'The device to control.' },
        },
        required: ['state'],
        additionalProperties: false,
      },
      run: async (input: Record<string, unknown>) => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const result = await toggleShuffle(input as any)
          if (!result.successful) throw new Error(result.error || 'Unknown error')
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const msg = `Shuffle ${(input as any).state ? 'enabled' : 'disabled'}.`
          await sseHandler.sendToolEvent('spotify_toggle_shuffle', 'end', input, msg)
          return msg
        } catch (error) {
          const errorMsg = `Spotify error: ${error instanceof Error ? error.message : 'Unknown error'}`
          await sseHandler.sendToolEvent('spotify_toggle_shuffle', 'end', input, errorMsg)
          return errorMsg
        }
      },
    },

    // Add to Queue
    {
      name: 'spotify_add_to_queue',
      description: 'Add a track or episode to the user\'s playback queue. Requires Spotify Premium.',
      input_schema: {
        type: 'object',
        properties: {
          uri: { type: 'string', description: 'Spotify URI of the track or episode (e.g., spotify:track:xxx).' },
          device_id: { type: 'string', description: 'The device to add to queue.' },
        },
        required: ['uri'],
        additionalProperties: false,
      },
      run: async (input: Record<string, unknown>) => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const result = await addToQueue(input as any)
          if (!result.successful) throw new Error(result.error || 'Unknown error')
          const msg = 'Added to queue successfully.'
          await sseHandler.sendToolEvent('spotify_add_to_queue', 'end', input, msg)
          return msg
        } catch (error) {
          const errorMsg = `Spotify error: ${error instanceof Error ? error.message : 'Unknown error'}`
          await sseHandler.sendToolEvent('spotify_add_to_queue', 'end', input, errorMsg)
          return errorMsg
        }
      },
    },

    // Get Track Info
    {
      name: 'spotify_get_track',
      description: 'Get detailed information about a specific track.',
      input_schema: {
        type: 'object',
        properties: {
          track_id: { type: 'string', description: 'Spotify track ID.' },
        },
        required: ['track_id'],
        additionalProperties: false,
      },
      run: async (input: Record<string, unknown>) => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const result = await getTrack((input as any).track_id)
          if (!result.successful) throw new Error(result.error || 'Unknown error')
          const formatted = formatTrackForLLM(result.data as Record<string, unknown>)
          await sseHandler.sendToolEvent('spotify_get_track', 'end', input, formatted)
          return formatted
        } catch (error) {
          const errorMsg = `Spotify error: ${error instanceof Error ? error.message : 'Unknown error'}`
          await sseHandler.sendToolEvent('spotify_get_track', 'end', input, errorMsg)
          return errorMsg
        }
      },
    },

    // Get Album Info
    {
      name: 'spotify_get_album',
      description: 'Get detailed information about a specific album.',
      input_schema: {
        type: 'object',
        properties: {
          album_id: { type: 'string', description: 'Spotify album ID.' },
        },
        required: ['album_id'],
        additionalProperties: false,
      },
      run: async (input: Record<string, unknown>) => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const result = await getAlbum((input as any).album_id)
          if (!result.successful) throw new Error(result.error || 'Unknown error')
          const formatted = formatAlbumForLLM(result.data as Record<string, unknown>)
          await sseHandler.sendToolEvent('spotify_get_album', 'end', input, formatted)
          return formatted
        } catch (error) {
          const errorMsg = `Spotify error: ${error instanceof Error ? error.message : 'Unknown error'}`
          await sseHandler.sendToolEvent('spotify_get_album', 'end', input, errorMsg)
          return errorMsg
        }
      },
    },

    // Get Artist Info
    {
      name: 'spotify_get_artist',
      description: 'Get detailed information about a specific artist.',
      input_schema: {
        type: 'object',
        properties: {
          artist_id: { type: 'string', description: 'Spotify artist ID.' },
        },
        required: ['artist_id'],
        additionalProperties: false,
      },
      run: async (input: Record<string, unknown>) => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const result = await getArtist((input as any).artist_id)
          if (!result.successful) throw new Error(result.error || 'Unknown error')
          const formatted = formatArtistForLLM(result.data as Record<string, unknown>)
          await sseHandler.sendToolEvent('spotify_get_artist', 'end', input, formatted)
          return formatted
        } catch (error) {
          const errorMsg = `Spotify error: ${error instanceof Error ? error.message : 'Unknown error'}`
          await sseHandler.sendToolEvent('spotify_get_artist', 'end', input, errorMsg)
          return errorMsg
        }
      },
    },

    // Get Artist Top Tracks
    {
      name: 'spotify_get_artist_top_tracks',
      description: 'Get an artist\'s top tracks by country.',
      input_schema: {
        type: 'object',
        properties: {
          artist_id: { type: 'string', description: 'Spotify artist ID.' },
          market: { type: 'string', description: 'ISO 3166-1 alpha-2 country code (e.g., "US").' },
        },
        required: ['artist_id'],
        additionalProperties: false,
      },
      run: async (input: Record<string, unknown>) => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const inp = input as any
          const result = await getArtistTopTracks(inp.artist_id, inp.market || 'US')
          if (!result.successful) throw new Error(result.error || 'Unknown error')
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const tracks = (result.data as any).tracks || []
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const formatted = tracks.map((t: any, i: number) => 
            `${i + 1}. ${t.name} (${t.album.name}) - Popularity: ${t.popularity}`
          ).join('\n')
          await sseHandler.sendToolEvent('spotify_get_artist_top_tracks', 'end', input, formatted)
          return formatted || 'No top tracks found.'
        } catch (error) {
          const errorMsg = `Spotify error: ${error instanceof Error ? error.message : 'Unknown error'}`
          await sseHandler.sendToolEvent('spotify_get_artist_top_tracks', 'end', input, errorMsg)
          return errorMsg
        }
      },
    },

    // Get Currently Playing Track
    {
      name: 'spotify_get_currently_playing',
      description: 'Get the track currently playing on the user\'s Spotify account.',
      input_schema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      run: async (input: Record<string, unknown>) => {
        try {
          const result = await getCurrentlyPlayingTrack()
          if (!result.successful) throw new Error(result.error || 'Unknown error')
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const data = result.data as any
          if (!data || !data.item) {
            const msg = 'Nothing is currently playing.'
            await sseHandler.sendToolEvent('spotify_get_currently_playing', 'end', input, msg)
            return msg
          }
          const track = data.item
          const artists = track.artists?.map((a: { name: string }) => a.name).join(', ') || 'Unknown'
          const progressMs = data.progress_ms || 0
          const durationMs = track.duration_ms || 0
          const progressMin = Math.floor(progressMs / 60000)
          const progressSec = Math.floor((progressMs % 60000) / 1000)
          const durationMin = Math.floor(durationMs / 60000)
          const durationSec = Math.floor((durationMs % 60000) / 1000)
          
          const formatted = `Now Playing: ${track.name} by ${artists}\nAlbum: ${track.album?.name || 'Unknown'}\nProgress: ${progressMin}:${progressSec.toString().padStart(2, '0')} / ${durationMin}:${durationSec.toString().padStart(2, '0')}\nURI: ${track.uri}`
          await sseHandler.sendToolEvent('spotify_get_currently_playing', 'end', input, formatted)
          return formatted
        } catch (error) {
          const errorMsg = `Spotify error: ${error instanceof Error ? error.message : 'Unknown error'}`
          await sseHandler.sendToolEvent('spotify_get_currently_playing', 'end', input, errorMsg)
          return errorMsg
        }
      },
    },

    // Get Recently Played
    {
      name: 'spotify_get_recently_played',
      description: 'Get the user\'s recently played tracks.',
      input_schema: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Max number of tracks to return (default 20, max 50).' },
        },
        additionalProperties: false,
      },
      run: async (input: Record<string, unknown>) => {
        try {
          const result = await getRecentlyPlayed(input)
          if (!result.successful) throw new Error(result.error || 'Unknown error')
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const data = result.data as any
          const items = data.items || []
          if (items.length === 0) {
            const msg = 'No recently played tracks found.'
            await sseHandler.sendToolEvent('spotify_get_recently_played', 'end', input, msg)
            return msg
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const formatted = items.map((item: any, i: number) => {
            const t = item.track
            const playedAt = new Date(item.played_at).toLocaleString()
            return `${i + 1}. ${t.name} by ${t.artists[0]?.name || 'Unknown'} (Played: ${playedAt})`
          }).join('\n')
          await sseHandler.sendToolEvent('spotify_get_recently_played', 'end', input, formatted)
          return formatted
        } catch (error) {
          const errorMsg = `Spotify error: ${error instanceof Error ? error.message : 'Unknown error'}`
          await sseHandler.sendToolEvent('spotify_get_recently_played', 'end', input, errorMsg)
          return errorMsg
        }
      },
    },

    // Get User Profile
    {
      name: 'spotify_get_my_profile',
      description: 'Get the current user\'s Spotify profile information.',
      input_schema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      run: async (input: Record<string, unknown>) => {
        try {
          const result = await getCurrentUserProfile()
          if (!result.successful) throw new Error(result.error || 'Unknown error')
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const data = result.data as any
          const formatted = `# ${data.display_name || 'Spotify User'}\n\n**Email:** ${data.email || 'N/A'}\n**Country:** ${data.country || 'N/A'}\n**Product:** ${data.product || 'free'}\n**Followers:** ${data.followers?.total?.toLocaleString() || 0}\n**Profile URL:** ${data.external_urls?.spotify || 'N/A'}`
          await sseHandler.sendToolEvent('spotify_get_my_profile', 'end', input, formatted)
          return formatted
        } catch (error) {
          const errorMsg = `Spotify error: ${error instanceof Error ? error.message : 'Unknown error'}`
          await sseHandler.sendToolEvent('spotify_get_my_profile', 'end', input, errorMsg)
          return errorMsg
        }
      },
    },

    // Get Top Artists
    {
      name: 'spotify_get_top_artists',
      description: 'Get the current user\'s top artists based on listening history.',
      input_schema: {
        type: 'object',
        properties: {
          time_range: { 
            type: 'string', 
            enum: ['short_term', 'medium_term', 'long_term'],
            description: 'Time range: short_term (~4 weeks), medium_term (~6 months), long_term (all time).'
          },
          limit: { type: 'number', description: 'Max number of artists (default 20).' },
        },
        additionalProperties: false,
      },
      run: async (input: Record<string, unknown>) => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const result = await getTopArtists(input as any)
          if (!result.successful) throw new Error(result.error || 'Unknown error')
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const data = result.data as any
          const items = data.items || []
          if (items.length === 0) {
            const msg = 'No top artists found.'
            await sseHandler.sendToolEvent('spotify_get_top_artists', 'end', input, msg)
            return msg
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const formatted = items.map((a: any, i: number) => 
            `${i + 1}. ${a.name} (${a.genres?.slice(0, 2).join(', ') || 'N/A'}) - Popularity: ${a.popularity}`
          ).join('\n')
          await sseHandler.sendToolEvent('spotify_get_top_artists', 'end', input, formatted)
          return formatted
        } catch (error) {
          const errorMsg = `Spotify error: ${error instanceof Error ? error.message : 'Unknown error'}`
          await sseHandler.sendToolEvent('spotify_get_top_artists', 'end', input, errorMsg)
          return errorMsg
        }
      },
    },

    // Get Top Tracks
    {
      name: 'spotify_get_top_tracks',
      description: 'Get the current user\'s top tracks based on listening history.',
      input_schema: {
        type: 'object',
        properties: {
          time_range: { 
            type: 'string', 
            enum: ['short_term', 'medium_term', 'long_term'],
            description: 'Time range: short_term (~4 weeks), medium_term (~6 months), long_term (all time).'
          },
          limit: { type: 'number', description: 'Max number of tracks (default 20).' },
        },
        additionalProperties: false,
      },
      run: async (input: Record<string, unknown>) => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const result = await getTopTracks(input as any)
          if (!result.successful) throw new Error(result.error || 'Unknown error')
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const data = result.data as any
          const items = data.items || []
          if (items.length === 0) {
            const msg = 'No top tracks found.'
            await sseHandler.sendToolEvent('spotify_get_top_tracks', 'end', input, msg)
            return msg
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const formatted = items.map((t: any, i: number) => 
            `${i + 1}. ${t.name} by ${t.artists[0]?.name || 'Unknown'} - Popularity: ${t.popularity}`
          ).join('\n')
          await sseHandler.sendToolEvent('spotify_get_top_tracks', 'end', input, formatted)
          return formatted
        } catch (error) {
          const errorMsg = `Spotify error: ${error instanceof Error ? error.message : 'Unknown error'}`
          await sseHandler.sendToolEvent('spotify_get_top_tracks', 'end', input, errorMsg)
          return errorMsg
        }
      },
    },

    // Get Playlist Details
    {
      name: 'spotify_get_playlist',
      description: 'Get details of a specific playlist.',
      input_schema: {
        type: 'object',
        properties: {
          playlist_id: { type: 'string', description: 'Spotify playlist ID.' },
        },
        required: ['playlist_id'],
        additionalProperties: false,
      },
      run: async (input: Record<string, unknown>) => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const result = await getPlaylist((input as any).playlist_id)
          if (!result.successful) throw new Error(result.error || 'Unknown error')
          const formatted = formatPlaylistForLLM(result.data as Record<string, unknown>)
          await sseHandler.sendToolEvent('spotify_get_playlist', 'end', input, formatted)
          return formatted
        } catch (error) {
          const errorMsg = `Spotify error: ${error instanceof Error ? error.message : 'Unknown error'}`
          await sseHandler.sendToolEvent('spotify_get_playlist', 'end', input, errorMsg)
          return errorMsg
        }
      },
    },

    // Create Playlist
    {
      name: 'spotify_create_playlist',
      description: 'Create a new playlist for the current user.',
      input_schema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Name for the new playlist.' },
          description: { type: 'string', description: 'Description for the playlist.' },
          public: { type: 'boolean', description: 'Whether the playlist is public (default true).' },
        },
        required: ['name'],
        additionalProperties: false,
      },
      run: async (input: Record<string, unknown>) => {
        try {
          // First get the user's profile to get their user_id
          const profileResult = await getCurrentUserProfile()
          if (!profileResult.successful) throw new Error(profileResult.error || 'Failed to get user profile')
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const userId = (profileResult.data as any).id
          
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const inp = input as any
          const result = await createPlaylist({
            user_id: userId,
            name: inp.name,
            description: inp.description,
            public: inp.public,
          })
          if (!result.successful) throw new Error(result.error || 'Unknown error')
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const data = result.data as any
          const msg = `Created playlist: "${data.name}" (ID: ${data.id})\nURL: ${data.external_urls?.spotify || 'N/A'}`
          await sseHandler.sendToolEvent('spotify_create_playlist', 'end', input, msg)
          return msg
        } catch (error) {
          const errorMsg = `Spotify error: ${error instanceof Error ? error.message : 'Unknown error'}`
          await sseHandler.sendToolEvent('spotify_create_playlist', 'end', input, errorMsg)
          return errorMsg
        }
      },
    },

    // Add Tracks to Playlist
    {
      name: 'spotify_add_tracks_to_playlist',
      description: 'Add tracks to a playlist.',
      input_schema: {
        type: 'object',
        properties: {
          playlist_id: { type: 'string', description: 'Spotify playlist ID.' },
          uris: { type: 'array', items: { type: 'string' }, description: 'Array of Spotify track URIs to add.' },
          position: { type: 'number', description: 'Position to insert tracks (0-based).' },
        },
        required: ['playlist_id', 'uris'],
        additionalProperties: false,
      },
      run: async (input: Record<string, unknown>) => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const result = await addTracksToPlaylist(input as any)
          if (!result.successful) throw new Error(result.error || 'Unknown error')
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const msg = `Added ${(input as any).uris.length} track(s) to playlist.`
          await sseHandler.sendToolEvent('spotify_add_tracks_to_playlist', 'end', input, msg)
          return msg
        } catch (error) {
          const errorMsg = `Spotify error: ${error instanceof Error ? error.message : 'Unknown error'}`
          await sseHandler.sendToolEvent('spotify_add_tracks_to_playlist', 'end', input, errorMsg)
          return errorMsg
        }
      },
    },

    // Save Tracks to Library
    {
      name: 'spotify_save_tracks',
      description: 'Save tracks to the user\'s Liked Songs.',
      input_schema: {
        type: 'object',
        properties: {
          ids: { type: 'array', items: { type: 'string' }, description: 'Array of Spotify track IDs to save.' },
        },
        required: ['ids'],
        additionalProperties: false,
      },
      run: async (input: Record<string, unknown>) => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const result = await saveTracks(input as any)
          if (!result.successful) throw new Error(result.error || 'Unknown error')
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const msg = `Saved ${(input as any).ids.length} track(s) to your library.`
          await sseHandler.sendToolEvent('spotify_save_tracks', 'end', input, msg)
          return msg
        } catch (error) {
          const errorMsg = `Spotify error: ${error instanceof Error ? error.message : 'Unknown error'}`
          await sseHandler.sendToolEvent('spotify_save_tracks', 'end', input, errorMsg)
          return errorMsg
        }
      },
    },

    // Get Available Genre Seeds
    {
      name: 'spotify_get_genres',
      description: 'Get a list of available genre seeds for recommendations.',
      input_schema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      run: async (input: Record<string, unknown>) => {
        try {
          const result = await getAvailableGenres()
          if (!result.successful) throw new Error(result.error || 'Unknown error')
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const genres = (result.data as any).genres || []
          const formatted = `Available genres for recommendations:\n${genres.join(', ')}`
          await sseHandler.sendToolEvent('spotify_get_genres', 'end', input, formatted)
          return formatted
        } catch (error) {
          const errorMsg = `Spotify error: ${error instanceof Error ? error.message : 'Unknown error'}`
          await sseHandler.sendToolEvent('spotify_get_genres', 'end', input, errorMsg)
          return errorMsg
        }
      },
    },

    // Get New Releases
    {
      name: 'spotify_get_new_releases',
      description: 'Get new album releases featured in Spotify.',
      input_schema: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Max number of albums (default 20).' },
        },
        additionalProperties: false,
      },
      run: async (input: Record<string, unknown>) => {
        try {
          const result = await getNewReleases(input)
          if (!result.successful) throw new Error(result.error || 'Unknown error')
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const data = result.data as any
          const albums = data.albums?.items || []
          if (albums.length === 0) {
            const msg = 'No new releases found.'
            await sseHandler.sendToolEvent('spotify_get_new_releases', 'end', input, msg)
            return msg
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const formatted = albums.map((a: any, i: number) => {
            const artists = a.artists?.map((ar: { name: string }) => ar.name).join(', ') || 'Unknown'
            return `${i + 1}. ${a.name} by ${artists} (${a.release_date})`
          }).join('\n')
          await sseHandler.sendToolEvent('spotify_get_new_releases', 'end', input, formatted)
          return formatted
        } catch (error) {
          const errorMsg = `Spotify error: ${error instanceof Error ? error.message : 'Unknown error'}`
          await sseHandler.sendToolEvent('spotify_get_new_releases', 'end', input, errorMsg)
          return errorMsg
        }
      },
    },

    // Transfer Playback to Device
    {
      name: 'spotify_transfer_playback',
      description: 'Transfer playback to a different device. Requires Spotify Premium.',
      input_schema: {
        type: 'object',
        properties: {
          device_ids: { type: 'array', items: { type: 'string' }, description: 'Array containing the device ID to transfer to.' },
          play: { type: 'boolean', description: 'If true, playback will start on the new device.' },
        },
        required: ['device_ids'],
        additionalProperties: false,
      },
      run: async (input: Record<string, unknown>) => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const result = await transferPlayback(input as any)
          if (!result.successful) throw new Error(result.error || 'Unknown error')
          const msg = 'Playback transferred to new device.'
          await sseHandler.sendToolEvent('spotify_transfer_playback', 'end', input, msg)
          return msg
        } catch (error) {
          const errorMsg = `Spotify error: ${error instanceof Error ? error.message : 'Unknown error'}`
          await sseHandler.sendToolEvent('spotify_transfer_playback', 'end', input, errorMsg)
          return errorMsg
        }
      },
    },

    // Get Track Audio Features
    {
      name: 'spotify_get_track_features',
      description: 'Get audio features for a track (danceability, energy, tempo, etc.).',
      input_schema: {
        type: 'object',
        properties: {
          track_id: { type: 'string', description: 'Spotify track ID.' },
        },
        required: ['track_id'],
        additionalProperties: false,
      },
      run: async (input: Record<string, unknown>) => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const result = await getTrackAudioFeatures((input as any).track_id)
          if (!result.successful) throw new Error(result.error || 'Unknown error')
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const data = result.data as any
          const formatted = `# Audio Features\n\n**Danceability:** ${(data.danceability * 100).toFixed(0)}%\n**Energy:** ${(data.energy * 100).toFixed(0)}%\n**Valence (Happiness):** ${(data.valence * 100).toFixed(0)}%\n**Tempo:** ${data.tempo?.toFixed(0)} BPM\n**Acousticness:** ${(data.acousticness * 100).toFixed(0)}%\n**Instrumentalness:** ${(data.instrumentalness * 100).toFixed(0)}%\n**Speechiness:** ${(data.speechiness * 100).toFixed(0)}%\n**Liveness:** ${(data.liveness * 100).toFixed(0)}%\n**Key:** ${data.key}\n**Mode:** ${data.mode === 1 ? 'Major' : 'Minor'}\n**Time Signature:** ${data.time_signature}/4`
          await sseHandler.sendToolEvent('spotify_get_track_features', 'end', input, formatted)
          return formatted
        } catch (error) {
          const errorMsg = `Spotify error: ${error instanceof Error ? error.message : 'Unknown error'}`
          await sseHandler.sendToolEvent('spotify_get_track_features', 'end', input, errorMsg)
          return errorMsg
        }
      },
    },

    // Get Album Tracks
    {
      name: 'spotify_get_album_tracks',
      description: 'Get the tracks from a specific album.',
      input_schema: {
        type: 'object',
        properties: {
          album_id: { type: 'string', description: 'Spotify album ID.' },
          limit: { type: 'number', description: 'Max number of tracks (default 20).' },
        },
        required: ['album_id'],
        additionalProperties: false,
      },
      run: async (input: Record<string, unknown>) => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const inp = input as any
          const result = await getAlbumTracks(inp.album_id, { limit: inp.limit })
          if (!result.successful) throw new Error(result.error || 'Unknown error')
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const data = result.data as any
          const items = data.items || []
          if (items.length === 0) {
            const msg = 'No tracks found in this album.'
            await sseHandler.sendToolEvent('spotify_get_album_tracks', 'end', input, msg)
            return msg
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const formatted = items.map((t: any, i: number) => {
            const artists = t.artists?.map((a: { name: string }) => a.name).join(', ') || 'Unknown'
            const mins = Math.floor(t.duration_ms / 60000)
            const secs = Math.floor((t.duration_ms % 60000) / 1000)
            return `${t.track_number || i + 1}. ${t.name} - ${artists} (${mins}:${secs.toString().padStart(2, '0')})`
          }).join('\n')
          await sseHandler.sendToolEvent('spotify_get_album_tracks', 'end', input, formatted)
          return formatted
        } catch (error) {
          const errorMsg = `Spotify error: ${error instanceof Error ? error.message : 'Unknown error'}`
          await sseHandler.sendToolEvent('spotify_get_album_tracks', 'end', input, errorMsg)
          return errorMsg
        }
      },
    },

    // Get Artist Albums
    {
      name: 'spotify_get_artist_albums',
      description: 'Get an artist\'s albums.',
      input_schema: {
        type: 'object',
        properties: {
          artist_id: { type: 'string', description: 'Spotify artist ID.' },
          include_groups: { type: 'string', description: 'Filter by album type: album, single, appears_on, compilation (comma-separated).' },
          limit: { type: 'number', description: 'Max number of albums (default 20).' },
        },
        required: ['artist_id'],
        additionalProperties: false,
      },
      run: async (input: Record<string, unknown>) => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const inp = input as any
          const result = await getArtistAlbums(inp.artist_id, { 
            include_groups: inp.include_groups, 
            limit: inp.limit 
          })
          if (!result.successful) throw new Error(result.error || 'Unknown error')
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const data = result.data as any
          const items = data.items || []
          if (items.length === 0) {
            const msg = 'No albums found for this artist.'
            await sseHandler.sendToolEvent('spotify_get_artist_albums', 'end', input, msg)
            return msg
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const formatted = items.map((a: any, i: number) => 
            `${i + 1}. ${a.name} (${a.album_type}) - ${a.release_date} - ${a.total_tracks} tracks`
          ).join('\n')
          await sseHandler.sendToolEvent('spotify_get_artist_albums', 'end', input, formatted)
          return formatted
        } catch (error) {
          const errorMsg = `Spotify error: ${error instanceof Error ? error.message : 'Unknown error'}`
          await sseHandler.sendToolEvent('spotify_get_artist_albums', 'end', input, errorMsg)
          return errorMsg
        }
      },
    },

    // Get Related Artists
    {
      name: 'spotify_get_related_artists',
      description: 'Get artists similar to a given artist.',
      input_schema: {
        type: 'object',
        properties: {
          artist_id: { type: 'string', description: 'Spotify artist ID.' },
        },
        required: ['artist_id'],
        additionalProperties: false,
      },
      run: async (input: Record<string, unknown>) => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const result = await getRelatedArtists((input as any).artist_id)
          if (!result.successful) throw new Error(result.error || 'Unknown error')
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const data = result.data as any
          const artists = data.artists || []
          if (artists.length === 0) {
            const msg = 'No related artists found.'
            await sseHandler.sendToolEvent('spotify_get_related_artists', 'end', input, msg)
            return msg
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const formatted = artists.map((a: any, i: number) => 
            `${i + 1}. ${a.name} (${a.genres?.slice(0, 2).join(', ') || 'N/A'}) - ${a.followers?.total?.toLocaleString() || 0} followers`
          ).join('\n')
          await sseHandler.sendToolEvent('spotify_get_related_artists', 'end', input, formatted)
          return formatted
        } catch (error) {
          const errorMsg = `Spotify error: ${error instanceof Error ? error.message : 'Unknown error'}`
          await sseHandler.sendToolEvent('spotify_get_related_artists', 'end', input, errorMsg)
          return errorMsg
        }
      },
    },

    // Get Playlist Tracks
    {
      name: 'spotify_get_playlist_tracks',
      description: 'Get the tracks from a playlist.',
      input_schema: {
        type: 'object',
        properties: {
          playlist_id: { type: 'string', description: 'Spotify playlist ID.' },
          limit: { type: 'number', description: 'Max number of tracks (default 20).' },
          offset: { type: 'number', description: 'Offset for pagination.' },
        },
        required: ['playlist_id'],
        additionalProperties: false,
      },
      run: async (input: Record<string, unknown>) => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const inp = input as any
          const result = await getPlaylistTracks(inp.playlist_id, { limit: inp.limit, offset: inp.offset })
          if (!result.successful) throw new Error(result.error || 'Unknown error')
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const data = result.data as any
          const items = data.items || []
          if (items.length === 0) {
            const msg = 'No tracks found in this playlist.'
            await sseHandler.sendToolEvent('spotify_get_playlist_tracks', 'end', input, msg)
            return msg
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const formatted = items.map((item: any, i: number) => {
            const t = item.track
            if (!t) return `${i + 1}. [Unavailable track]`
            const artists = t.artists?.map((a: { name: string }) => a.name).join(', ') || 'Unknown'
            return `${i + 1}. ${t.name} by ${artists} (URI: ${t.uri})`
          }).join('\n')
          await sseHandler.sendToolEvent('spotify_get_playlist_tracks', 'end', input, formatted)
          return formatted
        } catch (error) {
          const errorMsg = `Spotify error: ${error instanceof Error ? error.message : 'Unknown error'}`
          await sseHandler.sendToolEvent('spotify_get_playlist_tracks', 'end', input, errorMsg)
          return errorMsg
        }
      },
    },

    // Remove Tracks from Playlist
    {
      name: 'spotify_remove_playlist_items',
      description: 'Remove tracks from a playlist.',
      input_schema: {
        type: 'object',
        properties: {
          playlist_id: { type: 'string', description: 'Spotify playlist ID.' },
          uris: { type: 'array', items: { type: 'string' }, description: 'Array of Spotify track URIs to remove.' },
        },
        required: ['playlist_id', 'uris'],
        additionalProperties: false,
      },
      run: async (input: Record<string, unknown>) => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const result = await removeTracksFromPlaylist(input as any)
          if (!result.successful) throw new Error(result.error || 'Unknown error')
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const msg = `Removed ${(input as any).uris.length} track(s) from playlist.`
          await sseHandler.sendToolEvent('spotify_remove_playlist_items', 'end', input, msg)
          return msg
        } catch (error) {
          const errorMsg = `Spotify error: ${error instanceof Error ? error.message : 'Unknown error'}`
          await sseHandler.sendToolEvent('spotify_remove_playlist_items', 'end', input, errorMsg)
          return errorMsg
        }
      },
    },

    // Update Playlist Details
    {
      name: 'spotify_update_playlist_details',
      description: 'Update playlist name, description, or public/private status.',
      input_schema: {
        type: 'object',
        properties: {
          playlist_id: { type: 'string', description: 'Spotify playlist ID.' },
          name: { type: 'string', description: 'New name for the playlist.' },
          description: { type: 'string', description: 'New description for the playlist.' },
          public: { type: 'boolean', description: 'Whether the playlist should be public.' },
        },
        required: ['playlist_id'],
        additionalProperties: false,
      },
      run: async (input: Record<string, unknown>) => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const result = await updatePlaylistDetails(input as any)
          if (!result.successful) throw new Error(result.error || 'Unknown error')
          const msg = 'Playlist updated successfully.'
          await sseHandler.sendToolEvent('spotify_update_playlist_details', 'end', input, msg)
          return msg
        } catch (error) {
          const errorMsg = `Spotify error: ${error instanceof Error ? error.message : 'Unknown error'}`
          await sseHandler.sendToolEvent('spotify_update_playlist_details', 'end', input, errorMsg)
          return errorMsg
        }
      },
    },

    // Reorder Playlist Items
    {
      name: 'spotify_reorder_playlist_items',
      description: 'Reorder tracks in a playlist or replace all tracks.',
      input_schema: {
        type: 'object',
        properties: {
          playlist_id: { type: 'string', description: 'Spotify playlist ID.' },
          range_start: { type: 'number', description: 'Position of the first item to reorder.' },
          insert_before: { type: 'number', description: 'Position where items should be inserted.' },
          range_length: { type: 'number', description: 'Number of items to reorder (default 1).' },
          uris: { type: 'array', items: { type: 'string' }, description: 'New list of track URIs to replace all items.' },
        },
        required: ['playlist_id'],
        additionalProperties: false,
      },
      run: async (input: Record<string, unknown>) => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const result = await updatePlaylistItems(input as any)
          if (!result.successful) throw new Error(result.error || 'Unknown error')
          const msg = 'Playlist items updated successfully.'
          await sseHandler.sendToolEvent('spotify_reorder_playlist_items', 'end', input, msg)
          return msg
        } catch (error) {
          const errorMsg = `Spotify error: ${error instanceof Error ? error.message : 'Unknown error'}`
          await sseHandler.sendToolEvent('spotify_reorder_playlist_items', 'end', input, errorMsg)
          return errorMsg
        }
      },
    },

    // Get User Playlists
    {
      name: 'spotify_get_user_playlists',
      description: 'Get playlists owned or followed by a specific user.',
      input_schema: {
        type: 'object',
        properties: {
          user_id: { type: 'string', description: 'Spotify user ID.' },
          limit: { type: 'number', description: 'Max number of playlists (default 20).' },
        },
        required: ['user_id'],
        additionalProperties: false,
      },
      run: async (input: Record<string, unknown>) => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const inp = input as any
          const result = await getUserPlaylists(inp.user_id, { limit: inp.limit })
          if (!result.successful) throw new Error(result.error || 'Unknown error')
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const data = result.data as any
          const items = data.items || []
          if (items.length === 0) {
            const msg = 'No playlists found for this user.'
            await sseHandler.sendToolEvent('spotify_get_user_playlists', 'end', input, msg)
            return msg
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const formatted = items.map((p: any) => `- ${p.name} (ID: ${p.id}, Tracks: ${p.tracks.total})`).join('\n')
          await sseHandler.sendToolEvent('spotify_get_user_playlists', 'end', input, formatted)
          return formatted
        } catch (error) {
          const errorMsg = `Spotify error: ${error instanceof Error ? error.message : 'Unknown error'}`
          await sseHandler.sendToolEvent('spotify_get_user_playlists', 'end', input, errorMsg)
          return errorMsg
        }
      },
    },

    // Get Featured Playlists
    {
      name: 'spotify_get_featured_playlists',
      description: 'Get Spotify\'s featured playlists.',
      input_schema: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Max number of playlists (default 20).' },
          country: { type: 'string', description: 'ISO 3166-1 alpha-2 country code.' },
        },
        additionalProperties: false,
      },
      run: async (input: Record<string, unknown>) => {
        try {
          const result = await getFeaturedPlaylists(input)
          if (!result.successful) throw new Error(result.error || 'Unknown error')
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const data = result.data as any
          const items = data.playlists?.items || []
          if (items.length === 0) {
            const msg = 'No featured playlists found.'
            await sseHandler.sendToolEvent('spotify_get_featured_playlists', 'end', input, msg)
            return msg
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const formatted = items.map((p: any, i: number) => 
            `${i + 1}. ${p.name} - ${p.description || 'No description'} (ID: ${p.id})`
          ).join('\n')
          await sseHandler.sendToolEvent('spotify_get_featured_playlists', 'end', input, formatted)
          return formatted
        } catch (error) {
          const errorMsg = `Spotify error: ${error instanceof Error ? error.message : 'Unknown error'}`
          await sseHandler.sendToolEvent('spotify_get_featured_playlists', 'end', input, errorMsg)
          return errorMsg
        }
      },
    },

    // Get Category Playlists
    {
      name: 'spotify_get_category_playlists',
      description: 'Get playlists for a specific category (e.g., party, workout, chill).',
      input_schema: {
        type: 'object',
        properties: {
          category_id: { type: 'string', description: 'Category ID (e.g., "party", "workout", "chill").' },
          limit: { type: 'number', description: 'Max number of playlists (default 20).' },
        },
        required: ['category_id'],
        additionalProperties: false,
      },
      run: async (input: Record<string, unknown>) => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const inp = input as any
          const result = await getCategoryPlaylists(inp.category_id, { limit: inp.limit })
          if (!result.successful) throw new Error(result.error || 'Unknown error')
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const data = result.data as any
          const items = data.playlists?.items || []
          if (items.length === 0) {
            const msg = 'No playlists found for this category.'
            await sseHandler.sendToolEvent('spotify_get_category_playlists', 'end', input, msg)
            return msg
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const formatted = items.map((p: any, i: number) => 
            `${i + 1}. ${p.name} (ID: ${p.id})`
          ).join('\n')
          await sseHandler.sendToolEvent('spotify_get_category_playlists', 'end', input, formatted)
          return formatted
        } catch (error) {
          const errorMsg = `Spotify error: ${error instanceof Error ? error.message : 'Unknown error'}`
          await sseHandler.sendToolEvent('spotify_get_category_playlists', 'end', input, errorMsg)
          return errorMsg
        }
      },
    },

    // Remove Saved Tracks
    {
      name: 'spotify_remove_saved_tracks',
      description: 'Remove tracks from the user\'s Liked Songs.',
      input_schema: {
        type: 'object',
        properties: {
          ids: { type: 'array', items: { type: 'string' }, description: 'Array of Spotify track IDs to remove.' },
        },
        required: ['ids'],
        additionalProperties: false,
      },
      run: async (input: Record<string, unknown>) => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const result = await removeSavedTracks(input as any)
          if (!result.successful) throw new Error(result.error || 'Unknown error')
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const msg = `Removed ${(input as any).ids.length} track(s) from your library.`
          await sseHandler.sendToolEvent('spotify_remove_saved_tracks', 'end', input, msg)
          return msg
        } catch (error) {
          const errorMsg = `Spotify error: ${error instanceof Error ? error.message : 'Unknown error'}`
          await sseHandler.sendToolEvent('spotify_remove_saved_tracks', 'end', input, errorMsg)
          return errorMsg
        }
      },
    },

    // Check Saved Tracks
    {
      name: 'spotify_check_saved_tracks',
      description: 'Check if tracks are in the user\'s Liked Songs.',
      input_schema: {
        type: 'object',
        properties: {
          ids: { type: 'array', items: { type: 'string' }, description: 'Array of Spotify track IDs to check.' },
        },
        required: ['ids'],
        additionalProperties: false,
      },
      run: async (input: Record<string, unknown>) => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const result = await checkSavedTracks((input as any).ids)
          if (!result.successful) throw new Error(result.error || 'Unknown error')
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const ids = (input as any).ids as string[]
          const saved = result.data as boolean[]
          const formatted = ids.map((id, i) => `${id}: ${saved[i] ? '✓ Saved' : '✗ Not saved'}`).join('\n')
          await sseHandler.sendToolEvent('spotify_check_saved_tracks', 'end', input, formatted)
          return formatted
        } catch (error) {
          const errorMsg = `Spotify error: ${error instanceof Error ? error.message : 'Unknown error'}`
          await sseHandler.sendToolEvent('spotify_check_saved_tracks', 'end', input, errorMsg)
          return errorMsg
        }
      },
    },

    // Get Saved Albums
    {
      name: 'spotify_get_saved_albums',
      description: 'Get the current user\'s saved albums.',
      input_schema: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Max number of albums (default 20).' },
          offset: { type: 'number', description: 'Offset for pagination.' },
        },
        additionalProperties: false,
      },
      run: async (input: Record<string, unknown>) => {
        try {
          const result = await getSavedAlbums(input)
          if (!result.successful) throw new Error(result.error || 'Unknown error')
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const data = result.data as any
          const items = data.items || []
          if (items.length === 0) {
            const msg = 'No saved albums found.'
            await sseHandler.sendToolEvent('spotify_get_saved_albums', 'end', input, msg)
            return msg
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const formatted = items.map((item: any, i: number) => {
            const a = item.album
            const artists = a.artists?.map((ar: { name: string }) => ar.name).join(', ') || 'Unknown'
            return `${i + 1}. ${a.name} by ${artists} (Added: ${item.added_at})`
          }).join('\n')
          await sseHandler.sendToolEvent('spotify_get_saved_albums', 'end', input, formatted)
          return formatted
        } catch (error) {
          const errorMsg = `Spotify error: ${error instanceof Error ? error.message : 'Unknown error'}`
          await sseHandler.sendToolEvent('spotify_get_saved_albums', 'end', input, errorMsg)
          return errorMsg
        }
      },
    },

    // Save Albums
    {
      name: 'spotify_save_albums',
      description: 'Save albums to the user\'s library.',
      input_schema: {
        type: 'object',
        properties: {
          ids: { type: 'array', items: { type: 'string' }, description: 'Array of Spotify album IDs to save.' },
        },
        required: ['ids'],
        additionalProperties: false,
      },
      run: async (input: Record<string, unknown>) => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const result = await saveAlbums(input as any)
          if (!result.successful) throw new Error(result.error || 'Unknown error')
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const msg = `Saved ${(input as any).ids.length} album(s) to your library.`
          await sseHandler.sendToolEvent('spotify_save_albums', 'end', input, msg)
          return msg
        } catch (error) {
          const errorMsg = `Spotify error: ${error instanceof Error ? error.message : 'Unknown error'}`
          await sseHandler.sendToolEvent('spotify_save_albums', 'end', input, errorMsg)
          return errorMsg
        }
      },
    },

    // Remove Saved Albums
    {
      name: 'spotify_remove_saved_albums',
      description: 'Remove albums from the user\'s library.',
      input_schema: {
        type: 'object',
        properties: {
          ids: { type: 'array', items: { type: 'string' }, description: 'Array of Spotify album IDs to remove.' },
        },
        required: ['ids'],
        additionalProperties: false,
      },
      run: async (input: Record<string, unknown>) => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const result = await removeSavedAlbums(input as any)
          if (!result.successful) throw new Error(result.error || 'Unknown error')
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const msg = `Removed ${(input as any).ids.length} album(s) from your library.`
          await sseHandler.sendToolEvent('spotify_remove_saved_albums', 'end', input, msg)
          return msg
        } catch (error) {
          const errorMsg = `Spotify error: ${error instanceof Error ? error.message : 'Unknown error'}`
          await sseHandler.sendToolEvent('spotify_remove_saved_albums', 'end', input, errorMsg)
          return errorMsg
        }
      },
    },

    // Get Browse Categories
    {
      name: 'spotify_get_categories',
      description: 'Get a list of browse categories used to tag items in Spotify.',
      input_schema: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Max number of categories (default 20).' },
          country: { type: 'string', description: 'ISO 3166-1 alpha-2 country code.' },
        },
        additionalProperties: false,
      },
      run: async (input: Record<string, unknown>) => {
        try {
          const result = await getBrowseCategories(input)
          if (!result.successful) throw new Error(result.error || 'Unknown error')
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const data = result.data as any
          const items = data.categories?.items || []
          if (items.length === 0) {
            const msg = 'No categories found.'
            await sseHandler.sendToolEvent('spotify_get_categories', 'end', input, msg)
            return msg
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const formatted = items.map((c: any) => `- ${c.name} (ID: ${c.id})`).join('\n')
          await sseHandler.sendToolEvent('spotify_get_categories', 'end', input, formatted)
          return formatted
        } catch (error) {
          const errorMsg = `Spotify error: ${error instanceof Error ? error.message : 'Unknown error'}`
          await sseHandler.sendToolEvent('spotify_get_categories', 'end', input, errorMsg)
          return errorMsg
        }
      },
    },

    // Follow Playlist
    {
      name: 'spotify_follow_playlist',
      description: 'Follow a playlist.',
      input_schema: {
        type: 'object',
        properties: {
          playlist_id: { type: 'string', description: 'Spotify playlist ID.' },
          public: { type: 'boolean', description: 'Whether to follow publicly (default true).' },
        },
        required: ['playlist_id'],
        additionalProperties: false,
      },
      run: async (input: Record<string, unknown>) => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const inp = input as any
          const result = await followPlaylist(inp.playlist_id, inp.public)
          if (!result.successful) throw new Error(result.error || 'Unknown error')
          const msg = 'Now following this playlist.'
          await sseHandler.sendToolEvent('spotify_follow_playlist', 'end', input, msg)
          return msg
        } catch (error) {
          const errorMsg = `Spotify error: ${error instanceof Error ? error.message : 'Unknown error'}`
          await sseHandler.sendToolEvent('spotify_follow_playlist', 'end', input, errorMsg)
          return errorMsg
        }
      },
    },

    // Unfollow Playlist
    {
      name: 'spotify_unfollow_playlist',
      description: 'Unfollow a playlist.',
      input_schema: {
        type: 'object',
        properties: {
          playlist_id: { type: 'string', description: 'Spotify playlist ID.' },
        },
        required: ['playlist_id'],
        additionalProperties: false,
      },
      run: async (input: Record<string, unknown>) => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const result = await unfollowPlaylist((input as any).playlist_id)
          if (!result.successful) throw new Error(result.error || 'Unknown error')
          const msg = 'Unfollowed this playlist.'
          await sseHandler.sendToolEvent('spotify_unfollow_playlist', 'end', input, msg)
          return msg
        } catch (error) {
          const errorMsg = `Spotify error: ${error instanceof Error ? error.message : 'Unknown error'}`
          await sseHandler.sendToolEvent('spotify_unfollow_playlist', 'end', input, errorMsg)
          return errorMsg
        }
      },
    },
  ]
}
