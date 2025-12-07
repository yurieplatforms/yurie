---
title: Spotify
subtitle: Learn how to use Spotify with Composio
category: Entertainment & Media
image:
  type: url
  value: 'https://og.composio.dev/api/og?title=Using%20Spotify%20with%20Composio'
---


## Overview

**SLUG**: `SPOTIFY`

### Description
Spotify is a digital music and podcast streaming service with millions of tracks, personalized playlists, and social sharing features

### Authentication Details

<Accordion title="OAuth2">
<ParamField path="client_id" type="string" required={true}>
</ParamField>

<ParamField path="client_secret" type="string" required={true}>
</ParamField>

<ParamField path="full" type="string" required={true} default="https://api.spotify.com/v1">
</ParamField>

<ParamField path="oauth_redirect_uri" type="string" default="https://backend.composio.dev/api/v1/auth-apps/add">
</ParamField>

<ParamField path="scopes" type="string" default="user-read-private user-read-email app-remote-control streaming user-modify-playback-state user-read-playback-state user-read-currently-playing">
</ParamField>

</Accordion>


## Connecting to Spotify
### Create an auth config
Use the dashboard to create an auth config for the Spotify toolkit. This allows you to connect multiple Spotify accounts to Composio for agents to use.

<Steps>
  <Step title="Select App">
    Navigate to **[Spotify](https://platform.composio.dev?next_page=/marketplace/Spotify)**.
  </Step>
  <Step title="Configure Auth Config Settings">
    Select among the supported auth schemes of and configure them here.
  </Step>
  <Step title="Create and Get auth config ID">
    Click **"Create Spotify Auth Config"**. After creation, **copy the displayed ID starting with `ac_`**. This is your auth config ID. This is _not_ a sensitive ID -- you can save it in environment variables or a database.
    **This ID will be used to create connections to the toolkit for a given user.**
  </Step>
</Steps>


### Connect Your Account

#### Using OAuth2

<CodeGroup>
```python title="Python" maxLines=40 wordWrap
from composio import Composio

# Replace these with your actual values
spotify_auth_config_id = "ac_YOUR_SPOTIFY_CONFIG_ID" # Auth config ID created above
user_id = "0000-0000-0000"  # UUID from database/application

composio = Composio()


def authenticate_toolkit(user_id: str, auth_config_id: str):
    connection_request = composio.connected_accounts.initiate(
        user_id=user_id,
        auth_config_id=auth_config_id,
    )

    print(
        f"Visit this URL to authenticate Spotify: {connection_request.redirect_url}"
    )

    # This will wait for the auth flow to be completed
    connection_request.wait_for_connection(timeout=15)
    return connection_request.id


connection_id = authenticate_toolkit(user_id, spotify_auth_config_id)

# You can also verify the connection status using:
connected_account = composio.connected_accounts.get(connection_id)
print(f"Connected account: {connected_account}")
```
```typescript title="TypeScript" maxLines=40 wordWrap
import { Composio } from '@composio/core';

// Replace these with your actual values
const spotify_auth_config_id = "ac_YOUR_SPOTIFY_CONFIG_ID"; // Auth config ID created above
const userId = "user@example.com"; // User ID from database/application

const composio = new Composio();

async function authenticateToolkit(userId: string, authConfigId: string) {
  const connectionRequest = await composio.connectedAccounts.initiate(
    userId,
    authConfigId
  );

  console.log(`Visit this URL to authenticate Spotify: ${connectionRequest.redirectUrl}`);
  
  // This will wait for the auth flow to be completed
  await connectionRequest.waitForConnection(60);
  
  return connectionRequest.id;
}

// Authenticate the toolkit
const connectionId = await authenticateToolkit(userId, spotify_auth_config_id);

// You can also verify the connection status using:
const connectedAccount = await composio.connectedAccounts.get(connectionId);
console.log("Connected account:", connectedAccount);
```
</CodeGroup>


## Tools

### Executing tools

To prototype you can execute some tools to see the responses and working on the [Spotify toolkit's playground](https://app.composio.dev/app/Spotify)

<Tabs>
<Tab title="OpenAI (Python)">
```python title="Python" maxLines=40 wordWrap
from composio import Composio
from openai import OpenAI
import json

openai = OpenAI()
composio = Composio()

# User ID must be a valid UUID format
user_id = "0000-0000-0000"  # Replace with actual user UUID from your database

tools = composio.tools.get(user_id=user_id, toolkits=["SPOTIFY"])

print("[!] Tools:")
print(json.dumps(tools))

def invoke_llm(task = "What can you do?"):
    completion = openai.chat.completions.create(
        model="gpt-4o",
        messages=[
            {
                "role": "user",
                "content": task,  # Your task here!
            },
        ],
        tools=tools,
    )

    # Handle Result from tool call
    result = composio.provider.handle_tool_calls(user_id=user_id, response=completion)
    print(f"[!] Completion: {completion}")
    print(f"[!] Tool call result: {result}")

invoke_llm()
```

</Tab>
<Tab title="Anthropic (TypeScript)">
```typescript title="TypeScript" maxLines=40 wordWrap
import { Composio } from '@composio/core';
import { AnthropicProvider } from '@composio/anthropic';
import { Anthropic } from '@anthropic-ai/sdk';

const composio = new Composio({
  provider: new AnthropicProvider({
    cacheTools: false, // default
  }),
});

const anthropic = new Anthropic();

// User ID must be a valid UUID format
const userId = "0000-0000-0000"; // Replace with actual user UUID from your database

// Get tools for Spotify
const tools = await composio.tools.get(userId, {
  toolkits: ["SPOTIFY"],
});

console.log("[!] Tools:", tools);

// Create a message with the tools
const msg = await anthropic.messages.create({
  model: 'claude-3-5-sonnet-20240620',
  messages: [
    {
      role: 'user',
      content: 'What can you do with Spotify?', // Your task here!
    },
  ],
  tools: tools,
  max_tokens: 1000,
});

// Handle tool calls if any
const result = await composio.provider.handleToolCalls(userId, msg);
console.log("[!] Result:", result);
```

</Tab>
<Tab title="Google (Python)">
```python title="Python" maxLines=40 wordWrap
from composio import Composio
from composio_google import GoogleProvider
from google import genai
from google.genai import types

# Create composio client
composio = Composio(provider=GoogleProvider())
# Create google client
client = genai.Client()

# User ID must be a valid UUID format
user_id = "0000-0000-0000"  # Replace with actual user UUID from your database

# Get tools for Spotify
tools = composio.tools.get(user_id, toolkits=["SPOTIFY"])

print("[!] Tools:", tools)

# Create genai client config
config = types.GenerateContentConfig(tools=tools)

# Use the chat interface
chat = client.chats.create(model="gemini-2.0-flash", config=config)
response = chat.send_message("What can you do with Spotify?")
print("[!] Response:", response.text)
```

</Tab>
<Tab title="Vercel (TypeScript)">
```typescript title="TypeScript" maxLines=40 wordWrap
import { Composio } from '@composio/core';
import { generateText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { VercelProvider } from '@composio/vercel';

const composio = new Composio({
  apiKey: process.env.COMPOSIO_API_KEY,
  provider: new VercelProvider(),
});

// User ID must be a valid UUID format
const userId = "0000-0000-0000"; // Replace with actual user UUID from your database

// Get tools for Spotify
const tools = await composio.tools.get(userId, { 
  toolkits: ["SPOTIFY"] 
});

console.log("[!] Tools:", tools);

// Generate text with tools
const { text } = await generateText({
  model: anthropic('claude-3-7-sonnet-20250219'),
  messages: [
    {
      role: 'user',
      content: "What can you do with Spotify?", // Your task here!
    },
  ],
  tools,
  maxSteps: 3,
});

console.log("[!] Result:", text);
```

</Tab>
</Tabs>

### Tool List

<AccordionGroup>
<Accordion title="SPOTIFY_ADD_ITEMS_TO_PLAYLIST">
**Tool Name:** Add items to playlist

**Description**

```text wordWrap
Add one or more items to a user's playlist.
```


**Action Parameters**

<ParamField path="playlist_id" type="string" required={true}>
</ParamField>

<ParamField path="position" type="integer">
</ParamField>

<ParamField path="uris" type="array">
</ParamField>


**Action Response**

<ParamField path="data" type="object" required={true}>
</ParamField>

<ParamField path="error" type="string">
</ParamField>

<ParamField path="successful" type="boolean" required={true}>
</ParamField>

</Accordion>

<Accordion title="SPOTIFY_ADD_ITEM_TO_PLAYBACK_QUEUE">
**Tool Name:** Add item to playback queue

**Description**

```text wordWrap
Add an item to the end of the user's current playback queue. This API only works for users who have Spotify Premium. The order of execution is not guaranteed when you use this API with other Player API endpoints.
```


**Action Parameters**

<ParamField path="device_id" type="string">
</ParamField>

<ParamField path="uri" type="string" required={true}>
</ParamField>


**Action Response**

<ParamField path="data" type="object" required={true}>
</ParamField>

<ParamField path="error" type="string">
</ParamField>

<ParamField path="successful" type="boolean" required={true}>
</ParamField>

</Accordion>

<Accordion title="SPOTIFY_ADD_TRACKS_TO_PLAYLIST">
**Tool Name:** Add items to playlist

**Description**

```text wordWrap
Add one or more items to a user's playlist. <<DEPRECATED use add_items_to_playlist>>
```


**Action Parameters**

<ParamField path="playlist_id" type="string" required={true}>
</ParamField>

<ParamField path="position" type="integer">
</ParamField>

<ParamField path="uris" type="array">
</ParamField>


**Action Response**

<ParamField path="data" type="object" required={true}>
</ParamField>

<ParamField path="error" type="string">
</ParamField>

<ParamField path="successful" type="boolean" required={true}>
</ParamField>

</Accordion>

<Accordion title="SPOTIFY_CHANGE_PLAYLIST_DETAILS">
**Tool Name:** Change playlist details

**Description**

```text wordWrap
Change a playlist's name and public/private state. (The user must, of course, own the playlist.)
```


**Action Parameters**

<ParamField path="collaborative" type="boolean">
</ParamField>

<ParamField path="description" type="string">
</ParamField>

<ParamField path="name" type="string">
</ParamField>

<ParamField path="playlist_id" type="string" required={true}>
</ParamField>

<ParamField path="public" type="boolean">
</ParamField>


**Action Response**

<ParamField path="data" type="object" required={true}>
</ParamField>

<ParamField path="error" type="string">
</ParamField>

<ParamField path="successful" type="boolean" required={true}>
</ParamField>

</Accordion>

<Accordion title="SPOTIFY_CHECK_IF_USER_FOLLOWS_ARTISTS_OR_USERS">
**Tool Name:** Check if user follows artists or users

**Description**

```text wordWrap
Check to see if the current user is following one or more artists or other Spotify users.
```


**Action Parameters**

<ParamField path="ids" type="string" required={true}>
</ParamField>

<ParamField path="type" type="string" required={true}>
</ParamField>


**Action Response**

<ParamField path="data" type="object" required={true}>
</ParamField>

<ParamField path="error" type="string">
</ParamField>

<ParamField path="successful" type="boolean" required={true}>
</ParamField>

</Accordion>

<Accordion title="SPOTIFY_CHECK_IF_USERS_FOLLOW_PLAYLIST">
**Tool Name:** Check if users follow playlist

**Description**

```text wordWrap
Check to see if one or more Spotify users are following a specified playlist.
```


**Action Parameters**

<ParamField path="ids" type="string" required={true}>
</ParamField>

<ParamField path="playlist_id" type="string" required={true}>
</ParamField>


**Action Response**

<ParamField path="data" type="object" required={true}>
</ParamField>

<ParamField path="error" type="string">
</ParamField>

<ParamField path="successful" type="boolean" required={true}>
</ParamField>

</Accordion>

<Accordion title="SPOTIFY_CHECK_USER_S_SAVED_ALBUMS">
**Tool Name:** Check user s saved albums

**Description**

```text wordWrap
Check if one or more albums is already saved in the current Spotify user's 'Your Music' library.
```


**Action Parameters**

<ParamField path="ids" type="string" required={true}>
</ParamField>


**Action Response**

<ParamField path="data" type="object" required={true}>
</ParamField>

<ParamField path="error" type="string">
</ParamField>

<ParamField path="successful" type="boolean" required={true}>
</ParamField>

</Accordion>

<Accordion title="SPOTIFY_CHECK_USER_S_SAVED_AUDIOBOOKS">
**Tool Name:** Check user s saved audiobooks

**Description**

```text wordWrap
Check if one or more audiobooks are already saved in the current Spotify user's library.
```


**Action Parameters**

<ParamField path="ids" type="string" required={true}>
</ParamField>


**Action Response**

<ParamField path="data" type="object" required={true}>
</ParamField>

<ParamField path="error" type="string">
</ParamField>

<ParamField path="successful" type="boolean" required={true}>
</ParamField>

</Accordion>

<Accordion title="SPOTIFY_CHECK_USER_S_SAVED_EPISODES">
**Tool Name:** Check user s saved episodes

**Description**

```text wordWrap
This Spotify API endpoint (in beta) checks if episodes are saved in a user's library. Feedback and issues can be shared in the developer forum.
```


**Action Parameters**

<ParamField path="ids" type="string" required={true}>
</ParamField>


**Action Response**

<ParamField path="data" type="object" required={true}>
</ParamField>

<ParamField path="error" type="string">
</ParamField>

<ParamField path="successful" type="boolean" required={true}>
</ParamField>

</Accordion>

<Accordion title="SPOTIFY_CHECK_USER_S_SAVED_SHOWS">
**Tool Name:** Check user s saved shows

**Description**

```text wordWrap
Check if one or more shows is already saved in the current Spotify user's library.
```


**Action Parameters**

<ParamField path="ids" type="string" required={true}>
</ParamField>


**Action Response**

<ParamField path="data" type="object" required={true}>
</ParamField>

<ParamField path="error" type="string">
</ParamField>

<ParamField path="successful" type="boolean" required={true}>
</ParamField>

</Accordion>

<Accordion title="SPOTIFY_CHECK_USER_S_SAVED_TRACKS">
**Tool Name:** Check user s saved tracks

**Description**

```text wordWrap
Check if one or more tracks is already saved in the current Spotify user's 'Your Music' library.
```


**Action Parameters**

<ParamField path="ids" type="string" required={true}>
</ParamField>


**Action Response**

<ParamField path="data" type="object" required={true}>
</ParamField>

<ParamField path="error" type="string">
</ParamField>

<ParamField path="successful" type="boolean" required={true}>
</ParamField>

</Accordion>

<Accordion title="SPOTIFY_CREATE_PLAYLIST">
**Tool Name:** Create playlist

**Description**

```text wordWrap
Create a playlist for a Spotify user. (The playlist will be empty until you [add tracks](/documentation/web-api/reference/add-tracks-to-playlist).) Each user is generally limited to a maximum of 11000 playlists.
```


**Action Parameters**

<ParamField path="collaborative" type="boolean">
</ParamField>

<ParamField path="description" type="string">
</ParamField>

<ParamField path="name" type="string" required={true}>
</ParamField>

<ParamField path="public" type="boolean">
</ParamField>

<ParamField path="user_id" type="string" required={true}>
</ParamField>


**Action Response**

<ParamField path="data" type="object" required={true}>
</ParamField>

<ParamField path="error" type="string">
</ParamField>

<ParamField path="successful" type="boolean" required={true}>
</ParamField>

</Accordion>

<Accordion title="SPOTIFY_FOLLOW_ARTISTS_OR_USERS">
**Tool Name:** Follow artists or users

**Description**

```text wordWrap
Add the current user as a follower of one or more artists or other Spotify users.
```


**Action Parameters**

<ParamField path="ids" type="array" required={true}>
</ParamField>

<ParamField path="type" type="string" required={true}>
</ParamField>


**Action Response**

<ParamField path="data" type="object" required={true}>
</ParamField>

<ParamField path="error" type="string">
</ParamField>

<ParamField path="successful" type="boolean" required={true}>
</ParamField>

</Accordion>

<Accordion title="SPOTIFY_FOLLOW_PLAYLIST">
**Tool Name:** Follow playlist

**Description**

```text wordWrap
Add the current user as a follower of a playlist.
```


**Action Parameters**

<ParamField path="playlist_id" type="string" required={true}>
</ParamField>

<ParamField path="public" type="boolean">
</ParamField>


**Action Response**

<ParamField path="data" type="object" required={true}>
</ParamField>

<ParamField path="error" type="string">
</ParamField>

<ParamField path="successful" type="boolean" required={true}>
</ParamField>

</Accordion>

<Accordion title="SPOTIFY_GET_A_CHAPTER">
**Tool Name:** Get a chapter

**Description**

```text wordWrap
Get Spotify catalog information for a single audiobook chapter. Chapters are only available within the US, UK, Canada, Ireland, New Zealand and Australia markets.
```


**Action Parameters**

<ParamField path="id" type="string" required={true}>
</ParamField>

<ParamField path="market" type="string">
</ParamField>


**Action Response**

<ParamField path="data" type="object" required={true}>
</ParamField>

<ParamField path="error" type="string">
</ParamField>

<ParamField path="successful" type="boolean" required={true}>
</ParamField>

</Accordion>

<Accordion title="SPOTIFY_GET_ALBUM">
**Tool Name:** Get album

**Description**

```text wordWrap
Get Spotify catalog information for a single album.
```


**Action Parameters**

<ParamField path="id" type="string" required={true}>
</ParamField>

<ParamField path="market" type="string">
</ParamField>


**Action Response**

<ParamField path="data" type="object" required={true}>
</ParamField>

<ParamField path="error" type="string">
</ParamField>

<ParamField path="successful" type="boolean" required={true}>
</ParamField>

</Accordion>

<Accordion title="SPOTIFY_GET_ALBUM_TRACKS">
**Tool Name:** Get album tracks

**Description**

```text wordWrap
Get Spotify catalog information about an album’s tracks. Optional parameters can be used to limit the number of tracks returned.
```


**Action Parameters**

<ParamField path="id" type="string" required={true}>
</ParamField>

<ParamField path="limit" type="integer" default="20">
</ParamField>

<ParamField path="market" type="string">
</ParamField>

<ParamField path="offset" type="integer">
</ParamField>


**Action Response**

<ParamField path="data" type="object" required={true}>
</ParamField>

<ParamField path="error" type="string">
</ParamField>

<ParamField path="successful" type="boolean" required={true}>
</ParamField>

</Accordion>

<Accordion title="SPOTIFY_GET_A_LIST_OF_CURRENT_USERS_PLAYLISTS">
**Tool Name:** Get current user s playlists

**Description**

```text wordWrap
Get a list of the playlists owned or followed by the current Spotify user. <<DEPRECATED use get_current_user_s_playlists>>
```


**Action Parameters**

<ParamField path="limit" type="integer" default="20">
</ParamField>

<ParamField path="offset" type="integer">
</ParamField>


**Action Response**

<ParamField path="data" type="object" required={true}>
</ParamField>

<ParamField path="error" type="string">
</ParamField>

<ParamField path="successful" type="boolean" required={true}>
</ParamField>

</Accordion>

<Accordion title="SPOTIFY_GET_AN_ARTIST">
**Tool Name:** Get artist

**Description**

```text wordWrap
Get Spotify catalog information for a single artist identified by their unique Spotify ID. <<DEPRECATED use get_artist>>
```


**Action Parameters**

<ParamField path="id" type="string" required={true}>
</ParamField>


**Action Response**

<ParamField path="data" type="object" required={true}>
</ParamField>

<ParamField path="error" type="string">
</ParamField>

<ParamField path="successful" type="boolean" required={true}>
</ParamField>

</Accordion>

<Accordion title="SPOTIFY_GET_AN_ARTISTS_ALBUMS">
**Tool Name:** Get artist s albums

**Description**

```text wordWrap
Get Spotify catalog information about an artist's albums. <<DEPRECATED use get_artist_s_albums>>
```


**Action Parameters**

<ParamField path="id" type="string" required={true}>
</ParamField>

<ParamField path="include_groups" type="string">
</ParamField>

<ParamField path="limit" type="integer" default="20">
</ParamField>

<ParamField path="market" type="string">
</ParamField>

<ParamField path="offset" type="integer">
</ParamField>


**Action Response**

<ParamField path="data" type="object" required={true}>
</ParamField>

<ParamField path="error" type="string">
</ParamField>

<ParamField path="successful" type="boolean" required={true}>
</ParamField>

</Accordion>

<Accordion title="SPOTIFY_GET_AN_ARTISTS_TOP_TRACKS">
**Tool Name:** Get artist s top tracks

**Description**

```text wordWrap
Get Spotify catalog information about an artist's top tracks by country. <<DEPRECATED use get_artist_s_top_tracks>>
```


**Action Parameters**

<ParamField path="id" type="string" required={true}>
</ParamField>

<ParamField path="market" type="string">
</ParamField>


**Action Response**

<ParamField path="data" type="object" required={true}>
</ParamField>

<ParamField path="error" type="string">
</ParamField>

<ParamField path="successful" type="boolean" required={true}>
</ParamField>

</Accordion>

<Accordion title="SPOTIFY_GET_AN_AUDIOBOOK">
**Tool Name:** Get an audiobook

**Description**

```text wordWrap
Get Spotify catalog information for a single audiobook. Audiobooks are only available within the US, UK, Canada, Ireland, New Zealand and Australia markets.
```


**Action Parameters**

<ParamField path="id" type="string" required={true}>
</ParamField>

<ParamField path="market" type="string">
</ParamField>


**Action Response**

<ParamField path="data" type="object" required={true}>
</ParamField>

<ParamField path="error" type="string">
</ParamField>

<ParamField path="successful" type="boolean" required={true}>
</ParamField>

</Accordion>

<Accordion title="SPOTIFY_GET_ARTIST">
**Tool Name:** Get artist

**Description**

```text wordWrap
Get Spotify catalog information for a single artist identified by their unique Spotify ID.
```


**Action Parameters**

<ParamField path="id" type="string" required={true}>
</ParamField>


**Action Response**

<ParamField path="data" type="object" required={true}>
</ParamField>

<ParamField path="error" type="string">
</ParamField>

<ParamField path="successful" type="boolean" required={true}>
</ParamField>

</Accordion>

<Accordion title="SPOTIFY_GET_ARTIST_S_ALBUMS">
**Tool Name:** Get artist s albums

**Description**

```text wordWrap
Get Spotify catalog information about an artist's albums.
```


**Action Parameters**

<ParamField path="id" type="string" required={true}>
</ParamField>

<ParamField path="include_groups" type="string">
</ParamField>

<ParamField path="limit" type="integer" default="20">
</ParamField>

<ParamField path="market" type="string">
</ParamField>

<ParamField path="offset" type="integer">
</ParamField>


**Action Response**

<ParamField path="data" type="object" required={true}>
</ParamField>

<ParamField path="error" type="string">
</ParamField>

<ParamField path="successful" type="boolean" required={true}>
</ParamField>

</Accordion>

<Accordion title="SPOTIFY_GET_ARTIST_S_RELATED_ARTISTS">
**Tool Name:** Get artist s related artists

**Description**

```text wordWrap
Get Spotify catalog information about artists similar to a given artist. Similarity is based on analysis of the Spotify community's listening history.
```


**Action Parameters**

<ParamField path="id" type="string" required={true}>
</ParamField>


**Action Response**

<ParamField path="data" type="object" required={true}>
</ParamField>

<ParamField path="error" type="string">
</ParamField>

<ParamField path="successful" type="boolean" required={true}>
</ParamField>

</Accordion>

<Accordion title="SPOTIFY_GET_ARTIST_S_TOP_TRACKS">
**Tool Name:** Get artist s top tracks

**Description**

```text wordWrap
Get Spotify catalog information about an artist's top tracks by country.
```


**Action Parameters**

<ParamField path="id" type="string" required={true}>
</ParamField>

<ParamField path="market" type="string">
</ParamField>


**Action Response**

<ParamField path="data" type="object" required={true}>
</ParamField>

<ParamField path="error" type="string">
</ParamField>

<ParamField path="successful" type="boolean" required={true}>
</ParamField>

</Accordion>

<Accordion title="SPOTIFY_GET_A_SHOWS_EPISODES">
**Tool Name:** Get show episodes

**Description**

```text wordWrap
Get Spotify catalog information about an show’s episodes. Optional parameters can be used to limit the number of episodes returned. <<DEPRECATED use get_show_episodes>>
```


**Action Parameters**

<ParamField path="id" type="string" required={true}>
</ParamField>

<ParamField path="limit" type="integer" default="20">
</ParamField>

<ParamField path="market" type="string">
</ParamField>

<ParamField path="offset" type="integer">
</ParamField>


**Action Response**

<ParamField path="data" type="object" required={true}>
</ParamField>

<ParamField path="error" type="string">
</ParamField>

<ParamField path="successful" type="boolean" required={true}>
</ParamField>

</Accordion>

<Accordion title="SPOTIFY_GET_AUDIOBOOK_CHAPTERS">
**Tool Name:** Get audiobook chapters

**Description**

```text wordWrap
Get Spotify catalog information about an audiobook's chapters. Audiobooks are only available within the US, UK, Canada, Ireland, New Zealand and Australia markets.
```


**Action Parameters**

<ParamField path="id" type="string" required={true}>
</ParamField>

<ParamField path="limit" type="integer" default="20">
</ParamField>

<ParamField path="market" type="string">
</ParamField>

<ParamField path="offset" type="integer">
</ParamField>


**Action Response**

<ParamField path="data" type="object" required={true}>
</ParamField>

<ParamField path="error" type="string">
</ParamField>

<ParamField path="successful" type="boolean" required={true}>
</ParamField>

</Accordion>

<Accordion title="SPOTIFY_GET_A_USERS_AVAILABLE_DEVICES">
**Tool Name:** Get available devices

**Description**

```text wordWrap
Get information about a user’s available Spotify Connect devices. Some device models are not supported and will not be listed in the API response. <<DEPRECATED use get_available_devices>>
```


**Action Parameters**



**Action Response**

<ParamField path="data" type="object" required={true}>
</ParamField>

<ParamField path="error" type="string">
</ParamField>

<ParamField path="successful" type="boolean" required={true}>
</ParamField>

</Accordion>

<Accordion title="SPOTIFY_GET_AVAILABLE_DEVICES">
**Tool Name:** Get available devices

**Description**

```text wordWrap
Get information about a user’s available Spotify Connect devices. Some device models are not supported and will not be listed in the API response.
```


**Action Parameters**



**Action Response**

<ParamField path="data" type="object" required={true}>
</ParamField>

<ParamField path="error" type="string">
</ParamField>

<ParamField path="successful" type="boolean" required={true}>
</ParamField>

</Accordion>

<Accordion title="SPOTIFY_GET_AVAILABLE_GENRE_SEEDS">
**Tool Name:** Get available genre seeds

**Description**

```text wordWrap
Retrieve a list of available genres seed parameter values for [recommendations](/documentation/web-api/reference/get-recommendations).
```


**Action Parameters**



**Action Response**

<ParamField path="data" type="object" required={true}>
</ParamField>

<ParamField path="error" type="string">
</ParamField>

<ParamField path="successful" type="boolean" required={true}>
</ParamField>

</Accordion>

<Accordion title="SPOTIFY_GET_AVAILABLE_MARKETS">
**Tool Name:** Get available markets

**Description**

```text wordWrap
Get the list of markets where Spotify is available.
```


**Action Parameters**



**Action Response**

<ParamField path="data" type="object" required={true}>
</ParamField>

<ParamField path="error" type="string">
</ParamField>

<ParamField path="successful" type="boolean" required={true}>
</ParamField>

</Accordion>

<Accordion title="SPOTIFY_GET_CATEGORY_S_PLAYLISTS">
**Tool Name:** Get category s playlists

**Description**

```text wordWrap
Get a list of Spotify playlists tagged with a particular category.
```


**Action Parameters**

<ParamField path="category_id" type="string" required={true}>
</ParamField>

<ParamField path="limit" type="integer" default="20">
</ParamField>

<ParamField path="offset" type="integer">
</ParamField>


**Action Response**

<ParamField path="data" type="object" required={true}>
</ParamField>

<ParamField path="error" type="string">
</ParamField>

<ParamField path="successful" type="boolean" required={true}>
</ParamField>

</Accordion>

<Accordion title="SPOTIFY_GET_CURRENTLY_PLAYING_TRACK">
**Tool Name:** Get currently playing track

**Description**

```text wordWrap
Get the object currently being played on the user's Spotify account.
```


**Action Parameters**

<ParamField path="additional_types" type="string">
</ParamField>

<ParamField path="market" type="string">
</ParamField>


**Action Response**

<ParamField path="data" type="object" required={true}>
</ParamField>

<ParamField path="error" type="string">
</ParamField>

<ParamField path="successful" type="boolean" required={true}>
</ParamField>

</Accordion>

<Accordion title="SPOTIFY_GET_CURRENT_USER_S_PLAYLISTS">
**Tool Name:** Get current user s playlists

**Description**

```text wordWrap
Get a list of the playlists owned or followed by the current Spotify user.
```


**Action Parameters**

<ParamField path="limit" type="integer" default="20">
</ParamField>

<ParamField path="offset" type="integer">
</ParamField>


**Action Response**

<ParamField path="data" type="object" required={true}>
</ParamField>

<ParamField path="error" type="string">
</ParamField>

<ParamField path="successful" type="boolean" required={true}>
</ParamField>

</Accordion>

<Accordion title="SPOTIFY_GET_CURRENT_USER_S_PROFILE">
**Tool Name:** Get current user s profile

**Description**

```text wordWrap
Get detailed profile information about the current user (including the current user's username).
```


**Action Parameters**



**Action Response**

<ParamField path="data" type="object" required={true}>
</ParamField>

<ParamField path="error" type="string">
</ParamField>

<ParamField path="successful" type="boolean" required={true}>
</ParamField>

</Accordion>

<Accordion title="SPOTIFY_GET_CURRENT_USERS_PROFILE">
**Tool Name:** Get current user s profile

**Description**

```text wordWrap
Get detailed profile information about the current user (including the current user's username). <<DEPRECATED use get_current_user_s_profile>>
```


**Action Parameters**



**Action Response**

<ParamField path="data" type="object" required={true}>
</ParamField>

<ParamField path="error" type="string">
</ParamField>

<ParamField path="successful" type="boolean" required={true}>
</ParamField>

</Accordion>

<Accordion title="SPOTIFY_GET_EPISODE">
**Tool Name:** Get episode

**Description**

```text wordWrap
Get Spotify catalog information for a single episode identified by its unique Spotify ID.
```


**Action Parameters**

<ParamField path="id" type="string" required={true}>
</ParamField>

<ParamField path="market" type="string">
</ParamField>


**Action Response**

<ParamField path="data" type="object" required={true}>
</ParamField>

<ParamField path="error" type="string">
</ParamField>

<ParamField path="successful" type="boolean" required={true}>
</ParamField>

</Accordion>

<Accordion title="SPOTIFY_GET_FEATURED_PLAYLISTS">
**Tool Name:** Get featured playlists

**Description**

```text wordWrap
Get a list of Spotify featured playlists (shown, for example, on a Spotify player's 'Browse' tab).
```


**Action Parameters**

<ParamField path="limit" type="integer" default="20">
</ParamField>

<ParamField path="locale" type="string">
</ParamField>

<ParamField path="offset" type="integer">
</ParamField>


**Action Response**

<ParamField path="data" type="object" required={true}>
</ParamField>

<ParamField path="error" type="string">
</ParamField>

<ParamField path="successful" type="boolean" required={true}>
</ParamField>

</Accordion>

<Accordion title="SPOTIFY_GET_FOLLOWED_ARTISTS">
**Tool Name:** Get followed artists

**Description**

```text wordWrap
Get the current user's followed artists.
```


**Action Parameters**

<ParamField path="after" type="string">
</ParamField>

<ParamField path="limit" type="integer" default="20">
</ParamField>

<ParamField path="type" type="string" required={true}>
</ParamField>


**Action Response**

<ParamField path="data" type="object" required={true}>
</ParamField>

<ParamField path="error" type="string">
</ParamField>

<ParamField path="successful" type="boolean" required={true}>
</ParamField>

</Accordion>

<Accordion title="SPOTIFY_GET_INFORMATION_ABOUT_THE_USERS_CURRENT_PLAYBACK">
**Tool Name:** Get playback state

**Description**

```text wordWrap
Get information about the user’s current playback state, including track or episode, progress, and active device. <<DEPRECATED use get_playback_state>>
```


**Action Parameters**

<ParamField path="additional_types" type="string">
</ParamField>

<ParamField path="market" type="string">
</ParamField>


**Action Response**

<ParamField path="data" type="object" required={true}>
</ParamField>

<ParamField path="error" type="string">
</ParamField>

<ParamField path="successful" type="boolean" required={true}>
</ParamField>

</Accordion>

<Accordion title="SPOTIFY_GET_LIST_USERS_PLAYLISTS">
**Tool Name:** Get user s playlists

**Description**

```text wordWrap
Get a list of the playlists owned or followed by a Spotify user. <<DEPRECATED use get_user_s_playlists>>
```


**Action Parameters**

<ParamField path="limit" type="integer" default="20">
</ParamField>

<ParamField path="offset" type="integer">
</ParamField>

<ParamField path="user_id" type="string" required={true}>
</ParamField>


**Action Response**

<ParamField path="data" type="object" required={true}>
</ParamField>

<ParamField path="error" type="string">
</ParamField>

<ParamField path="successful" type="boolean" required={true}>
</ParamField>

</Accordion>

<Accordion title="SPOTIFY_GET_NEW_RELEASES">
**Tool Name:** Get new releases

**Description**

```text wordWrap
Get a list of new album releases featured in Spotify (shown, for example, on a Spotify player’s “Browse” tab).
```


**Action Parameters**

<ParamField path="limit" type="integer" default="20">
</ParamField>

<ParamField path="offset" type="integer">
</ParamField>


**Action Response**

<ParamField path="data" type="object" required={true}>
</ParamField>

<ParamField path="error" type="string">
</ParamField>

<ParamField path="successful" type="boolean" required={true}>
</ParamField>

</Accordion>

<Accordion title="SPOTIFY_GET_PLAYBACK_STATE">
**Tool Name:** Get playback state

**Description**

```text wordWrap
Get information about the user’s current playback state, including track or episode, progress, and active device.
```


**Action Parameters**

<ParamField path="additional_types" type="string">
</ParamField>

<ParamField path="market" type="string">
</ParamField>


**Action Response**

<ParamField path="data" type="object" required={true}>
</ParamField>

<ParamField path="error" type="string">
</ParamField>

<ParamField path="successful" type="boolean" required={true}>
</ParamField>

</Accordion>

<Accordion title="SPOTIFY_GET_PLAYLIST">
**Tool Name:** Get playlist

**Description**

```text wordWrap
Get a playlist owned by a Spotify user.
```


**Action Parameters**

<ParamField path="additional_types" type="string">
</ParamField>

<ParamField path="fields" type="string">
</ParamField>

<ParamField path="market" type="string">
</ParamField>

<ParamField path="playlist_id" type="string" required={true}>
</ParamField>


**Action Response**

<ParamField path="data" type="object" required={true}>
</ParamField>

<ParamField path="error" type="string">
</ParamField>

<ParamField path="successful" type="boolean" required={true}>
</ParamField>

</Accordion>

<Accordion title="SPOTIFY_GET_PLAYLIST_COVER_IMAGE">
**Tool Name:** Get playlist cover image

**Description**

```text wordWrap
Get the current image associated with a specific playlist.
```


**Action Parameters**

<ParamField path="playlist_id" type="string" required={true}>
</ParamField>


**Action Response**

<ParamField path="data" type="object" required={true}>
</ParamField>

<ParamField path="error" type="string">
</ParamField>

<ParamField path="successful" type="boolean" required={true}>
</ParamField>

</Accordion>

<Accordion title="SPOTIFY_GET_PLAYLIST_ITEMS">
**Tool Name:** Get playlist items

**Description**

```text wordWrap
Get full details of the items of a playlist owned by a Spotify user.
```


**Action Parameters**

<ParamField path="additional_types" type="string">
</ParamField>

<ParamField path="fields" type="string">
</ParamField>

<ParamField path="limit" type="integer" default="20">
</ParamField>

<ParamField path="market" type="string">
</ParamField>

<ParamField path="offset" type="integer">
</ParamField>

<ParamField path="playlist_id" type="string" required={true}>
</ParamField>


**Action Response**

<ParamField path="data" type="object" required={true}>
</ParamField>

<ParamField path="error" type="string">
</ParamField>

<ParamField path="successful" type="boolean" required={true}>
</ParamField>

</Accordion>

<Accordion title="SPOTIFY_GET_QUEUE">
**Tool Name:** Get the user s queue

**Description**

```text wordWrap
Get the list of objects that make up the user's queue. <<DEPRECATED use get_the_user_s_queue>>
```


**Action Parameters**



**Action Response**

<ParamField path="data" type="object" required={true}>
</ParamField>

<ParamField path="error" type="string">
</ParamField>

<ParamField path="successful" type="boolean" required={true}>
</ParamField>

</Accordion>

<Accordion title="SPOTIFY_GET_RECENTLY_PLAYED">
**Tool Name:** Get recently played tracks

**Description**

```text wordWrap
Get tracks from the current user's recently played tracks. _**Note**: Currently doesn't support podcast episodes._ <<DEPRECATED use get_recently_played_tracks>>
```


**Action Parameters**

<ParamField path="after" type="integer">
</ParamField>

<ParamField path="before" type="integer">
</ParamField>

<ParamField path="limit" type="integer" default="20">
</ParamField>


**Action Response**

<ParamField path="data" type="object" required={true}>
</ParamField>

<ParamField path="error" type="string">
</ParamField>

<ParamField path="successful" type="boolean" required={true}>
</ParamField>

</Accordion>

<Accordion title="SPOTIFY_GET_RECENTLY_PLAYED_TRACKS">
**Tool Name:** Get recently played tracks

**Description**

```text wordWrap
Get tracks from the current user's recently played tracks. _**Note**: Currently doesn't support podcast episodes._
```


**Action Parameters**

<ParamField path="after" type="integer">
</ParamField>

<ParamField path="before" type="integer">
</ParamField>

<ParamField path="limit" type="integer" default="20">
</ParamField>


**Action Response**

<ParamField path="data" type="object" required={true}>
</ParamField>

<ParamField path="error" type="string">
</ParamField>

<ParamField path="successful" type="boolean" required={true}>
</ParamField>

</Accordion>

<Accordion title="SPOTIFY_GET_RECOMMENDATIONS">
**Tool Name:** Get recommendations

**Description**

```text wordWrap
Recommendations are based on seed entity data, matched with similar artists and tracks. If data is ample, a track list and pool size are returned. For new or obscure artists and tracks, data may be insufficient for recommendations.
```


**Action Parameters**

<ParamField path="limit" type="integer" default="20">
</ParamField>

<ParamField path="market" type="string">
</ParamField>

<ParamField path="max_acousticness" type="integer">
</ParamField>

<ParamField path="max_danceability" type="integer">
</ParamField>

<ParamField path="max_duration_ms" type="integer">
</ParamField>

<ParamField path="max_energy" type="integer">
</ParamField>

<ParamField path="max_instrumentalness" type="integer">
</ParamField>

<ParamField path="max_key" type="integer">
</ParamField>

<ParamField path="max_liveness" type="integer">
</ParamField>

<ParamField path="max_loudness" type="integer">
</ParamField>

<ParamField path="max_mode" type="integer">
</ParamField>

<ParamField path="max_popularity" type="integer">
</ParamField>

<ParamField path="max_speechiness" type="integer">
</ParamField>

<ParamField path="max_tempo" type="integer">
</ParamField>

<ParamField path="max_time_signature" type="integer">
</ParamField>

<ParamField path="max_valence" type="integer">
</ParamField>

<ParamField path="min_acousticness" type="integer">
</ParamField>

<ParamField path="min_danceability" type="integer">
</ParamField>

<ParamField path="min_duration_ms" type="integer">
</ParamField>

<ParamField path="min_energy" type="integer">
</ParamField>

<ParamField path="min_instrumentalness" type="integer">
</ParamField>

<ParamField path="min_key" type="integer">
</ParamField>

<ParamField path="min_liveness" type="integer">
</ParamField>

<ParamField path="min_loudness" type="integer">
</ParamField>

<ParamField path="min_mode" type="integer">
</ParamField>

<ParamField path="min_popularity" type="integer">
</ParamField>

<ParamField path="min_speechiness" type="integer">
</ParamField>

<ParamField path="min_tempo" type="integer">
</ParamField>

<ParamField path="min_time_signature" type="integer">
</ParamField>

<ParamField path="min_valence" type="integer">
</ParamField>

<ParamField path="seed_artists" type="string">
</ParamField>

<ParamField path="seed_genres" type="string">
</ParamField>

<ParamField path="seed_tracks" type="string">
</ParamField>

<ParamField path="target_acousticness" type="integer">
</ParamField>

<ParamField path="target_danceability" type="integer">
</ParamField>

<ParamField path="target_duration_ms" type="integer">
</ParamField>

<ParamField path="target_energy" type="integer">
</ParamField>

<ParamField path="target_instrumentalness" type="integer">
</ParamField>

<ParamField path="target_key" type="integer">
</ParamField>

<ParamField path="target_liveness" type="integer">
</ParamField>

<ParamField path="target_loudness" type="integer">
</ParamField>

<ParamField path="target_mode" type="integer">
</ParamField>

<ParamField path="target_popularity" type="integer">
</ParamField>

<ParamField path="target_speechiness" type="integer">
</ParamField>

<ParamField path="target_tempo" type="integer">
</ParamField>

<ParamField path="target_time_signature" type="integer">
</ParamField>

<ParamField path="target_valence" type="integer">
</ParamField>


**Action Response**

<ParamField path="data" type="object" required={true}>
</ParamField>

<ParamField path="error" type="string">
</ParamField>

<ParamField path="successful" type="boolean" required={true}>
</ParamField>

</Accordion>

<Accordion title="SPOTIFY_GET_SEVERAL_ALBUMS">
**Tool Name:** Get several albums

**Description**

```text wordWrap
Get Spotify catalog information for multiple albums identified by their Spotify IDs.
```


**Action Parameters**

<ParamField path="ids" type="string" required={true}>
</ParamField>

<ParamField path="market" type="string">
</ParamField>


**Action Response**

<ParamField path="data" type="object" required={true}>
</ParamField>

<ParamField path="error" type="string">
</ParamField>

<ParamField path="successful" type="boolean" required={true}>
</ParamField>

</Accordion>

<Accordion title="SPOTIFY_GET_SEVERAL_ARTISTS">
**Tool Name:** Get several artists

**Description**

```text wordWrap
Get Spotify catalog information for several artists based on their Spotify IDs.
```


**Action Parameters**

<ParamField path="ids" type="string" required={true}>
</ParamField>


**Action Response**

<ParamField path="data" type="object" required={true}>
</ParamField>

<ParamField path="error" type="string">
</ParamField>

<ParamField path="successful" type="boolean" required={true}>
</ParamField>

</Accordion>

<Accordion title="SPOTIFY_GET_SEVERAL_AUDIOBOOKS">
**Tool Name:** Get several audiobooks

**Description**

```text wordWrap
Get Spotify catalog information for several audiobooks identified by their Spotify IDs. Audiobooks are only available within the US, UK, Canada, Ireland, New Zealand and Australia markets.
```


**Action Parameters**

<ParamField path="ids" type="string" required={true}>
</ParamField>

<ParamField path="market" type="string">
</ParamField>


**Action Response**

<ParamField path="data" type="object" required={true}>
</ParamField>

<ParamField path="error" type="string">
</ParamField>

<ParamField path="successful" type="boolean" required={true}>
</ParamField>

</Accordion>

<Accordion title="SPOTIFY_GET_SEVERAL_BROWSE_CATEGORIES">
**Tool Name:** Get several browse categories

**Description**

```text wordWrap
Get a list of categories used to tag items in Spotify (on, for example, the Spotify player’s “Browse” tab).
```


**Action Parameters**

<ParamField path="limit" type="integer" default="20">
</ParamField>

<ParamField path="locale" type="string">
</ParamField>

<ParamField path="offset" type="integer">
</ParamField>


**Action Response**

<ParamField path="data" type="object" required={true}>
</ParamField>

<ParamField path="error" type="string">
</ParamField>

<ParamField path="successful" type="boolean" required={true}>
</ParamField>

</Accordion>

<Accordion title="SPOTIFY_GET_SEVERAL_CHAPTERS">
**Tool Name:** Get several chapters

**Description**

```text wordWrap
Get Spotify catalog information for several audiobook chapters identified by their Spotify IDs. Chapters are only available within the US, UK, Canada, Ireland, New Zealand and Australia markets.
```


**Action Parameters**

<ParamField path="ids" type="string" required={true}>
</ParamField>

<ParamField path="market" type="string">
</ParamField>


**Action Response**

<ParamField path="data" type="object" required={true}>
</ParamField>

<ParamField path="error" type="string">
</ParamField>

<ParamField path="successful" type="boolean" required={true}>
</ParamField>

</Accordion>

<Accordion title="SPOTIFY_GET_SEVERAL_EPISODES">
**Tool Name:** Get several episodes

**Description**

```text wordWrap
Get Spotify catalog information for several episodes based on their Spotify IDs.
```


**Action Parameters**

<ParamField path="ids" type="string" required={true}>
</ParamField>

<ParamField path="market" type="string">
</ParamField>


**Action Response**

<ParamField path="data" type="object" required={true}>
</ParamField>

<ParamField path="error" type="string">
</ParamField>

<ParamField path="successful" type="boolean" required={true}>
</ParamField>

</Accordion>

<Accordion title="SPOTIFY_GET_SEVERAL_SHOWS">
**Tool Name:** Get several shows

**Description**

```text wordWrap
Get Spotify catalog information for several shows based on their Spotify IDs.
```


**Action Parameters**

<ParamField path="ids" type="string" required={true}>
</ParamField>

<ParamField path="market" type="string">
</ParamField>


**Action Response**

<ParamField path="data" type="object" required={true}>
</ParamField>

<ParamField path="error" type="string">
</ParamField>

<ParamField path="successful" type="boolean" required={true}>
</ParamField>

</Accordion>

<Accordion title="SPOTIFY_GET_SEVERAL_TRACKS">
**Tool Name:** Get several tracks

**Description**

```text wordWrap
Get Spotify catalog information for multiple tracks based on their Spotify IDs.
```


**Action Parameters**

<ParamField path="ids" type="string" required={true}>
</ParamField>

<ParamField path="market" type="string">
</ParamField>


**Action Response**

<ParamField path="data" type="object" required={true}>
</ParamField>

<ParamField path="error" type="string">
</ParamField>

<ParamField path="successful" type="boolean" required={true}>
</ParamField>

</Accordion>

<Accordion title="SPOTIFY_GET_SEVERAL_TRACKS_AUDIO_FEATURES">
**Tool Name:** Get several tracks audio features

**Description**

```text wordWrap
Get audio features for multiple tracks based on their Spotify IDs.
```


**Action Parameters**

<ParamField path="ids" type="string" required={true}>
</ParamField>


**Action Response**

<ParamField path="data" type="object" required={true}>
</ParamField>

<ParamField path="error" type="string">
</ParamField>

<ParamField path="successful" type="boolean" required={true}>
</ParamField>

</Accordion>

<Accordion title="SPOTIFY_GET_SHOW">
**Tool Name:** Get show

**Description**

```text wordWrap
Get Spotify catalog information for a single show identified by its unique Spotify ID.
```


**Action Parameters**

<ParamField path="id" type="string" required={true}>
</ParamField>

<ParamField path="market" type="string">
</ParamField>


**Action Response**

<ParamField path="data" type="object" required={true}>
</ParamField>

<ParamField path="error" type="string">
</ParamField>

<ParamField path="successful" type="boolean" required={true}>
</ParamField>

</Accordion>

<Accordion title="SPOTIFY_GET_SHOW_EPISODES">
**Tool Name:** Get show episodes

**Description**

```text wordWrap
Get Spotify catalog information about an show’s episodes. Optional parameters can be used to limit the number of episodes returned.
```


**Action Parameters**

<ParamField path="id" type="string" required={true}>
</ParamField>

<ParamField path="limit" type="integer" default="20">
</ParamField>

<ParamField path="market" type="string">
</ParamField>

<ParamField path="offset" type="integer">
</ParamField>


**Action Response**

<ParamField path="data" type="object" required={true}>
</ParamField>

<ParamField path="error" type="string">
</ParamField>

<ParamField path="successful" type="boolean" required={true}>
</ParamField>

</Accordion>

<Accordion title="SPOTIFY_GET_SINGLE_BROWSE_CATEGORY">
**Tool Name:** Get single browse category

**Description**

```text wordWrap
Get a single category used to tag items in Spotify (on, for example, the Spotify player’s “Browse” tab).
```


**Action Parameters**

<ParamField path="category_id" type="string" required={true}>
</ParamField>

<ParamField path="locale" type="string">
</ParamField>


**Action Response**

<ParamField path="data" type="object" required={true}>
</ParamField>

<ParamField path="error" type="string">
</ParamField>

<ParamField path="successful" type="boolean" required={true}>
</ParamField>

</Accordion>

<Accordion title="SPOTIFY_GET_THE_USERS_CURRENTLY_PLAYING_TRACK">
**Tool Name:** Get currently playing track

**Description**

```text wordWrap
Get the object currently being played on the user's Spotify account. <<DEPRECATED use get_currently_playing_track>>
```


**Action Parameters**

<ParamField path="additional_types" type="string">
</ParamField>

<ParamField path="market" type="string">
</ParamField>


**Action Response**

<ParamField path="data" type="object" required={true}>
</ParamField>

<ParamField path="error" type="string">
</ParamField>

<ParamField path="successful" type="boolean" required={true}>
</ParamField>

</Accordion>

<Accordion title="SPOTIFY_GET_THE_USER_S_QUEUE">
**Tool Name:** Get the user s queue

**Description**

```text wordWrap
Get the list of objects that make up the user's queue.
```


**Action Parameters**



**Action Response**

<ParamField path="data" type="object" required={true}>
</ParamField>

<ParamField path="error" type="string">
</ParamField>

<ParamField path="successful" type="boolean" required={true}>
</ParamField>

</Accordion>

<Accordion title="SPOTIFY_GET_TRACK">
**Tool Name:** Get track

**Description**

```text wordWrap
Get Spotify catalog information for a single track identified by its unique Spotify ID.
```


**Action Parameters**

<ParamField path="id" type="string" required={true}>
</ParamField>

<ParamField path="market" type="string">
</ParamField>


**Action Response**

<ParamField path="data" type="object" required={true}>
</ParamField>

<ParamField path="error" type="string">
</ParamField>

<ParamField path="successful" type="boolean" required={true}>
</ParamField>

</Accordion>

<Accordion title="SPOTIFY_GET_TRACK_S_AUDIO_ANALYSIS">
**Tool Name:** Get track s audio analysis

**Description**

```text wordWrap
Get a low-level audio analysis for a track in the Spotify catalog. The audio analysis describes the track’s structure and musical content, including rhythm, pitch, and timbre.
```


**Action Parameters**

<ParamField path="id" type="string" required={true}>
</ParamField>


**Action Response**

<ParamField path="data" type="object" required={true}>
</ParamField>

<ParamField path="error" type="string">
</ParamField>

<ParamField path="successful" type="boolean" required={true}>
</ParamField>

</Accordion>

<Accordion title="SPOTIFY_GET_TRACK_S_AUDIO_FEATURES">
**Tool Name:** Get track s audio features

**Description**

```text wordWrap
Get audio feature information for a single track identified by its unique Spotify ID.
```


**Action Parameters**

<ParamField path="id" type="string" required={true}>
</ParamField>


**Action Response**

<ParamField path="data" type="object" required={true}>
</ParamField>

<ParamField path="error" type="string">
</ParamField>

<ParamField path="successful" type="boolean" required={true}>
</ParamField>

</Accordion>

<Accordion title="SPOTIFY_GET_USER_S_PLAYLISTS">
**Tool Name:** Get user s playlists

**Description**

```text wordWrap
Get a list of the playlists owned or followed by a Spotify user.
```


**Action Parameters**

<ParamField path="limit" type="integer" default="20">
</ParamField>

<ParamField path="offset" type="integer">
</ParamField>

<ParamField path="user_id" type="string" required={true}>
</ParamField>


**Action Response**

<ParamField path="data" type="object" required={true}>
</ParamField>

<ParamField path="error" type="string">
</ParamField>

<ParamField path="successful" type="boolean" required={true}>
</ParamField>

</Accordion>

<Accordion title="SPOTIFY_GET_USER_S_PROFILE">
**Tool Name:** Get user s profile

**Description**

```text wordWrap
Get public profile information about a Spotify user.
```


**Action Parameters**

<ParamField path="user_id" type="string" required={true}>
</ParamField>


**Action Response**

<ParamField path="data" type="object" required={true}>
</ParamField>

<ParamField path="error" type="string">
</ParamField>

<ParamField path="successful" type="boolean" required={true}>
</ParamField>

</Accordion>

<Accordion title="SPOTIFY_GET_USERS_PROFILE">
**Tool Name:** Get user s profile

**Description**

```text wordWrap
Get public profile information about a Spotify user. <<DEPRECATED use get_user_s_profile>>
```


**Action Parameters**

<ParamField path="user_id" type="string" required={true}>
</ParamField>


**Action Response**

<ParamField path="data" type="object" required={true}>
</ParamField>

<ParamField path="error" type="string">
</ParamField>

<ParamField path="successful" type="boolean" required={true}>
</ParamField>

</Accordion>

<Accordion title="SPOTIFY_GET_USER_S_SAVED_ALBUMS">
**Tool Name:** Get user s saved albums

**Description**

```text wordWrap
Get a list of the albums saved in the current Spotify user's 'Your Music' library.
```


**Action Parameters**

<ParamField path="limit" type="integer" default="20">
</ParamField>

<ParamField path="market" type="string">
</ParamField>

<ParamField path="offset" type="integer">
</ParamField>


**Action Response**

<ParamField path="data" type="object" required={true}>
</ParamField>

<ParamField path="error" type="string">
</ParamField>

<ParamField path="successful" type="boolean" required={true}>
</ParamField>

</Accordion>

<Accordion title="SPOTIFY_GET_USER_S_SAVED_AUDIOBOOKS">
**Tool Name:** Get user s saved audiobooks

**Description**

```text wordWrap
Get a list of the audiobooks saved in the current Spotify user's 'Your Music' library.
```


**Action Parameters**

<ParamField path="limit" type="integer" default="20">
</ParamField>

<ParamField path="offset" type="integer">
</ParamField>


**Action Response**

<ParamField path="data" type="object" required={true}>
</ParamField>

<ParamField path="error" type="string">
</ParamField>

<ParamField path="successful" type="boolean" required={true}>
</ParamField>

</Accordion>

<Accordion title="SPOTIFY_GET_USER_S_SAVED_EPISODES">
**Tool Name:** Get user s saved episodes

**Description**

```text wordWrap
This API endpoint, currently in beta, allows retrieving episodes saved in a Spotify user's library. Changes may occur without notice. Feedback and issues can be shared in Spotify's developer forum.
```


**Action Parameters**

<ParamField path="limit" type="integer" default="20">
</ParamField>

<ParamField path="market" type="string">
</ParamField>

<ParamField path="offset" type="integer">
</ParamField>


**Action Response**

<ParamField path="data" type="object" required={true}>
</ParamField>

<ParamField path="error" type="string">
</ParamField>

<ParamField path="successful" type="boolean" required={true}>
</ParamField>

</Accordion>

<Accordion title="SPOTIFY_GET_USER_S_SAVED_SHOWS">
**Tool Name:** Get user s saved shows

**Description**

```text wordWrap
Get a list of shows saved in the current Spotify user's library. Optional parameters can be used to limit the number of shows returned.
```


**Action Parameters**

<ParamField path="limit" type="integer" default="20">
</ParamField>

<ParamField path="offset" type="integer">
</ParamField>


**Action Response**

<ParamField path="data" type="object" required={true}>
</ParamField>

<ParamField path="error" type="string">
</ParamField>

<ParamField path="successful" type="boolean" required={true}>
</ParamField>

</Accordion>

<Accordion title="SPOTIFY_GET_USER_S_SAVED_TRACKS">
**Tool Name:** Get user s saved tracks

**Description**

```text wordWrap
Get a list of the songs saved in the current Spotify user's 'Your Music' library.
```


**Action Parameters**

<ParamField path="limit" type="integer" default="20">
</ParamField>

<ParamField path="market" type="string">
</ParamField>

<ParamField path="offset" type="integer">
</ParamField>


**Action Response**

<ParamField path="data" type="object" required={true}>
</ParamField>

<ParamField path="error" type="string">
</ParamField>

<ParamField path="successful" type="boolean" required={true}>
</ParamField>

</Accordion>

<Accordion title="SPOTIFY_GET_USERS_SAVED_TRACKS">
**Tool Name:** Get user s saved tracks

**Description**

```text wordWrap
Get a list of the songs saved in the current Spotify user's 'Your Music' library. <<DEPRECATED use get_user_s_saved_tracks>>
```


**Action Parameters**

<ParamField path="limit" type="integer" default="20">
</ParamField>

<ParamField path="market" type="string">
</ParamField>

<ParamField path="offset" type="integer">
</ParamField>


**Action Response**

<ParamField path="data" type="object" required={true}>
</ParamField>

<ParamField path="error" type="string">
</ParamField>

<ParamField path="successful" type="boolean" required={true}>
</ParamField>

</Accordion>

<Accordion title="SPOTIFY_GET_USER_S_TOP_ARTISTS">
**Tool Name:** Get user s top artists

**Description**

```text wordWrap
Get the current user's top artists based on calculated affinity.
```


**Action Parameters**

<ParamField path="limit" type="integer" default="20">
</ParamField>

<ParamField path="offset" type="integer">
</ParamField>

<ParamField path="time_range" type="string" default="medium_term">
</ParamField>


**Action Response**

<ParamField path="data" type="object" required={true}>
</ParamField>

<ParamField path="error" type="string">
</ParamField>

<ParamField path="successful" type="boolean" required={true}>
</ParamField>

</Accordion>

<Accordion title="SPOTIFY_GET_USERS_TOP_ARTISTS">
**Tool Name:** Get user s top artists

**Description**

```text wordWrap
Get the current user's top artists based on calculated affinity. <<DEPRECATED use get_user_s_top_artists>>
```


**Action Parameters**

<ParamField path="limit" type="integer" default="20">
</ParamField>

<ParamField path="offset" type="integer">
</ParamField>

<ParamField path="time_range" type="string" default="medium_term">
</ParamField>


**Action Response**

<ParamField path="data" type="object" required={true}>
</ParamField>

<ParamField path="error" type="string">
</ParamField>

<ParamField path="successful" type="boolean" required={true}>
</ParamField>

</Accordion>

<Accordion title="SPOTIFY_GET_USER_S_TOP_TRACKS">
**Tool Name:** Get user s top tracks

**Description**

```text wordWrap
Get the current user's top tracks based on calculated affinity.
```


**Action Parameters**

<ParamField path="limit" type="integer" default="20">
</ParamField>

<ParamField path="offset" type="integer">
</ParamField>

<ParamField path="time_range" type="string" default="medium_term">
</ParamField>


**Action Response**

<ParamField path="data" type="object" required={true}>
</ParamField>

<ParamField path="error" type="string">
</ParamField>

<ParamField path="successful" type="boolean" required={true}>
</ParamField>

</Accordion>

<Accordion title="SPOTIFY_GET_USERS_TOP_TRACKS">
**Tool Name:** Get user s top tracks

**Description**

```text wordWrap
Get the current user's top tracks based on calculated affinity. <<DEPRECATED use get_user_s_top_tracks>>
```


**Action Parameters**

<ParamField path="limit" type="integer" default="20">
</ParamField>

<ParamField path="offset" type="integer">
</ParamField>

<ParamField path="time_range" type="string" default="medium_term">
</ParamField>


**Action Response**

<ParamField path="data" type="object" required={true}>
</ParamField>

<ParamField path="error" type="string">
</ParamField>

<ParamField path="successful" type="boolean" required={true}>
</ParamField>

</Accordion>

<Accordion title="SPOTIFY_PAUSE_PLAYBACK">
**Tool Name:** Pause playback

**Description**

```text wordWrap
Pause playback on the user's account. This API only works for users who have Spotify Premium. The order of execution is not guaranteed when you use this API with other Player API endpoints.
```


**Action Parameters**

<ParamField path="device_id" type="string">
</ParamField>


**Action Response**

<ParamField path="data" type="object" required={true}>
</ParamField>

<ParamField path="error" type="string">
</ParamField>

<ParamField path="successful" type="boolean" required={true}>
</ParamField>

</Accordion>

<Accordion title="SPOTIFY_REMOVE_PLAYLIST_ITEMS">
**Tool Name:** Remove playlist items

**Description**

```text wordWrap
Remove one or more items from a user's playlist.
```


**Action Parameters**

<ParamField path="playlist_id" type="string" required={true}>
</ParamField>

<ParamField path="snapshot_id" type="string">
</ParamField>

<ParamField path="tracks" type="array" required={true}>
</ParamField>


**Action Response**

<ParamField path="data" type="object" required={true}>
</ParamField>

<ParamField path="error" type="string">
</ParamField>

<ParamField path="successful" type="boolean" required={true}>
</ParamField>

</Accordion>

<Accordion title="SPOTIFY_REMOVE_USERS_SAVED_ALBUMS">
**Tool Name:** Remove users saved albums

**Description**

```text wordWrap
Remove one or more albums from the current user's 'Your Music' library.
```


**Action Parameters**

<ParamField path="ids" type="array" required={true}>
</ParamField>


**Action Response**

<ParamField path="data" type="object" required={true}>
</ParamField>

<ParamField path="error" type="string">
</ParamField>

<ParamField path="successful" type="boolean" required={true}>
</ParamField>

</Accordion>

<Accordion title="SPOTIFY_REMOVE_USER_S_SAVED_AUDIOBOOKS">
**Tool Name:** Remove user s saved audiobooks

**Description**

```text wordWrap
Remove one or more audiobooks from the Spotify user's library.
```


**Action Parameters**

<ParamField path="ids" type="string" required={true}>
</ParamField>


**Action Response**

<ParamField path="data" type="object" required={true}>
</ParamField>

<ParamField path="error" type="string">
</ParamField>

<ParamField path="successful" type="boolean" required={true}>
</ParamField>

</Accordion>

<Accordion title="SPOTIFY_REMOVE_USER_S_SAVED_EPISODES">
**Tool Name:** Remove user s saved episodes

**Description**

```text wordWrap
This API endpoint, currently in beta, allows for the removal of episodes from a user's library and may change without notice. Feedback and issues can be shared on the Spotify developer forum.
```


**Action Parameters**

<ParamField path="ids" type="array" required={true}>
</ParamField>


**Action Response**

<ParamField path="data" type="object" required={true}>
</ParamField>

<ParamField path="error" type="string">
</ParamField>

<ParamField path="successful" type="boolean" required={true}>
</ParamField>

</Accordion>

<Accordion title="SPOTIFY_REMOVE_USER_S_SAVED_SHOWS">
**Tool Name:** Remove user s saved shows

**Description**

```text wordWrap
Delete one or more shows from current Spotify user's library.
```


**Action Parameters**

<ParamField path="ids" type="array" required={true}>
</ParamField>

<ParamField path="market" type="string">
</ParamField>


**Action Response**

<ParamField path="data" type="object" required={true}>
</ParamField>

<ParamField path="error" type="string">
</ParamField>

<ParamField path="successful" type="boolean" required={true}>
</ParamField>

</Accordion>

<Accordion title="SPOTIFY_REMOVE_USER_S_SAVED_TRACKS">
**Tool Name:** Remove user s saved tracks

**Description**

```text wordWrap
Remove one or more tracks from the current user's 'Your Music' library.
```


**Action Parameters**

<ParamField path="ids" type="array" required={true}>
</ParamField>


**Action Response**

<ParamField path="data" type="object" required={true}>
</ParamField>

<ParamField path="error" type="string">
</ParamField>

<ParamField path="successful" type="boolean" required={true}>
</ParamField>

</Accordion>

<Accordion title="SPOTIFY_SAVE_ALBUMS_FOR_CURRENT_USER">
**Tool Name:** Save albums for current user

**Description**

```text wordWrap
Save one or more albums to the current user's 'Your Music' library.
```


**Action Parameters**

<ParamField path="ids" type="array" required={true}>
</ParamField>


**Action Response**

<ParamField path="data" type="object" required={true}>
</ParamField>

<ParamField path="error" type="string">
</ParamField>

<ParamField path="successful" type="boolean" required={true}>
</ParamField>

</Accordion>

<Accordion title="SPOTIFY_SAVE_ALBUMS_USER">
**Tool Name:** Save albums for current user

**Description**

```text wordWrap
Save one or more albums to the current user's 'Your Music' library. <<DEPRECATED use save_albums_for_current_user>>
```


**Action Parameters**

<ParamField path="ids" type="array" required={true}>
</ParamField>


**Action Response**

<ParamField path="data" type="object" required={true}>
</ParamField>

<ParamField path="error" type="string">
</ParamField>

<ParamField path="successful" type="boolean" required={true}>
</ParamField>

</Accordion>

<Accordion title="SPOTIFY_SAVE_AUDIOBOOKS_FOR_CURRENT_USER">
**Tool Name:** Save audiobooks for current user

**Description**

```text wordWrap
Save one or more audiobooks to the current Spotify user's library.
```


**Action Parameters**

<ParamField path="ids" type="string" required={true}>
</ParamField>


**Action Response**

<ParamField path="data" type="object" required={true}>
</ParamField>

<ParamField path="error" type="string">
</ParamField>

<ParamField path="successful" type="boolean" required={true}>
</ParamField>

</Accordion>

<Accordion title="SPOTIFY_SAVE_EPISODES_FOR_CURRENT_USER">
**Tool Name:** Save episodes for current user

**Description**

```text wordWrap
This API endpoint, currently in beta, allows saving episodes to a user's library. Users are encouraged to provide feedback or report issues in the Spotify developer forum.
```


**Action Parameters**

<ParamField path="ids" type="array" required={true}>
</ParamField>


**Action Response**

<ParamField path="data" type="object" required={true}>
</ParamField>

<ParamField path="error" type="string">
</ParamField>

<ParamField path="successful" type="boolean" required={true}>
</ParamField>

</Accordion>

<Accordion title="SPOTIFY_SAVE_SHOWS_FOR_CURRENT_USER">
**Tool Name:** Save shows for current user

**Description**

```text wordWrap
Save one or more shows to current Spotify user's library.
```


**Action Parameters**

<ParamField path="ids" type="array" required={true}>
</ParamField>


**Action Response**

<ParamField path="data" type="object" required={true}>
</ParamField>

<ParamField path="error" type="string">
</ParamField>

<ParamField path="successful" type="boolean" required={true}>
</ParamField>

</Accordion>

<Accordion title="SPOTIFY_SAVE_TRACKS_FOR_CURRENT_USER">
**Tool Name:** Save tracks for current user

**Description**

```text wordWrap
Save one or more tracks to the current user's 'Your Music' library.
```


**Action Parameters**

<ParamField path="ids" type="array" required={true}>
</ParamField>


**Action Response**

<ParamField path="data" type="object" required={true}>
</ParamField>

<ParamField path="error" type="string">
</ParamField>

<ParamField path="successful" type="boolean" required={true}>
</ParamField>

</Accordion>

<Accordion title="SPOTIFY_SEARCH">
**Tool Name:** Search for item

**Description**

```text wordWrap
Get Spotify catalog information about albums, artists, playlists, tracks, shows, episodes or audiobooks that match a keyword string. Audiobooks are only available within the US, UK, Canada, Ireland, New Zealand and Australia markets. <<DEPRECATED use search_for_item>>
```


**Action Parameters**

<ParamField path="include_external" type="string">
</ParamField>

<ParamField path="limit" type="integer" default="20">
</ParamField>

<ParamField path="market" type="string">
</ParamField>

<ParamField path="offset" type="integer">
</ParamField>

<ParamField path="q" type="string" required={true}>
</ParamField>

<ParamField path="type" type="array" required={true}>
</ParamField>


**Action Response**

<ParamField path="data" type="object" required={true}>
</ParamField>

<ParamField path="error" type="string">
</ParamField>

<ParamField path="successful" type="boolean" required={true}>
</ParamField>

</Accordion>

<Accordion title="SPOTIFY_SEARCH_FOR_ITEM">
**Tool Name:** Search for item

**Description**

```text wordWrap
Get Spotify catalog information about albums, artists, playlists, tracks, shows, episodes or audiobooks that match a keyword string. Audiobooks are only available within the US, UK, Canada, Ireland, New Zealand and Australia markets.
```


**Action Parameters**

<ParamField path="include_external" type="string">
</ParamField>

<ParamField path="limit" type="integer" default="20">
</ParamField>

<ParamField path="market" type="string">
</ParamField>

<ParamField path="offset" type="integer">
</ParamField>

<ParamField path="q" type="string" required={true}>
</ParamField>

<ParamField path="type" type="array" required={true}>
</ParamField>


**Action Response**

<ParamField path="data" type="object" required={true}>
</ParamField>

<ParamField path="error" type="string">
</ParamField>

<ParamField path="successful" type="boolean" required={true}>
</ParamField>

</Accordion>

<Accordion title="SPOTIFY_SEEK_TO_POSITION">
**Tool Name:** Seek to position

**Description**

```text wordWrap
Seeks to the given position in the user’s currently playing track. This API only works for users who have Spotify Premium. The order of execution is not guaranteed when you use this API with other Player API endpoints.
```


**Action Parameters**

<ParamField path="device_id" type="string">
</ParamField>

<ParamField path="position_ms" type="integer" required={true}>
</ParamField>


**Action Response**

<ParamField path="data" type="object" required={true}>
</ParamField>

<ParamField path="error" type="string">
</ParamField>

<ParamField path="successful" type="boolean" required={true}>
</ParamField>

</Accordion>

<Accordion title="SPOTIFY_SET_PLAYBACK_VOLUME">
**Tool Name:** Set playback volume

**Description**

```text wordWrap
Set the volume for the user’s current playback device. This API only works for users who have Spotify Premium. The order of execution is not guaranteed when you use this API with other Player API endpoints.
```


**Action Parameters**

<ParamField path="device_id" type="string">
</ParamField>

<ParamField path="volume_percent" type="integer" required={true}>
</ParamField>


**Action Response**

<ParamField path="data" type="object" required={true}>
</ParamField>

<ParamField path="error" type="string">
</ParamField>

<ParamField path="successful" type="boolean" required={true}>
</ParamField>

</Accordion>

<Accordion title="SPOTIFY_SET_REPEAT_MODE">
**Tool Name:** Set repeat mode

**Description**

```text wordWrap
Set the repeat mode for the user's playback. This API only works for users who have Spotify Premium. The order of execution is not guaranteed when you use this API with other Player API endpoints.
```


**Action Parameters**

<ParamField path="device_id" type="string">
</ParamField>

<ParamField path="state" type="string" required={true}>
</ParamField>


**Action Response**

<ParamField path="data" type="object" required={true}>
</ParamField>

<ParamField path="error" type="string">
</ParamField>

<ParamField path="successful" type="boolean" required={true}>
</ParamField>

</Accordion>

<Accordion title="SPOTIFY_SKIP_TO_NEXT">
**Tool Name:** Skip to next

**Description**

```text wordWrap
Skips to next track in the user’s queue. This API only works for users who have Spotify Premium. The order of execution is not guaranteed when you use this API with other Player API endpoints.
```


**Action Parameters**

<ParamField path="device_id" type="string">
</ParamField>


**Action Response**

<ParamField path="data" type="object" required={true}>
</ParamField>

<ParamField path="error" type="string">
</ParamField>

<ParamField path="successful" type="boolean" required={true}>
</ParamField>

</Accordion>

<Accordion title="SPOTIFY_SKIP_TO_PREVIOUS">
**Tool Name:** Skip to previous

**Description**

```text wordWrap
Skips to previous track in the user’s queue. This API only works for users who have Spotify Premium. The order of execution is not guaranteed when you use this API with other Player API endpoints.
```


**Action Parameters**

<ParamField path="device_id" type="string">
</ParamField>


**Action Response**

<ParamField path="data" type="object" required={true}>
</ParamField>

<ParamField path="error" type="string">
</ParamField>

<ParamField path="successful" type="boolean" required={true}>
</ParamField>

</Accordion>

<Accordion title="SPOTIFY_SKIP_USERS_PLAYBACK_TO_NEXT_TRACK">
**Tool Name:** Skip to next

**Description**

```text wordWrap
Skips to next track in the user’s queue. This API only works for users who have Spotify Premium. The order of execution is not guaranteed when you use this API with other Player API endpoints. <<DEPRECATED use skip_to_next>>
```


**Action Parameters**

<ParamField path="device_id" type="string">
</ParamField>


**Action Response**

<ParamField path="data" type="object" required={true}>
</ParamField>

<ParamField path="error" type="string">
</ParamField>

<ParamField path="successful" type="boolean" required={true}>
</ParamField>

</Accordion>

<Accordion title="SPOTIFY_START_A_USERS_PLAYBACK">
**Tool Name:** Start resume playback

**Description**

```text wordWrap
Start a new context or resume current playback on the user's active device. This API only works for users who have Spotify Premium. The order of execution is not guaranteed when you use this API with other Player API endpoints. <<DEPRECATED use start_resume_playback>>
```


**Action Parameters**

<ParamField path="context_uri" type="string">
</ParamField>

<ParamField path="device_id" type="string">
</ParamField>

<ParamField path="offset" type="object">
</ParamField>

<ParamField path="position_ms" type="integer">
</ParamField>

<ParamField path="uris" type="array">
</ParamField>


**Action Response**

<ParamField path="data" type="object" required={true}>
</ParamField>

<ParamField path="error" type="string">
</ParamField>

<ParamField path="successful" type="boolean" required={true}>
</ParamField>

</Accordion>

<Accordion title="SPOTIFY_START_RESUME_PLAYBACK">
**Tool Name:** Start resume playback

**Description**

```text wordWrap
Start a new context or resume current playback on the user's active device. This API only works for users who have Spotify Premium. The order of execution is not guaranteed when you use this API with other Player API endpoints.
```


**Action Parameters**

<ParamField path="context_uri" type="string">
</ParamField>

<ParamField path="device_id" type="string">
</ParamField>

<ParamField path="offset" type="object">
</ParamField>

<ParamField path="position_ms" type="integer">
</ParamField>

<ParamField path="uris" type="array">
</ParamField>


**Action Response**

<ParamField path="data" type="object" required={true}>
</ParamField>

<ParamField path="error" type="string">
</ParamField>

<ParamField path="successful" type="boolean" required={true}>
</ParamField>

</Accordion>

<Accordion title="SPOTIFY_TOGGLE_PLAYBACK_SHUFFLE">
**Tool Name:** Toggle playback shuffle

**Description**

```text wordWrap
Toggle shuffle on or off for user’s playback. This API only works for users who have Spotify Premium. The order of execution is not guaranteed when you use this API with other Player API endpoints.
```


**Action Parameters**

<ParamField path="device_id" type="string">
</ParamField>

<ParamField path="state" type="boolean" required={true}>
</ParamField>


**Action Response**

<ParamField path="data" type="object" required={true}>
</ParamField>

<ParamField path="error" type="string">
</ParamField>

<ParamField path="successful" type="boolean" required={true}>
</ParamField>

</Accordion>

<Accordion title="SPOTIFY_TRANSFER_PLAYBACK">
**Tool Name:** Transfer playback

**Description**

```text wordWrap
Transfer playback to a new device and optionally begin playback. This API only works for users who have Spotify Premium. The order of execution is not guaranteed when you use this API with other Player API endpoints.
```


**Action Parameters**

<ParamField path="device_ids" type="array" required={true}>
</ParamField>

<ParamField path="play" type="boolean">
</ParamField>


**Action Response**

<ParamField path="data" type="object" required={true}>
</ParamField>

<ParamField path="error" type="string">
</ParamField>

<ParamField path="successful" type="boolean" required={true}>
</ParamField>

</Accordion>

<Accordion title="SPOTIFY_UNFOLLOW_ARTISTS_OR_USERS">
**Tool Name:** Unfollow artists or users

**Description**

```text wordWrap
Remove the current user as a follower of one or more artists or other Spotify users.
```


**Action Parameters**

<ParamField path="ids" type="array" required={true}>
</ParamField>

<ParamField path="type" type="string" required={true}>
</ParamField>


**Action Response**

<ParamField path="data" type="object" required={true}>
</ParamField>

<ParamField path="error" type="string">
</ParamField>

<ParamField path="successful" type="boolean" required={true}>
</ParamField>

</Accordion>

<Accordion title="SPOTIFY_UNFOLLOW_PLAYLIST">
**Tool Name:** Unfollow playlist

**Description**

```text wordWrap
Remove the current user as a follower of a playlist.
```


**Action Parameters**

<ParamField path="playlist_id" type="string" required={true}>
</ParamField>


**Action Response**

<ParamField path="data" type="object" required={true}>
</ParamField>

<ParamField path="error" type="string">
</ParamField>

<ParamField path="successful" type="boolean" required={true}>
</ParamField>

</Accordion>

<Accordion title="SPOTIFY_UPDATE_PLAYLIST_ITEMS">
**Tool Name:** Update playlist items

**Description**

```text wordWrap
To modify a playlist, use rearrange (with `range_start`, `insert_before`, `range_length`, `snapshot_id`) or replace items (`uris` in body/query). Replace overwrites items. Operations can't combine in one request; they are exclusive but share an endpoint.
```


**Action Parameters**

<ParamField path="insert_before" type="integer">
</ParamField>

<ParamField path="playlist_id" type="string" required={true}>
</ParamField>

<ParamField path="range_length" type="integer">
</ParamField>

<ParamField path="range_start" type="integer">
</ParamField>

<ParamField path="snapshot_id" type="string">
</ParamField>

<ParamField path="uris" type="array">
</ParamField>


**Action Response**

<ParamField path="data" type="object" required={true}>
</ParamField>

<ParamField path="error" type="string">
</ParamField>

<ParamField path="successful" type="boolean" required={true}>
</ParamField>

</Accordion>

</AccordionGroup>
