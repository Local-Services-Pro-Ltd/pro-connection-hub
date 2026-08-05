# Hero visual regression

Compares the hero band of `/trades`, `/areas`, `/for-tradesmen` and
`/post-job` across Light and Dark themes at desktop (1280×900) and mobile
(390×844), so overlay gradients and focal crops can't drift unnoticed.

```bash
# with the dev server running on :8080
python3 tests/visual/hero_regression.py --update   # record baselines
python3 tests/visual/hero_regression.py            # compare
```

- Baselines: `tests/visual/baseline/`
- Latest run: `tests/visual/current/`
- Pixel diffs for failures: `tests/visual/diffs/`

A shot fails when more than 0.5% of its pixels change (tune `THRESHOLD`).
Re-run with `--update` after an intentional hero redesign.
