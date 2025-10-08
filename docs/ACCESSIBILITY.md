# Accessibility Guide

This project includes accessibility improvements and a checklist to keep it accessible.

## Implemented features

- ARIA live regions for progress and system messages (`aria-live="polite"`, `role="status"` for dynamic status updates).
- Messages container uses `role="log"` and `aria-live="polite"` so screen readers receive updates.
- Keyboard interactions: `Escape` cancels ongoing uploads (aborts XHR); `Enter` sends a prompt from the textarea (without shift).
- Focus-visible states for interactive controls and a clear focus outline for handles.
- Images include meaningful `alt` attributes.

## Checklist for contributions

- [ ] Ensure all interactive elements have accessible names (`aria-label` or visible text).
- [ ] Provide `alt` text for images; if decorative, use `alt=""` and `role="presentation"`.
- [ ] Verify color contrast using tools (WCAG AA minimum for normal text).
- [ ] Ensure dynamic updates use `aria-live` appropriately (avoid overly verbose messages).
- [ ] Test keyboard-only navigation and focus order.
- [ ] Run automated accessibility linting and manual testing with a screen reader.

## Tips to test locally

- Use Chrome/Edge devtools Lighthouse (Accessibility) to get a quick pass/fail.
- Test with NVDA (Windows) or VoiceOver (macOS) for workflows.
- Use `tab` key to traverse controls and ensure `focus-visible` is visible.


## Known issues / areas to improve

- Some color combinations marked as `text-muted-foreground` may be borderline in contrast — consider boosting for WCAG AA.
- Consider adding `skip to content` link and landmarks for deeper pages.


# Accessibility contact

If you find an accessibility issue, open an issue or PR with steps to reproduce and suggested fixes.
