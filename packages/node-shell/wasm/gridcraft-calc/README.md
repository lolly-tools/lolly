# GridCraft calculation adapter

Lolly's browser and Node shells use one committed `gridcraft-calc.wasm` to evaluate spreadsheet formulas: recalculating the formulas in an imported XLSX and computing cells that start with `=` in a tool's table input. The engine never loads the module. It takes a function the shell supplies, the way `readXlsx` takes `formatCell`, and tools reach it through the optional `host.calc` API.

The calculation engine is GridCraft's `gridcraft-calc`, `gridcraft-formula`, `gridcraft-functions` and `gridcraft-model` crates (MIT OR Apache-2.0) at commit `5e415cdd34d287b90a4a9df67eb4f532f6f72d96`, with `gridcraft-core` and `gridcraft-numfmt` shared from `../xlsx-numfmt/vendor`. Source, licence choices and modifications are under `vendor/`. The Lolly byte adapter in `src/lib.rs` is MPL-2.0.

The module imports nothing from the host. The clock (`now`, milliseconds since the Unix epoch) and the random seed arrive in each request, so the same request always returns the same bytes. Volatile functions (NOW, TODAY, RAND, RANDBETWEEN, RANDARRAY, OFFSET, INDIRECT, INFO, CELL) therefore stay live only because the caller passes a fresh clock and seed; an export keeps the values it computed.

The three REGEX functions are left out, because the regex engine with its Unicode tables roughly doubles the module. A formula that calls one evaluates to `#NAME?`.

The raw ABI is `gridcraft_calc_alloc`, `_free`, `_run(ptr, len, op)`, `_result_ptr` and `_result_len`. Operation 1 evaluates sheets, operation 2 lists the functions. Rebuild with `pnpm run build:gridcraft-calc`. Run the vendored crates' own tests with `cargo test --workspace` in this directory.

## Size and limits

The committed module is 1,235,331 bytes raw and about 414,000 bytes gzipped, inside the 1.5 MB raw or 600 KB gzip budget. With the three regular-expression functions the module was 2.1 MB raw and 700 KB gzipped, so they are left out (the `regex` feature of the vendored `gridcraft-functions` is off). The web shell fetches the module the first time a formula needs working out. A request is limited to 64 sheets, 400,000 cells and 100,000 formulas; an array over 4,194,304 cells is `#NUM!` and a cell that makes more than 100,000 lambda calls is `#CALC!`. The module aborts instead of unwinding, so the transport drops an instance that traps and starts a fresh one.

Formulas the caller marks `legacy` (a cell from a file without the dynamic-array mark) are rewritten before evaluation with the implicit-intersection operator `@` on operands, scalar function arguments and the result, which is how a program without dynamic arrays read them.

## Functions

Every function the module knows, by category, as `host.calc.functions()` lists them. `Special` are the functions the evaluator implements itself.

