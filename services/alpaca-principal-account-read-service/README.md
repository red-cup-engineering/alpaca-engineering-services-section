# Historical Alpaca principal account reader

The standalone repository has one local checkout at
[the preserved legacy source](../../lib/legacy/alpaca-principal-account-read-service).
Its selected implementation is source revision 00221fd4b15b575a55e78a4502fd776f11afef32; the same store
also retains the complete published history through bc4f6e1b4094bb64df0f695c9bb1f79a06e9ad29.

[Alpaca Engine](https://github.com/red-cup-engineering/prediction-market-engineering-services-section/blob/main/services/alpaca-engine/src/principal-account-read.mjs) owns the current runtime implementation.
Existing consumers keep importing that implementation; this directory is
only a source reference and contains no package or re-export.
