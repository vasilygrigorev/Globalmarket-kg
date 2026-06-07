# Global Market KG

Static storefront prototype for `globalmarket.kg`.

## Public site files

- `index.html`
- `styles.css`
- `app.js`
- `data/public-catalog.json`
- `assets/hero-shopfoto2-laundry.png`
- `assets/products/`

The private local inventory source is `data/catalog.json`; it is intentionally ignored by git because it contains internal stock and pricing fields.

To rebuild the public catalog after importing stock:

```bash
python3 scripts/build_public_catalog.py
```