```
AddIn (1): EUROCONVERT

Compatibility (43): BETADIST, BETAINV, BINOMDIST, CEILING, CHIDIST, CHIINV, CHITEST, CONFIDENCE, COVAR, CRITBINOM, ECMA.CEILING, EXPONDIST, FDIST, FINV, FLOOR, FORECAST, FTEST, GAMMADIST, GAMMAINV, HYPGEOMDIST, LOGINV, LOGNORMDIST, MODE, NEGBINOMDIST, NORMDIST, NORMINV, NORMSDIST, NORMSINV, PERCENTILE, PERCENTRANK, POISSON, QUARTILE, RANK, STDEV, STDEVP, TDIST, TINV, TTEST, USDOLLAR, VAR, VARP, WEIBULL, ZTEST

Cube (7): CUBEKPIMEMBER, CUBEMEMBER, CUBEMEMBERPROPERTY, CUBERANKEDMEMBER, CUBESET, CUBESETCOUNT, CUBEVALUE

Database (12): DAVERAGE, DCOUNT, DCOUNTA, DGET, DMAX, DMIN, DPRODUCT, DSTDEV, DSTDEVP, DSUM, DVAR, DVARP

DateTime (25): DATE, DATEDIF, DATEVALUE, DAY, DAYS, DAYS360, EDATE, EOMONTH, HOUR, ISOWEEKNUM, MINUTE, MONTH, NETWORKDAYS, NETWORKDAYS.INTL, NOW, SECOND, TIME, TIMEVALUE, TODAY, WEEKDAY, WEEKNUM, WORKDAY, WORKDAY.INTL, YEAR, YEARFRAC

Engineering (54): BESSELI, BESSELJ, BESSELK, BESSELY, BIN2DEC, BIN2HEX, BIN2OCT, BITAND, BITLSHIFT, BITOR, BITRSHIFT, BITXOR, COMPLEX, CONVERT, DEC2BIN, DEC2HEX, DEC2OCT, DELTA, ERF, ERF.PRECISE, ERFC, ERFC.PRECISE, GESTEP, HEX2BIN, HEX2DEC, HEX2OCT, IMABS, IMAGINARY, IMARGUMENT, IMCONJUGATE, IMCOS, IMCOSH, IMCOT, IMCSC, IMCSCH, IMDIV, IMEXP, IMLN, IMLOG10, IMLOG2, IMPOWER, IMPRODUCT, IMREAL, IMSEC, IMSECH, IMSIN, IMSINH, IMSQRT, IMSUB, IMSUM, IMTAN, OCT2BIN, OCT2DEC, OCT2HEX

Financial (55): ACCRINT, ACCRINTM, AMORDEGRC, AMORLINC, COUPDAYBS, COUPDAYS, COUPDAYSNC, COUPNCD, COUPNUM, COUPPCD, CUMIPMT, CUMPRINC, DB, DDB, DISC, DOLLARDE, DOLLARFR, DURATION, EFFECT, FV, FVSCHEDULE, INTRATE, IPMT, IRR, ISPMT, MDURATION, MIRR, NOMINAL, NPER, NPV, ODDFPRICE, ODDFYIELD, ODDLPRICE, ODDLYIELD, PDURATION, PMT, PPMT, PRICE, PRICEDISC, PRICEMAT, PV, RATE, RECEIVED, RRI, SLN, SYD, TBILLEQ, TBILLPRICE, TBILLYIELD, VDB, XIRR, XNPV, YIELD, YIELDDISC, YIELDMAT

Information (16): ERROR.TYPE, HYPERLINK, INFO, ISBLANK, ISERR, ISERROR, ISEVEN, ISLOGICAL, ISNA, ISNONTEXT, ISNUMBER, ISODD, ISTEXT, N, NA, TYPE

Logical (11): AND, FALSE, IF, IFERROR, IFNA, IFS, NOT, OR, SWITCH, TRUE, XOR

Lookup (29): ADDRESS, CHOOSE, CHOOSECOLS, CHOOSEROWS, COLUMNS, DROP, EXPAND, FILTER, GROUPBY, HLOOKUP, HSTACK, INDEX, LOOKUP, MATCH, PIVOTBY, ROWS, SORT, SORTBY, TAKE, TOCOL, TOROW, TRANSPOSE, UNIQUE, VLOOKUP, VSTACK, WRAPCOLS, WRAPROWS, XLOOKUP, XMATCH

MathTrig (78): ABS, ACOS, ACOSH, ACOT, ACOTH, ARABIC, ASIN, ASINH, ATAN, ATAN2, ATANH, BASE, CEILING.MATH, CEILING.PRECISE, COMBIN, COMBINA, COS, COSH, COT, COTH, CSC, CSCH, DECIMAL, DEGREES, EVEN, EXP, FACT, FACTDOUBLE, FLOOR.MATH, FLOOR.PRECISE, GCD, INT, ISO.CEILING, LCM, LN, LOG, LOG10, MDETERM, MINVERSE, MMULT, MOD, MROUND, MULTINOMIAL, MUNIT, ODD, PERCENTOF, PI, POWER, PRODUCT, QUOTIENT, RADIANS, RAND, RANDARRAY, RANDBETWEEN, ROMAN, ROUND, ROUNDDOWN, ROUNDUP, SEC, SECH, SEQUENCE, SERIESSUM, SIGN, SIN, SINH, SQRT, SQRTPI, SUM, SUMIF, SUMIFS, SUMPRODUCT, SUMSQ, SUMX2MY2, SUMX2PY2, SUMXMY2, TAN, TANH, TRUNC

Special (24): AGGREGATE, AREAS, BYCOL, BYROW, CELL, COLUMN, FORMULATEXT, INDIRECT, ISFORMULA, ISOMITTED, ISREF, LAMBDA, LET, MAKEARRAY, MAP, OFFSET, REDUCE, ROW, SCAN, SHEET, SHEETS, SUBTOTAL, TEXT, TRIMRANGE

Statistical (110): AVEDEV, AVERAGE, AVERAGEA, AVERAGEIF, AVERAGEIFS, BETA.DIST, BETA.INV, BINOM.DIST, BINOM.DIST.RANGE, BINOM.INV, CHISQ.DIST, CHISQ.DIST.RT, CHISQ.INV, CHISQ.INV.RT, CHISQ.TEST, CONFIDENCE.NORM, CONFIDENCE.T, CORREL, COUNT, COUNTA, COUNTBLANK, COUNTIF, COUNTIFS, COVARIANCE.P, COVARIANCE.S, DEVSQ, EXPON.DIST, F.DIST, F.DIST.RT, F.INV, F.INV.RT, F.TEST, FISHER, FISHERINV, FORECAST.ETS, FORECAST.ETS.CONFINT, FORECAST.ETS.SEASONALITY, FORECAST.ETS.STAT, FORECAST.LINEAR, FREQUENCY, GAMMA, GAMMA.DIST, GAMMA.INV, GAMMALN, GAMMALN.PRECISE, GAUSS, GEOMEAN, GROWTH, HARMEAN, HYPGEOM.DIST, INTERCEPT, KURT, LARGE, LINEST, LOGEST, LOGNORM.DIST, LOGNORM.INV, MAX, MAXA, MAXIFS, MEDIAN, MIN, MINA, MINIFS, MODE.MULT, MODE.SNGL, NEGBINOM.DIST, NORM.DIST, NORM.INV, NORM.S.DIST, NORM.S.INV, PEARSON, PERCENTILE.EXC, PERCENTILE.INC, PERCENTRANK.EXC, PERCENTRANK.INC, PERMUT, PERMUTATIONA, PHI, POISSON.DIST, PROB, QUARTILE.EXC, QUARTILE.INC, RANK.AVG, RANK.EQ, RSQ, SKEW, SKEW.P, SLOPE, SMALL, STANDARDIZE, STDEV.P, STDEV.S, STDEVA, STDEVPA, STEYX, T.DIST, T.DIST.2T, T.DIST.RT, T.INV, T.INV.2T, T.TEST, TREND, TRIMMEAN, VAR.P, VAR.S, VARA, VARPA, WEIBULL.DIST, Z.TEST

Text (44): ARRAYTOTEXT, ASC, BAHTTEXT, CHAR, CLEAN, CODE, CONCAT, CONCATENATE, DBCS, DOLLAR, EXACT, FIND, FINDB, FIXED, JIS, LEFT, LEFTB, LEN, LENB, LOWER, MID, MIDB, NUMBERVALUE, PHONETIC, PROPER, REPLACE, REPLACEB, REPT, RIGHT, RIGHTB, SEARCH, SEARCHB, SUBSTITUTE, T, TEXTAFTER, TEXTBEFORE, TEXTJOIN, TEXTSPLIT, TRIM, UNICHAR, UNICODE, UPPER, VALUE, VALUETOTEXT

Web (3): ENCODEURL, FILTERXML, WEBSERVICE
```

Volatile: `CELL`, `INDIRECT`, `INFO`, `NOW`, `OFFSET`, `RAND`, `RANDARRAY`, `RANDBETWEEN`, `TODAY`.

Left out: `REGEXTEST`, `REGEXEXTRACT`, `REGEXREPLACE`.

## Checks

`tests/gridcraft-calc.test.ts` covers the module, the table convention and the XLSX recalculation. `node scripts/xlsx-formula-corpus.ts --fetch` downloads 16 Excel-saved workbooks from Apache POI's test data (Apache-2.0, pinned commit and SHA-256 per file) into `plans/corpora/`, and `node scripts/xlsx-formula-corpus.ts` recalculates every sheet and compares each cell with the saved result: 63,404 cells, 1,389 formulas, 8 known differences listed in `scripts/data/xlsx-formula-corpus.json`. The fuzz target `formula-calc` mutates formula text and request bodies.
