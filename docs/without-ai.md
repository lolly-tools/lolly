# Lolly without AI

Lolly does not write, draw or compose your work with a generative model. A tool is a template. You give the template your words, pictures and data, and Lolly sets them out the same way every time.

This page is for people who want no generated content in their files. It says what Lolly does in place of generation, where a model can appear and how to keep every one of them out.

<!--i:eti-layers-->
## Templates, not generation

- <!--i:layers--> **A tool is a template.** A designer builds a layout once and chooses which parts other people may change. When you render, Lolly fills that layout. Nothing in the layout is made up at that moment. [Share a design with rules](/info/create-a-tool.html) shows how a template is made.
- <!--i:document--> **Your inputs are the content.** The words are the ones you typed. The pictures are the ones you chose. A chart draws the numbers you gave.
- <!--i:eti-repeat--> **The same inputs make the same file.** One renderer runs in the browser, the apps and the terminal, so a link renders today as it will next year. [Determinism](/info/determinism.html) says how far that reaches into the bytes and what can change them.
- <!--i:palette--> **Your design system sets the look.** Colours, type and logos come from the values you set, not from a guess.

<!--i:eti-user-check-->
## You never need AI

Every tool renders with no model. No model is on your device until you ask for one, and Lolly works offline without any. Downloading a model is a request you start, as the [privacy policy](/info/privacy.html) records.

<!--i:eti-sliders-->
## Where a model can appear

A model runs in a few places, each one an action you start and can cancel. Each runs on your device. The result is saved as an ordinary file and the model is not asked again.

| You ask Lolly to... | What the model does | How the result is marked |
|---|---|---|
| Speak a script aloud | Makes a voice | AI-generated, with the GEN AI badge |
| Enlarge a small image | Infers detail that was not there | AI-generated composite, with the badge |
| Reword a sentence the text check flagged | Proposes words, which you accept or skip | AI-assisted, when you keep a proposed sentence |
| Sing a song's lyrics | Makes a singing voice | AI-generated, with the models listed |
| Remove a background | Finds the subject and keeps your own pixels | A plain edit |
| Give a photo depth | Estimates distance and moves your own pixels | No badge |
| Read the text in an image or a recording | Reads, and makes no media | Nothing |

The badge means that a model made up part of what you see or hear. It does not mean that a model was somewhere nearby. [Generated once, rendered the same](/info/ai-features.html) gives the test for each row.

<!--i:eti-info-->
## What is not a model

- <!--i:neurobeat--> **The music.** A tune comes from a station and a seed. The composer turns them into the same tune every time, on every device, and synthesised instruments play the notes. [Generated music](/info/generated-music.html) explains how.
- <!--i:wrench--> **Retouch and pixel-art scaling.** Both fill from the pixels that are already there. No model takes part.
- <!--i:check--> **Charts, diagrams, gradients, codes and layouts.** Each is drawn from your inputs by fixed rules.

<!--i:eti-search-->
## Content that AI made elsewhere

You can bring in a picture that a model made. Lolly reads what the file declares about its origin and carries that declaration into every file you make from the picture. Anyone who checks your file sees the GEN AI badge.

Lolly reads declarations. It does not claim to detect every generated picture. [What Lolly Verify checks](/info/what-verify-checks.html) lists what a check can and cannot show.

<!--i:eti-cpu-->
## AI agents

An agent can fill in a tool's inputs through the same template, with the same limits a person has. An agent cannot sign a file as you. [Input, not impersonation](/info/input-not-impersonation.html) draws that line. No agent takes part unless you connect one.

<!--i:eti-building-->
## For an organisation

On Lolly Work, managed AI is off by default. An admin has one switch for the whole deployment. [Manage organisation AI policy](/info/work-ai-policy.html) covers the switch and what it stops.

<!--i:eti-clipboard-->
## How Lolly itself was made

That is a different question from what Lolly puts in your files, and the answer is on record: [Was Lolly "vibe coded"?](/info/faq.html#faq-was-lolly-vibe-coded)

<!--i:eti-checklist-->
## Check this yourself

- Render the same link twice and compare the two files. [Determinism](/info/determinism.html#check-the-claim-yourself) gives the commands.
- Open any file in [Lolly Verify](/#/verify) and read what the file records about how it was made.
- [Our AI Stance](/info/ai-stance.html) gives the position behind this page.
