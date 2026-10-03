# Bottom-nav artwork

Tab icons are 3D object renders from [The Thiings Collection](https://www.thiings.co/things) (free-to-use),
downscaled to 96px and rendered via `NativeTabs.Trigger.Icon`'s `src` prop in `app/(tabs)/_layout.tsx`.

- `inventory.png` — Crate
- `shopping.png` — Shopping Cart
- `settings.png` — Gear

Note: these are full-color renders, so the selected state is conveyed by the
label color (`labelStyle.selected`) rather than an icon tint. Swap for
monochrome symbols if a tint is preferred.
