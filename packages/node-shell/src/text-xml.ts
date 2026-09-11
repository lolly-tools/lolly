// SPDX-License-Identifier: MPL-2.0
/** Browser and Node use the same bounded, single-document XML/XSD path. */
export async function xmlText(text: string, schema: string, format: boolean): Promise<string> {
  if (text.length > 1024 * 1024 || schema.length > 256 * 1024)
    throw new Error('Use XML up to 1 MiB and a schema up to 256 KiB.');
  if (/<!\s*(?:DOCTYPE|ENTITY)\b/i.test(text + schema))
    throw new Error('DTDs and entity declarations are not supported.');
  if (/<(?:[\w.-]+:)?(?:include|import|redefine)\b/i.test(schema))
    throw new Error('Use a self-contained XSD. External schemas are not loaded.');
  const { XmlDocument, XsdValidator, ParseOption } = await import('libxml2-wasm');
  const options = { option: ParseOption.XML_PARSE_NONET | ParseOption.XML_PARSE_NO_XXE };
  const doc = XmlDocument.fromString(text, options);
  try {
    if (schema.trim()) {
      const xsd = XmlDocument.fromString(schema, options);
      try {
        const validator = XsdValidator.fromDoc(xsd);
        try {
          validator.validate(doc);
        } finally {
          validator.dispose();
        }
      } finally {
        xsd.dispose();
      }
    }
    return format
      ? doc.toString({ format: true })
      : schema.trim()
        ? 'Valid against the supplied XSD schema.'
        : 'Well-formed XML. No schema was supplied.';
  } finally {
    doc.dispose();
  }
}
