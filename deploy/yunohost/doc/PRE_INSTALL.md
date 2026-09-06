Lolly needs a **whole domain** (for example `lolly.example.org`), because the app resolves its assets, its offline service worker and its short links from the domain root.

The on-device machine-learning models (background removal, upscaling, speech) are not bundled in this package. The app fetches them on first use from `https://lolli.li`, the project's release host, and keeps them in the browser afterwards. The optional Google Fonts picker in the brand editor contacts Google only when you use it. Everything else runs on the device.
