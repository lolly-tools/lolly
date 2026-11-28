# Lolly

<img src="icon.svg" alt="Lolly's green and white lollipop" width="80"/>

**Make graphics, documents and video from simple inputs.**

Pick a tool, add your words, pictures or data and download a finished file. Lolly is free and open source. It runs in your browser and you need no account.

[Open Lolly](https://lolly.tools) · [Make your first file](https://lolly.tools/info/start/make-something.html) · [Install](https://lolly.tools/info/install.html) · [iPhone and iPad](https://apps.apple.com/app/id6836763603) · [Releases](https://github.com/lolly-tools/lolly/releases) · [Documentation](https://lolly.tools/info/)

## How it works

1. **Pick a tool.** Each tool makes one kind of file, such as a QR code, a chart or a video.
2. **Fill in the fields.** Add your words, pictures or data.
3. **Download the file.** Take an image, a PDF, a slide deck or a video.

Making things happens on your device. What you make leaves your device only when you ask. The [privacy guide](docs/privacy.md) has the details.

## What can I make?

| I need to... | Try... |
| --- | --- |
| Make a QR code for a link | [Lolly QR Code](https://lolly.tools/t/qr-code) |
| Frame a screenshot for a post or presentation | [Lolly Frame](https://lolly.tools/t/frame) |
| Turn a recording into a video with a moving waveform | [Lolly Audiogram](https://lolly.tools/t/audiogram) |
| Turn data into a chart or diagram | [Lolly Chart](https://lolly.tools/t/chart) or [Lolly Diagrams](https://lolly.tools/t/diagram-builder) |
| Build a layout I can reuse | [Lolly Design](https://lolly.tools/t/design) |
| Remove hidden metadata or shrink a PDF | [Lolly Strip Hidden Data](https://lolly.tools/t/strip-data) or [Lolly Pages](https://lolly.tools/t/pages?operation=compress) |

[See every tool](TOOLS.md), or [make your first file](docs/make-something.md) with a QR code.

## Make it yours

Add your colours, fonts and logos once in **Lolly Design System Setup**. Every tool then uses them. You can also turn a layout of your own into a tool that other people fill in.

[Put your brand in](docs/quickstart.md) · [Import a design](docs/design-import.md) · [Share a design with rules](docs/create-a-tool.md)

## Run your own copy

The web app is plain static files, so any web server can host a copy. There are three ways to get one:

- **Install an app.** [Releases](https://github.com/lolly-tools/lolly/releases) has the packaged apps.
- **Host it for other people.** [Choose a deployment](docs/deployment.md) covers Kubernetes, a web server of your own and managed devices.
- **Build it from source:**

```bash
git clone https://github.com/lolly-tools/lolly.git
cd lolly
npm install --global pnpm@11.26.0
pnpm install
pnpm run dev:web
```

Then open <http://localhost:5173>. Lolly needs a browser with WebGPU. [Supported environments](docs/supported-environments.md) lists the tested browsers, and [INSTALL.md](INSTALL.md) has setup help.

## Go further

| I want to... | Read... |
| --- | --- |
| Make many files at once, or script them | [CLI guide](docs/cli.md) and [URL inputs](docs/url-mode.md) |
| Let an AI agent use the tools | [MCP server](docs/mcp.md) |
| Share assets, projects and approvals with a team | [Organisation guide](docs/organisation.md) and [Lolly Work](https://github.com/lolly-tools/lolly-work), the optional server |
| Check which file formats Lolly reads and writes | [Format guide](https://lolly.tools/info/create/formats.html) |
| Build a tool of my own | [Tool-authoring guide](docs/authoring-tools.md) |
| See how the parts fit together | [Architecture](docs/overview.md) and the [glossary](docs/glossary.md) |
| Know why Lolly exists | [What content sovereignty means](docs/content-sovereignty.md) and [Why Lolly is free](docs/faq.md) |

## Contributing

Lolly began at SUSE and is maintained as open source. Bug reports, documentation, tools and code are welcome. [CONTRIBUTING.md](CONTRIBUTING.md) covers setup and checks. Report security issues privately using [SECURITY.md](SECURITY.md).

## Licence

Code is [MPL-2.0](https://github.com/lolly-tools/lolly/blob/main/LICENSE). Documentation is [CC BY-SA 4.0](https://github.com/lolly-tools/lolly/blob/main/docs/LICENSE), with attribution to [lolly.tools](https://lolly.tools).

Brand packs, fonts and other third-party material keep their own licences. See [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md). SUSE's own brand pack is a separate private repository and is not part of a public clone.
