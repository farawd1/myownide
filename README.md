# Judge0 IDE with AI Support

[![Judge0 IDE Screenshot](./.github/screenshot.png)](https://ide.judge0.com)

[![License](https://img.shields.io/github/license/judge0/ide?color=2185d0&style=flat-square)](https://github.com/judge0/ide/blob/master/LICENSE)
[![Release](https://img.shields.io/github/v/release/judge0/ide?color=2185d0&style=flat-square)](https://github.com/judge0/ide/releases)
[![Stars](https://img.shields.io/github/stars/judge0/ide?color=2185d0&style=flat-square)](https://github.com/judge0/ide/stargazers)

<a href="https://www.producthunt.com/posts/judge0-ide" target="_blank"><img src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=179885&theme=light" alt="" height="43px" /></a>

## About

[**Judge0 IDE**](https://ide.judge0.com) is a free and open-source online code editor that allows you to write and execute code from a rich set of languages. It's perfect for anybody who just wants to quickly write and run some code without opening a full-featured IDE on their computer. Moreover, it is also useful for teaching and learning or just trying out a new language.

Judge0 IDE is using [**Judge0**](https://ce.judge0.com) for executing the user's source code.

This version includes **AI support** using the Anthropic API. Press **Ctrl+I** to send your code or text to AI and get a response in the output panel.

### Features

- **Code Execution**: Run code in 40+ languages using Judge0
- **AI Assistance**: Press Ctrl+I to get AI help via Anthropic Claude
- **Dark Theme**: Modern dark theme for comfortable coding
- **Split View**: Editor on left, input/output on right

Visit https://ide.judge0.com, and enjoy happy coding. :)

## Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Running Locally

1. **Clone the repository**
   ```bash
   git clone https://github.com/judge0/ide.git
   cd ide
   ```

2. **Set up environment variables**
   
   Copy the example env file:
   ```bash
   cp backend/.env.example backend/.env
   ```
   
   Edit `backend/.env` and add your Anthropic API key:
   ```
   ANTHROPIC_API_KEY=your_api_key_here
   ```

3. **Install dependencies and start**
   
   ```bash
   # Install frontend (static files - no build needed)
   # Just serve the files from the root directory
   
   # Install and start backend
   cd backend
   npm install
   npm start
   ```

4. **Open the IDE**
   
   The frontend is served from the root directory. You can use any static file server:
   
   ```bash
   # Using Python
   cd /workspace/project/myownide
   python3 -m http.server 3000
   
   # Or using npx
   npx serve -p 3000
   ```
   
   Then open http://localhost:3000

### Using Docker

A `docker-compose.yml` is included for easy setup:

```bash
docker-compose up
```

This will start:
- Frontend on http://localhost:3000
- Backend API on http://localhost:3001

## Environment Variables

Create a `.env` file in the `backend` directory:

| Variable | Description | Default |
|----------|-------------|---------|
| `ANTHROPIC_API_KEY` | Your Anthropic API key | (required) |
| `ANTHROPIC_MODEL` | Model to use | `claude-3-5-sonnet-20241022` |
| `JUDGE0_API_URL` | Judge0 API URL | `https://ce.judge0.com` |
| `JUDGE0_API_KEY` | Optional Judge0 API key | (empty) |
| `PORT` | Backend server port | `3001` |
| `FRONTEND_ORIGIN` | Allowed frontend origin | `*` |
| `API_BASE_URL` | Base URL for frontend calls | `http://localhost:3001` |

## Usage

### Running Code

1. Select a language from the dropdown
2. Write your code in the editor
3. Click **Run Code** or press **Ctrl+Enter**
4. View output in the right panel

### AI Mode

1. Write code or a natural language prompt in the editor
2. Press **Ctrl+I** to send to AI
3. The editor will clear and the AI response appears in the output panel

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Ctrl+Enter | Run code |
| Ctrl+I | AI mode (send to Anthropic) |
| Ctrl+S | Save |
| Ctrl+O | Open file |
| Ctrl+` | Focus editor |

## API Endpoints

The backend provides these endpoints:

- `POST /api/ai` - Send prompt to Anthropic
- `POST /api/submit` - Submit code to Judge0
- `GET /api/submissions/:token` - Get submission result
- `GET /api/health` - Health check

## Community

Join our community - get help, share feedback, and contribute. Whether you're integrating Judge0, building with the API, or reporting bugs, your participation helps improve the project for everyone.

* [Visit Judge0 website](https://judge0.com)
* [Read Judge0 blog](https://blog.judge0.com)
* [Subscribe to Judge0 newsletter](https://newsletter.judge0.com)
* [Join Judge0 Discord server](https://discord.judge0.com)
* [Follow Judge0 on X](https://x.com/Judge0HQ)
* [Follow Judge0 on LinkedIn](https://www.linkedin.com/company/judge0)
* [Read Judge0 research paper](https://paper.judge0.com)
* [Watch Judge0 asciinema](https://asciinema.org/~hermanzdosilovic)
* [Report an issue](https://github.com/judge0/judge0/issues/new)
* [Contact Judge0 team via email](mailto:contact@judge0.com)
* [Schedule a meeting with Judge0 team](https://meet.judge0.com)

## Author and Contributors
Judge0 IDE was created by [Herman Zvonimir Došilović](https://github.com/hermanzdosilovic).

Thanks a lot to all [contributors](https://github.com/judge0/ide/graphs/contributors) for their contributions to this project.

## License
Judge0 IDE is licensed under the [MIT License](https://github.com/judge0/ide/blob/master/LICENSE).
