# Lolly and online file converters

_Last checked: 28 September 2026._

Lolly converts files in the browser on your own device: HEIC to JPG, PNG to SVG, PDF to images and many other combinations. See [every format Lolly can open and make](/info/formats.html) for the supported conversions and their limits.

## Where the conversion happens

A browser-based converter may upload a file for processing or convert locally. Lolly's on-device utilities process the file locally, with no account, ads or trackers. They add no Lolly watermark or provenance metadata. Once the required conversion assets are available, they can work offline; file size is bounded by the device's memory and the particular format reader.

Choose a converter by the formats and fidelity you need as well as where it processes the file. Some conversions preserve editable structure, while others flatten the result; Lolly's format pages describe those differences.

## When a team needs more

[lolly.work](https://lolly.work) is the Lolly project's separately deployed organisation service. It adds SSO, SCIM, shared catalogues, approvals, reporting and server rendering for supported production workflows. Both parts are open source under MPL-2.0. An organisation can use them together while its members keep using on-device utilities for local conversions.

The distinction matters for data handling: a local conversion keeps the file on the device, while choosing a shared upload, server render or delivery sends the relevant data to the configured services. The [combined-solution overview](/info/compare.html) explains the separation.
