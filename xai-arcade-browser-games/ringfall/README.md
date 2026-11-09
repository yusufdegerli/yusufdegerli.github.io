# oneforEveryone

Welcome to your GrokBox, powered by Grok CLI.

- **Agent workspace**: open it from the GrokBox dashboard for a friendly chat,
  live progress and tool calls, model controls, multiple agents, and file tools.
  Use the paperclip to upload files, folders, or ZIPs; you can also drag content
  anywhere or paste images, files, and long text into the chat composer.
- **IDE**: use it for direct editor and terminal control.
- **Open a terminal**: `Ctrl+\`` (backtick), then run `grok` (or pick the
  `grok` / `grok (continue)` profile from the terminal dropdown).
- **Workspace** is at `/projects/workspace` and persists across resets.

Both interfaces use the same Grok CLI and the same files in this isolated box.
The Agent workspace **Settings** (gear icon) control its optional add-ons and
Grok CLI features for this box. All agents in this box see the same Workspace;
use separate files or a lead-and-review workflow when several agents are
working at once. While an agent is busy, choose **Queue next** to run a message
after its current turn or **Interrupt & send** when the new direction should
take priority.

## Tips
- This box has three dashboard entry points:
  - **Agent workspace**: friendly Grok chat and file workspace.
  - **IDE**: code-server on container port 8080.
  - **App preview**: bind your dev server to `0.0.0.0:8000` inside the box —
    it'll be reachable at `https://autoqa.teachx.ai/GrokBox/preview/<port>/`
    (use the *Preview app* button on the dashboard to find the URL).
    In Agent workspace, ask Grok to run or deploy the app and a compact
    Preview control appears while the health check continues to pass.
    See the dashboard's *Tips* button → "Previewing your app" for the
    relative-path requirement.
- Grok automatically uses this box's shared xAI API key. You do not need to
  run `/login` or connect a personal Grok account.
- The default model is `grok-4.7`. Use `/model` to check or change it.
- Resume a previous Grok session with `grok -c` or the `grok (continue)`
  terminal profile.
- Grok uses this box's shared xAI key. The key is not in the shell, so
  `echo $XAI_API_KEY` is empty. Use `grok` for model calls.

## Built-in skills

Ask in normal language and Grok will choose the relevant skill. Slash commands
are optional; use one when you want to select a skill explicitly.

| Skill | What it does | Example request |
|---|---|---|
| `batch` | Applies one safe, consistent change across several files. | “Rename this prop throughout every React component.” |
| `database` | Adds or debugs schemas, migrations, queries, caching, and persistence. | “Add a SQLite database for saved projects.” |
| `debug` | Reproduces, diagnoses, and fixes errors. | “Find out why this route returns 500 and fix it.” |
| `deploy` | Runs the app on the GrokBox preview port and checks it. | “Run this site and give me the preview.” |
| `google-maps` | Adds directions, travel times, geocoding, and place search. | “Add nearby coffee shop search to this app.” |
| `scaffold` | Creates project-appropriate boilerplate for a feature. | “Scaffold an authenticated settings page.” |
| `simplify` | Reviews recent code for clarity, reuse, and efficiency. | “Simplify the code you just changed.” |
| `verify` | Runs the project’s real checks and focused smoke tests. | “Verify the feature works before we finish.” |
| `xai-api` | Adds Grok models and xAI API features to the project. | “Add a Grok-powered chat endpoint.” |
| `xai-tts` | Creates spoken dialogue MP3s and can put speech on a video. | “Make Eve read this dialogue and add it to intro.mp4.” |
| `skill-builder` | Creates a reusable private skill in this GrokBox only. | “Build a skill for producing our weekly project report.” |

You can also start a request with a skill name, such as `/debug`, `/deploy`, or
`/xai-tts`. To add a private capability, ask Grok to build a skill. Grok will
inspect the project, explain its work, and ask a focused question only when a
choice is genuinely needed.

## Add your own dialogue to Imagine videos

GrokBox includes an xAI Text-to-Speech skill. You do not need an API key or
`/login`.

1. If `/xai-tts` is missing after this update, click **Stop**, then **Open** on
   the dashboard once.
2. Open a terminal (`Ctrl+\``) and run `grok`.
3. Use the slash command or ask in plain English:

   ```text
   /xai-tts Eve says: We have to get to the ship before sunrise.

   Make Eve say “We have to get to the ship before sunrise,” then put that
   line on my video instead of the generated music.
   ```

Audio files land in the `tts/` folder in your workspace. When you point Grok
at a video, it writes a new `*-voiced.mp4` there and leaves the source intact.
Eve is the default; Ara, Leo, Rex, Orion, and Luna are also available. Ask
“what voices can you use?” for the live list. Speech can include `[pause]` or
`<whisper>this part</whisper>`.

Imagine still creates the picture or video. `/xai-tts` creates the speech and
can replace the video's generated audio with it.
