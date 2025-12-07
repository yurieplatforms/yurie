# Yurie

Yurie is a personalized, friendly AI companion designed to be more than just an assistant. She has her own personality, remembers your context, and helps you navigate your digital life with warmth and authenticity.

Built with **Next.js 16**, **Supabase**, **OpenAI**, and **Composio**, Yurie combines advanced LLM capabilities with real-world tool integrations like Gmail.

## ✨ Key Features

-   **🧠 Emotional Intelligence**: Yurie adapts her tone and personality based on the conversation, offering a genuine connection rather than robotic responses.
-   **🛠️ Tool Integration**:
    -   **Gmail**: Send, read, and draft emails seamlessly.
    -   **Web Search**: Access real-time information to answer your questions.
-   **👤 Personalization**: Remembers your name, birthday, location, and timezone to provide context-aware interactions.
-   **⚡ Streaming Interface**: Experience real-time chat with visible thought processes and tool execution steps.
-   **🔒 Secure Authentication**: Robust user management powered by Supabase Auth.

## 🚀 Tech Stack

-   **Frontend**: Next.js 16 (App Router), React 19, Tailwind CSS v4, Radix UI, Framer Motion
-   **Backend**: Next.js API Routes (Serverless)
-   **Database**: Supabase (PostgreSQL) + Storage (Avatars)
-   **AI Intelligence**: OpenAI (GPT-5.1 Preview/Custom Models)
-   **Agent Tools**: Composio (Gmail Integration, etc.)
-   **Testing**: Vitest

## 🛠️ Getting Started

Follow these steps to set up Yurie locally.

### Prerequisites

-   Node.js 18+ and npm/pnpm
-   A [Supabase](https://supabase.com/) project
-   An [OpenAI](https://openai.com/) API Key
-   A [Composio](https://composio.dev/) account for tool integrations

### Environment Variables

Create a `.env.local` file in the root directory and add the following variables:

```bash
# OpenAI
OPENAI_API_KEY=your_openai_api_key

# Composio Integration
COMPOSIO_API_KEY=your_composio_api_key
COMPOSIO_AUTH_CONFIG_ID=your_composio_auth_config_id
COMPOSIO_WEBHOOK_SECRET=your_composio_webhook_secret

# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Installation

1.  **Clone the repository**

    ```bash
    git clone https://github.com/yourusername/yurie.git
    cd yurie
    ```

2.  **Install dependencies**

    ```bash
    npm install
    ```

3.  **Set up the database**

    Run the migration script in your Supabase SQL editor to set up the required tables and policies.

    The migration file is located at: `supabase/migrations.sql`

4.  **Run the development server**

    ```bash
    npm run dev
    ```

    Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## 📂 Project Structure

```
yurie/
├── src/
│   ├── app/                 # Next.js App Router pages and API routes
│   │   ├── api/             # Backend API endpoints (agent, composio, etc.)
│   │   ├── login/           # Authentication pages
│   │   └── ...
│   ├── components/          # React components
│   │   ├── ai/              # AI-specific UI (chat bubbles, reasoning)
│   │   ├── chat/            # Chat interface components
│   │   └── ui/              # Reusable UI primitives
│   ├── lib/                 # Core logic and utilities
│   │   ├── ai/              # AI agent logic, system prompts, stream processing
│   │   ├── config/          # Environment and constants
│   │   ├── integrations/    # External service integrations (Composio)
│   │   └── supabase/        # Database clients and schemas
│   └── ...
├── supabase/                # Database migrations
├── public/                  # Static assets
└── ...
```

## 🤝 Contributing

This project is private, but contributions are welcome from authorized collaborators. Please follow the standard pull request workflow.

## 📄 License

This project is proprietary and private.

