# A digitally signed PDF and its unsigned original

`unsigned.pdf` is a two-page PDF saved with object streams. `signed.pdf` is the same
file with an incremental update that adds one signature field holding a real detached
PKCS#7 signature (`adbe.pkcs7.detached`, SHA-256) over the whole document, made with a
throwaway self-signed certificate (`CN=Fixture Signer`). `pdfsig signed.pdf` reports
"Signature is Valid" and "Total document signed". The private key was discarded.

`tests/pages-signed-pdf.test.ts` reads both.
