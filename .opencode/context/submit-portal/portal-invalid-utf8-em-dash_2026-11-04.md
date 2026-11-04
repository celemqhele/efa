# Fix invalid UTF-8 in submit-match portal

## What was done
Replaced a lone Windows-1252 byte `0x97` (an em dash) in `app/submit-match/[code]/_portal.tsx` with the proper UTF-8 em dash (`—`), unblocking the production build.

## Problem
`npm run build` failed with `stream did not contain valid UTF-8` at `app/submit-match/[code]/_portal.tsx` (position ~31709), inside the string `'This knockout match ended in a draw \x97 enter the penalty scores before submit'`. The source file contained a raw `0x97` byte instead of a UTF-8-encoded em dash, which webpack cannot parse as source.