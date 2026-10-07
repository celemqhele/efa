# Submit portal: allow uploading a screenshot instead of forced camera (2026-10-07)

Follow-up to `.opencode/context/submit-portal/portal-screenshot-required-message_2026-10-07.md`.
The file inputs in `app\submit-match\[code]\_portal.tsx` were `<input type="file" capture="environment">`,
which on mobile phones opens the camera directly and gives no option to pick from the gallery.

## What changed

Removed `capture="environment"` from both screenshot inputs (Result and Backdoor panels). The
inputs now keep `accept="image/*"` without a capture hint, so the native picker offers both
"Take Photo" and "Photo Library / Choose File".